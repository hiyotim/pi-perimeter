# Implementation Handoff

Task ID: 20260911-read-path-default-decisions
Baseline: e9b2f16cafe79421c8cf59f1d3fc028379888386

Baseline status: accepted Phase 1B commit on `main`; working branch `codex/read-path-default-decisions`. The Git transition described in `docs/BRANCH-TRANSITION.md` is complete and the baseline was refreshed to the actual commit. Implementation has not started and is not begun by the transition itself.

## Goal

Implement the selected fixed default read-path decision primitive: genuine resolver input plus the explicit read operation produces one structured ALLOW, ASK, or DENY result, using the ordered contract in `docs/READ-PATH-DECISIONS.md`. Do not implement the broader policy engine.

## Context

Phase 1B is accepted after final independent PASS and is committed as `e9b2f16cafe79421c8cf59f1d3fc028379888386`. The source/test baseline passed 69/69 resource tests, typecheck and 111/111 total tests, and 92/92 independent synthetic probes. These are previous-review results, not new implementation verification. No Pi enforcement exists.

`STATE.md` is the acceptance authority and `docs/READ-PATH-DECISIONS.md` fixes this Goal's architectural contract. `docs/PHASE-1B-COMMIT.md` records the prepared snapshot and its completed commit; do not reapply the patch or make a commit during implementation. The preceding assertion handoff is preserved in `docs/handoffs/20260911-resource-full-result-assertions.md` and must not be re-executed.

Work on `codex/read-path-default-decisions`; the accepted Phase 1B implementation and tests are part of the baseline commit. The next-Goal planning documents (`STATE.md`, `ARCHITECTURE.md`, this handoff, and `docs/READ-PATH-DECISIONS.md`) remain uncommitted working changes. Existing `.gitignore`, `.opencode-permission-canary.txt`, and `.qwen/` changes are unrelated; preserve them without loading local configuration. The Git index was empty after the transition commit.

### Starting SHA-256 anchors

| File | SHA-256 |
| --- | --- |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `test/paths.test.ts` | `676e00aaef9f26e70dfad5ea9513a702352d2d707fd5cc0f04f62c0ed3b21398` |
| `test/resources.test.ts` | `f9a03c98a6ee9c01ae9103ede6f87fc37ee656966a14730ffe6e35df31478436` |
| `docs/READ-PATH-DECISIONS.md` | `a0eb69fd323daf69a6606a24b2ede5c4cbcd3f89e0c8a76ba06975e4cb6fde92` |

Record starting status and hashes before implementation. The baseline was refreshed to the committed Phase 1B SHA by the transition executor under its separate contract, preserving this Goal, criteria, scope, and anchors; the pre-transition baseline is historical. Treat any subsequent material divergence as a new baseline ambiguity.

## Scope

Create only `src/policy/decisions.ts` and `test/decisions.test.ts`. Public exports for the selected function and its result/reason types belong in the new decisions module. Existing production files, tests, dependencies, configuration, canonical documentation, and this handoff remain unchanged during execution.

## Acceptance Criteria

1. Export `evaluateReadPath(operation: "read", resource: ResolvedPath): ReadPathDecision`. It is synchronous and performs no filesystem/content reads, process starts, UI, network access, or Pi interaction. Obtain classification internally through the existing classifier; do not accept caller-supplied classification, sensitivity, membership, approval, policy configuration, or bypass flags.
2. Return exactly `{ decision, reason }` using a readonly discriminated union. The only allowed pairs, in precedence order, are: `DENY/INVALID_RESOURCE` for non-issued resources; `DENY/UNSUPPORTED_OPERATION` for an operation other than exact `read`; `DENY/SECRET_RESOURCE`; `DENY/SENSITIVE_RESOURCE`; `DENY/READ_TARGET_MISSING` for an ordinary missing target; `ALLOW/WORKSPACE_READ` for an ordinary existing canonical in-workspace target; `ASK/EXTERNAL_READ` for an ordinary existing external target. No extra fields or SANDBOX outcome.
3. Check genuine issuance before resource property access, including on forged throwing getters and proxies. No spread, assignment copy, inheritance, descriptor copy, serialization, structural input, or copied symbol can establish issuance. Preserve the existing trusted-workspace and frozen-input boundary; do not add a public issuer or weaken the resolver/classifier.
4. Preserve ordering for overlaps: secret wins over sensitive evidence; both deny inside/outside and even when missing; missing ordinary resources deny before workspace/external decisions. Unsupported operations cannot ALLOW or ASK, including write/edit/delete/bash strings, case variants, absent values, and non-string runtime inputs. Invalid resource wins when both inputs are invalid.
5. Use both path identities via Phase 1B and canonical membership via the issued result. Cover ordinary aliases out of and into the workspace, secret-target aliases, sensitive lexical aliases to ordinary targets, compound templates, generic keys, and mixed key/p12 aliases. Do not recreate path normalization, matcher logic, or workspace-prefix checks.
6. Classifier failures propagate as errors without an ALLOW/ASK fallback. Resolver errors stop the preceding chain and are not converted to ordinary input. Exercise isolated broken-link and ENOTDIR failures to demonstrate that the test calling chain does not invoke a decision after failed resolution. No production fault-injection hook or dependency-injection surface is permitted.
7. Tests compare complete literal expected objects for every table row and required overlap, using fabricated temporary workspaces/resources and genuine resolver results for valid inputs. Add the provenance attacks above and TypeScript assertions rejecting non-read operations, structural resources, result-field assignment, and invalid decision/reason combinations. Test-case expectations must not be computed from production output or mirrored decision logic.
8. Keep all four existing source/test anchors byte-identical. No integration, new resource rules, configuration merging, approval handling, write/delete semantics, recursive directory permissions, operation execution, or claim of complete policy enforcement. An ALLOW is only a default path-rule result; all limits of the design contract remain.

## Verification

Run targeted new tests first:

```sh
node --test test/decisions.test.ts
npm run check
git diff --check
git status --short --branch
```

`npm run check` runs typecheck and all test files, including the new suite. Independently compare all complete expected results and overlap ordering to the contract. Check that no test uses real home paths/credentials. Inspect new files explicitly because ordinary git diff omits untracked files; compare the four original source/test hashes and all pre-existing tracked/untracked files with the recorded baseline. Do not install dependencies or change tooling to bypass a failure.

## Constraints

The caller must resolve against a trusted active workspace; this Goal does not authenticate workspace configuration. Results are not capabilities or approvals. Read-path ALLOW cannot override later global/project restrictions, authorize recursive traversal, or validate object kind. Content-blind, TOCTOU, hard-link, mount, and same-process limitations remain.

No existing-file edits, source/test refactoring, new dependencies, Pi integration, installation, real credentials, staging, commit, push, branch changes, cleanup, next Goal, or roadmap/state updates during execution.

## Execution Notes

Stop after implementation and verification for independent security review. Report exact new files, full-result coverage by table row, precedence and provenance evidence, check results, unchanged anchors, and remaining limitations. A passing implementation is not acceptance of this Goal or completion of Phase 1. Configuration authority and other operation contracts remain separate work.

## Escalate If

Stop and report if the selected Goal or acceptance criteria need to change, an architectural invariant must change, scope must materially expand, an unapproved public/external contract is needed, canonical documents conflict, the baseline differs materially, or a security-sensitive/destructive change or data migration would be required. Also stop if existing production/tests need changes or a failing check requires an out-of-scope fix. Preserve accumulated work; do not reset, broaden permissions, invent a fallback, or silently change the contract.
