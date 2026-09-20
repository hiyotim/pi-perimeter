/**
 * Shell runtime: the single lifecycle both supported shell routes use.
 *
 *   authorize (plan, static resources, effective outcomes, approval)
 *   prepare   (platform/helper verification, profile, projection, sealing)
 *   execute   (contained run, quiescence)
 *   export    (per-target re-authorization, bound effects)
 *   dispose   (invocation-owned artifacts only)
 *
 * The model `bash` tool and user `!`/`!!` both call this module; there is no
 * second spawn path and no fallback. Nothing here can widen containment: a
 * refusal blocks the invocation.
 */

import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";

import {
  isLoadedPolicySources,
  loadOperationPolicySources,
  type LoadedPolicySources,
} from "../policy/config-loader.ts";
import type { ProtectedZone } from "../policy/control-plane.ts";
import { protectedDenialFor } from "../policy/control-plane.ts";
import { resolveWorkspacePath } from "../policy/paths.ts";
import { classifyPathResource } from "../policy/resources.ts";
import { evaluateEffectivePath } from "../policy/effective.ts";
import { buildShellPlan, shellQuoteLiteral, type ShellPlan } from "../policy/shell-plan.ts";
import {
  composeNetworkScope,
  extractNetworkTargets,
  unapprovedNetworkTargets,
  type ComposedNetworkScope,
  type ShellNetworkTarget,
} from "../policy/network.ts";
import {
  decideShellInvocation,
  shellOutcomeContributions,
  type ShellNetworkState,
  type ShellPolicyDecision,
  type ShellResourceOutcome,
} from "../policy/shell-policy.ts";
import {
  consumeShellApproval,
  requestShellApproval,
  type ShellApprovalBindings,
  type ShellApprovalGrant,
  type ShellApprovalUI,
} from "../approvals/shell-approvals.ts";
import { requestScopedApproval, type ApprovalUI } from "../approvals/approvals.ts";
import { prepareContainedInvocation, executePreparedInvocation, type ContainedRunResult, type PreparedContainedInvocation } from "../sandbox/containment.ts";
import { refusalReason } from "../sandbox/errors.ts";

export const SHELL_POLICY_DENY_PREFIX = "pi-warden SHELL DENY";
export const SHELL_APPROVAL_PREFIX = "pi-warden approval required";

export interface ShellServices {
  readonly trustedUserConfigRoot: string;
  readonly protectedZones: readonly ProtectedZone[];
  readonly helperPath: string;
  readonly buildManifestPath: string;
  readonly approvalTimeoutMs?: number;
  readonly runtimeBaseDirectory?: string;
  /** Runtime instance identity: approvals never transfer between runtimes. */
  readonly instanceId?: string;
}

export interface ShellRouteRequest {
  readonly services: ShellServices;
  readonly workspace: string;
  readonly command: string;
  readonly ui: ApprovalUI | undefined;
  readonly sessionEpoch: number;
}

export interface AuthorizedShell {
  readonly command: string;
  readonly plan: ShellPlan;
  readonly decision: ShellPolicyDecision;
  readonly loaded: LoadedPolicySources;
  readonly prepared: PreparedContainedInvocation;
  readonly bindings: ShellApprovalBindings;
  readonly grant: ShellApprovalGrant | undefined;
}

export type ShellAuthorizationResult =
  | { readonly status: "blocked"; readonly reason: string }
  | { readonly status: "authorized"; readonly authorized: AuthorizedShell };

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function instanceIdOf(services: ShellServices): string {
  return services.instanceId ?? "default";
}

/** Hash over the loaded policy source states, used in approval bindings. */
export function policyStateSha256(loaded: LoadedPolicySources): string {
  return sha256(
    JSON.stringify({
      user: loaded.user.status === "valid" ? { status: "valid", policy: loaded.user.policy } : loaded.user,
      project: loaded.project.status === "valid" ? { status: "valid", policy: loaded.project.policy } : loaded.project,
    }),
  );
}

export function environmentSha256(environment: Readonly<Record<string, string>>): string {
  return sha256(
    Object.keys(environment)
      .sort()
      .map((key) => `${key}=${environment[key]}`)
      .join("\n"),
  );
}

/** Canonical non-secret destination string used in bindings and prompts. */
function canonicalDestination(target: ShellNetworkTarget): string {
  return `${target.host}:${target.port}`;
}

/**
 * The enforced network state of one invocation: the composed trusted/project
 * scope plus the representable destinations of the plan (which are pinned as
 * part of preparation and must be approved when they are not already
 * covered). Canonical, non-secret, and identical to what the broker enforces.
 * Exported for its pure regressions (the merge rules are policy, not wiring).
 */
export function networkStateOf(
  scope: ComposedNetworkScope,
  targets: readonly ShellNetworkTarget[],
): { state: ShellNetworkState; scopeEntries: readonly { host: string; ports: readonly number[] }[] } {
  if (scope.status !== "open") {
    // Closed: a network-class command denies as in Goal 3; nothing is pinned.
    return {
      state: Object.freeze({ status: "closed" as const, entries: Object.freeze([]), unapprovedTargets: Object.freeze([]) }),
      scopeEntries: Object.freeze([]),
    };
  }
  const unapproved = unapprovedNetworkTargets(scope, targets);
  const entries = scope.entries.flatMap((entry) => entry.ports.map((port) => `${entry.host}:${port}`));
  /*
   * Approved targets are merged per host before pinning: the broker keys
   * destinations by host, so an approved port on an already-trusted host must
   * extend that entry's port set instead of creating a second entry that the
   * broker's map would overwrite.
   */
  const merged = new Map<string, number[]>();
  for (const entry of scope.entries) {
    const ports = merged.get(entry.host) ?? [];
    ports.push(...entry.ports);
    merged.set(entry.host, ports);
  }
  for (const target of unapproved) {
    const ports = merged.get(target.host) ?? [];
    if (!ports.includes(target.port)) {
      ports.push(target.port);
      merged.set(target.host, ports);
    }
  }
  return {
    state: Object.freeze({
      status: "open" as const,
      entries: Object.freeze(entries),
      unapprovedTargets: Object.freeze(unapproved.map(canonicalDestination)),
    }),
    scopeEntries: Object.freeze(
      [...merged].map(([host, ports]) => Object.freeze({ host, ports: Object.freeze([...new Set(ports)].sort((left, right) => left - right)) })),
    ),
  };
}

/**
 * Evaluates one statically visible operand against the same projection
 * predicate the import uses. Returns undefined when the operand is not a
 * projected object (it does not exist, or the command creates it later).
 */
async function evaluateOperand(
  request: ShellRouteRequest,
  loaded: LoadedPolicySources,
  operand: { readonly kind: "read" | "write"; readonly logicalPath: string; readonly origin: string },
): Promise<ShellResourceOutcome | { readonly refusal: string } | undefined> {
  if (operand.logicalPath.length === 0) return undefined;
  let resolved;
  try {
    resolved = await resolveWorkspacePath(request.workspace, operand.logicalPath);
  } catch {
    return { refusal: `${operand.origin} ${operand.logicalPath}: path resolution failed` };
  }
  if (!resolved.targetExists) return undefined;

  const protection = protectedDenialFor(resolved.canonicalPath, request.services.protectedZones);
  if (protection !== undefined) {
    return {
      kind: operand.kind,
      logicalPath: operand.logicalPath,
      decision: "DENY",
      reason: `PROTECTED_RESOURCE (${protection.zone})`,
    };
  }
  let classification;
  try {
    classification = classifyPathResource(resolved);
  } catch {
    return {
      kind: operand.kind,
      logicalPath: operand.logicalPath,
      decision: "DENY",
      reason: "classification failed",
    };
  }
  if (classification.sensitivity !== "ordinary") {
    return {
      kind: operand.kind,
      logicalPath: operand.logicalPath,
      decision: "DENY",
      reason: `${classification.matches.map((match) => match.reason).join(",") || classification.sensitivity}`,
    };
  }
  if (!resolved.insideWorkspace) {
    return {
      kind: operand.kind,
      logicalPath: operand.logicalPath,
      decision: "DENY",
      reason: "operand resolves outside the workspace projection",
    };
  }
  try {
    const effective = evaluateEffectivePath(operand.kind, resolved, loaded);
    return {
      kind: operand.kind,
      logicalPath: operand.logicalPath,
      decision: effective.decision,
      reason: effective.reason,
    };
  } catch {
    return {
      kind: operand.kind,
      logicalPath: operand.logicalPath,
      decision: "DENY",
      reason: "effective policy evaluation failed",
    };
  }
}

/**
 * Authorizes one shell invocation and prepares its contained state. The
 * projection and any sealed inputs are built *before* the approval so the
 * grant binds the exact bytes that will be executed.
 */
export async function authorizeShellRoute(request: ShellRouteRequest): Promise<ShellAuthorizationResult> {
  const planResult = buildShellPlan(request.command);
  if (!planResult.ok) {
    return { status: "blocked", reason: `${SHELL_POLICY_DENY_PREFIX} unsupported input (${planResult.code}: ${planResult.detail})` };
  }
  const plan = planResult.plan;

  let resolvedRoot;
  try {
    resolvedRoot = await resolveWorkspacePath(request.workspace, ".");
  } catch {
    return { status: "blocked", reason: `${SHELL_POLICY_DENY_PREFIX} workspace could not be resolved` };
  }
  const loaded = await loadOperationPolicySources(resolvedRoot, request.services.trustedUserConfigRoot);
  if (!isLoadedPolicySources(loaded)) {
    return { status: "blocked", reason: `${SHELL_POLICY_DENY_PREFIX} policy sources could not be loaded` };
  }

  const contributions = shellOutcomeContributions(loaded);
  const resourceOutcomes: ShellResourceOutcome[] = [];
  const refusals: { code: string; detail: string }[] = [...plan.refusals];
  for (const operand of plan.operands) {
    const outcome = await evaluateOperand(request, loaded, operand);
    if (outcome === undefined) continue;
    if ("refusal" in outcome) {
      refusals.push({ code: "SHELL_OPERAND_REFUSED", detail: outcome.refusal });
      continue;
    }
    resourceOutcomes.push(outcome);
  }
  // Sealed inputs are projection paths; they must be projected objects too.
  for (const sealed of plan.sealed) {
    const outcome = await evaluateOperand(request, loaded, {
      kind: "read",
      logicalPath: sealed.logicalPath,
      origin: sealed.origin,
    });
    if (outcome === undefined) {
      refusals.push({
        code: "SHELL_DYNAMIC_SOURCE",
        detail: `bound script input ${sealed.logicalPath} is not a projected object`,
      });
      continue;
    }
    if ("refusal" in outcome) {
      refusals.push({ code: "SHELL_DYNAMIC_SOURCE", detail: outcome.refusal });
      continue;
    }
    resourceOutcomes.push(outcome);
  }

  /*
   * The composed network scope plus the plan's representable destinations:
   * together the exact set the broker will pin and enforce, and the set the
   * approval must show. With a closed scope nothing is pinned and a
   * network-class command denies exactly as in Goal 3.
   */
  const network = networkStateOf(composeNetworkScope(loaded.user, loaded.project), plan.networkTargets);

  const decision = decideShellInvocation({
    readOutcome: contributions.read,
    mutationOutcome: contributions.mutation,
    configurationInvalid: contributions.invalid,
    refusals,
    commandRisk: plan.risk,
    commandRiskReasons: plan.riskReasons,
    riskClasses: plan.riskClasses,
    network: network.state,
    resourceOutcomes,
  });
  if (decision.decision === "DENY") {
    return { status: "blocked", reason: `${SHELL_POLICY_DENY_PREFIX} ${decision.reason}: ${decision.detail}` };
  }

  let prepared: PreparedContainedInvocation;
  try {
    prepared = await prepareContainedInvocation({
      command: request.command,
      workspaceRoot: resolvedRoot.workspaceRoot,
      loaded,
      protectedZones: request.services.protectedZones,
      trustedUserConfigRoot: request.services.trustedUserConfigRoot,
      helperPath: request.services.helperPath,
      buildManifestPath: request.services.buildManifestPath,
      sealedInputs: plan.sealed.map((sealed) => sealed.logicalPath),
      ...(network.scopeEntries.length > 0 ? { networkScope: network.scopeEntries } : {}),
      ...(request.services.runtimeBaseDirectory !== undefined
        ? { runtimeBaseDirectory: request.services.runtimeBaseDirectory }
        : {}),
    });
  } catch (error) {
    const refusal = refusalReason(error);
    return { status: "blocked", reason: `${SHELL_POLICY_DENY_PREFIX} ${refusal.code}: ${refusal.detail}` };
  }

  const bindings: ShellApprovalBindings = {
    commandSha256: sha256(prepared.command),
    parsedFormSha256: sha256(JSON.stringify(plan.operands.map((operand) => `${operand.kind}:${operand.logicalPath}`))),
    workspaceRoot: resolvedRoot.workspaceRoot,
    cwd: prepared.paths.staging,
    instanceId: instanceIdOf(request.services),
    sessionEpoch: request.sessionEpoch,
    policySha256: policyStateSha256(loaded),
    profileSha256: prepared.profile.sha256,
    environmentSha256: environmentSha256(prepared.environment),
    sealedInputSha256: prepared.sealedInputs.map((input) => input.sha256),
    resourceOutcomes: resourceOutcomes.map(
      (outcome) => `${outcome.kind}:${outcome.logicalPath}=${outcome.decision}(${outcome.reason})`,
    ),
    networkScopeSha256: sha256(
      JSON.stringify({
        status: network.state.status,
        entries: network.state.entries,
        unapprovedTargets: network.state.unapprovedTargets,
      }),
    ),
    networkDestinations: Object.freeze(
      network.state.status === "open"
        ? [...network.state.entries, ...network.state.unapprovedTargets]
        : [],
    ),
  };

  let grant: ShellApprovalGrant | undefined;
  if (decision.decision === "ASK") {
    const sealedByLogicalPath = new Map(prepared.sealedInputs.map((input) => [input.logicalPath, input]));
    const outcome = await requestShellApproval(
      request.ui as ShellApprovalUI | undefined,
      {
        bindings,
        presentation: {
          command: prepared.command,
          workspaceRoot: resolvedRoot.workspaceRoot,
          cwd: prepared.paths.staging,
          commandRisk: plan.risk,
          readOutcome: decision.readOutcome,
          mutationOutcome: decision.mutationOutcome,
          networkDestinations: bindings.networkDestinations,
          projectionSummary: `${prepared.manifest.files} files, ${prepared.manifest.directories} directories, ${prepared.manifest.symlinks} symlinks, ${prepared.manifest.refusals.length} excluded objects`,
          sealedInputs: plan.sealed.map((sealed) => ({
            original: sealed.logicalPath,
            sha256: sealedByLogicalPath.get(sealed.logicalPath)?.sha256 ?? "",
          })),
        },
      },
      request.services.approvalTimeoutMs !== undefined ? { timeoutMs: request.services.approvalTimeoutMs } : undefined,
    );
    if (outcome.status !== "granted") {
      await prepared.dispose();
      return {
        status: "blocked",
        reason: `${SHELL_APPROVAL_PREFIX} (${decision.reason}) — request blocked: ${outcome.status}`,
      };
    }
    grant = outcome.grant;
  }

  return {
    status: "authorized",
    authorized: { command: prepared.command, plan, decision, loaded, prepared, bindings, grant },
  };
}

export interface ShellExecutionRequest {
  readonly services: ShellServices;
  readonly authorized: AuthorizedShell;
  readonly ui: ApprovalUI | undefined;
  readonly signal: AbortSignal | undefined;
  readonly timeoutMs: number | undefined;
  readonly onOutput: (chunk: Buffer) => void;
}

/**
 * Per-target export authorization. Each effect carries its own fresh `write`
 * decision; `ASK` needs its own approval; the invocation grant never
 * pre-authorizes an effect and never widens containment.
 */
async function authorizeExportEffect(
  services: ShellServices,
  workspace: string,
  ui: ApprovalUI | undefined,
  change: { readonly relativePath: string; readonly kind: "create" | "mkdir" | "replace" },
): Promise<{ decision: "ALLOW" | "ASK" | "DENY"; reason: string }> {
  let resolved;
  try {
    resolved = await resolveWorkspacePath(workspace, change.relativePath);
  } catch {
    return { decision: "DENY", reason: "export target path resolution failed" };
  }
  const protection = protectedDenialFor(resolved.canonicalPath, services.protectedZones);
  if (protection !== undefined) {
    return { decision: "DENY", reason: `PROTECTED_RESOURCE (${protection.zone})` };
  }
  let classification;
  try {
    classification = classifyPathResource(resolved);
  } catch {
    return { decision: "DENY", reason: "export target classification failed" };
  }
  if (classification.sensitivity !== "ordinary") {
    return {
      decision: "DENY",
      reason: `export target is ${classification.sensitivity} (${classification.matches.map((match) => match.reason).join(",")})`,
    };
  }
  if (!resolved.insideWorkspace) {
    return { decision: "DENY", reason: "export target is outside the workspace" };
  }
  const loaded = await loadOperationPolicySources(resolved, services.trustedUserConfigRoot);
  let effective;
  try {
    effective = evaluateEffectivePath("write", resolved, loaded);
  } catch {
    return { decision: "DENY", reason: "export target policy evaluation failed" };
  }
  if (effective.decision === "DENY") {
    return { decision: "DENY", reason: `export denied by policy (${effective.reason})` };
  }
  if (effective.decision === "ASK") {
    const approval = await requestScopedApproval(
      ui,
      {
        toolName: `export ${change.kind}`,
        operation: "write",
        requestedPath: change.relativePath,
        canonicalPath: resolved.canonicalPath,
        workspaceRoot: resolved.workspaceRoot,
        reason: effective.reason,
        protection: "none",
      },
      services.approvalTimeoutMs !== undefined ? { timeoutMs: services.approvalTimeoutMs } : undefined,
    );
    return approval.status === "granted"
      ? { decision: "ALLOW", reason: "per-target export approval granted" }
      : { decision: "DENY", reason: `export approval ${approval.status}` };
  }
  return { decision: "ALLOW", reason: `export policy ${effective.reason}` };
}

/**
 * Executes an authorized invocation. The approval grant (when the outcome was
 * `ASK`) is consumed exactly here, against the exact bindings that were
 * approved; a mismatch, expiry or replay blocks execution.
 */
export async function executeAuthorizedShellRoute(
  request: ShellExecutionRequest,
): Promise<ContainedRunResult | { readonly blocked: string }> {
  const { authorized } = request;
  if (authorized.decision.decision === "ASK") {
    // The grant is consumed against the exact bindings that were approved.
    const consumption = consumeShellApproval(authorized.grant, authorized.bindings, Date.now());
    if (!consumption.ok) {
      await authorized.prepared.dispose();
      return { blocked: `${SHELL_APPROVAL_PREFIX} — ${consumption.reason}` };
    }
  }

  try {
    return await executePreparedInvocation(authorized.prepared, {
      timeoutMs: request.timeoutMs,
      signal: request.signal,
      onOutput: request.onOutput,
      authorizeExport: (change) =>
        authorizeExportEffect(request.services, authorized.prepared.workspaceRoot, request.ui, change),
    });
  } catch (error) {
    const refusal = refusalReason(error);
    return { blocked: `${SHELL_POLICY_DENY_PREFIX} ${refusal.code}: ${refusal.detail}` };
  } finally {
    await authorized.prepared.dispose();
  }
}

/** Reports the effective outcome for status surfaces; no secret payloads. */
export function describeShellDecision(decision: ShellPolicyDecision): string {
  return `shell ${decision.decision} (${decision.reason}): ${decision.detail}`;
}
