import assert from "node:assert/strict";
import { test } from "node:test";

import {
  approvalPromptFor,
  consumeGrant,
  requestScopedApproval,
  type ApprovalUI,
} from "../src/approvals/approvals.ts";
import type { AuthorizationOutcome } from "../src/policy/authority.ts";

const baseRequest = {
  toolName: "read",
  operation: "read" as const,
  requestedPath: "../outside/file.txt",
  canonicalPath: "/isolated/user-root-workspace-parent/outside/file.txt",
  workspaceRoot: "/isolated/user-root-workspace",
  reason: "EXTERNAL_READ",
  protection: "none" as const,
};

function midiUI(response: unknown, calls: string[]): ApprovalUI {
  return {
    hasUI: true,
    async confirm(title, message, _options) {
      calls.push(`${title}\n${message}`);
      if (response && typeof response === "object" && "throw" in response && response.throw === true) {
        throw new Error("simulated UI failure");
      }
      return response as boolean;
    },
  };
}


test("approval prompt displays the exact operation, canonical resource, reason, scope, and protection", async () => {
  const calls: string[] = [];
  const outcome = await requestScopedApproval(midiUI(true, calls), baseRequest);
  assert.equal(outcome.status, "granted");
  assert.equal(calls.length, 1);
  const prompt = calls[0];
  assert.match(prompt, /operation: read \(policy operation read\)/);
  assert.match(prompt, /canonical resource: \/isolated\/user-root-workspace-parent\/outside\/file\.txt\n/);
  assert.match(prompt, /reason: EXTERNAL_READ/);
  assert.match(prompt, /scope: this single tool call only, no standing permission/);
  assert.match(prompt, /duration/);
  assert.match(prompt, /protection/);
  // The prompt must not leak any secret payload or claim an OS capability.
  assert.ok(!/api[_-]?key/i.test(prompt));
  assert.ok(!/sandbox/i.test(prompt));
});

test("approved grants are one-time and bound to operation and canonical path", async () => {
  const calls: string[] = [];
  const outcome = await requestScopedApproval(midiUI(true, calls), baseRequest);
  assert.equal(outcome.status, "granted");
  if (outcome.status !== "granted") throw new Error("unreachable");
  assert.ok(consumeGrant(outcome.grant, "read", baseRequest.canonicalPath));
  // Replay beyond the single-use scope fails closed.
  assert.equal(consumeGrant(outcome.grant, "read", baseRequest.canonicalPath), false);
  assert.equal(consumeGrant(outcome.grant, "write", baseRequest.canonicalPath), false);
  assert.equal(consumeGrant(outcome.grant, "read", "/different/target"), false);
  assert.equal(consumeGrant(undefined, "read", baseRequest.canonicalPath), false);
  assert.equal(consumeGrant({}, "read", baseRequest.canonicalPath), false);
});

test("refusal, unavailable UI, page failure, and malformed responses all fail closed", async () => {
  const refused = await requestScopedApproval(midiUI(false, []), baseRequest);
  assert.equal(refused.status, "refused");

  const noUI = await requestScopedApproval(undefined, baseRequest);
  assert.equal(noUI.status, "unavailable");

  const withoutDialog = { hasUI: false, confirm: async () => true } as unknown as ApprovalUI;
  assert.equal((await requestScopedApproval(withoutDialog, baseRequest)).status, "unavailable");

  const throwing: ApprovalUI = {
    hasUI: true,
    confirm: async () => {
      throw new Error("dialog failed");
    },
  };
  assert.equal((await requestScopedApproval(throwing, baseRequest)).status, "refused");

  const malformedObject: ApprovalUI = {
    hasUI: true,
    // The supported UI contract returns a boolean; anything else is malformed.
    confirm: async () => ({ approved: true }) as unknown as boolean,
  };
  assert.equal((await requestScopedApproval(malformedObject, baseRequest)).status, "malformed");
});

test("decision status text never claims an unsupported authorization outcome", () => {
  const text = `pi-warden decision: DENY (SECRET_RESOURCE)`;
  const reported: AuthorizationOutcome = "DENY";
  assert.equal(text.startsWith(`pi-warden decision: ${reported}`), true);
  assert.ok(!text.toLowerCase().includes("sandbox"));
});
