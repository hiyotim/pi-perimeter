import type { AuthorizationOutcome } from "./authority.ts";
import {
  isLoadedPolicySources,
  policySourcesApplyToResource,
  type LoadedPolicySources,
  type PolicySourceErrorCode,
  type PolicySourceName,
  type PolicySourceState,
} from "./config-loader.ts";
import { policyContribution, type PolicyOperation } from "./configuration.ts";
import {
  evaluateEditPath,
  evaluateReadPath,
  evaluateWritePath,
  type EditPathDecision,
  type ReadPathDecision,
  type WritePathDecision,
} from "./decisions.ts";
import { mergeAuthorizationOutcomes } from "./merge.ts";
import type { ResolvedPath } from "./paths.ts";

type BaselineDecision = ReadPathDecision | WritePathDecision | EditPathDecision;
export type EffectiveReason =
  | BaselineDecision["reason"]
  | "CONFIGURATION_RESTRICTION"
  | "CONFIGURATION_INVALID"
  | "INVALID_POLICY_SOURCES";

export type EffectiveSourceExplanation =
  | { readonly source: PolicySourceName; readonly status: "not-evaluated" }
  | { readonly source: PolicySourceName; readonly status: "absent" }
  | {
      readonly source: PolicySourceName;
      readonly status: "valid";
      readonly contribution: AuthorizationOutcome | null;
    }
  | {
      readonly source: PolicySourceName;
      readonly status: "invalid";
      readonly code: PolicySourceErrorCode | "INVALID_POLICY_SOURCES";
    };

export interface EffectivePathDecision {
  readonly operation: PolicyOperation | "unsupported";
  readonly decision: AuthorizationOutcome;
  readonly reason: EffectiveReason;
  readonly baseline: Readonly<BaselineDecision>;
  readonly sources: readonly EffectiveSourceExplanation[];
}

function explainSource(
  source: PolicySourceName,
  value: PolicySourceState,
  operation: PolicyOperation,
): EffectiveSourceExplanation {
  if (value.status === "absent") return Object.freeze({ source, status: "absent" });
  if (value.status === "invalid") {
    return Object.freeze({ source, status: "invalid", code: value.code });
  }
  return Object.freeze({
    source,
    status: "valid",
    contribution: policyContribution(value.policy, operation) ?? null,
  });
}

function baselineFor(operation: PolicyOperation, resource: ResolvedPath): BaselineDecision {
  if (operation === "read") return evaluateReadPath(operation, resource);
  if (operation === "write") return evaluateWritePath(operation, resource);
  return evaluateEditPath(operation, resource);
}

function invalidSources(): readonly EffectiveSourceExplanation[] {
  return Object.freeze([
    Object.freeze({ source: "user", status: "invalid", code: "INVALID_POLICY_SOURCES" }),
    Object.freeze({ source: "project", status: "invalid", code: "INVALID_POLICY_SOURCES" }),
  ] as const);
}

function unevaluatedSources(): readonly EffectiveSourceExplanation[] {
  return Object.freeze([
    Object.freeze({ source: "user", status: "not-evaluated" }),
    Object.freeze({ source: "project", status: "not-evaluated" }),
  ] as const);
}

/**
 * Combines a genuine path decision with all exact-operation restrictions from
 * the loader-issued source set. It is pure and performs no filesystem or Pi work.
 */
export function evaluateEffectivePath(
  operation: PolicyOperation,
  resource: ResolvedPath,
  loaded: LoadedPolicySources,
): EffectivePathDecision {
  const validOperation = operation === "read" || operation === "write" || operation === "edit";
  if (!validOperation) {
    const baseline = Object.freeze({ decision: "DENY", reason: "UNSUPPORTED_OPERATION" } as const);
    return Object.freeze({
      operation: "unsupported",
      decision: "DENY",
      reason: "UNSUPPORTED_OPERATION",
      baseline,
      sources: unevaluatedSources(),
    });
  }

  const baseline = Object.freeze(baselineFor(operation, resource));
  if (!isLoadedPolicySources(loaded) || !policySourcesApplyToResource(loaded, resource)) {
    return Object.freeze({
      operation,
      decision: "DENY",
      reason: baseline.decision === "DENY" ? baseline.reason : "INVALID_POLICY_SOURCES",
      baseline,
      sources: invalidSources(),
    });
  }

  const sources = Object.freeze([
    explainSource("user", loaded.user, operation),
    explainSource("project", loaded.project, operation),
  ]);
  const invalidConfiguration = loaded.user.status === "invalid" || loaded.project.status === "invalid";
  const contributions: AuthorizationOutcome[] = [];
  if (loaded.user.status === "valid") {
    const contribution = policyContribution(loaded.user.policy, operation);
    if (contribution !== undefined) contributions.push(contribution);
  }
  if (loaded.project.status === "valid") {
    const contribution = policyContribution(loaded.project.policy, operation);
    if (contribution !== undefined) contributions.push(contribution);
  }

  const decision = invalidConfiguration
    ? "DENY"
    : mergeAuthorizationOutcomes(baseline.decision, ...contributions);
  const reason: EffectiveReason = baseline.decision === "DENY"
    ? baseline.reason
    : invalidConfiguration
      ? "CONFIGURATION_INVALID"
      : decision !== baseline.decision
        ? "CONFIGURATION_RESTRICTION"
        : baseline.reason;

  return Object.freeze({ operation, decision, reason, baseline, sources });
}
