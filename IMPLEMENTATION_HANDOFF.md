# Implementation Handoff

Task ID: 20260912-monotonic-authorization-merge
Baseline: 6622dce90ddad2fa60b9a7b9c276e2154e2910e6

## Goal

Implement one pure policy primitive that completes monotonic authorization composition: a fail-closed, baseline-anchored N-ary merge of applicable authorization outcomes under `ALLOW < ASK < DENY`.

## Context

The accepted contract `docs/MONOTONIC-POLICY-AUTHORITY.md` fixes the composition model: the effective authorization outcome is the join of every applicable contributed outcome, the strictest wins, and the join is idempotent, commutative, and associative (sections 3.2 and 3.4). The accepted pairwise primitive `joinAuthorizationOutcomes` in `src/policy/authority.ts` implements the binary join. `STATE.md` records a complete configuration merge as still missing, and `docs/MONOTONIC-AUTHORIZATION-JOIN-AUDIT.md` records that a pairwise primitive cannot by itself join every applicable contribution.

This Goal adds only the N-ary merge for contributions that a future trusted caller has already associated with one decision. It does not decide or encode configuration sources, source precedence, applicability or affected-decision scope, schema, file format, or loading; those remain deferred by the contract (sections 5.4 and 10) and must not be inferred here.

The baseline contains the accepted `src/policy/authority.ts` and `test/authority.test.ts` unchanged, and no `src/policy/merge.ts` or `test/merge.test.ts`. All 145 registered test scenarios pass. Stop if the baseline or scope differs rather than resetting or reconstructing it.

## Scope

Create only:

- `src/policy/merge.ts`
- `test/merge.test.ts`

Expose exactly this public surface from the new module:

```ts
import type { AuthorizationOutcome } from "./authority.ts";

export function mergeAuthorizationOutcomes(
  baseline: AuthorizationOutcome,
  ...contributions: AuthorizationOutcome[]
): AuthorizationOutcome;
```

`AuthorizationOutcome` is imported from the accepted authority module; do not duplicate or re-export it. Do not modify `src/policy/authority.ts`, `test/authority.test.ts`, any other existing source, tests, package files, exports, dependencies, or documentation. Do not add another public symbol. Do not connect the primitive to `decisions.ts`, `src/index.ts`, or Pi.

## Acceptance Criteria

1. `mergeAuthorizationOutcomes` is synchronous, deterministic, and side-effect-free: no filesystem, process, UI, network, configuration, or Pi operation; no value mutation; no logging; no dependency; it never throws for any runtime input.
2. Baseline anchoring: with zero contributions the function returns the validated `baseline` unchanged. It must not introduce an implicit lattice identity: absent contributions never become `ALLOW` or `DENY` on their own.
3. Monotonic completeness: for a valid baseline and any number of valid contributions, the result is the strictest outcome under `ALLOW < ASK < DENY` across the baseline and every contribution. It must equal the accepted `joinAuthorizationOutcomes` folded over the same sequence and must be independent of contribution order or grouping.
4. Fail-closed runtime validation: if `baseline` or any contribution is not exactly one of the primitive strings `"ALLOW"`, `"ASK"`, or `"DENY"`, the result is the primitive string `"DENY"`. Validation must use exact, non-coercing comparisons and must not invoke `toString`, `valueOf`, `Symbol.toPrimitive`, getters, proxy traps (`get`, `getOwnPropertyDescriptor`, `getPrototypeOf`, `has`, `ownKeys`, `apply`, `construct`), iteration, or any attacker-controlled callback.
5. Invalid-input coverage includes `undefined`, `null`, booleans, numbers (`0`, `1`, `-1`, `NaN`, `Infinity`), bigint, symbols, empty/whitespace/case/padded string variants, `"MAYBE"`, `"SANDBOX"`, arrays, boxed strings, plain and null-prototype objects, decision-shaped objects, functions, objects with throwing coercion hooks, throwing getters, and revoked or trapping proxies. Invalid values are covered in the baseline position, in first, middle, and last contribution positions, and in combination.
6. The return value is always a primitive string that is a member of `AuthorizationOutcome`; no reason code, source identifier, approval state, containment flag, object wrapper, or extra structure is added.
7. Tests explicitly establish: the no-contribution case for all three baselines; representative combinations for one, two, and three or more contributions; all 27 valid triples compared against the accepted pairwise fold; invalid values failing closed in every position; hostile coercion/proxy inputs invoking no traps; and order permutations producing identical results.
8. Compile-time checks accept only the three outcome literals and reject unsupported strings, `SANDBOX`, structured decision objects, invalid assignments to `AuthorizationOutcome`, and non-outcome arguments. Runtime casts of those rejected values still fail closed to `DENY`.
9. Existing files remain byte-identical: `src/policy/authority.ts` SHA-256 stays `21c3df092f48c84d23f8b8ce90b1fee03143d5b5282f3b1377742b67df088cfb`, and `test/authority.test.ts` SHA-256 stays `75dfef5bcadc6c25b223bc81c8e4992d8adda45b212a4dc4648e01454f0d27e5`. All 145 accepted scenarios continue to pass.

## Verification

Run in order:

```sh
node --test test/merge.test.ts
node --test test/authority.test.ts
npm run check
git diff --check
git status --short --branch
```

Inspect the complete two-file diff. Confirm only `src/policy/merge.ts` and `test/merge.test.ts` changed, the index is empty, no dependency or package file changed, and no existing file changed. Record the focused scenario count and the SHA-256 of both new files.

## Constraints

Follow `AGENTS.md` and the accepted authority contract. Keep authorization and containment separate: `SANDBOX` is not an authorization outcome and does not appear in this API. The merge combines only contributions already judged applicable by a trusted caller; it must not perform discovery, parsing, source identification, precedence resolution, or affected-decision selection, and must not assume answers to the contract's deferred questions. Invalid inputs fail closed to `DENY`; do not throw them into a caller-controlled fallback.

Do not stage, commit, push, open a PR, change branches, or start another Goal. Stop after implementation and verification for independent security review.

## Escalate If

Stop and report before proceeding if the exact API or semantics must change, an existing file must change, source association, precedence, schema, format, or affected-decision scope becomes necessary, a new dependency is needed, the accepted authority contract is internally insufficient, the baseline differs materially, or an existing check fails. Preserve accumulated work; do not reset, clean, weaken fail-closed behavior, or invent configuration semantics.
