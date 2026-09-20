/**
 * Effective shell policy: joins the accepted policy model with the bounded
 * shell plan and produces one outcome for one contained invocation.
 *
 * Pure and synchronous. It reads no configuration itself, performs no
 * filesystem or process work, and can neither grant containment nor widen a
 * profile. `DENY` always wins; `ALLOW` never waives a stronger command-risk
 * class or a stricter resource outcome.
 */

import type { AuthorizationOutcome } from "./authority.ts";
import { isLoadedPolicySources, type LoadedPolicySources } from "./config-loader.ts";
import { policyContribution } from "./configuration.ts";
import { mergeAuthorizationOutcomes } from "./merge.ts";
import { isDeniedRisk, strictestShellRisk, type ShellCommandRisk } from "./shell-commands.ts";

export type ShellPolicyReason =
  | "SHELL_UNSUPPORTED_INPUT"
  | "SHELL_COMMAND_DENIED"
  | "SHELL_RESOURCE_DENIED"
  | "SHELL_CONFIGURATION_INVALID"
  | "SHELL_POLICY_DENIED"
  | "SHELL_APPROVAL_REQUIRED"
  | "SHELL_INVOCATION_ALLOWED";

export interface ShellOutcomeContributions {
  readonly read: AuthorizationOutcome;
  readonly mutation: AuthorizationOutcome;
  readonly invalid: boolean;
}

/**
 * Derives the shell read/mutation requirements from the loaded source set.
 * The shell cannot distinguish an in-place edit from a write, so the `edit`
 * contribution constrains every shell mutation. Invalid sources deny both.
 */
export function shellOutcomeContributions(loaded: LoadedPolicySources): ShellOutcomeContributions {
  if (!isLoadedPolicySources(loaded)) {
    return Object.freeze({ read: "DENY" as const, mutation: "DENY" as const, invalid: true });
  }
  const invalid = loaded.user.status === "invalid" || loaded.project.status === "invalid";
  const collect = (operation: "read" | "write" | "edit"): AuthorizationOutcome[] => {
    const values: AuthorizationOutcome[] = [];
    if (loaded.user.status === "valid") {
      const contribution = policyContribution(loaded.user.policy, operation);
      if (contribution !== undefined) values.push(contribution);
    }
    if (loaded.project.status === "valid") {
      const contribution = policyContribution(loaded.project.policy, operation);
      if (contribution !== undefined) values.push(contribution);
    }
    return values;
  };
  if (invalid) {
    return Object.freeze({ read: "DENY" as const, mutation: "DENY" as const, invalid: true });
  }
  const read = mergeAuthorizationOutcomes("ALLOW", ...collect("read"));
  const mutation = mergeAuthorizationOutcomes(
    "ALLOW",
    ...collect("write"),
    ...collect("edit"),
  );
  return Object.freeze({ read, mutation, invalid: false });
}

export interface ShellResourceOutcome {
  readonly kind: "read" | "write";
  readonly logicalPath: string;
  readonly decision: AuthorizationOutcome;
  readonly reason: string;
}

/**
 * The composed network scope and the representable destinations that are not
 * covered by it, both canonical and non-secret. `closed` means no destination
 * is reachable; a network-class command then denies exactly as in Goal 3.
 */
export interface ShellNetworkState {
  readonly status: "closed" | "open";
  /** Canonical non-secret entries of the effective scope (`host:port`). */
  readonly entries: readonly string[];
  /** Canonical representable destinations the scope does not cover. */
  readonly unapprovedTargets: readonly string[];
}

export interface ShellPolicyInputs {
  readonly readOutcome: AuthorizationOutcome;
  readonly mutationOutcome: AuthorizationOutcome;
  readonly configurationInvalid: boolean;
  /** Refusals from the bounded parser/plan (unsupported or external forms). */
  readonly refusals: readonly { readonly code: string; readonly detail: string }[];
  readonly commandRisk: ShellCommandRisk;
  readonly commandRiskReasons: readonly string[];
  /** Distinct per-command risk classes, in first-seen plan order. */
  readonly riskClasses: readonly ShellCommandRisk[];
  readonly network: ShellNetworkState;
  readonly resourceOutcomes: readonly ShellResourceOutcome[];
}

export interface ShellPolicyDecision {
  readonly decision: AuthorizationOutcome;
  readonly reason: ShellPolicyReason;
  readonly detail: string;
  readonly readOutcome: AuthorizationOutcome;
  readonly mutationOutcome: AuthorizationOutcome;
  readonly commandRisk: ShellCommandRisk;
}

function denied(reason: ShellPolicyReason, detail: string, inputs: ShellPolicyInputs): ShellPolicyDecision {
  return Object.freeze({
    decision: "DENY" as const,
    reason,
    detail,
    readOutcome: inputs.readOutcome,
    mutationOutcome: inputs.mutationOutcome,
    commandRisk: inputs.commandRisk,
  });
}

/**
 * Combines every applicable restriction into one invocation outcome.
 *
 * Order of precedence: unsupported input, denied command class, denied
 * resource, invalid configuration or denied effective outcome, then `ASK`
 * (which always requires a single-use approval), then `ALLOW`.
 *
 * The `network` command class is denied only while the composed scope is
 * closed; with an open scope it contributes an `ASK` exactly when the command
 * names a representable destination the scope does not already cover, and the
 * other denied classes keep denying regardless (a per-command class in a
 * denied category can never hide behind a network-allowed command line).
 */
export function decideShellInvocation(inputs: ShellPolicyInputs): ShellPolicyDecision {
  if (inputs.refusals.length > 0) {
    const first = inputs.refusals[0];
    const extra = inputs.refusals.length > 1 ? ` (+${inputs.refusals.length - 1} more)` : "";
    return denied("SHELL_UNSUPPORTED_INPUT", `${first.code}: ${first.detail}${extra}`, inputs);
  }
  const networkOpen = inputs.network.status === "open";
  const deniedRiskClass = inputs.riskClasses.find(
    (risk) => isDeniedRisk(risk) && !(risk === "network" && networkOpen),
  );
  if (deniedRiskClass !== undefined) {
    const reason = inputs.commandRiskReasons[0] ?? "command class is denied";
    return denied("SHELL_COMMAND_DENIED", reason, inputs);
  }
  for (const resource of inputs.resourceOutcomes) {
    if (resource.decision === "DENY") {
      return denied(
        "SHELL_RESOURCE_DENIED",
        `${resource.kind} ${resource.logicalPath}: ${resource.reason}`,
        inputs,
      );
    }
  }
  if (inputs.configurationInvalid) {
    return denied("SHELL_CONFIGURATION_INVALID", "policy configuration is invalid", inputs);
  }
  const commandRisk = inputs.riskClasses.some((risk) => risk === "unknown" || risk === "destructive")
    ? "ASK"
    : networkOpen && inputs.network.unapprovedTargets.length > 0
      ? "ASK"
      : "ALLOW";
  const merged = mergeAuthorizationOutcomes(
    inputs.readOutcome,
    inputs.mutationOutcome,
    commandRisk,
  );
  if (merged === "DENY") {
    return denied(
      "SHELL_POLICY_DENIED",
      `effective shell outcomes deny execution (read=${inputs.readOutcome}, mutation=${inputs.mutationOutcome})`,
      inputs,
    );
  }
  if (merged === "ASK") {
    return Object.freeze({
      decision: "ASK" as const,
      reason: "SHELL_APPROVAL_REQUIRED" as const,
      detail: `single-use approval required (read=${inputs.readOutcome}, mutation=${inputs.mutationOutcome}, risk=${inputs.commandRisk}${networkDetail(inputs.network, networkOpen)})`,
      readOutcome: inputs.readOutcome,
      mutationOutcome: inputs.mutationOutcome,
      commandRisk: inputs.commandRisk,
    });
  }
  return Object.freeze({
    decision: "ALLOW" as const,
    reason: "SHELL_INVOCATION_ALLOWED" as const,
    detail: `read=${inputs.readOutcome}, mutation=${inputs.mutationOutcome}, risk=${inputs.commandRisk}`,
    readOutcome: inputs.readOutcome,
    mutationOutcome: inputs.mutationOutcome,
    commandRisk: inputs.commandRisk,
  });
}

function networkDetail(network: ShellNetworkState, open: boolean): string {
  if (network.unapprovedTargets.length > 0) return `, network approval for ${network.unapprovedTargets.join(", ")}`;
  if (open) return ", network scope from trusted policy";
  return "";
}

/** `ordinary` never forces an outcome; `unknown`/`destructive` require approval. */
export function commandRiskOutcome(risk: ShellCommandRisk): AuthorizationOutcome {
  if (isDeniedRisk(risk)) return "DENY";
  return risk === "ordinary" ? "ALLOW" : "ASK";
}

export { strictestShellRisk };
