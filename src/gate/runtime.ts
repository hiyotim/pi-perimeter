/**
 * pi-warden runtime: central file-tool gate, scoped approvals, blocked shell
 * routes, and controlled search/list tools, wired onto the supported Pi
 * extension interface.
 *
 * Coverage rules encoded here:
 * - `read`, `write`, `edit`: central authorization, then input pinning, so the
 *   actual builtin execution is bound to the checked canonical identity.
 * - `grep`, `find`, `ls`: pi-warden registers same-name controlled tools; the
 *   gate authorizes the root, binds the per-call authorization under the
 *   trusted toolCallId, and the controlled executor consumes exactly that
 *   binding. A foreign tool registered over these names, or any dispatch that
 *   reaches a controlled tool without a matching gate authorization, fails
 *   closed.
 * - `bash`: mediated by the contained shell lifecycle (plan, effective
 *   policy, single-use approval, projection, Seatbelt containment, controlled
 *   export). Every failure blocks; there is no uncontained fallback.
 * - `powershell`: blocked (no containment path exists for it).
 * - unknown/unintegrated model-facing tools: blocked (fail closed), so dynamic
 *   registration or activation still cannot create unmediated effects.
 * - user `!` / `!!` shell execution: mediated by the same contained shell
 *   lifecycle and returned as a full result replacement; a refusal returns a
 *   blocked result and no shell is spawned. Failure to register a controlled
 *   tool, or to observe its owned registration, marks the runtime degraded and
 *   blocks the affected tools.
 */

import {
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { requestScopedApproval, type ApprovalUI } from "../approvals/approvals.ts";
import { buildExecutionPlan, executeBoundEdit, executeBoundRead, executeBoundWrite, BOUND_EXECUTION_REFUSED_PREFIX, type ExecutionPlan } from "./bound-execution.ts";
import type { LoadedPolicySources } from "../policy/config-loader.ts";
import { createProtectedZone, type ProtectedZone } from "../policy/control-plane.ts";
import { mapFileToolToOperation, isBlockedShellTool, isContainedShellTool } from "../policy/operations.ts";
import type { ResolvedPath } from "../policy/paths.ts";
import { authorizeResource, type GateServices } from "./authorizer.ts";
import { parseGateInput } from "./gate-input.ts";
import { controlledFind, controlledGrep, controlledLs } from "./controlled-traversal.ts";
import {
  authorizeShellRoute,
  executeAuthorizedShellRoute,
  SHELL_APPROVAL_PREFIX,
  SHELL_POLICY_DENY_PREFIX,
  type AuthorizedShell,
  type ShellServices,
} from "./shell-runtime.ts";
import { defaultBuildManifestPath, defaultHelperPath, packageRootFromModule } from "../sandbox/helper.ts";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const SHELL_UNSUPPORTED_REASON = "pi-warden: this shell dialect has no containment path and is blocked";
export const UNKNOWN_TOOL_REASON = "pi-warden: tool is not integrated and is blocked (fail closed)";
export const MALFORMED_INPUT_REASON = "pi-warden: tool input failed validation";
export const MISSING_WORKSPACE_REASON = "pi-warden: missing trusted workspace context";
export const CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON =
  "pi-warden: controlled tool executed without a gate-issued authorization";
export const CONTROLLED_TOOL_FOREIGN_OWNER_REASON =
  "pi-warden: controlled tool registration does not match the authorized owner";
export const GATE_FAILURE_REASON =
  "pi-warden: gate initialization failed; affected operations are blocked (fail closed)";
/**
 * Pre-ready refusal: Pi `0.84.4` keeps every action method (`getAllTools`,
 * `getActiveTools`, ...) as a throwing stub until its session binds the core
 * (`ExtensionRunner.bindCore`), and only then emits `session_start`
 * (`dist/core/extensions/loader.js:132-155` stubs, `runner.js:160-170`
 * `bindCore` wiring in `_bindExtensionCore` at `agent-session.js:2003`
 * (called from `_buildRuntime` at `:2199`), `bindExtensions` at `:1916-1920`
 * applying bindings then emitting `session_start` (`:152` default event,
 * reload re-emit `:2229-2230`); real `getAllTools` `:641`). Ownership
 * observations therefore run only in the `session_start` handler; every
 * gated call before that blocks here.
 */
export const GATE_NOT_READY_REASON =
  "pi-warden: gate not ready (waiting for Pi session_start); operations are blocked (fail closed)";

export interface ToolOwnerInfo {
  readonly name: string;
  readonly sourceInfo:
    | { readonly source: string; readonly scope: string; readonly origin: string; readonly path: string }
    | undefined;
}

/** The Pi extension surface the runtime requires (structural subset). */
export interface PiRuntimeAPI {
  on(event: string, handler: (event: unknown, ctx: unknown) => unknown): void;
  registerTool(tool: unknown): void;
  getAllTools(): ToolOwnerInfo[];
}

/** One gate-issued authorization for exactly one controlled tool call. */
/** One gate-issued shell authorization awaiting its controlled execution. */
interface PendingShellCall {
  readonly authorized: AuthorizedShell;
  readonly createdAtMs: number;
}

interface AuthorizedCall {
  readonly tool: string;
  readonly workspace: string;
  /** Present for `read`/`write`/`edit`: the descriptor-bound execution plan. */
  readonly plan?: ExecutionPlan;
  /** Present for `grep`/`find`/`ls`: the authorized search root snapshot. */
  readonly root?: ResolvedPath;
  readonly loaded?: LoadedPolicySources;
}

export interface RuntimeState {
  /** Gate-issued per-call bindings; entries are consumed exactly once. */
  readonly authorizedCalls: Map<string, AuthorizedCall>;
  /** Gate-issued shell authorizations; entries are consumed exactly once. */
  readonly pendingShellCalls: Map<string, PendingShellCall>;
  readonly degraded: boolean;
  /** True once Pi emitted `session_start` and ownership was observed. */
  readonly ready: boolean;
}

export interface GateRuntimeOptions {
  /** Trusted host inputs captured outside any model- or repo-controlled flow. */
  readonly trustedUserConfigRoot: string;
  readonly protectedRoots: readonly {
    readonly name: "pi-warden-agent-dir" | "pi-warden-user-config";
    readonly canonicalRoot: string;
  }[];
  /** Optional confirmation dialog timeout in milliseconds. */
  readonly approvalTimeoutMs?: number;
  /** Trusted helper location; defaults to the package's own native directory. */
  readonly helperPath?: string;
  readonly buildManifestPath?: string;
  /** Runtime-instance identity used for shell approval bindings. */
  readonly instanceId?: string;
  /** Lifetime of a prepared shell invocation that is never executed. */
  readonly pendingShellTtlMs?: number;
}

type ExtCtx = { readonly ui?: unknown; readonly hasUI?: unknown; readonly cwd?: unknown };
type ExtEvent = { toolName?: unknown; toolCallId?: unknown; input?: unknown };

function sameOwner(
  observed: NonNullable<ToolOwnerInfo["sourceInfo"]> | undefined,
  expected: NonNullable<ToolOwnerInfo["sourceInfo"]> | undefined,
): boolean {
  if (observed === undefined || expected === undefined) return false;
  return (
    observed.source === expected.source &&
    observed.scope === expected.scope &&
    observed.origin === expected.origin &&
    observed.path === expected.path
  );
}

function positiveIntOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return fallback;
}

/** Signature of a controlled tool executor. */
type ControlledRun = (
  toolCallId: string,
  workspace: string,
  params: unknown,
  ctx: unknown,
  signal: AbortSignal | undefined,
) => Promise<unknown>;

interface ControlledTool {
  readonly name: "grep" | "find" | "ls" | "read" | "write" | "edit" | "bash";
  readonly run: ControlledRun;
}

function controlledBaseDefinition(
  toolName: ControlledTool["name"],
  cwd: string,
): object | undefined {
  if (toolName === "bash") return createBashToolDefinition(cwd);
  if (toolName === "grep") return createGrepToolDefinition(cwd);
  if (toolName === "find") return createFindToolDefinition(cwd);
  if (toolName === "ls") return createLsToolDefinition(cwd);
  if (toolName === "read") return createReadToolDefinition(cwd);
  if (toolName === "edit") return createEditToolDefinition(cwd);
  return createWriteToolDefinition(cwd);
}

export function createPiWardenRuntime(pi: PiRuntimeAPI, options: GateRuntimeOptions): RuntimeState {
  const protectedZones: ProtectedZone[] = [];
  for (const root of options.protectedRoots) {
    const zone = createProtectedZone(root.name, root.canonicalRoot);
    if (zone !== undefined) protectedZones.push(zone);
  }
  const services: GateServices = {
    trustedUserConfigRoot: options.trustedUserConfigRoot,
    protectedZones,
  };

  const packageRoot = packageRootFromModule(import.meta.url);
  // Pi derives extension tool provenance from the loaded entry file. This is
  // the only owner that may replace the built-in tools, even if another
  // extension registered a same-name tool before session_start.
  const extensionPath = path.join(packageRoot, "src", "index.ts");
  const shellServices: ShellServices = {
    trustedUserConfigRoot: options.trustedUserConfigRoot,
    protectedZones,
    helperPath: options.helperPath ?? defaultHelperPath(packageRoot),
    buildManifestPath: options.buildManifestPath ?? defaultBuildManifestPath(packageRoot),
    instanceId: options.instanceId ?? randomUUID(),
    ...(options.approvalTimeoutMs !== undefined ? { approvalTimeoutMs: options.approvalTimeoutMs } : {}),
  };
  let sessionEpoch = 0;
  /** False until Pi emits `session_start` (post-bindCore); every
   * `getAllTools()` ownership observation runs only after that signal. */
  let ready = false;
  let degraded = false;
  const authorizedCalls = new Map<string, AuthorizedCall>();
  const pendingShellCalls = new Map<string, PendingShellCall>();
  /** Prepared invocations that Pi never executes are released after this long. */
  const PENDING_SHELL_TTL_MS = options.pendingShellTtlMs ?? 10 * 60 * 1000;

  async function releaseStalePendingShellCalls(): Promise<void> {
    const deadline = Date.now() - PENDING_SHELL_TTL_MS;
    for (const [toolCallId, pending] of [...pendingShellCalls]) {
      if (pending.createdAtMs > deadline) continue;
      pendingShellCalls.delete(toolCallId);
      await pending.authorized.prepared.dispose();
    }
  }
  const controlledToolOwners = new Map<string, ToolOwnerInfo["sourceInfo"]>();

  function approvalUI(ctx: unknown): ApprovalUI | undefined {
    if (typeof ctx !== "object" || ctx === null) return undefined;
    const dyn = ctx as ExtCtx;
    if (dyn.hasUI !== true) return undefined;
    const ui = dyn.ui as ApprovalUI | undefined;
    if (typeof ui !== "object" || ui === null) return undefined;
    // The context decides availability (ctx.hasUI); the ui object itself
    // supplies the confirm dialog.
    return { hasUI: true, confirm: ui.confirm };
  }

  /** Ownership observation: runs only from the `session_start` handler (never
   * at factory load). The name table is literal so it is callable before the
   * executor closures below are defined. */
  function observeControlledToolOwners(): boolean {
    const names = ["bash", "read", "write", "edit", "ls", "find", "grep"] as const;
    let tools: ToolOwnerInfo[];
    try {
      tools = pi.getAllTools();
    } catch {
      degraded = true;
      return false;
    }
    for (const name of names) {
      const observed = tools.filter((tool) => tool.name === name);
      if (observed.length !== 1 || observed[0].sourceInfo?.path !== extensionPath) {
        degraded = true;
        return false;
      }
      controlledToolOwners.set(name, observed[0].sourceInfo);
    }
    return true;
  }

  pi.on("session_start", () => {
    // Readiness signal: Pi `0.84.4` emits this only after bindCore replaces
    // the throwing action-method stubs (evidence: see `GATE_NOT_READY_REASON`
    // note), so `getAllTools()` is safe here and throws at factory load.
    // Ownership is observed exactly once per session binding;
    // missing/duplicate observation degrades. No epoch bump here:
    // `session_shutdown` already advanced it.
    ready = false;
    pendingShellCalls.clear();
    authorizedCalls.clear();
    controlledToolOwners.clear();
    if (!degraded) ready = observeControlledToolOwners();
  });

  pi.on("session_shutdown", () => {
    sessionEpoch += 1;
    for (const pending of pendingShellCalls.values()) {
      void pending.authorized.prepared.dispose();
    }
    pendingShellCalls.clear();
    authorizedCalls.clear();
    // Ownership observations belong to the current session binding; a new
    // session binding must reobserve them (via `session_start`) before
    // controlled calls run.
    controlledToolOwners.clear();
    ready = false;
  });

  pi.on("tool_call", async (event: unknown, ctx: unknown) => {
    try {
      return await handleToolCall(event, ctx);
    } catch {
      return { block: true, reason: GATE_FAILURE_REASON };
    }
  });

  /**
   * User `!`/`!!` commands run the same contained lifecycle as model `bash`.
   * The result is a full replacement: no shell is spawned by Pi itself, and a
   * refusal returns a blocked result instead of executing anything.
   */
  pi.on("user_bash", async (event: unknown, ctx: unknown) => {
    const blocked = (reason: string) => ({
      result: {
        output: `${reason}\n(command not executed)`,
        exitCode: 126,
        cancelled: false,
        truncated: false,
      },
    });
    try {
      if (typeof event !== "object" || event === null) return blocked(MALFORMED_INPUT_REASON);
      const frame = event as { command?: unknown };
      if (typeof frame.command !== "string" || frame.command.length === 0 || frame.command.includes("\0")) {
        return blocked(`${MALFORMED_INPUT_REASON} (SHELL_INPUT)`);
      }
      if (degraded) return blocked(GATE_FAILURE_REASON);
      if (!ready) return blocked(GATE_NOT_READY_REASON);
      const dyn = (typeof ctx === "object" && ctx !== null ? ctx : {}) as ExtCtx;
      const workspace =
        typeof dyn.cwd === "string" && dyn.cwd.length > 0 ? dyn.cwd : undefined;
      if (workspace === undefined) return blocked(MISSING_WORKSPACE_REASON);
      const ui = approvalUI(ctx);

      const authorization = await authorizeShellRoute({
        services: shellServices,
        workspace,
        command: frame.command,
        ui,
        sessionEpoch,
      });
      if (authorization.status === "blocked") return blocked(authorization.reason);

      let output = "";
      const execution = await executeAuthorizedShellRoute({
        services: shellServices,
        authorized: authorization.authorized,
        ui,
        signal: undefined,
        timeoutMs: undefined,
        onOutput: (chunk) => {
          output += chunk.toString("utf8");
          if (output.length > 4 * 1024 * 1024) output = output.slice(-2 * 1024 * 1024);
        },
      });
      if ("blocked" in execution) return blocked(execution.blocked);
      const text = [output.trimEnd(), execution.report].filter((part) => part.length > 0).join("\n\n");
      return {
        result: {
          output: text.length > 0 ? text : "(no output)",
          exitCode: execution.cancelled
            ? undefined
            : (execution.exitCode === null ? undefined : execution.exitCode),
          cancelled: execution.cancelled,
          truncated: execution.outputTruncated,
        },
      };
    } catch {
      return blocked(GATE_FAILURE_REASON);
    }
  });

  /** Validates the model `bash` input frame exactly as the gate sees it. */
  function parseShellToolInput(input: unknown): { command: string; timeoutMs: number | undefined } | undefined {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const frame = input as { command?: unknown; timeout?: unknown };
    if (typeof frame.command !== "string" || frame.command.length === 0 || frame.command.includes("\0")) {
      return undefined;
    }
    if (frame.timeout !== undefined) {
      if (typeof frame.timeout !== "number" || !Number.isFinite(frame.timeout) || frame.timeout <= 0) {
        return undefined;
      }
      return { command: frame.command, timeoutMs: Math.round(frame.timeout * 1000) };
    }
    return { command: frame.command, timeoutMs: undefined };
  }

  async function handleContainedShellToolCall(
    toolName: string,
    call: ExtEvent,
    ctx: ExtCtx,
    workspace: string,
  ): Promise<Record<string, unknown> | undefined> {
    if (degraded) {
      return { block: true, reason: GATE_FAILURE_REASON };
    }
    if (!ready) {
      return { block: true, reason: GATE_NOT_READY_REASON };
    }
    const frame = parseShellToolInput(call.input);
    if (frame === undefined) {
      return { block: true, reason: `${MALFORMED_INPUT_REASON} (SHELL_INPUT)` };
    }
    const toolCallId =
      typeof call.toolCallId === "string" && call.toolCallId.length > 0 ? call.toolCallId : undefined;
    if (toolCallId === undefined) {
      return { block: true, reason: MALFORMED_INPUT_REASON };
    }
    const expected = controlledToolOwners.get(toolName);
    const observed = pi.getAllTools().filter((tool) => tool.name === toolName);
    if (expected === undefined || observed.length !== 1 || !sameOwner(observed[0].sourceInfo, expected)) {
      return { block: true, reason: CONTROLLED_TOOL_FOREIGN_OWNER_REASON };
    }

    await releaseStalePendingShellCalls();
    const previous = pendingShellCalls.get(toolCallId);
    if (previous !== undefined) {
      pendingShellCalls.delete(toolCallId);
      await previous.authorized.prepared.dispose();
    }

    const authorization = await authorizeShellRoute({
      services: shellServices,
      workspace,
      command: frame.command,
      ui: approvalUI(ctx),
      sessionEpoch,
    });
    if (authorization.status === "blocked") {
      return { block: true, reason: authorization.reason };
    }
    pendingShellCalls.set(toolCallId, {
      authorized: authorization.authorized,
      createdAtMs: Date.now(),
    });
    return undefined;
  }

  async function handleToolCall(
    event: unknown,
    ctx: unknown,
  ): Promise<Record<string, unknown> | undefined> {
    if (typeof event !== "object" || event === null || Array.isArray(event)) {
      return { block: true, reason: MALFORMED_INPUT_REASON };
    }
    const call = event as ExtEvent;
    if (typeof call.toolName !== "string") {
      return { block: true, reason: MALFORMED_INPUT_REASON };
    }
    if (typeof ctx !== "object" || ctx === null) {
      return { block: true, reason: MALFORMED_INPUT_REASON };
    }
    const dyn = ctx as ExtCtx;
    if (typeof dyn.cwd !== "string" || dyn.cwd.length === 0) {
      return { block: true, reason: MISSING_WORKSPACE_REASON };
    }
    const toolName: string = call.toolName;
    const workspace: string = dyn.cwd as string;

    if (isBlockedShellTool(toolName)) {
      return { block: true, reason: `${SHELL_UNSUPPORTED_REASON} (${toolName})` };
    }

    if (isContainedShellTool(toolName)) {
      return await handleContainedShellToolCall(toolName, call, dyn, workspace);
    }

    const mappedOp = mapFileToolToOperation(toolName);
    if (mappedOp === undefined) {
      return { block: true, reason: UNKNOWN_TOOL_REASON };
    }

    if (degraded) {
      return { block: true, reason: GATE_FAILURE_REASON };
    }
    if (!ready) {
      return { block: true, reason: GATE_NOT_READY_REASON };
    }

    const frame = parseGateInput(toolName, call.input);
    if (frame.status !== "ok") {
      return { block: true, reason: `${MALFORMED_INPUT_REASON} (${frame.code})` };
    }
    if (frame.kind !== "resource" && frame.kind !== "search-root") {
      return { block: true, reason: UNKNOWN_TOOL_REASON };
    }
    const requestedPath = frame.kind === "resource" ? frame.resource.path : frame.root.requestedPath;

    const authorization = await authorizeResource(services, workspace, mappedOp, requestedPath);
    if (
      authorization.resolvedPath === undefined ||
      authorization.sources === undefined ||
      authorization.decision === "DENY"
    ) {
      return { block: true, reason: `pi-warden DENY ${authorization.reason}` };
    }

    // Conservative hard-link rule for search/list tools: a hard-linked
    // regular-file search root (a possible secret alias) is denied before
    // any listing or content effect, and before any approval interaction.
    if (frame.kind === "search-root") {
      try {
        const { lstat } = await import("node:fs/promises");
        const rootStats = await lstat(authorization.resolvedPath.canonicalPath);
        if (rootStats.isFile() && rootStats.nlink !== 1) {
          return { block: true, reason: "pi-warden DENY HARD_LINKED_RESOURCE" };
        }
      } catch {
        return { block: true, reason: "pi-warden DENY RESOLUTION_FAILED (search root verify failed)" };
      }
    }

    const toolCallId =
      typeof call.toolCallId === "string" && call.toolCallId.length > 0 ? call.toolCallId : undefined;
    if (toolCallId === undefined) {
      return { block: true, reason: MALFORMED_INPUT_REASON };
    }
    const expected = controlledToolOwners.get(toolName);
    const observed = pi.getAllTools().filter((tool) => tool.name === toolName);
    if (expected === undefined || observed.length !== 1 || !sameOwner(observed[0].sourceInfo, expected)) {
      return { block: true, reason: CONTROLLED_TOOL_FOREIGN_OWNER_REASON };
    }

    // Capture the descriptor-bound execution plan from trusted host code
    // IMMEDIATELY after authorization and BEFORE any approval interaction, so
    // approval delay cannot bind a substituted object: the plan is immutable
    // from here on and execution compares against this exact capture.
    let plan: ExecutionPlan | undefined;
    if (frame.kind === "resource") {
      try {
        plan = await buildExecutionPlan(mappedOp, authorization.resolvedPath);
      } catch (error) {
        // Fail closed; specific plan refusals (hard-linked target,
        // non-regular target) surface their own reason.
        const message = error instanceof Error ? error.message : "";
        const reason = message.startsWith(BOUND_EXECUTION_REFUSED_PREFIX)
          ? message
          : "pi-warden DENY RESOLUTION_FAILED (execution plan unavailable)";
        return { block: true, reason };
      }
    }

    if (authorization.decision === "ASK") {
      const ui = approvalUI(ctx);
      const outcome = await requestScopedApproval(
        ui,
        {
          toolName,
          operation: mappedOp,
          requestedPath,
          canonicalPath: authorization.resolvedPath.canonicalPath,
          workspaceRoot: authorization.resolvedPath.workspaceRoot,
          reason: authorization.reason,
          protection: "none",
        },
        options.approvalTimeoutMs ? { timeoutMs: options.approvalTimeoutMs } : undefined,
      );
      if (outcome.status !== "granted") {
        return {
          block: true,
          reason: `pi-warden approval required (${authorization.reason}) — request blocked: ${outcome.status}`,
        };
      }
    }

    // Bind actual execution to the checked canonical identity: Pi applies
    // mutable `event.input` mutations to the real tool execution. The
    // descriptor-level object binding below is the security guarantee; this
    // string pinning is only an additional input constraint.
    if (typeof call.input === "object" && call.input !== null && !Array.isArray(call.input)) {
      (call.input as Record<string, unknown>).path = authorization.resolvedPath.canonicalPath;
    }

    if (plan !== undefined) {
      authorizedCalls.set(toolCallId, { tool: toolName, workspace, plan });
    } else {
      authorizedCalls.set(toolCallId, {
        tool: toolName,
        workspace,
        root: authorization.resolvedPath,
        loaded: authorization.sources,
      });
    }
    return undefined;
  }

  /**
   * Consumes the gate-issued binding exactly once for one identity: a later
   * call with the same id — same tool, another tool, or another operation —
   * always fails closed.
   */
  function consumeAuthorizedCall(
    toolCallId: string,
    toolName: string,
    workspace: string,
    params: unknown,
  ): AuthorizedCall {
    const call = authorizedCalls.get(toolCallId);
    // Consume the binding before any effect.
    const consumed = authorizedCalls.delete(toolCallId);
    if (
      call === undefined ||
      !consumed ||
      call.tool !== toolName ||
      call.workspace !== workspace ||
      typeof params !== "object" ||
      params === null ||
      Array.isArray(params)
    ) {
      throw new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON);
    }
    const requested = (params as { path?: unknown }).path;
    const canonical = call.plan !== undefined ? call.plan.canonicalPath : call.root?.canonicalPath;
    if (requested !== canonical) {
      throw new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON);
    }
    return call;
  }

  function requirePlan(call: AuthorizedCall, toolName: string): ExecutionPlan {
    if (call.plan === undefined) {
      throw new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON);
    }
    if (call.plan.tool !== toolName) {
      throw new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON);
    }
    return call.plan;
  }

  async function executeControlledRead(toolCallId: string, workspace: string, params: unknown): Promise<unknown> {
    const call = consumeAuthorizedCall(toolCallId, "read", workspace, params);
    const plan = requirePlan(call, "read");
    const typed = params as { offset?: unknown; limit?: unknown };
    const result = await executeBoundRead(plan, {
      offset: typeof typed.offset === "number" ? typed.offset : undefined,
      limit: typeof typed.limit === "number" ? typed.limit : undefined,
    });
    return { content: [{ type: "text", text: result.text }], details: undefined };
  }

  async function executeControlledWrite(toolCallId: string, workspace: string, params: unknown): Promise<unknown> {
    const call = consumeAuthorizedCall(toolCallId, "write", workspace, params);
    const plan = requirePlan(call, "write");
    const typed = params as { content?: unknown };
    if (typeof typed.content !== "string") {
      throw new Error(MALFORMED_INPUT_REASON);
    }
    // Participate in Pi's per-file mutation queue for parallel-tool parity.
    return withFileMutationQueue(plan.canonicalPath, async () => {
      await executeBoundWrite(plan, typed.content as string);
      return {
        content: [{ type: "text", text: `Successfully wrote ${(typed.content as string).length} bytes to ${plan.canonicalPath}` }],
        details: undefined,
      };
    });
  }

  async function executeControlledEdit(toolCallId: string, workspace: string, params: unknown): Promise<unknown> {
    const call = consumeAuthorizedCall(toolCallId, "edit", workspace, params);
    const plan = requirePlan(call, "edit");
    const typed = params as { edits?: unknown };
    if (typeof typed.edits !== "object" || typed.edits === null || !Array.isArray(typed.edits)) {
      throw new Error(MALFORMED_INPUT_REASON);
    }
    const edits = (typed.edits as unknown[]).map((entry) => entry as { oldText: string; newText: string });
    return withFileMutationQueue(plan.canonicalPath, async () => {
      await executeBoundEdit(plan, edits);
      return {
        content: [{ type: "text", text: `pi-warden controlled edit applied to ${plan.canonicalPath}` }],
        details: undefined,
      };
    });
  }

  function requireRoot(call: AuthorizedCall): { root: ResolvedPath; loaded: LoadedPolicySources } {
    if (call.root === undefined || call.loaded === undefined) {
      throw new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON);
    }
    return { root: call.root, loaded: call.loaded };
  }

  async function executeControlledLs(toolCallId: string, workspace: string, params: unknown): Promise<unknown> {
    const call = consumeAuthorizedCall(toolCallId, "ls", workspace, params);
    const basis = requireRoot(call);
    const result = await controlledLs(
      { workspace, authorizedRoot: basis.root, loaded: basis.loaded, services },
      positiveIntOr((params as { limit?: unknown }).limit, 500),
    );
    const omitted = result.excludedCount > 0 ? `\n[pi-warden: ${result.excludedCount} resource(s) withheld by policy]` : "";
    const text =
      result.lines.length === 0 ? `No entries${omitted}` : `${result.lines.join("\n")}${omitted}`;
    return { content: [{ type: "text", text }], details: undefined };
  }

  async function executeControlledFind(toolCallId: string, workspace: string, params: unknown): Promise<unknown> {
    const call = consumeAuthorizedCall(toolCallId, "find", workspace, params);
    const basis = requireRoot(call);
    const typed = params as { pattern?: unknown; limit?: unknown };
    const pattern = typeof typed.pattern === "string" ? typed.pattern : "";
    const result = await controlledFind(
      { workspace, authorizedRoot: basis.root, loaded: basis.loaded, services },
      pattern,
      positiveIntOr(typed.limit, 1000),
    );
    const omitted = result.excludedCount > 0 ? `\n[pi-warden: ${result.excludedCount} resource(s) withheld by policy]` : "";
    const text =
      result.lines.length === 0
        ? `No files found matching pattern${omitted}`
        : `${result.lines.join("\n")}${omitted}`;
    return { content: [{ type: "text", text }], details: undefined };
  }

  async function executeControlledGrep(toolCallId: string, workspace: string, params: unknown): Promise<unknown> {
    const call = consumeAuthorizedCall(toolCallId, "grep", workspace, params);
    const basis = requireRoot(call);
    const typed = params as {
      pattern?: unknown;
      glob?: unknown;
      ignoreCase?: unknown;
      literal?: unknown;
      context?: unknown;
      limit?: unknown;
    };
    if (typeof typed.context === "number" && typed.context > 0) {
      throw new Error("pi-warden: grep context is unsupported in controlled mode (fail closed)");
    }
    const result = await controlledGrep(
      { workspace, authorizedRoot: basis.root, loaded: basis.loaded, services },
      {
        pattern: typeof typed.pattern === "string" ? typed.pattern : "",
        glob: typeof typed.glob === "string" ? typed.glob : undefined,
        ignoreCase: typed.ignoreCase === true,
        literal: typed.literal === true,
        context: 0,
        limit: positiveIntOr(typed.limit, 100),
      },
    );
    const omitted = result.excludedCount > 0 ? `\n[pi-warden: ${result.excludedCount} resource(s) withheld by policy]` : "";
    const text =
      result.lines.length === 0 ? `No matches found${omitted}` : `${result.lines.join("\n")}${omitted}`;
    return { content: [{ type: "text", text }], details: undefined };
  }

  async function executeControlledBash(
    toolCallId: string,
    workspace: string,
    params: unknown,
    ctx: unknown,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    const pending = pendingShellCalls.get(toolCallId);
    const consumed = pendingShellCalls.delete(toolCallId);
    if (pending === undefined || !consumed) {
      throw new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON);
    }
    const frame = parseShellToolInput(params);
    if (frame === undefined || frame.command !== pending.authorized.plan.command) {
      await pending.authorized.prepared.dispose();
      throw new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON);
    }
    return await runControlledShellExecution(
      pending.authorized,
      shellServices,
      approvalUI(ctx),
      signal,
      frame.timeoutMs,
    );
  }

  async function runControlledShellExecution(
    authorized: AuthorizedShell,
    services: ShellServices,
    ui: ApprovalUI | undefined,
    signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
  ): Promise<unknown> {
    let output = "";
    const execution = await executeAuthorizedShellRoute({
      services,
      authorized,
      ui,
      signal,
      timeoutMs,
      onOutput: (chunk) => {
        output += chunk.toString("utf8");
        if (output.length > 4 * 1024 * 1024) output = output.slice(-2 * 1024 * 1024);
      },
    });
    if ("blocked" in execution) {
      throw new Error(execution.blocked);
    }
    const text = [output.trimEnd(), execution.report].filter((part) => part.length > 0).join("\n\n");
    if (execution.timedOut) {
      throw new Error(`${text}\n\nCommand timed out inside containment`);
    }
    if (execution.cancelled) {
      throw new Error(`${text}\n\nCommand aborted`);
    }
    if (execution.exitCode !== 0 && execution.exitCode !== null) {
      throw new Error(`${text}\n\nCommand exited with code ${execution.exitCode}`);
    }
    return { content: [{ type: "text", text }], details: undefined };
  }

  // Factory-load phase: `registerTool`/`on` are the only Pi calls valid here.
  // `getAllTools()` still throws (`Extension runtime not initialized`), so
  // ownership observation is deferred to the `session_start` handler above,
  // which Pi emits only after `bindCore`. A registration failure degrades
  // immediately; the per-session observation degrades on missing/duplicate.
  const controlledTools: readonly ControlledTool[] = [
    { name: "bash", run: executeControlledBash },
    { name: "read", run: executeControlledRead },
    { name: "write", run: executeControlledWrite },
    { name: "edit", run: executeControlledEdit },
    { name: "ls", run: executeControlledLs },
    { name: "find", run: executeControlledFind },
    { name: "grep", run: executeControlledGrep },
  ];
  for (const controlled of controlledTools) {
    const base = controlledBaseDefinition(controlled.name, process.cwd());
    if (base === undefined) {
      degraded = true;
      break;
    }
    const definition: object = {
      ...base,
      execute: (toolCallId: unknown, params: unknown, signal: unknown, _onUpdate: unknown, ctx: unknown) =>
        runControlledToolCall(controlled.run, toolCallId, params, ctx, signal),
    };
    try {
      pi.registerTool(definition);
    } catch {
      degraded = true;
      break;
    }
  }

  return {
    authorizedCalls,
    pendingShellCalls,
    get degraded() {
      return degraded;
    },
    get ready() {
      return ready;
    },
  };
}

export function runControlledToolCall(
  run: ControlledRun,
  toolCallId: unknown,
  params: unknown,
  ctx: unknown,
  signal?: unknown,
): Promise<unknown> {
  const dyn = ctx as ExtCtx | undefined;
  const workspace =
    dyn !== null && dyn !== undefined && typeof dyn["cwd"] === "string"
      ? (dyn["cwd"] as string)
      : process.cwd();
  if (typeof toolCallId !== "string" || toolCallId.length === 0) {
    return Promise.reject(new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON));
  }
  const abortSignal =
    typeof signal === "object" && signal !== null && "aborted" in signal ? (signal as AbortSignal) : undefined;
  try {
    return run(toolCallId, workspace, params, ctx, abortSignal);
  } catch (error) {
    return Promise.reject(error);
  }
}
