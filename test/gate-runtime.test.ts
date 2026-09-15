import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import p from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import {
  createPiWardenRuntime,
  CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON,
  GATE_FAILURE_REASON,
  MALFORMED_INPUT_REASON,
  SHELL_BLOCK_REASON,
  UNKNOWN_TOOL_REASON,
  type PiRuntimeAPI,
  type ToolOwnerInfo,
} from "../src/gate/runtime.ts";
import { createProtectedZone } from "../src/policy/control-plane.ts";
import { canonicalizeWorkspace } from "../src/policy/paths.ts";

type FakeHandler = (event: unknown, ctx: unknown) => Promise<unknown>;
type FakeSourceInfo = NonNullable<ToolOwnerInfo["sourceInfo"]>;

const SOURCE_INFO: FakeSourceInfo = {
  source: "pi-warden-integration",
  scope: "temporary",
  origin: "top-level",
  path: "<integration:fake>",
};

interface RegisteredTool {
  name: string;
  sourceInfo: FakeSourceInfo;
  definition: unknown;
}

interface Host {
  handlers: Map<string, FakeHandler>;
  registered: RegisteredTool[];
  on(event: string, handler: unknown): void;
  registerTool(tool: unknown): void;
  getAllTools(): ToolOwnerInfo[];
  setThrowOnRegister(value: boolean): void;
  dropRegistered(): void;
}

function makeHost(): Host {
  const handlers = new Map<string, FakeHandler>();
  const registered: RegisteredTool[] = [];
  let throwOnRegister = false;
  return {
    handlers,
    registered,
    on(event, handler) {
      handlers.set(event, handler as FakeHandler);
    },
    registerTool(tool) {
      if (throwOnRegister) throw new Error("simulated registration failure");
      registered.push({
        name: (tool as { name?: unknown }).name as string,
        sourceInfo: { ...SOURCE_INFO },
        definition: tool,
      });
    },
    getAllTools: () =>
      registered.map((entry) => ({ name: entry.name, sourceInfo: entry.sourceInfo })) as ToolOwnerInfo[],
    setThrowOnRegister(value: boolean) {
      throwOnRegister = value;
    },
    dropRegistered() {
      registered.length = 0;
    },
  };
}

async function tempFixture() {
  const root = await mkdtemp(p.join(tmpdir(), "pi-warden-gate-"));
  const workspace = p.join(root, "workspace");
  const userRoot = p.join(root, "user-config");
  await mkdir(workspace);
  await mkdir(userRoot);
  return { root, workspace, userRoot };
}

function buildGateHarness(
  userRoot: string,
  protectedRoots: readonly string[],
  options?: { throwOnRegister?: boolean; dropRegistered?: boolean },
): Harness {
  const fake = makeHost();
  if (options?.throwOnRegister === true) fake.setThrowOnRegister(true);
  const state = createPiWardenRuntime(fake as unknown as PiRuntimeAPI, {
    trustedUserConfigRoot: userRoot,
    protectedRoots: protectedRoots.map((canonicalRoot) => ({ name: "pi-warden-user-config" as const, canonicalRoot })),
  });
  if (options?.dropRegistered === true) fake.dropRegistered();
  const toolCall = fake.handlers.get("tool_call");
  const userBash = fake.handlers.get("user_bash");
  assert.ok(toolCall !== undefined);
  assert.ok(userBash !== undefined);
  return { fake, toolCall, userBash, state };
}

function controlledExecuteOf(harness: Harness, name: "read" | "write" | "edit" | "grep" | "find" | "ls"): (...a: unknown[]) => unknown {
  const entry = harness.fake.registered.find((tool) => tool.name === name);
  const execute = (entry as unknown as { definition?: { execute?: (...a: unknown[]) => unknown } }).definition
    ?.execute as (...a: unknown[]) => unknown;
  assert.ok(typeof execute === "function", `missing controlled ${name} execute`);
  return execute;
}

function fakeCtx(workspace: string, confirmResponse?: unknown) {
  return {
    cwd: workspace,
    hasUI: confirmResponse !== undefined,
    ui:
      confirmResponse === undefined
        ? undefined
        : { confirm: async () => confirmResponse as boolean, notify: () => undefined },
    sessionManager: { getSessionId: () => "integration-session" },
  };
}

interface Harness {
  fake: Host;
  toolCall: FakeHandler;
  userBash: FakeHandler;
  state: { authorizedCalls: Map<string, unknown>; degraded: boolean };
}

test("controlled gate registers same-name tools and stays non-degraded", async () => {
  const { root, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, []);
    assert.equal(harness.state.degraded, false, `degraded: ${harness.state.degraded}`);
    assert.deepEqual(
      harness.fake.registered
        .filter((tool) => ["grep", "find", "ls", "read", "write", "edit"].includes(tool.name))
        .map((tool) => tool.name)
        .sort(),
      ["edit", "find", "grep", "ls", "read", "write"].sort(),
      "controlled same-name tools must be registered",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("allowed workspace read: gate authorizes and the controlled descriptor-bound read returns the file content", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const target = p.join(workspace, "data.txt");
    const expected = "hello allowed\n";
    await writeFile(target, expected);
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const input = { path: "./data.txt" };
    const result = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "t1", input }, ctx);
    assert.equal(result, undefined, "allowed call must not block");
    assert.equal(harness.state.authorizedCalls.has("t1"), true, "descriptor-bound plan must be issued");
    assert.equal(input.path, target, "input is pinned to the authorized canonical target");

    // The controlled executor consumes the gate-issued binding exactly once
    // and reads through the verified descriptor (no mocked hook value).
    const readExecute = controlledExecuteOf(harness, "read");
    const executed = (await readExecute("t1", input, undefined, undefined, ctx)) as { content: { type: string; text: string }[] };
    assert.equal(executed.content[0].type, "text");
    assert.match(executed.content[0].text, /hello allowed/, `controlled read output: ${executed.content[0].text}`);

    // Replay beyond the single-use plan binding fails closed.
    let rejected = false;
    try {
      await readExecute("t1", input, undefined, undefined, ctx);
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, "plan binding must be consumed exactly once");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P1 regression: final-target symlink swap after authorization is refused before any effect", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await mkdir(p.join(workspace, "target"));
    await writeFile(p.join(workspace, "ordinary.txt"), "authorized ordinary content\n");
    await writeFile(p.join(workspace, "target", ".env"), "fake secret payload\n");
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const input = { path: "ordinary.txt" };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "swap1", input }, ctx);
    assert.equal(gateResult, undefined, "authorize the ordinary file");
    assert.equal(harness.state.authorizedCalls.has("swap1"), true, "descriptor-bound plan must be issued");
    // The owner's attack: swap the authorized object for a symlink to a secret
    // AFTER authorization and BEFORE execution.
    await rm(p.join(workspace, "ordinary.txt"));
    await symlink(p.join(workspace, "target", ".env"), p.join(workspace, "ordinary.txt"));
    const readExecute = controlledExecuteOf(harness, "read");
    let refused = false;
    let output = "";
    try {
      const executed = (await readExecute("swap1", input, undefined, undefined, ctx)) as {
        content?: { type: string; text: string }[];
      };
      output = executed.content?.map((c) => c["text"] as string).join("\n") ?? "";
    } catch (error) {
      refused = true;
      output = (error as { message?: string }).message ?? "";
    }
    assert.equal(refused, true, `symlink-swapped target must be refused, got: ${output}`);
    assert.ok(!output.includes("fake secret payload"), "fake secret content must never be read");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P1 regression: object substitution with a different real file is refused before any effect", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await writeFile(p.join(workspace, "authorized.txt"), "authorized object\n");
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const input = { path: "authorized.txt" };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "sw2", input }, ctx);
    assert.equal(gateResult, undefined);
    await rm(p.join(workspace, "authorized.txt"));
    await writeFile(p.join(workspace, "authorized.txt"), "substituted object content\n");
    const readExecute = controlledExecuteOf(harness, "read");
    await assert.rejects(
      async () => readExecute("sw2", input, undefined, undefined, ctx),
      /identity does not match the authorized object/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("approval-window object substitution is refused: the plan captured before the dialog is carried unchanged", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    // The target is EXTERNAL to the workspace so its effective decision is
    // ASK: a real approval dialog swaps it with a different real file
    // DURING the dialog.
    await mkdir(p.join(root, "outside-dir"), { recursive: true });
    await writeFile(p.join(root, "outside-dir", "authorized.txt"), "the object the user approves\n");
    await writeFile(p.join(root, "outside-dir", "sub.txt"), "the substituted object content\n");
    const harness = buildGateHarness(userRoot, []);
    const swappingCtx = {
      cwd: workspace,
      hasUI: true,
      ui: {
        confirm: async () => {
          await rm(p.join(root, "outside-dir", "authorized.txt"));
          await writeFile(p.join(root, "outside-dir", "authorized.txt"), "the substituted object content\n");
          return true;
        },
        notify: () => undefined,
      },
      sessionManager: { getSessionId: () => "integration-session" },
    };
    const input = { path: p.join("..", "outside-dir", "authorized.txt") };
    const approved = await harness.toolCall(
      { type: "tool_call", toolName: "read", toolCallId: "ask1", input },
      swappingCtx,
    );
    // The request itself is authorized and approved, but the plan (captured
    // before the dialog) no longer matches the substituted object at
    // execute time, so the effect refuses.
    assert.equal(approved, undefined, "ASK+approval authorize the request");
    const readExecute = controlledExecuteOf(harness, "read");
    let refused = false;
    let refusalText = "";
    try {
      await readExecute("ask1", input, undefined, undefined, swappingCtx);
    } catch (error) {
      refused = true;
      refusalText = (error as { message?: string }).message ?? "";
    }
    assert.equal(refused, true, `approval-window substitution must be refused, got output: ${refusalText}`);
    assert.match(refusalText, /bound execution refused/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P0: escape via planted ancestor symlink at a missing creation parent is refused with no outside effect", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const outside = p.join(root, "outside");
    await mkdir(outside);
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    // Gate authorizes the nested write while the parent is still MISSING;
    // the deterministic equivalent of planting a symlinked directory during
    // the approval window: the plant happens between gate and execute.
    const input = { path: p.join("made", "later.txt"), content: "should never escape\n" };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "write", toolCallId: "esc1", input }, ctx);
    assert.equal(gateResult, undefined, "the ordinary nested write is authorized");
    await symlink(outside, p.join(workspace, "made"));
    const writeExecute = controlledExecuteOf(harness, "write");
    let refused = false;
    let refusalText = "";
    try {
      await writeExecute("esc1", input, undefined, undefined, ctx);
    } catch (error) {
      refused = true;
      refusalText = (error as { message?: string }).message ?? "";
    }
    assert.equal(refused, true, `planted missing-parent symlink must be refused: ${refusalText}`);
    assert.match(refusalText, /bound execution refused/);
    assert.equal(existsSync(p.join(outside, "later.txt")), false, "no file must be created outside the workspace");
    assert.equal(existsSync(p.join(workspace, "made", "later.txt")), false, "no file must be created through the planted symlink");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P0: planting a symlink at an EXISTING verified parent directory cannot redirect the create effect", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const outside = p.join(root, "outside");
    await mkdir(outside);
    await mkdir(p.join(workspace, "existing"));
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const input = { path: p.join("existing", "later.txt"), content: "bound content\n" };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "write", toolCallId: "esc2", input }, ctx);
    assert.equal(gateResult, undefined);
    // Replace the verified parent with a symlinked outside directory.
    await rm(p.join(workspace, "existing"), { recursive: true });
    await symlink(outside, p.join(workspace, "existing"));
    const writeExecute = controlledExecuteOf(harness, "write");
    let refused = false;
    let refusalText = "";
    try {
      await writeExecute("esc2", input, undefined, undefined, ctx);
    } catch (error) {
      refused = true;
      refusalText = (error as { message?: string }).message ?? "";
    }
    assert.equal(refused, true, `parent replacement must be refused: ${refusalText}`);
    assert.equal(existsSync(p.join(outside, "later.txt")), false, "no file must be created outside the workspace");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("creation keeps working for authorized nested depth with no substitution", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    // Nested missing parents (two levels deep) using only fd-relative creation.
    const nested = { path: p.join("made", "deeper", "file.txt"), content: "nested create\n" };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "write", toolCallId: "mk1", input: nested }, ctx);
    assert.equal(gateResult, undefined);
    const writeExecute = controlledExecuteOf(harness, "write");
    await writeExecute("mk1", nested, undefined, undefined, ctx);
    assert.equal(await readFile(p.join(workspace, "made", "deeper", "file.txt"), "utf8"), "nested create\n");

    // Single-level create still succeeds and is bound to the verified root.
    const simple = { path: "later.txt", content: "simple create\n" };
    const gateSimple = await harness.toolCall({ type: "tool_call", toolName: "write", toolCallId: "mk2", input: simple }, ctx);
    assert.equal(gateSimple, undefined);
    await writeExecute("mk2", simple, undefined, undefined, ctx);
    assert.equal(await readFile(p.join(workspace, "later.txt"), "utf8"), "simple create\n");

    // Overwriting an existing file keeps working through the verified parent.
    const overwrite = { path: "later.txt", content: "overwritten\n" };
    const gateOverwrite = await harness.toolCall({ type: "tool_call", toolName: "write", toolCallId: "mk3", input: overwrite }, ctx);
    assert.equal(gateOverwrite, undefined);
    await writeExecute("mk3", overwrite, undefined, undefined, ctx);
    assert.equal(await readFile(p.join(workspace, "later.txt"), "utf8"), "overwritten\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("hard-link alias of a secret is refused for direct read/write/edit and withheld from search/list", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await mkdir(p.join(workspace, "hidden"));
    await writeFile(p.join(workspace, "hidden", ".env"), "hardlinked secret payload\n");
    await mkdir(p.join(workspace, "alias"));
    const secretPath = p.join(workspace, "hidden", ".env");
    const aliasPath = p.join(workspace, "alias", "plain.txt");
    await (await import("node:fs/promises")).link(secretPath, aliasPath);
    const harness = buildGateHarness(userRoot, []);

    // Direct read: the plan itself refuses the hard-linked target (before
    // any approval interaction).
    const ctx = fakeCtx(workspace);
    const readInput = { path: p.join("alias", "plain.txt") };
    const gateRead = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "hl1", input: readInput }, ctx);
    assert.ok(
      typeof gateRead === "object" && (gateRead as { block?: unknown })?.block === true,
      `hard-linked direct read must be blocked at the gate: ${JSON.stringify(gateRead)}`,
    );
    assert.match((gateRead as { reason?: string }).reason ?? "", /hard-linked/);

    // A grep whose SEARCH ROOT is the hard-linked alias is refused outright.
    const gateGrep = await harness.toolCall(
      { type: "tool_call", toolName: "grep", toolCallId: "hl2", input: { pattern: "secret payload", path: "alias/plain.txt" } },
      ctx,
    );
    assert.ok(
      typeof gateGrep === "object" && (gateGrep as { block?: unknown })?.block === true,
      `hard-linked grep root must be blocked: ${JSON.stringify(gateGrep)}`,
    );
    assert.match((gateGrep as { reason?: string }).reason ?? "", /HARD_LINKED_RESOURCE/);

    // Listing the ordinary parent directory still works, but the hard-linked
    // alias entry is withheld (its name/content never appear).
    const gateLs = await harness.toolCall({ type: "tool_call", toolName: "ls", toolCallId: "hl3", input: { path: "alias" } }, ctx);
    assert.equal(gateLs, undefined, "the alias directory authorizes for listing");
    const lsExecute = controlledExecuteOf(harness, "ls");
    const lsOutput = (await lsExecute("hl3", { path: p.join(workspace, "alias") }, undefined, undefined, ctx)) as unknown;
    const lsText = JSON.stringify(lsOutput);
    assert.ok(!lsText.includes("hardlinked secret payload"), `secret not exposed in listing: ${lsText}`);
    // The alias itself is withheld from the authorized directory listing.
    assert.ok(!lsText.includes("plain.txt"), `hard-linked entry withheld from listing: ${lsText}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("ancestor-directory substitution is refused before any read effect", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await mkdir(p.join(workspace, "inner"));
    await writeFile(p.join(workspace, "inner", "doc.txt"), "authorized through inner\n");
    await mkdir(p.join(workspace, "elsewhere"));
    await writeFile(p.join(workspace, "elsewhere", "doc.txt"), "unrelated content\n");
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const input = { path: p.join("inner", "doc.txt") };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "anc1", input }, ctx);
    assert.equal(gateResult, undefined);
    // Swap the authorized ancestor for a symlink to a different directory.
    await rm(p.join(workspace, "inner"), { recursive: true });
    await symlink(p.join(workspace, "elsewhere"), p.join(workspace, "inner"));
    const readExecute = controlledExecuteOf(harness, "read");
    await assert.rejects(
      async () => readExecute("anc1", input, undefined, undefined, ctx),
      /bound execution refused/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("write creates a workspace file through the controlled descriptor executor", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const input = { path: p.join("made", "later.txt"), content: "written by gate\n" };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "write", toolCallId: "w1", input }, ctx);
    assert.equal(gateResult, undefined);
    assert.equal(harness.state.authorizedCalls.has("w1"), true);

    // The controlled write executor performs the effect via the descriptor plan.
    const writeExecute = controlledExecuteOf(harness, "write");
    await writeExecute("w1", input, undefined, undefined, ctx);
    const written = await readFile(p.join(workspace, "made", "later.txt"), "utf8");
    assert.equal(written, "written by gate\n");

    // Overwriting an existing target remains bound to the authorized object.
    const overwrite = { path: p.join("made", "later.txt"), content: "overwritten by gate\n" };
    const gateResult2 = await harness.toolCall({ type: "tool_call", toolName: "write", toolCallId: "w2", input: overwrite }, ctx);
    assert.equal(gateResult2, undefined);
    await writeExecute("w2", overwrite, undefined, undefined, ctx);
    const written2 = await readFile(p.join(workspace, "made", "later.txt"), "utf8");
    assert.equal(written2, "overwritten by gate\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("controlled edit applies an exact unique match through the descriptor", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const target = p.join(workspace, "code.txt");
    await writeFile(target, "function alpha() {}\n");
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const input = { path: "code.txt", edits: [{ oldText: "alpha", newText: "beta" }] };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "edit", toolCallId: "e1", input }, ctx);
    assert.equal(gateResult, undefined);
    const editExecute = controlledExecuteOf(harness, "edit");
    await editExecute("e1", input, undefined, undefined, ctx);
    const updated = await readFile(target, "utf8");
    assert.equal(updated, "function beta() {}\n");

    // An ambiguous second edit (oldText matching multiple locations) is
    // refused without any effect: oldText "n" occurs twice in "function".
    const ambiguous = { path: "code.txt", edits: [{ oldText: "n", newText: "N" }] };
    const gateResult2 = await harness.toolCall({ type: "tool_call", toolName: "edit", toolCallId: "e2", input: ambiguous }, ctx);
    assert.equal(gateResult2, undefined);
    try {
      await editExecute("e2", ambiguous, undefined, undefined, ctx);
      assert.fail("ambiguous edit must refuse");
    } catch (error) {
      assert.match((error as { message?: string }).message ?? "", /ambigu|multiple/);
    }
    assert.equal(await readFile(target, "utf8"), updated, "ambiguous edit must not produce an effect");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("secret resources are denied hard and never approvable", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await mkdir(p.join(workspace, "target"));
    await writeFile(p.join(workspace, "target", ".env"), "TOP=secret\n");
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace, true); // even a willing user cannot approve
    const input = { path: p.join("target", ".env") };
    const result = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "s1", input }, ctx);
    assert.ok(result && typeof result === "object" && (result as { block?: unknown }).block === true);
    const reason = (result as { reason?: string }).reason ?? "";
    assert.match(reason, /SECRET_RESOURCE/);
    assert.equal(input.path, "target/.env", "denied call must not be pinned to the canonical resource");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing read targets fail closed", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const input = { path: "nope.txt" };
    const result = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "m1", input }, ctx);
    const reason = (result as { reason?: string })?.reason ?? "";
    assert.match(reason, /READ_TARGET_MISSING/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("model bash and user !/!! shell routes are blocked without spawning an unrestricted shell", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    for (const name of ["bash", "powershell"]) {
      const result = await harness.toolCall({ type: "tool_call", toolName: name, toolCallId: name, input: { command: "echo hi" } }, ctx);
      assert.ok((result as { block?: unknown })?.block === true, `${name} must be blocked`);
      assert.match((result as { reason?: string }).reason ?? "", /shell/i);
    }
    const userResult = await harness.userBash({ type: "user_bash", command: "echo hi", excludeFromContext: false, cwd: workspace }, fakeCtx(workspace));
    assert.equal((userResult as { result?: { output?: string; exitCode?: number; cancelled?: boolean; truncated?: boolean } }).result?.exitCode, 126);
    assert.equal((userResult as { result?: { cancelled?: boolean } }).result?.cancelled, false, "no shell was run");
    assert.match((userResult as { result?: { output?: string } }).result?.output ?? "", /shell execution is disabled/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unknown and dynamically registered model-facing tools fail closed", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    // A later extension registers a new model-facing tool at runtime.
    harness.fake.registerTool({ name: "dynamic_probe", execute: async () => ({}) });
    for (const name of ["never_granted", "dynamic_probe"]) {
      const result = await harness.toolCall({ type: "tool_call", toolName: name, toolCallId: name, input: {} }, ctx);
      assert.ok((result as { block?: unknown })?.block === true, `${name} must be blocked`);
      assert.match((result as { reason?: string }).reason ?? "", /not integrated and is blocked/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("protected control-plane resources override workspace allowance and any approval", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const zoneRoot = await canonicalizeWorkspace(userRoot);
    const harness = buildGateHarness(userRoot, [zoneRoot]);
    const confirmCalls: unknown[] = [];
    const ctx = {
      cwd: workspace,
      hasUI: true,
      ui: { confirm: async () => { confirmCalls.push(1); return true; }, notify: () => undefined },
      sessionManager: { getSessionId: () => "integration-session" },
    };
    const input = { path: p.join("..", "user-config", "pi-warden", "policy.json") };
    const result = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "p1", input }, ctx);
    assert.ok((result as { block?: unknown })?.block === true);
    assert.match((result as { reason?: string }).reason ?? "", /PROTECTED_RESOURCE/);
    assert.equal(confirmCalls.length, 0, "protected denials must not be approvable");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("external read asks and approval blocks or grants exactly once, one call", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await mkdir(p.join(root, "outside"));
    await writeFile(p.join(root, "outside", "external.txt"), "outside content\n");
    const harness = buildGateHarness(userRoot, []);

    const refuser = fakeCtx(workspace, false);
    const refused = await harness.toolCall(
      { type: "tool_call", toolName: "read", toolCallId: "a1", input: { path: p.join("..", "outside", "external.txt") } },
      refuser,
    );
    assert.ok((refused as { block?: unknown })?.block === true);
    assert.match((refused as { reason?: string }).reason ?? "", /approval required/);

    const approver = fakeCtx(workspace, true);
    const allowedInput = { path: p.join("..", "outside", "external.txt") };
    const allowed = await harness.toolCall(
      { type: "tool_call", toolName: "read", toolCallId: "a2", input: allowedInput },
      approver,
    );
    assert.equal(allowed, undefined);
    assert.equal(allowedInput.path.startsWith(root), true, "post-approval execution is bound to the canonical target");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("controlled ls executes through the gate-issued memo and fails closed without it", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await mkdir(p.join(workspace, "target"));
    await writeFile(p.join(workspace, "target", "visible.txt"), "");
    const harness = buildGateHarness(userRoot, []);
    const lsEntry = harness.fake.registered.find((tool) => tool.name === "ls");
    assert.ok(lsEntry !== undefined);
    const execute = (lsEntry as unknown as { definition?: { execute?: (...a: unknown[]) => unknown } }).definition?.execute;
    assert.ok(typeof execute === "function");

    const ctx = fakeCtx(workspace);
    const input = { path: "target" };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "ls", toolCallId: "l1", input }, ctx);
    assert.equal(gateResult, undefined);
    const canonicalRoot = input.path as string;

    const executed = (await (execute as (...a: unknown[]) => unknown)(
      "l1",
      { path: canonicalRoot },
      undefined,
      undefined,
      ctx,
    )) as { content: { type: string; text: string }[] };
    assert.equal(executed.content[0].type, "text", "unexpected controlled ls output");
    assert.ok(executed.content[0].text.includes("visible.txt"), `ls output: ${executed.content[0].text}`);

    // Without the gate memo (a different call id), execution must fail closed.
    let rejected = false;
    try {
      await (execute as (...a: unknown[]) => unknown)("unused-id", { path: canonicalRoot }, undefined, undefined, ctx);
      // Must have thrown.
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, "controlled execution without the gate memo must fail closed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("session lifecycle transitions invalidate the gate-issued memo", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await mkdir(p.join(workspace, "target"));
    await writeFile(p.join(workspace, "target", "visible.txt"), "");
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const inputLs = { path: "target" };
    const allowed = await harness.toolCall({ type: "tool_call", toolName: "ls", toolCallId: "L1", input: inputLs }, ctx);
    assert.equal(allowed, undefined);
    assert.equal(harness.state.authorizedCalls.has("L1"), true);

    const shutdown = harness.fake.handlers.get("session_shutdown");
    assert.ok(shutdown !== undefined);
    await shutdown({ type: "session_shutdown", reason: "new" }, ctx);
    assert.equal(harness.state.authorizedCalls.has("L1"), false, "memo must not survive session replacement");

    // Stale memo after the session transition cannot serve a delayed execute.
    const lsEntry = harness.fake.registered.find((tool) => tool.name === "ls");
    const execute = (lsEntry as unknown as { definition?: { execute?: (...a: unknown[]) => unknown } }).definition
      ?.execute as (...a: unknown[]) => unknown;
    let rejected = false;
    try {
      await execute("L1", { path: inputLs.path }, undefined, undefined, ctx);
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, "controlled execution after session replacement must fail closed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("controlled search bindings are consumed exactly once and cannot be replayed or reused across tools", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    await mkdir(p.join(workspace, "target"));
    await writeFile(p.join(workspace, "target", "visible.txt"), "");
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);

    const controlled = harness.fake.registered.filter((tool) => tool.name === "ls" || tool.name === "grep");
    const executeOf = (name: string): (...a: unknown[]) => unknown => {
      const entry = controlled.find((tool) => tool.name === name);
      const execute = (entry as unknown as { definition?: { execute?: (...a: unknown[]) => unknown } }).definition
        ?.execute as (...a: unknown[]) => unknown;
      assert.ok(typeof execute === "function", `${name} must expose its controlled execute`);
      return execute;
    };
    const runExecute = (execute: (...a: unknown[]) => unknown, toolCallId: string, params: unknown) =>
      execute(toolCallId, params, undefined, undefined, ctx) as Promise<unknown>;
    const expectsRejection = async (execute: (...a: unknown[]) => unknown, toolCallId: string, params: unknown, label: string) => {
      let rejected = false;
      try {
        await runExecute(execute, toolCallId, params);
      } catch (error) {
        rejected = (error as { message?: string })?.message === CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON;
      }
      assert.equal(rejected, true, `${label} must fail closed`);
    };

    // Authorize one controlled call binding.
    const inputLs = { path: "target" };
    const gateResult = await harness.toolCall({ type: "tool_call", toolName: "ls", toolCallId: "bind1", input: inputLs }, ctx);
    assert.equal(gateResult, undefined);
    const canonicalRoot = inputLs.path as string;
    assert.equal(harness.state.authorizedCalls.has("bind1"), true);

    // First consume succeeds for the authorized tool.
    const lsExecute = executeOf("ls");
    const first = (await runExecute(lsExecute, "bind1", { path: canonicalRoot })) as { content: { text: string }[] };
    assert.ok(first.content[0].text.includes("visible.txt"), `controlled ls output: ${first.content[0].text}`);

    // Replay with the same toolCallId fails closed.
    await expectsRejection(lsExecute, "bind1", { path: canonicalRoot }, "same-tool replay");
    // The consumed id cannot be reused by another controlled tool either.
    const grepExecute = executeOf("grep");
    await expectsRejection(grepExecute, "bind1", { path: canonicalRoot, pattern: "x" }, "cross-tool reuse");
    assert.equal(harness.state.authorizedCalls.has("bind1"), false, "binding must be gone after consumption");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("malformed and forged inputs fail closed without pinning any effect identity", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, []);
    const ctx = fakeCtx(workspace);
    const cases: unknown[] = [
      { path: 42 },
      { path: "" },
      { path: "a\0b" },
      null,
      [] as unknown[],
      { path: "x", content: 7 },
      { path: "x", edits: "not-an-array" as unknown as unknown[] },
      { path: "x", edits: [{ oldText: 1, newText: 2 }] },
    ];
    let index = 0;
    for (const input of cases) {
      index += 1;
      const result = await harness.toolCall({ type: "tool_call", toolName: "write", toolCallId: `z${index}`, input }, ctx);
      assert.ok((result as { block?: unknown })?.block === true, `malformed write input ${JSON.stringify(input)} must block`);
      assert.match((result as { reason?: string }).reason ?? "", /tool input failed validation/);
    }
    // Malformed events with a hostile tool name also fail closed.
    const nameResult = await harness.toolCall({ type: "tool_call", toolName: { forged: true } as unknown as string, toolCallId: "n1", input: {} }, ctx);
    assert.ok((nameResult as { block?: unknown })?.block === true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a lost or foreign controlled-tool registration blocks search tools at the gate", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, [], { dropRegistered: true });
    await mkdir(p.join(workspace, "target"));
    const ctx = fakeCtx(workspace);
    const result = await harness.toolCall({ type: "tool_call", toolName: "grep", toolCallId: "g1", input: { pattern: "x", path: "target" } }, ctx);
    assert.ok((result as { block?: unknown })?.block === true, "unowned controlled tool call must be blocked");
    assert.match((result as { reason?: string }).reason ?? "", /controlled tool registration does not match the authorized owner/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("initialization failure cannot silently restore unprotected tools", async () => {
  const { root, workspace, userRoot } = await tempFixture();
  try {
    const harness = buildGateHarness(userRoot, [], { throwOnRegister: true });
    assert.equal(harness.state.degraded, true, "registration failure must mark the runtime degraded");
    const ctx = fakeCtx(workspace);
    await writeFile(p.join(workspace, "plain.txt"), "");  // even an ordinary workspace read blocks
    const result = await harness.toolCall({ type: "tool_call", toolName: "read", toolCallId: "r9", input: { path: "plain.txt" } }, ctx);
    assert.ok((result as { block?: unknown })?.block === true, "degraded runtime must block file tools, not fall back");
    assert.match((result as { reason?: string }).reason ?? "", /gate initialization failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

