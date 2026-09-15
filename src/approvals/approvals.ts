/**
 * Scoped approval flow for effective ASK decisions.
 *
 * An approval is a one-time user confirmation for one exact operation on one
 * canonical resource, displayed with its decision state. It satisfies only a
 * matching effective ASK outcome; it never overrides a DENY, never changes a
 * configuration evaluation, and never grants containment or a shell/network
 * capability.
 *
 * Approval state lives in this module's private memory only: it is never
 * written into the repository, the workspace, Pi session files, or any
 * policy location, and it can never be produced from repository, model,
 * session, or tool-output data. The requester-supplied UI context is the only
 * trusted source of the user's decision.
 */

import type { AuthorizationOutcome } from "../policy/authority.ts";

export interface ApprovalRequest {
  readonly toolName: string;
  readonly operation: "read" | "write" | "edit";
  readonly requestedPath: string;
  readonly canonicalPath: string;
  readonly workspaceRoot: string;
  readonly reason: string;
  readonly protection: "none" | "protected-control-plane";
}

/** One-time grant. The holder cannot mint, copy, or extend it. */
export interface ApprovalGrant {
  readonly kind: "grant";
  readonly operation: "read" | "write" | "edit";
  readonly canonicalPath: string;
  readonly grantedAtMs: number;
  readonly consumedAtMs: number | undefined;
}

export type ApprovalOutcome =
  | { readonly status: "granted"; readonly grant: ApprovalGrant }
  | { readonly status: "refused" }
  | { readonly status: "unavailable" }
  | { readonly status: "malformed" };

/** The exact properties the confirmation dialog must show. */
export function approvalPromptFor(request: ApprovalRequest): { title: string; message: string } {
  const protectionText =
    request.protection === "protected-control-plane"
      ? "protection: this resource is a protected control-plane surface (not approvable through this request)"
      : "protection: none (ordinary resource protection only)";
  const message = [
    `pi-warden approval required.`,
    `operation: ${request.toolName} (policy operation ${request.operation})`,
    `requested: ${request.requestedPath}`,
    `canonical resource: ${request.canonicalPath}`,
    `workspace: ${request.workspaceRoot}`,
    `reason: ${request.reason}`,
    `scope: this single tool call only, no standing permission`,
    `duration: expires immediately after this one call; no approval state persists beyond it`,
    protectionText,
  ].join("\n");
  return { title: "pi-warden permission request", message };
}

export interface ApprovalUI {
  readonly hasUI: boolean;
  readonly confirm: (title: string, message: string, options?: { timeout?: number }) => Promise<boolean>;
  readonly notify?: (message: string, type?: "info" | "warning" | "error") => void;
}

/**
 * Requests a one-time approval. Every non-confirm outcome — refusal,
 * unavailable UI, throw, timeout (reported by the host as a false confirm),
 * malformed response object — fails closed. The grant is single-use and bound
 * to the exact operation and canonical resource of this call.
 */
export async function requestScopedApproval(
  ui: ApprovalUI | undefined,
  request: ApprovalRequest,
  options?: { timeoutMs?: number; notify?: (message: string) => void },
): Promise<ApprovalOutcome> {
  if (ui === undefined || ui.hasUI !== true || typeof ui.confirm !== "function") {
    return { status: "unavailable" };
  }
  const prompt = approvalPromptFor(request);
  options?.notify?.(prompt.message);
  let raw;
  try {
    raw = await ui.confirm(prompt.title, prompt.message, options?.timeoutMs ? { timeout: options.timeoutMs } : undefined);
  } catch {
    return { status: "refused" };
  }
  if (typeof raw !== "boolean") return { status: "malformed" };
  if (raw !== true) return { status: "refused" };

  const grantedAtMs = Date.now();
  const grant: {
    kind: "grant";
    operation: "read" | "write" | "edit";
    canonicalPath: string;
    grantedAtMs: number;
    consumedAtMs: number | undefined;
  } = {
    kind: "grant",
    operation: request.operation,
    canonicalPath: request.canonicalPath,
    grantedAtMs,
    consumedAtMs: undefined,
  };
  return Object.freeze({ status: "granted" as const, grant: Object.freeze(grant) });
}

const consumedGrants = new WeakSet<object>();

/**
 * Consumes a grant exactly once for a matching operation/canonical path.
 * Replay beyond the displayed use scope fails closed.
 */
export function consumeGrant(
  grant: unknown,
  operation: "read" | "write" | "edit",
  canonicalPath: string,
): boolean {
  if (typeof grant !== "object" || grant === null) return false;
  const candidate = grant as Partial<ApprovalGrant>;
  if (candidate["kind"] !== "grant") return false;
  if (candidate["operation"] !== operation) return false;
  if (candidate["canonicalPath"] !== canonicalPath) return false;
  if (consumedGrants.has(grant as object)) return false;
  consumedGrants.add(grant as object);
  return true;
}

/** Helper for reason surfacing without secret payloads or containment claims. */
export function describeDecisionForStatus(outcome: AuthorizationOutcome, reason: string): string {
  return `pi-warden decision: ${outcome} (${reason})`;
}
