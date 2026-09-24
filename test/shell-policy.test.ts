import assert from "node:assert/strict";
import { test } from "node:test";

import {
  commandRiskOutcome,
  decideShellInvocation,
  shellOutcomeContributions,
  type ShellPolicyInputs,
} from "../src/policy/shell-policy.ts";
import { isDeniedRisk, strictestShellRisk } from "../src/policy/shell-commands.ts";
import { isLoadedPolicySources, loadOperationPolicySources } from "../src/policy/config-loader.ts";
import { resolveWorkspacePath } from "../src/policy/paths.ts";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

function inputs(overrides: Partial<ShellPolicyInputs> = {}): ShellPolicyInputs {
  return {
    readOutcome: "ALLOW",
    mutationOutcome: "ALLOW",
    configurationInvalid: false,
    refusals: [],
    commandRisk: "ordinary",
    commandRiskReasons: [],
    riskClasses: ["ordinary"],
    network: { status: "closed", entries: [], unapprovedTargets: [] },
    resourceOutcomes: [],
    ...overrides,
  };
}

test("an ordinary invocation with ordinary outcomes is allowed", () => {
  const decision = decideShellInvocation(inputs());
  assert.equal(decision.decision, "ALLOW");
  assert.equal(decision.reason, "SHELL_INVOCATION_ALLOWED");
});

test("an ASK read or mutation outcome requires approval for every invocation", () => {
  for (const override of [{ readOutcome: "ASK" as const }, { mutationOutcome: "ASK" as const }]) {
    const decision = decideShellInvocation(inputs(override));
    assert.equal(decision.decision, "ASK", JSON.stringify(override));
    assert.equal(decision.reason, "SHELL_APPROVAL_REQUIRED");
  }
  // A command name that looks read-only does not waive the requirement: the
  // decision is identical for `ls` and for any other ordinary command.
  const listed = decideShellInvocation(inputs({ readOutcome: "ASK", commandRisk: "ordinary" }));
  assert.equal(listed.decision, "ASK");
});

test("unknown and destructive command classes require approval, never a bypass", () => {
  assert.equal(commandRiskOutcome("unknown"), "ASK");
  assert.equal(commandRiskOutcome("destructive"), "ASK");
  assert.equal(commandRiskOutcome("ordinary"), "ALLOW");
  for (const risk of ["network", "privilege", "system", "credential", "publish", "unsupported-builtin"] as const) {
    assert.equal(commandRiskOutcome(risk), "DENY");
    assert.equal(isDeniedRisk(risk), true);
    const decision = decideShellInvocation(
      inputs({ commandRisk: risk, riskClasses: [risk], commandRiskReasons: [`${risk} denied`] }),
    );
    assert.equal(decision.decision, "DENY", risk);
    assert.equal(decision.reason, "SHELL_COMMAND_DENIED");
  }
});

test("DENY always wins over ALLOW and ASK inputs", () => {
  const deniedRead = decideShellInvocation(inputs({ readOutcome: "DENY" }));
  assert.equal(deniedRead.decision, "DENY");
  assert.equal(deniedRead.reason, "SHELL_POLICY_DENIED");

  const deniedMutation = decideShellInvocation(inputs({ mutationOutcome: "DENY", readOutcome: "ASK" }));
  assert.equal(deniedMutation.decision, "DENY");

  const deniedResource = decideShellInvocation(
    inputs({ resourceOutcomes: [{ kind: "read", logicalPath: ".env", decision: "DENY", reason: "env-file" }] }),
  );
  assert.equal(deniedResource.decision, "DENY");
  assert.equal(deniedResource.reason, "SHELL_RESOURCE_DENIED");
  assert.match(deniedResource.detail, /env-file/);

  const invalid = decideShellInvocation(inputs({ configurationInvalid: true, readOutcome: "ASK" }));
  assert.equal(invalid.decision, "DENY");
  assert.equal(invalid.reason, "SHELL_CONFIGURATION_INVALID");

  const unsupported = decideShellInvocation(
    inputs({ refusals: [{ code: "SHELL_UNSUPPORTED_EXPANSION", detail: "expansion is unsupported" }] }),
  );
  assert.equal(unsupported.decision, "DENY");
  assert.equal(unsupported.reason, "SHELL_UNSUPPORTED_INPUT");

  // A denied command class outranks an otherwise allowed policy.
  const classDenied = decideShellInvocation(
    inputs({
      commandRisk: "network",
      riskClasses: ["network"],
      network: { status: "closed", entries: [], unapprovedTargets: [] },
      commandRiskReasons: ["curl: network command is denied"],
      readOutcome: "ALLOW",
    }),
  );
  assert.equal(classDenied.decision, "DENY");
  assert.equal(classDenied.reason, "SHELL_COMMAND_DENIED");

  // With a composed scope a network command is not class-denied; the scope and
  // the representable destinations govern it instead.
  const networkAllowed = decideShellInvocation(
    inputs({
      commandRisk: "network",
      riskClasses: ["network"],
      network: { status: "open", entries: ["registry.npmjs.org:443"], unapprovedTargets: [] },
      readOutcome: "ALLOW",
    }),
  );
  assert.equal(networkAllowed.decision, "ALLOW");
  const networkUnapproved = decideShellInvocation(
    inputs({
      commandRisk: "network",
      riskClasses: ["network"],
      network: { status: "open", entries: ["registry.npmjs.org:443"], unapprovedTargets: ["example.com:443"] },
      readOutcome: "ALLOW",
    }),
  );
  assert.equal(networkUnapproved.decision, "ASK");
  assert.equal(networkUnapproved.reason, "SHELL_APPROVAL_REQUIRED");
  assert.match(networkUnapproved.detail, /example\.com:443/);

  // A per-command denied class in the same command line still denies even when
  // a network command is scope-allowed.
  const mixedDenied = decideShellInvocation(
    inputs({
      commandRisk: "network",
      riskClasses: ["network", "privilege"],
      network: { status: "open", entries: ["registry.npmjs.org:443"], unapprovedTargets: [] },
      readOutcome: "ALLOW",
    }),
  );
  assert.equal(mixedDenied.decision, "DENY");
  assert.equal(mixedDenied.reason, "SHELL_COMMAND_DENIED");
});

test("strictest risk merging is monotone", () => {
  assert.equal(strictestShellRisk("ordinary", "ordinary"), "ordinary");
  assert.equal(strictestShellRisk("ordinary", "unknown"), "unknown");
  assert.equal(strictestShellRisk("unknown", "destructive"), "destructive");
  assert.equal(strictestShellRisk("destructive", "network"), "network");
  assert.equal(strictestShellRisk("network", "network"), "network");
  assert.equal(strictestShellRisk("ordinary", "publish"), "publish");
});

async function loadedFor(projectPolicy: string | undefined) {
  const root = await mkdtemp(path.join(tmpdir(), "piw-policy-"));
  const userRoot = path.join(root, "user");
  const workspace = path.join(root, "ws");
  await mkdir(userRoot);
  await mkdir(workspace);
  if (projectPolicy !== undefined) {
    await mkdir(path.join(workspace, ".pi-warden"));
    await writeFile(path.join(workspace, ".pi-warden", "policy.json"), projectPolicy);
  }
  const resolved = await resolveWorkspacePath(workspace, ".");
  const loaded = await loadOperationPolicySources(resolved, userRoot);
  return { root, loaded, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("shell outcomes come from the accepted policy contributions only", async () => {
  const absent = await loadedFor(undefined);
  try {
    assert.equal(isLoadedPolicySources(absent.loaded), true);
    const contributions = shellOutcomeContributions(absent.loaded);
    assert.deepEqual(
      { read: contributions.read, mutation: contributions.mutation, invalid: contributions.invalid },
      { read: "ALLOW", mutation: "ALLOW", invalid: false },
    );
  } finally {
    await absent.cleanup();
  }

  const restricted = await loadedFor(
    JSON.stringify({ version: 1, operations: { read: "ASK", write: "DENY", edit: "ASK" } }) + "\n",
  );
  try {
    const contributions = shellOutcomeContributions(restricted.loaded);
    assert.equal(contributions.read, "ASK");
    assert.equal(contributions.mutation, "DENY", "strictest of write and edit constrains all mutations");
    const decision = decideShellInvocation(
      inputs({ readOutcome: contributions.read, mutationOutcome: contributions.mutation }),
    );
    assert.equal(decision.decision, "DENY");
  } finally {
    await restricted.cleanup();
  }

  const askMutation = await loadedFor(JSON.stringify({ version: 1, operations: { edit: "ASK" } }) + "\n");
  try {
    const contributions = shellOutcomeContributions(askMutation.loaded);
    assert.equal(contributions.read, "ALLOW");
    assert.equal(contributions.mutation, "ASK", "the edit contribution constrains shell mutations");
  } finally {
    await askMutation.cleanup();
  }
});

test("invalid configuration denies both shell outcomes", async () => {
  const invalid = await loadedFor("{ not json }\n");
  try {
    const contributions = shellOutcomeContributions(invalid.loaded);
    assert.equal(contributions.invalid, true);
    assert.equal(contributions.read, "DENY");
    assert.equal(contributions.mutation, "DENY");
  } finally {
    await invalid.cleanup();
  }

  const wrongVersion = await loadedFor(JSON.stringify({ version: 2, operations: { read: "ALLOW" } }) + "\n");
  try {
    const contributions = shellOutcomeContributions(wrongVersion.loaded);
    assert.equal(contributions.invalid, true);
    assert.equal(contributions.read, "DENY");
  } finally {
    await wrongVersion.cleanup();
  }
});

test("a forged source set cannot contribute to shell outcomes", () => {
  const forged = { user: { status: "valid", policy: {} }, project: { status: "absent" } };
  const contributions = shellOutcomeContributions(forged as never);
  assert.equal(contributions.invalid, true);
  assert.equal(contributions.read, "DENY");
  assert.equal(contributions.mutation, "DENY");
});
test("a protected or denied export target denies the shell invocation even with an open network scope", () => {
  const denied = decideShellInvocation(
    inputs({
      network: { status: "open", entries: ["registry.npmjs.org:443"], unapprovedTargets: [] },
      resourceOutcomes: [{ kind: "read", logicalPath: ".env", decision: "DENY", reason: "env-file" }],
    }),
  );
  assert.equal(denied.decision, "DENY");
  assert.equal(denied.reason, "SHELL_RESOURCE_DENIED");

  const invalid = decideShellInvocation(
    inputs({
      network: { status: "open", entries: ["registry.npmjs.org:443"], unapprovedTargets: [] },
      readOutcome: "ALLOW",
      mutationOutcome: "ALLOW",
      configurationInvalid: true,
    }),
  );
  assert.equal(invalid.decision, "DENY");
  assert.equal(invalid.reason, "SHELL_CONFIGURATION_INVALID");
});
