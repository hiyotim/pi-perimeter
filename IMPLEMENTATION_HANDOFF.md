# Implementation Handoff

Task ID: 20260912-monotonic-authorization-join
Baseline: 6a63f09d5845c4e2d044fe46441384db0e0d96a5

## Goal

Implement the smallest pure-policy primitive required by the accepted monotonic authority contract: a fail-closed pairwise join for authorization outcomes in which `ALLOW < ASK < DENY` and the stricter outcome wins. Do not implement configuration loading, schemas, source precedence, approvals, containment, enforcement, or Pi integration.

## Context

The documentation-only authority contract in `docs/MONOTONIC-POLICY-AUTHORITY.md` is accepted and committed. It defines authorization outcomes as one strictness lattice and keeps `SANDBOX` on a separate containment axis. The accepted read/write/edit functions return structured path-rule decisions, but this Goal does not integrate or refactor them. It adds one independently testable join primitive that future policy composition can call.

The implementation baseline contains no `src/policy/authority.ts` or `test/authority.test.ts`. The Git index and working tree are clean apart from ignored local tooling files. Stop if the baseline or scope differs rather than resetting or reconstructing it.

## Scope

Create only:

- `src/policy/authority.ts`
- `test/authority.test.ts`

Expose exactly this public surface from the new module:

```ts
export type AuthorizationOutcome = "ALLOW" | "ASK" | "DENY";

export function joinAuthorizationOutcomes(
  left: AuthorizationOutcome,
  right: AuthorizationOutcome,
): AuthorizationOutcome;
```

Do not modify existing source, tests, package files, exports, dependencies, or documentation. Do not connect the primitive to `decisions.ts` or `src/index.ts`.

## Acceptance Criteria

1. `joinAuthorizationOutcomes` is synchronous, deterministic, side-effect-free, and performs no filesystem, process, UI, network, configuration, or Pi operation.
2. For all nine valid ordered pairs it returns the stricter outcome according to `ALLOW < ASK < DENY`. Expectations must be explicit and complete:

   | left | right | result |
   | --- | --- | --- |
   | `ALLOW` | `ALLOW` | `ALLOW` |
   | `ALLOW` | `ASK` | `ASK` |
   | `ALLOW` | `DENY` | `DENY` |
   | `ASK` | `ALLOW` | `ASK` |
   | `ASK` | `ASK` | `ASK` |
   | `ASK` | `DENY` | `DENY` |
   | `DENY` | `ALLOW` | `DENY` |
   | `DENY` | `ASK` | `DENY` |
   | `DENY` | `DENY` | `DENY` |

3. Runtime input is validated by exact, non-coercing value checks even though TypeScript callers see the literal union. If either argument is not one of the three primitive strings, the result is `DENY`. Invalid values must not throw or produce `ALLOW`/`ASK`.
4. Invalid-input coverage includes `undefined`, `null`, booleans, numbers, bigint, symbols, empty/case/whitespace variants, arrays, `new String(...)`, plain and null-prototype objects, functions, objects with throwing `toString`/`valueOf`/`Symbol.toPrimitive`, and proxies. Validation must not invoke coercion, getters, proxy traps, iteration, or attacker-controlled callbacks.
5. Tests explicitly establish idempotence, commutativity, and associativity. Associativity covers every one of the 27 valid triples. They also establish that no argument object is mutated and that the function returns only a primitive valid outcome.
6. Compile-time checks accept the three literals and reject unsupported strings, decision objects, `SANDBOX`, and invalid assignments to `AuthorizationOutcome`. Runtime casts of those values still fail closed.
7. The primitive represents only authorization strictness. It must not introduce reason codes, configuration-source identifiers, approval state, scope, resource data, containment flags, `SANDBOX`, exceptions, logging, fallback callbacks, or extra return structure.
8. Existing `paths.ts`, `resources.ts`, `decisions.ts`, all existing tests, documentation, configuration, and package metadata remain byte-identical. All 137 accepted tests continue to pass.

## Verification

Run in order:

```sh
node --test test/authority.test.ts
npm run check
git diff --check
git status --short --branch
```

Inspect the complete two-file diff. Confirm the index is empty, only the two scoped files changed, no existing file changed, no dependency was added, and no real credential or user path appears. Record SHA-256 for both new files.

## Constraints

Follow `AGENTS.md` and the accepted authority contract. Invalid runtime inputs fail closed to `DENY`; do not throw them into a caller-controlled fallback. Keep authorization and containment separate. This primitive does not decide whether trusted configuration may ever lower `ASK`, does not determine an affected decision set, and does not complete the roadmap authority item by itself.

Do not stage, commit, push, open a PR, change branches, or start another Goal. Stop after implementation and verification for independent security review.

## Escalate If

Stop and report before proceeding if the exact API or decision table must change, an existing file must change, runtime validation would require a broader parser/schema contract, a new dependency is needed, the accepted authority contract is internally insufficient, the baseline differs materially, or an existing check fails. Preserve accumulated work; do not reset, clean, weaken fail-closed behavior, or invent configuration semantics.
