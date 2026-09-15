/**
 * Central authorizer for model-facing file tools.
 *
 * Every file-tool effect flows through exactly one authorization sequence:
 * raw request path → resolver-issued canonical identity → protected
 * control-plane structuring → accepted baseline/config effective decision →
 * strictest merge. Any resolution, classification, loading, or combination
 * failure is a denial, never an allowance.
 *
 * This module performs no effect: it returns a decision plus the canonical
 * identity actual execution must be bound to. Approval is obtained by the
 * caller through the approvals module; this module never grants approval,
 * never weakens an outcome, and never passes a DENY through to execution.
 */

import type { AuthorizationOutcome } from "../policy/authority.ts";
import {
  isLoadedPolicySources,
  loadOperationPolicySources,
  policySourcesApplyToResource,
  type LoadedPolicySources,
} from "../policy/config-loader.ts";
import { protectedDenialFor, type ProtectedDenialReason, type ProtectedZone } from "../policy/control-plane.ts";
import { evaluateEffectivePath, type EffectiveReason } from "../policy/effective.ts";
import { mergeAuthorizationOutcomes } from "../policy/merge.ts";
import { resolveWorkspacePath, type ResolvedPath } from "../policy/paths.ts";

export type GateDenyReason =
  | ProtectedDenialReason
  | EffectiveReason
  | "RESOLUTION_FAILED";

export interface GateFailure {
  readonly decision: "DENY";
  readonly reason: GateDenyReason;
}

export interface GateAuthorization {
  readonly decision: AuthorizationOutcome;
  readonly reason: GateDenyReason;
  readonly resolvedPath: ResolvedPath | undefined;
  readonly sources: LoadedPolicySources | undefined;
}

export interface GateServices {
  readonly trustedUserConfigRoot: string;
  readonly protectedZones: readonly ProtectedZone[];
}

export async function authorizeResource(
  services: GateServices,
  workspace: string,
  operation: "read" | "write" | "edit",
  requestedPath: string,
): Promise<GateAuthorization> {
  let resolved: ResolvedPath;
  try {
    resolved = await resolveWorkspacePath(workspace, requestedPath);
  } catch {
    return { decision: "DENY", reason: "RESOLUTION_FAILED", resolvedPath: undefined, sources: undefined };
  }

  const protectedDenial = protectedDenialFor(resolved.canonicalPath, services.protectedZones);

  let loaded: LoadedPolicySources | undefined;
  let effective;
  try {
    loaded = await loadOperationPolicySources(resolved, services.trustedUserConfigRoot);
  } catch {
    loaded = undefined;
  }
  if (!loaded || !isLoadedPolicySources(loaded) || !policySourcesApplyToResource(loaded, resolved)) {
    return {
      decision: "DENY",
      reason: protectedDenial ? protectedDenial.reason : "INVALID_POLICY_SOURCES",
      resolvedPath: resolved,
      sources: loaded,
    };
  }

  try {
    effective = evaluateEffectivePath(operation, resolved, loaded);
  } catch {
    return {
      decision: "DENY",
      reason: protectedDenial ? protectedDenial.reason : "CONFIGURATION_INVALID",
      resolvedPath: resolved,
      sources: loaded,
    };
  }

  if (protectedDenial) {
    const merged = mergeAuthorizationOutcomes(effective.decision, "DENY");
    return {
      decision: merged,
      reason: protectedDenial.reason,
      resolvedPath: resolved,
      sources: loaded,
    };
  }

  return {
    decision: effective.decision,
    reason: effective.reason,
    resolvedPath: resolved,
    sources: loaded,
  };
}
