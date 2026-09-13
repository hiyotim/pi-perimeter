import type { AuthorizationOutcome } from "./authority.ts";

/**
 * Merges a validated baseline authorization outcome with any number of
 * contribution outcomes under the accepted monotonic strictness order
 * `ALLOW < ASK < DENY`, where the strictest outcome wins.
 *
 * This primitive completes the N-ary composition described by the accepted
 * monotonic policy authority contract (sections 3.2 and 3.4): the effective
 * outcome is the join of the baseline and every already-applicable
 * contribution, so adding a contribution can never weaken the result, and
 * evaluation order and grouping never affect it. It combines only
 * contributions a trusted caller has already judged applicable; it performs
 * no configuration discovery, parsing, source identification, precedence
 * resolution, classification, or affected-decision selection. `SANDBOX` is a
 * separate containment axis and is not an authorization outcome.
 *
 * This function is synchronous, deterministic, and side-effect-free: it
 * performs no filesystem, process, UI, network, configuration, or Pi
 * operation, never mutates its arguments, and has no dependencies.
 *
 * Runtime inputs are validated with exact, non-coercing comparisons. If the
 * baseline or any contribution is not exactly one of the three primitive
 * outcome strings `"ALLOW"`, `"ASK"`, or `"DENY"`, the result fails closed to
 * the primitive string `"DENY"` without throwing and without invoking
 * coercion, getters, proxy traps, iteration, or attacker-controlled
 * callbacks. With zero valid contributions, the validated baseline is
 * returned unchanged; no implicit lattice identity is introduced.
 */
export function mergeAuthorizationOutcomes(
  baseline: AuthorizationOutcome,
  ...contributions: AuthorizationOutcome[]
): AuthorizationOutcome {
  if (!isAuthorizationOutcome(baseline)) {
    return "DENY";
  }

  // Traversal uses own properties (`length` and numeric indices) of the
  // engine-created rest array only. Neither validation nor merging may resolve
  // `Array.prototype[Symbol.iterator]` or any prototype method through the
  // prototype chain, so no array prototype method and no iterator can carry
  // attacker-controlled code into this function.
  const count = contributions.length;
  for (let index = 0; index < count; index += 1) {
    if (!isAuthorizationOutcome(contributions[index])) {
      return "DENY";
    }
  }

  let strictest: AuthorizationOutcome = baseline;
  for (let index = 0; index < count; index += 1) {
    const contribution = contributions[index];
    if (strictest === "ALLOW" && contribution !== "ALLOW") {
      strictest = contribution;
      continue;
    }
    if (strictest === "ASK" && contribution === "DENY") {
      strictest = "DENY";
    }
  }

  return strictest;
}

function isAuthorizationOutcome(
  value: unknown,
): value is AuthorizationOutcome {
  return value === "ALLOW" || value === "ASK" || value === "DENY";
}
