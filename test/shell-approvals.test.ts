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
    "closed networking",
    "no access to the original workspace",
    "deletions and renames",
    "expires in 60 seconds",
    "does not widen containment",
  ]) {
    assert.ok(prompt.message.includes(fragment), `prompt must state: ${fragment}`);
  }
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
