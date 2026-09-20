/**
 * Shell approvals: one private, single-use, fully bound grant per contained
 * invocation.
 *
 * A shell grant authorizes execution inside the fixed containment only, with
 * the exact network scope bound into the grant (Goal 4). It cannot satisfy a
 * `DENY`, cannot widen the profile, cannot add a destination beyond the bound
 * scope, cannot be reused after any bound input changes, and does not
 * authorize any host write: export effects carry their own per-target
 * authorization.
 *
 * State is private in-memory only. It is never written into the workspace,
 * the repository, Pi session files, or any policy location, and it can never be
 * produced from repository, model, session, or tool-output data.
 */

import { createHash } from "node:crypto";

export interface ShellApprovalBindings {
  /** SHA-256 of the exact command text that will be executed. */
  readonly commandSha256: string;
  /** SHA-256 of the canonical parsed form. */
  readonly parsedFormSha256: string;
  readonly workspaceRoot: string;
  readonly cwd: string;
  /** Runtime instance identity: grants never transfer between runtimes. */
  readonly instanceId: string;
  /** Session epoch: incremented on every session shutdown. */
  readonly sessionEpoch: number;
  /** SHA-256 over the loaded policy source states. */
  readonly policySha256: string;
  /** SHA-256 of the generated Seatbelt profile. */
  readonly profileSha256: string;
  /** SHA-256 over the constructed environment. */
  readonly environmentSha256: string;
  /** SHA-256 of every sealed source/script buffer, in plan order. */
  readonly sealedInputSha256: readonly string[];
  /** The static resource outcomes the invocation was checked against. */
  readonly resourceOutcomes: readonly string[];
  /**
   * Canonical non-secret network scope the invocation enforces: the trusted
   * and approved destinations ("host:port" pairs). Empty when the route is
   * closed; the broker endpoint itself is bound through the profile hash.
   */
  readonly networkScopeSha256: string;
  readonly networkDestinations: readonly string[];
}

export interface ShellApprovalPresentation {
  readonly command: string;
  readonly workspaceRoot: string;
  readonly cwd: string;
  readonly commandRisk: string;
  readonly readOutcome: string;
  readonly mutationOutcome: string;
  /** Canonical destinations the invocation enforces; empty means closed. */
  readonly networkDestinations: readonly string[];
  readonly projectionSummary: string;
  readonly sealedInputs: readonly { readonly original: string; readonly sha256: string }[];
}

export interface ShellApprovalRequest {
  readonly bindings: ShellApprovalBindings;
  readonly presentation: ShellApprovalPresentation;
}

export interface ShellApprovalGrant {
  readonly kind: "shell-grant";
  readonly bindingsSha256: string;
  readonly grantedAtMs: number;
}

export type ShellApprovalOutcome =
  | { readonly status: "granted"; readonly grant: ShellApprovalGrant }
  | { readonly status: "refused" }
  | { readonly status: "unavailable" }
  | { readonly status: "malformed" }
  | { readonly status: "expired" };

export const SHELL_APPROVAL_TTL_MS = 60_000;

export interface ShellApprovalUI {
  readonly hasUI: boolean;
  readonly confirm: (title: string, message: string, options?: { timeout?: number }) => Promise<boolean>;
}

/** Canonical serialization of the bindings, used for the grant hash. */
export function serializeShellBindings(bindings: ShellApprovalBindings): string {
  return [
    `command=${bindings.commandSha256}`,
    `parsed=${bindings.parsedFormSha256}`,
    `workspace=${bindings.workspaceRoot}`,
    `cwd=${bindings.cwd}`,
    `instance=${bindings.instanceId}`,
    `epoch=${bindings.sessionEpoch}`,
    `policy=${bindings.policySha256}`,
    `profile=${bindings.profileSha256}`,
    `env=${bindings.environmentSha256}`,
    `sealed=${bindings.sealedInputSha256.join(",")}`,
    `resources=${bindings.resourceOutcomes.join(",")}`,
    `network=${bindings.networkScopeSha256}`,
    `destinations=${bindings.networkDestinations.join(",")}`,
  ].join("\n");
}

export function shellBindingsSha256(bindings: ShellApprovalBindings): string {
  return createHash("sha256").update(serializeShellBindings(bindings), "utf8").digest("hex");
}

/** The exact text the confirmation dialog must show. */
export function shellApprovalPrompt(request: ShellApprovalRequest): { title: string; message: string } {
  const { presentation } = request;
  const sealed =
    presentation.sealedInputs.length === 0
      ? "none"
      : presentation.sealedInputs
          .map((entry) => `${entry.original} (sealed sha256 ${entry.sha256.slice(0, 16)})`)
          .join(", ");
  const network =
    presentation.networkDestinations.length === 0
      ? "closed (no destinations approved; no network rule in the profile)"
      : [
          `outbound TCP to exactly: ${presentation.networkDestinations.join(", ")}`,
          "  (enforced at connection time by this invocation's network broker;",
          "  redirects, proxies, rebinding and all other destinations fail closed)",
        ].join("\n");
  const message = [
    "pi-warden shell approval required.",
    `command: ${presentation.command}`,
    `command risk class: ${presentation.commandRisk}`,
    `effective read outcome: ${presentation.readOutcome}`,
    `effective mutation outcome: ${presentation.mutationOutcome}`,
    `network scope: ${network}`,
    `workspace: ${presentation.workspaceRoot}`,
    `contained cwd: ${presentation.cwd}`,
    `projection: ${presentation.projectionSummary}`,
    `bound script inputs: ${sealed}`,
    "containment: deny-default Seatbelt profile,",
    "  constructed environment, no access to the original workspace, credentials or control plane",
    "effects: the command runs against a private projection; only individually re-authorized",
    "  changes to existing files and new files/directories are exported back afterwards;",
    "  deletions and renames inside the projection have no host effect",
    `scope: this single contained invocation only, expires in ${SHELL_APPROVAL_TTL_MS / 1000} seconds`,
    "approval does not widen containment and cannot satisfy a DENY",
    "permitted destinations can receive any data the command can read (projected workspace output)",
  ].join("\n");
  return { title: "pi-warden shell permission request", message };
}

export async function requestShellApproval(
  ui: ShellApprovalUI | undefined,
  request: ShellApprovalRequest,
  options?: { timeoutMs?: number; now?: () => number },
): Promise<ShellApprovalOutcome> {
  if (ui === undefined || ui.hasUI !== true || typeof ui.confirm !== "function") {
    return { status: "unavailable" };
  }
  const prompt = shellApprovalPrompt(request);
  let raw: unknown;
  try {
    raw = await ui.confirm(prompt.title, prompt.message, options?.timeoutMs ? { timeout: options.timeoutMs } : undefined);
  } catch {
    return { status: "refused" };
  }
  if (typeof raw !== "boolean") return { status: "malformed" };
  if (raw !== true) return { status: "refused" };
  const now = (options?.now ?? Date.now)();
  const grant: ShellApprovalGrant = Object.freeze({
    kind: "shell-grant" as const,
    bindingsSha256: shellBindingsSha256(request.bindings),
    grantedAtMs: now,
  });
  issuedGrants.add(grant);
  return Object.freeze({ status: "granted" as const, grant });
}

/**
 * Consumes a grant for exactly the bound invocation. Any change to the bound
 * inputs, expiry, or a replay fails closed.
 */
export function consumeShellApproval(
  grant: ShellApprovalGrant | undefined,
  bindings: ShellApprovalBindings,
  nowMs: number,
  ttlMs: number = SHELL_APPROVAL_TTL_MS,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (grant === undefined || grant.kind !== "shell-grant") {
    return { ok: false, reason: "no shell grant was issued for this invocation" };
  }
  if (!issuedGrants.has(grant)) {
    return { ok: false, reason: "shell grant was not issued by this process" };
  }
  if (consumedGrants.has(grant)) {
    return { ok: false, reason: "shell grant was already consumed" };
  }
  if (nowMs - grant.grantedAtMs > ttlMs) {
    return { ok: false, reason: "shell grant expired" };
  }
  const expected = shellBindingsSha256(bindings);
  if (expected !== grant.bindingsSha256) {
    return { ok: false, reason: "shell grant binding changed" };
  }
  consumedGrants.add(grant);
  return { ok: true };
}

/**
 * Module-owned registries. Only grants this module issued are accepted, and a
 * grant is consumed at most once; a structurally identical object built
 * elsewhere is refused.
 */
const issuedGrants = new WeakSet<object>();
const consumedGrants = new WeakSet<object>();
