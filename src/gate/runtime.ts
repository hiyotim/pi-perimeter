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
 * - `bash` / `powershell`: blocked (no unrestricted shell for any route).
 * - unknown/unintegrated model-facing tools: blocked (fail closed), so dynamic
 *   registration or activation still cannot create unmediated effects.
 * - user `!` / `!!` shell execution: replaced with a blocked result; no shell
 *   is spawned. Failure to register a controlled tool, or to observe its owned
 *   registration, marks the runtime degraded and blocks the affected tools.
 */

import {
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
import { mapFileToolToOperation, isBlockedShellTool } from "../policy/operations.ts";
import type { ResolvedPath } from "../policy/paths.ts";
import { authorizeResource, type GateServices } from "./authorizer.ts";
import { parseGateInput } from "./gate-input.ts";
import { controlledFind, controlledGrep, controlledLs } from "./controlled-traversal.ts";

export const SHELL_BLOCK_REASON = "pi-warden: shell execution is disabled while pi-warden is active";
export const UNKNOWN_TOOL_REASON = "pi-warden: tool is not integrated and is blocked (fail closed)";
export const MALFORMED_INPUT_REASON = "pi-warden: tool input failed validation";
export const MISSING_WORKSPACE_REASON = "pi-warden: missing trusted workspace context";
export const CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON =
  "pi-warden: controlled tool executed without a gate-issued authorization";
export const CONTROLLED_TOOL_FOREIGN_OWNER_REASON =
  "pi-warden: controlled tool registration does not match the authorized owner";
export const GATE_FAILURE_REASON =
  "pi-warden: gate initialization failed; affected operations are blocked (fail closed)";

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
  readonly degraded: boolean;
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
type ControlledRun = (toolCallId: string, workspace: string, params: unknown) => Promise<unknown>;

interface ControlledTool {
  readonly name: "grep" | "find" | "ls" | "read" | "write" | "edit";
  readonly run: ControlledRun;
}

function controlledBaseDefinition(
  toolName: ControlledTool["name"],
  cwd: string,
): object | undefined {
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

  let degraded = false;
  const authorizedCalls = new Map<string, AuthorizedCall>();
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

  pi.on("session_shutdown", () => {
    authorizedCalls.clear();
    // Ownership observations belong to the current session binding; a new
    // session binding must reobserve them before controlled calls run.
    controlledToolOwners.clear();
  });

  pi.on("tool_call", async (event: unknown, ctx: unknown) => {
    try {
      return await handleToolCall(event, ctx);
    } catch {
      return { block: true, reason: GATE_FAILURE_REASON };
    }
  });

  pi.on("user_bash", () => ({
    result: {
      output: `${SHELL_BLOCK_REASON}\n(command not executed)`,
      exitCode: 126,
      cancelled: false,
      truncated: false,
    },
  }));

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
      return { block: true, reason: `${SHELL_BLOCK_REASON} (${toolName})` };
    }

    const mappedOp = mapFileToolToOperation(toolName);
    if (mappedOp === undefined) {
      return { block: true, reason: UNKNOWN_TOOL_REASON };
    }

    if (degraded) {
      return { block: true, reason: GATE_FAILURE_REASON };
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

  const controlledTools: readonly ControlledTool[] = [
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
      execute: (toolCallId: unknown, params: unknown, _signal: unknown, _onUpdate: unknown, ctx: unknown) =>
        runControlledToolCall(controlled.run, toolCallId, params, ctx),
    };
    try {
      pi.registerTool(definition);
    } catch {
      degraded = true;
      break;
    }
    const observed = pi.getAllTools().filter((tool) => tool.name === controlled.name);
    if (observed.length !== 1) {
      degraded = true;
      break;
    }
    controlledToolOwners.set(controlled.name, observed[0].sourceInfo);
  }

  return { authorizedCalls, degraded };
}

export function runControlledToolCall(
  run: ControlledRun,
  toolCallId: unknown,
  params: unknown,
  ctx: unknown,
): Promise<unknown> {
  const dyn = ctx as ExtCtx | undefined;
  const workspace =
    dyn !== null && dyn !== undefined && typeof dyn["cwd"] === "string"
      ? (dyn["cwd"] as string)
      : process.cwd();
  if (typeof toolCallId !== "string" || toolCallId.length === 0) {
    return Promise.reject(new Error(CONTROLLED_TOOL_MISSING_AUTHORIZATION_REASON));
  }
  try {
    return run(toolCallId, workspace, params);
  } catch (error) {
    return Promise.reject(error);
  }
}
