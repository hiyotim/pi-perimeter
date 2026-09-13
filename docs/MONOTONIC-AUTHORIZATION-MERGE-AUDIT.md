# Monotonic authorization merge acceptance audit

Date: 2026-09-13

Goal: `20260912-monotonic-authorization-merge`

Branch: `codex/monotonic-authorization-merge`

Implementation baseline (recorded in the handoff): `6622dce90ddad2fa60b9a7b9c276e2154e2910e6`

Executed handoff commit: `46df92ba517bd179f0752424a370d5bd0ae0de77`

## Verdict

**PASS.** The fresh independent read-only review returned PASS for the exact two Goal file hashes recorded below after a complete manual reading of the production code and tests. The reviewer's environment did not permit running npm or hash commands, so all machine and hash evidence in this record comes from the executor checks and the acceptance-time re-runs described under Evidence; none of it is attributed to the independent reviewer.

The accepted primitive implements the N-ary monotonic composition described by the accepted authority contract for contributions a trusted caller has already judged applicable. It is unenforced and adds no configuration, approval, containment, or Pi behavior.

## Accepted artifacts

Only two files are Goal implementation artifacts:

| File | SHA-256 |
| --- | --- |
| `src/policy/merge.ts` | `71cde2b27428e8a8270d7672b48b92e2d978be7c9c7984716d793813e43df7d1` |
| `test/merge.test.ts` | `75ce0a00397d4c2cfb6a959614417c56b1e9d51d35ecd920b2c11be56ade3433` |

Accepted existing anchors remained byte-identical:

| File | SHA-256 |
| --- | --- |
| `src/policy/authority.ts` | `21c3df092f48c84d23f8b8ce90b1fee03143d5b5282f3b1377742b67df088cfb` |
| `test/authority.test.ts` | `75dfef5bcadc6c25b223bc81c8e4992d8adda45b212a4dc4648e01454f0d27e5` |

## Verified behavior

- `mergeAuthorizationOutcomes(baseline, ...contributions)` returns the strictest outcome under `ALLOW < ASK < DENY` across the validated baseline and every valid contribution.
- With zero contributions it returns the validated baseline unchanged; there is no implicit lattice identity.
- For every valid input combination it equals the accepted `joinAuthorizationOutcomes` pairwise fold and is independent of contribution order and grouping.
- If the baseline or any contribution is not exactly one of the primitive strings `"ALLOW"`, `"ASK"`, or `"DENY"`, the result is the primitive string `"DENY"`. Validation is exact and non-coercing.
- Invalid values fail closed in the baseline position, in first, middle, and last contribution positions, and in combination.
- Hostile coercion hooks, throwing getters, callable values, boxed strings, decision-shaped objects, revoked proxies, and trapping proxies do not cause coercion, property access, iteration, callbacks, or exceptions.
- The function never throws for any runtime input, does not mutate its arguments, and returns only a primitive authorization outcome with no reason code, source identifier, approval state, containment flag, or extra structure.
- `SANDBOX` is not an authorization outcome: it is rejected at compile time and fails closed to `DENY` through a runtime cast.
- The module performs no filesystem, process, UI, network, configuration, logging, or Pi operation and has no runtime dependency; its only import is the `AuthorizationOutcome` type from the accepted authority module.
- Compile-time checks admit the three supported literals and reject unsupported strings, `SANDBOX`, structured decision objects, invalid `AuthorizationOutcome` assignments, and non-outcome arguments.

## Resolved P1 and red-to-green evidence

An earlier revision of the Goal traversed contributions with `for...of`. That construct resolves `Array.prototype[Symbol.iterator]`, so a hostile, replaced, or deleted iterator could throw or execute attacker-controlled code on the merge path. The P1 was resolved before the accepted hashes were frozen by iterating only the own `length` and numeric indices of the engine-created rest array; the accepted production code contains no `for...of`, no `Symbol.iterator` lookup, and no prototype method call.

Red-to-green evidence recorded at acceptance time, using a local reconstruction kept outside the repository:

- The earlier `for...of` shape, exercised with a hostile replacement of `Array.prototype[Symbol.iterator]`, invoked the hostile iterator and threw (red).
- The accepted `src/policy/merge.ts`, exercised under the same hostile replacement, returned `ASK` with zero iterator calls and no throw (green). A second acceptance-time probe over zero, valid, and invalid inputs also recorded zero iterator calls and no throw.
- The accepted suite keeps regression tests for a replaced iterator, an adversarial `Symbol.iterator` getter, and a deleted `Array.prototype[Symbol.iterator]`.

## Evidence

Independent manual review (reported):

| Check | Result |
| --- | --- |
| Full manual read of production code and tests | PASS; no defect in the exact Goal hashes |
| Machine commands (npm, hashes) | not runnable in the reviewer environment; not attributed |

Executor machine checks reported before and after the review:

| Check | Result |
| --- | --- |
| `node test/merge.test.ts` | PASS, 16/16 |
| `npm run check` | PASS; typecheck and all 161 registered scenarios |
| Independent hostile-iterator probe | PASS, iterator calls = 0 |
| `git diff --check` | PASS |
| Exact Goal and authority SHA-256 | matched |
| Pre-existing documentation | unchanged during implementation and review |

Acceptance-time re-runs for the frozen hashes:

| Check | Result |
| --- | --- |
| `sha256sum` of both Goal files and both authority anchors | matched the recorded hashes |
| `node test/merge.test.ts` | PASS, 16/16 |
| `node test/authority.test.ts` | PASS, 8/8 |
| `npm run typecheck` | PASS |
| `npm run check` | PASS; typecheck and 161/161 registered scenarios |
| `git diff --check` | PASS |
| Independent hostile-iterator probe | PASS, iterator calls = 0, no throw |
| Red-to-green `for...of` comparison probe | confirmed red for the earlier shape and green for the accepted code |
| Production scan for `for...of`, `Symbol.iterator`, and prototype method calls | none present |

## Pre-existing documentation changes

`AGENTS.md`, `CONTRIBUTING.md`, and `docs/DEVELOPMENT.md` were modified before the Goal implementation began. They are not Goal artifacts and contain no merge behavior. Their working-tree content was unchanged during implementation and review. After the review was complete and before the merge commit, they were committed separately as `108f98e1e786bd9f40c8c2c691650f7012292035` (`docs: streamline development workflow`).

| File | SHA-256 |
| --- | --- |
| `AGENTS.md` | `f47b2a4216c380684215fb52d6ac5ea4c38a7733dec4db2e46d31b91da2bf6ea` |
| `CONTRIBUTING.md` | `d0fc49fa6354ed57573426eac02343675e8954378a208836343c5e11ddf7ff85` |
| `docs/DEVELOPMENT.md` | `112338fc4147f88fbb79d67d11c15ebf8e3c07f42ffb64c6becadb591960a25c` |

SHA-256 of the complete diff of those three documents: `72d06a1cf0e4ae4ee1ef4320729ab65422168e13058bfec848e6214af0103171`. The changes are procedural: they align the contributor workflow with the current gated Goal process and reference `STATE.md` for the current primitives. They do not alter the security invariants, claim enforcement, change release gates, or describe the merge primitive.

## Scope and non-goals

The Goal added only `src/policy/merge.ts` and `test/merge.test.ts`. It did not modify `src/policy/authority.ts`, `test/authority.test.ts`, `src/policy/decisions.ts`, `src/index.ts`, package files, dependencies, exports, or any other existing file, and it did not connect the primitive to Pi.

## Security implications and limits

The primitive makes the N-ary authorization composition order-independent and fail-closed for invalid direct inputs, and it cannot be weakened by adding a contribution when future trusted code calls it correctly. It ensures only that the strictest supplied outcome survives.

It does not discover, load, parse, or validate configuration; identify policy sources; associate contributions with a decision; resolve precedence; select affected decisions; integrate the accepted read/write/edit decisions; store or consume approvals; or provide enforcement or containment. It cannot by itself ensure that every applicable restriction is supplied to the merge. The monotonic configuration authority roadmap item and the Phase 1 release gate therefore remain open, and the primitive is unenforced.
