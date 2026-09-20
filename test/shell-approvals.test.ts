import assert from "node:assert/strict";
import { test } from "node:test";

import {
  consumeShellApproval,
  requestShellApproval,
  shellBindingsSha256,
  shellApprovalPrompt,
  SHELL_APPROVAL_TTL_MS,
  type ShellApprovalBindings,
  type ShellApprovalGrant,
} from "../src/approvals/shell-approvals.ts";

function bindings(overrides: Partial<ShellApprovalBindings> = {}): ShellApprovalBindings {
  return {
    commandSha256: "a".repeat(64),
    parsedFormSha256: "b".repeat(64),
    workspaceRoot: "/ws",
    cwd: "/ws/.runtime/staging",
    instanceId: "instance-1",
    sessionEpoch: 1,
    policySha256: "c".repeat(64),
    profileSha256: "d".repeat(64),
    environmentSha256: "e".repeat(64),
    sealedInputSha256: ["f".repeat(64)],
    resourceOutcomes: ["read:data.txt=ALLOW(WORKSPACE_READ)"],
    networkScopeSha256: "0".repeat(64),
    networkDestinations: [],
    ...overrides,
  };
}

const grantingUI = {
  hasUI: true,
  confirm: async () => true,
};

test("an approval prompt states the exact effects and boundaries", () => {
  const prompt = shellApprovalPrompt({
    bindings: bindings(),
    presentation: {
      command: "npm run check",
      workspaceRoot: "/ws",
      cwd: "/ws/.runtime/staging",
      commandRisk: "ordinary",
      readOutcome: "ALLOW",
      mutationOutcome: "ALLOW",
      networkDestinations: [],
      projectionSummary: "10 files, 2 directories",
      sealedInputs: [{ original: "scripts/build.sh", sha256: "1".repeat(64) }],
    },
  });
  assert.equal(prompt.title, "pi-warden shell permission request");
  for (const fragment of [
    "npm run check",
    "ordinary",
    "effective read outcome: ALLOW",
    "effective mutation outcome: ALLOW",
    "network scope: closed (no destinations approved",
    "no access to the original workspace",
    "deletions and renames",
    "expires in 60 seconds",
    "does not widen containment",
    "permitted destinations can receive any data the command can read",
  ]) {
    assert.ok(prompt.message.includes(fragment), `prompt must state: ${fragment}`);
  }
});

test("an approval prompt states the enforced destinations when a scope exists", () => {
  const prompt = shellApprovalPrompt({
    bindings: bindings({ networkDestinations: ["registry.npmjs.org:443"] }),
    presentation: {
      command: "npm install ms",
      workspaceRoot: "/ws",
      cwd: "/ws/.runtime/staging",
      commandRisk: "network",
      readOutcome: "ALLOW",
      mutationOutcome: "ALLOW",
      networkDestinations: ["registry.npmjs.org:443"],
      projectionSummary: "10 files, 2 directories",
      sealedInputs: [],
    },
  });
  assert.ok(prompt.message.includes("outbound TCP to exactly: registry.npmjs.org:443"));
  assert.ok(prompt.message.includes("network scope: outbound TCP to exactly"));
  assert.ok(prompt.message.includes("all other destinations fail closed"));
  assert.ok(!prompt.message.includes("network scope: closed"));
});

test("a grant is usable exactly once and only for its exact bindings", async () => {
  const approved = bindings();
  const outcome = await requestShellApproval(grantingUI, {
    bindings: approved,
    presentation: {
      command: "ls",
      workspaceRoot: "/ws",
      cwd: "/ws/.runtime/staging",
      commandRisk: "ordinary",
      readOutcome: "ASK",
      mutationOutcome: "ALLOW",
      networkDestinations: [],
      projectionSummary: "1 file",
      sealedInputs: [],
    },
  });
  assert.equal(outcome.status, "granted");
  if (outcome.status !== "granted") throw new Error("unreachable");
  const grant = outcome.grant;

  const first = consumeShellApproval(grant, approved, grant.grantedAtMs + 1_000);
  assert.equal(first.ok, true);
  const replay = consumeShellApproval(grant, approved, grant.grantedAtMs + 1_001);
  assert.equal(replay.ok, false);
  assert.match(replay.ok === false ? replay.reason : "", /already consumed/);
});

test("the bound network scope distinguishes grants: a different destination set never consumes", async () => {
  const approved = bindings({ networkDestinations: ["registry.npmjs.org:443"] });
  const outcome = await requestShellApproval(grantingUI, {
    bindings: approved,
    presentation: {
      command: "npm install ms",
      workspaceRoot: "/ws",
      cwd: "/ws/.runtime/staging",
      commandRisk: "network",
      readOutcome: "ALLOW",
      mutationOutcome: "ALLOW",
      networkDestinations: ["registry.npmjs.org:443"],
      projectionSummary: "1 file",
      sealedInputs: [],
    },
  });
  assert.equal(outcome.status, "granted");
  if (outcome.status !== "granted") throw new Error("unreachable");
  const grant = outcome.grant;

  // A different enforced scope is a different binding: the grant cannot
  // authorize a run whose enforced destinations differ in any way.
  for (const changed of [
    bindings({ networkDestinations: ["registry.npmjs.org:443", "example.com:443"] }),
    bindings({ networkDestinations: ["registry.npmjs.org:8443"] }),
    bindings({ networkDestinations: [] }),
    bindings({ networkScopeSha256: "1".repeat(64), networkDestinations: ["registry.npmjs.org:443"] }),
  ]) {
    const refused = consumeShellApproval(grant, changed, grant.grantedAtMs + 1);
    assert.equal(refused.ok, false, JSON.stringify(changed.networkDestinations));
    assert.match(refused.ok === false ? refused.reason : "", /binding changed/);
  }
  // The exact bindings still consume.
  const exact = consumeShellApproval(grant, approved, grant.grantedAtMs + 1_000);
  assert.equal(exact.ok, true);
});

test("every bound input change invalidates the grant", async () => {
  const approved = bindings();
  const outcome = await requestShellApproval(grantingUI, {
    bindings: approved,
    presentation: {
      command: "ls",
      workspaceRoot: "/ws",
      cwd: "/ws/.runtime/staging",
      commandRisk: "ordinary",
      readOutcome: "ASK",
      mutationOutcome: "ALLOW",
      networkDestinations: [],
      projectionSummary: "1 file",
      sealedInputs: [],
    },
  });
  if (outcome.status !== "granted") throw new Error("unreachable");

  const mutations: readonly Partial<ShellApprovalBindings>[] = [
    { commandSha256: "1".repeat(64) },
    { parsedFormSha256: "2".repeat(64) },
    { workspaceRoot: "/other" },
    { cwd: "/other/staging" },
    { instanceId: "instance-2" },
    { sessionEpoch: 2 },
    { policySha256: "3".repeat(64) },
    { profileSha256: "4".repeat(64) },
    { environmentSha256: "5".repeat(64) },
    { sealedInputSha256: ["6".repeat(64)] },
    { resourceOutcomes: ["read:data.txt=DENY(SECRET_RESOURCE)"] },
  ];
  for (const mutation of mutations) {
    const result = consumeShellApproval(outcome.grant, bindings(mutation), outcome.grant.grantedAtMs + 1);
    assert.equal(result.ok, false, `mutation ${JSON.stringify(mutation)} must invalidate the grant`);
    assert.match(result.ok === false ? result.reason : "", /binding changed/);
  }
});

test("expiry, forged and absent grants fail closed", async () => {
  const approved = bindings();
  const outcome = await requestShellApproval(grantingUI, {
    bindings: approved,
    presentation: {
      command: "ls",
      workspaceRoot: "/ws",
      cwd: "/ws/.runtime/staging",
      commandRisk: "ordinary",
      readOutcome: "ASK",
      mutationOutcome: "ALLOW",
      networkDestinations: [],
      projectionSummary: "1 file",
      sealedInputs: [],
    },
  });
  if (outcome.status !== "granted") throw new Error("unreachable");

  const expired = consumeShellApproval(outcome.grant, approved, outcome.grant.grantedAtMs + SHELL_APPROVAL_TTL_MS + 1);
  assert.equal(expired.ok, false);
  assert.match(expired.ok === false ? expired.reason : "", /expired/);

  const missing = consumeShellApproval(undefined, approved, Date.now());
  assert.equal(missing.ok, false);

  for (const forged of [
    { kind: "shell-grant", bindingsSha256: "0".repeat(64), grantedAtMs: Date.now() },
    { kind: "shell-grant", bindingsSha256: shellBindingsSha256(approved), grantedAtMs: Date.now() },
  ] as ShellApprovalGrant[]) {
    const result = consumeShellApproval(forged, approved, Date.now());
    assert.equal(result.ok, false, "a forged grant must never be accepted");
  }
});

test("missing UI, refusal, malformed responses and throws all fail closed", async () => {
  const request = {
    bindings: bindings(),
    presentation: {
      command: "ls",
      workspaceRoot: "/ws",
      cwd: "/ws/.runtime/staging",
      commandRisk: "ordinary" as const,
      readOutcome: "ASK" as const,
      mutationOutcome: "ALLOW" as const,
      networkDestinations: [],
      projectionSummary: "1 file",
      sealedInputs: [],
    },
  };
  assert.equal((await requestShellApproval(undefined, request)).status, "unavailable");
  assert.equal((await requestShellApproval({ hasUI: false, confirm: async () => true }, request)).status, "unavailable");
  assert.equal((await requestShellApproval({ hasUI: true, confirm: async () => false }, request)).status, "refused");
  assert.equal(
    (await requestShellApproval({ hasUI: true, confirm: async () => "yes" as unknown as boolean }, request)).status,
    "malformed",
  );
  assert.equal(
    (
      await requestShellApproval(
        {
          hasUI: true,
          confirm: async () => {
            throw new Error("host timeout");
          },
        },
        request,
      )
    ).status,
    "refused",
  );
});
