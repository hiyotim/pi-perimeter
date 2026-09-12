# Monotonic authorization join independent audit

Date: 2026-09-12

Goal: `20260912-monotonic-authorization-join`

Implementation baseline: `f7edf7e2af4c92fbe4369705b1b6f0c44d8f2ad2` on `codex/monotonic-authorization-join`

## Verdict

**PASS.** The independent read-only security review found no defect in the exact implementation accepted below. The pairwise join is suitable for Goal acceptance. The reviewer did not modify the production or test artifacts, stage, commit, push, access credentials, or inspect local tooling configuration.

An earlier review covered a different two-file artifact in a separate worker worktree. Before acceptance, the primary review detected that the files in the selected branch had different hashes, invalidated the earlier verdict for those files, and repeated the complete review against the exact hashes recorded here. No result from the earlier artifact is used as acceptance evidence for this version.

## Verified behavior

- `AuthorizationOutcome` contains exactly `ALLOW`, `ASK`, and `DENY`; `SANDBOX` is not an authorization outcome.
- `joinAuthorizationOutcomes(left, right)` implements the complete strictness order `ALLOW < ASK < DENY` for all nine ordered pairs.
- The join is synchronous, deterministic, idempotent, commutative, and associative across all 27 valid triples.
- Runtime validation uses exact primitive-string comparisons. If either argument is invalid, the result is the primitive string `DENY`.
- Hostile objects, throwing coercion hooks and getters, callable values, boxed strings, null-prototype objects, and revoked or trapping proxies cannot cause coercion, property access, iteration, callbacks, or exceptions.
- Inputs are not mutated, and valid calls return only a primitive authorization outcome.
- Compile-time checks admit the three supported literals and reject unsupported strings, `SANDBOX`, structured decisions, and invalid assignments.
- The module adds no reason codes, configuration sources, approvals, resource data, containment state, callbacks, logging, dependency, integration, or side effect.

## Evidence

Fresh acceptance-time evidence for the exact reviewed files:

| Check | Result |
| --- | --- |
| `node test/authority.test.ts` | PASS, 8/8 |
| `npm run check` | PASS; typecheck and all 145 registered test scenarios |
| Independent adversarial probes | PASS, 90/90 |
| `git diff --check` and `git diff --cached --check` | PASS; index empty before acceptance documentation |
| Scope | only the two new implementation files before acceptance documentation; all tracked files matched handoff HEAD |

Audited SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `src/policy/authority.ts` | `21c3df092f48c84d23f8b8ce90b1fee03143d5b5282f3b1377742b67df088cfb` |
| `test/authority.test.ts` | `75dfef5bcadc6c25b223bc81c8e4992d8adda45b212a4dc4648e01454f0d27e5` |

## Security implications and limits

The primitive makes authorization composition order-independent and fail-closed for invalid direct inputs. It prevents a weaker applicable outcome from replacing a stricter one when future trusted code calls this function correctly.

It does not load, parse, validate, or associate configuration with an affected decision; identify policy sources; define precedence between sources; integrate the accepted read/write/edit decisions; store or consume approvals; provide enforcement; or establish containment. It cannot by itself ensure that every applicable restriction is supplied to the join. The monotonic configuration authority roadmap item and the Phase 1 release gate therefore remain open.
