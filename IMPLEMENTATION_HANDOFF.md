# Implementation Handoff

Task ID: 20260911-write-path-default-decisions
Baseline: d5b4a189fc49183416dd3d0f62be1a09c5ab8eda

## Goal

Add the fixed default decision primitive for one `write` path while preserving the accepted read-path primitive. A genuine resolver result plus the exact write operation must produce one structured `ALLOW`, `ASK`, or `DENY` result. Do not implement edit, delete, multi-path, configuration, approval, or Pi integration behavior.

## Context

Phase 1A path resolution, Phase 1B path classification, and `20260911-read-path-default-decisions` are accepted and committed. Local `main` was fast-forwarded to the baseline, and work continues on `codex/write-path-default-decisions`. The roadmap decision checkbox remains open because only read-path behavior is complete.

The accepted read function checks genuine resolver issuance, the exact operation, internal resource classification, target existence, and canonical workspace membership in that order. Write has a deliberately different missing-target contract: creating a missing ordinary path inside the workspace is allowed by this default path rule, while an ordinary external path asks whether or not it already exists. Secret and sensitive evidence still denies everywhere.

Known unrelated working changes are `.gitignore`, `STATE.md`, `.opencode-permission-canary.txt`, and `.qwen/`. `STATE.md` contains the post-read-Goal checkpoint but its branch field predates this handoff-only branch transition. Preserve these files without inspecting local configuration. The Git index is empty. Stop on any other baseline change rather than resetting or cleaning it.

Starting SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `src/policy/decisions.ts` | `a8750065fcd40f653cb127aca3d32580529c83cb277d167621bc0d6be29db9f1` |
| `test/paths.test.ts` | `676e00aaef9f26e70dfad5ea9513a702352d2d707fd5cc0f04f62c0ed3b21398` |
| `test/resources.test.ts` | `f9a03c98a6ee9c01ae9103ede6f87fc37ee656966a14730ffe6e35df31478436` |
| `test/decisions.test.ts` | `a7a25d710e9818ffe85abcaf5b207d6e1481472b2ef7934e51da24fd888b9911` |

## Scope

Modify only `src/policy/decisions.ts` and create only `test/write-decisions.test.ts`. Add the write-specific public function and its exact readonly result/reason types to the existing decisions module. Do not refactor or rewrite the accepted read function or its tests.

## Acceptance Criteria

1. Export `evaluateWritePath(operation: "write", resource: ResolvedPath): WritePathDecision`, plus narrowly named readonly result and deny-reason types. The function is synchronous and performs no filesystem/content reads, process starts, UI, network access, or Pi interaction.
2. Return exactly `{ decision, reason }`. The only valid pairs, in precedence order, are `DENY/INVALID_RESOURCE`, `DENY/UNSUPPORTED_OPERATION`, `DENY/SECRET_RESOURCE`, `DENY/SENSITIVE_RESOURCE`, `ALLOW/WORKSPACE_WRITE`, and `ASK/EXTERNAL_WRITE`. Do not add `SANDBOX`, approval state, capability data, resource details, or extra fields.
3. Check resolver issuance before reading resource properties. Invalid resource wins when both inputs are invalid. Unsupported operations include read, edit, delete, bash, case/whitespace variants, absent and non-string runtime values; comparison must not coerce attacker-controlled values.
4. Obtain classification internally through `classifyPathResource`. Secret wins over sensitive; both deny for inside, outside, existing, and missing targets. A classifier error propagates and cannot become `ALLOW` or `ASK`. Do not accept caller-supplied classification, sensitivity, membership, approval, configuration, or bypass flags.
5. After ordinary classification, use the issued canonical `insideWorkspace` relation. Ordinary inside paths return `ALLOW/WORKSPACE_WRITE` whether existing or missing. Ordinary external paths return `ASK/EXTERNAL_WRITE` whether existing or missing. `targetExists` must not turn a valid missing write target into a denial.
6. Cover canonical and lexical evidence through the existing classifier: ordinary aliases across both workspace-boundary directions, aliases to secret targets, sensitive-looking lexical aliases, compound templates, `.key`/`.p12` mixed aliases, and overlapping secret/sensitive rules. Do not recreate matcher logic or compare workspace paths textually.
7. Provenance regression cases include structural input, spread, `Object.assign`, inheritance, descriptor and JSON copies, copied symbols, throwing getters, proxies, null/primitives, and claimed inside/missing flags. A throwing proxy/getter must demonstrate zero property access before invalid-resource denial.
8. Tests use genuine resolver results and fabricated temporary resources. Compare complete literal results for every decision row and precedence overlap; do not compute expectations from production output or mirror the decision implementation. Include broken-link and `ENOTDIR` calling-chain tests proving the decision is not invoked after resolver failure.
9. Type checks reject non-write operations, structural resources, result mutation, invalid decision/reason pairs, `SANDBOX`, and extra fields. Runtime results remain synchronous. Existing 119 tests and the accepted read behavior continue to pass unchanged.
10. Preserve all six starting anchors except the intentionally modified `src/policy/decisions.ts`; after implementation, the other five must be byte-identical. No existing test or documentation changes are in scope.

## Verification

Run in order:

```sh
node --test test/write-decisions.test.ts
node --test test/decisions.test.ts
npm run check
git diff --check
git status --short --branch
```

Inspect the complete new file explicitly because it is untracked. Review the incremental `decisions.ts` diff to confirm the read function is unchanged. Recheck the five unchanged anchors, exact working-tree scope, empty index, literal expected results, and absence of real home paths or credentials.

## Constraints

`ALLOW` is only a fixed default write-path result. It is not execution, authorization enforcement, an approval, a capability, or permission to bypass future global/project restrictions. This Goal does not validate object type, overwrite semantics, atomicity, parent permissions, or the complete set of resources touched by an operation. Future integration must handle TOCTOU, symlink replacement, hard links, mounts, directories, and each actual source/destination.

No edit/delete/rename semantics, multi-path operations, recursive behavior, configuration merging, approval consumption, shell/network policy, containment, Pi integration, dependencies, installation, real credentials, existing-test changes, state/roadmap updates, staging, commit, push, branch changes, cleanup, or next Goal.

## Execution Notes

Stop after implementation and verification for independent security review. Report the exact diff, complete write decision coverage, missing-target behavior, provenance and precedence evidence, checks, hashes, and limitations. A passing implementation does not accept this Goal or close the roadmap decision item.

## Escalate If

Stop and report before proceeding if the Goal or acceptance criteria must change, an architectural invariant must change, scope must expand, an unapproved public/external contract is needed, canonical documents conflict, the baseline differs materially, or a security-sensitive/destructive change or data migration would be required. Also stop if the accepted read implementation/tests need modification or an existing check fails. Preserve the accumulated work; do not reset, clean, weaken failure behavior, or invent a fallback.
