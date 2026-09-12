export type AuthorizationOutcome = "ALLOW" | "ASK" | "DENY";

/**
 * Joins two authorization outcomes under the accepted monotonic strictness
 * order `ALLOW < ASK < DENY`, where the stricter outcome wins.
 *
 * This function is synchronous, deterministic, and side-effect-free: it
 * performs no filesystem, process, UI, network, configuration, or Pi
 * operation. It represents authorization strictness only and does not model
 * approvals, configuration sources, resources, or containment. `SANDBOX` is
 * a separate containment axis and is not an authorization outcome.
 *
 * Runtime inputs are validated with exact, non-coercing comparisons. Any
 * value that is not one of the three primitive outcome strings fails closed
 * to `DENY` without throwing and without invoking coercion, getters, proxy
 * traps, iteration, or attacker-controlled callbacks.
 */
export function joinAuthorizationOutcomes(
  left: AuthorizationOutcome,
  right: AuthorizationOutcome,
): AuthorizationOutcome {
  if (!isAuthorizationOutcome(left) || !isAuthorizationOutcome(right)) {
    return "DENY";
  }

  if (left === "DENY" || right === "DENY") {
    return "DENY";
  }

  if (left === "ASK" || right === "ASK") {
    return "ASK";
  }

  return "ALLOW";
}

function isAuthorizationOutcome(
  value: unknown,
): value is AuthorizationOutcome {
  return value === "ALLOW" || value === "ASK" || value === "DENY";
}
