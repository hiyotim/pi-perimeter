# Implementation Handoff

Task ID: 20260911-edit-path-default-decisions
Baseline: be78e2cc3e4f6608b75e4b68cf5c24a248b0ba9d

## Goal

Add the fixed default decision primitive for one `edit` path while preserving the accepted read and write primitives byte-for-byte. A genuine resolver result plus the exact edit operation must produce one structured `ALLOW`, `ASK`, or `DENY` result. Do not implement delete, rename, multi-path, configuration, approval, or Pi integration behavior.

## Context

Phase 1A path resolution, Phase 1B path classification, `20260911-read-path-default-decisions`, and `20260911-write-path-default-decisions` are accepted and committed. Local `main` was fast-forwarded to the write-path commit, and work continues on `codex/edit-path-default-decisions`. The roadmap decision checkbox remains open because read and write cover only two operation paths.

The accepted read function denies ordinary missing targets; the accepted write function treats an ordinary missing target inside the workspace as an acceptable creation target. Edit has a deliberately different missing-target contract: every ordinary missing target denies because an edit requires an existing target. Secret and sensitive evidence still denies everywhere. Classification is obtained internally, and the issued canonical membership relation decides ordinary inside versus outside.

Known unrelated working changes on the new branch are `.gitignore`, the post-commit `STATE.md`, `.opencode-permission-canary.txt`, `.qwen/`, and the completed transition prompt. Preserve these files without inspecting local configuration. The Git index is empty. Stop on any other baseline change rather than resetting or cleaning it.

Starting SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `src/policy/decisions.ts` | `26066ff31d4c99f5e3b4b252bfd68d718823e3078db971cc038ec4e4676bc8ed` |
| `test/paths.test.ts` | `676e00aaef9f26e70dfad5ea9513a702352d2d707fd5cc0f04f62c0ed3b21398` |
| `test/resources.test.ts` | `f9a03c98a6ee9c01ae9103ede6f87fc37ee656966a14730ffe6e35df31478436` |
| `test/decisions.test.ts` | `a7a25d710e9818ffe85abcaf5b207d6e1481472b2ef7934e51da24fd888b9911` |
| `test/write-decisions.test.ts` | `e0d39598c0cacbab4a2e920b6134d15f9a2fb2c3d39254df712bdc8fa3a58045` |

## Scope

Modify only `src/policy/decisions.ts` and create only `test/edit-decisions.test.ts`. Add the edit-specific public function and its exact readonly result/reason types to the existing decisions module. Do not refactor or rewrite the accepted read or write functions, their types, or their tests.

## Acceptance Criteria

1. Export `evaluateEditPath(operation: "edit", resource: ResolvedPath): EditPathDecision`, plus narrowly named readonly result and deny-reason types. The function is synchronous and performs no filesystem/content reads, process starts, UI, network access, or Pi interaction.
2. Return exactly `{ decision, reason }`. The only valid pairs, in precedence order, are `DENY/INVALID_RESOURCE`, `DENY/UNSUPPORTED_OPERATION`, `DENY/SECRET_RESOURCE`, `DENY/SENSITIVE_RESOURCE`, `DENY/EDIT_TARGET_MISSING`, `ALLOW/WORKSPACE_EDIT`, and `ASK/EXTERNAL_EDIT`. Do not add `SANDBOX`, approval state, capability data, resource details, or extra fields.
3. Check resolver issuance before reading resource properties. Invalid resource wins when both inputs are invalid. Unsupported operations include read, write, delete, rename, bash, case/whitespace variants, absent and non-string runtime values; comparison must not coerce attacker-controlled values.
4. Obtain classification internally through `classifyPathResource`. Secret wins over sensitive; both deny for inside, outside, existing, and missing targets. Secret/sensitive evidence must be evaluated before the missing-target rule. A classifier error propagates and cannot become `ALLOW` or `ASK`. Do not accept caller-supplied classification, sensitivity, membership, existence, approval, configuration, or bypass flags.
5. After ordinary classification, an ordinary resource with `targetExists === false` returns `DENY/EDIT_TARGET_MISSING` regardless of membership. Only ordinary existing targets continue: the issued canonical `insideWorkspace` relation yields `ALLOW/WORKSPACE_EDIT` inside and `ASK/EXTERNAL_EDIT` outside. Do not add create-on-edit behavior or recreate write semantics.
6. Cover canonical and lexical evidence through the existing classifier: ordinary aliases across both workspace-boundary directions, aliases to secret targets, sensitive-looking lexical aliases, compound templates, `.key`/`.p12` mixed aliases, and overlapping secret/sensitive rules. Do not recreate matcher logic or compare workspace paths textually.
7. Provenance regression cases include structural input, spread, `Object.assign`, inheritance, descriptor and JSON copies, copied symbols, throwing getters, proxies, null/primitives, and claimed inside/missing flags. A throwing proxy/getter must demonstrate zero property access before invalid-resource denial.
8. Tests use genuine resolver results and fabricated temporary resources. Compare complete literal results for every decision row and precedence overlap; do not compute expectations from production output or mirror the decision implementation. Include broken-link and `ENOTDIR` calling-chain tests proving the decision is not invoked after resolver failure.
9. Type checks reject non-edit operations, structural resources, result mutation, invalid decision/reason pairs, `SANDBOX`, and extra fields. Runtime results remain synchronous. Existing 128 tests and the accepted read and write behavior continue to pass unchanged.
10. Preserve all seven starting anchors except the intentionally modified `src/policy/decisions.ts`; after implementation, the other six must be byte-identical. No existing test or documentation changes are in scope.

## Verification

Run in order:

```sh
node --test test/edit-decisions.test.ts
node --test test/decisions.test.ts
node --test test/write-decisions.test.ts
npm run check
git diff --check
git status --short --branch
```

Inspect the complete new file explicitly because it is untracked. Review the incremental `decisions.ts` diff to confirm the read and write functions are unchanged. Recheck the six unchanged anchors, exact working-tree scope, empty index, literal expected results, and absence of real home paths or credentials.

## Constraints

`ALLOW` is only a fixed default edit-path result. It is not execution, authorization enforcement, an approval, a capability, or permission to bypass future global/project restrictions. This Goal does not validate object type, overwrite semantics, atomicity, parent permissions, or the complete set of resources touched by an operation. Future integration must handle TOCTOU, symlink replacement, hard links, mounts, directories, and each actual source/destination.

No delete/rename semantics, multi-path operations, create-on-edit behavior, recursive behavior, configuration merging, approval consumption, shell/network policy, containment, Pi integration, dependencies, installation, real credentials, existing-test changes, state/roadmap updates, staging, commit, push, branch changes, cleanup, or next Goal.

## Execution Notes

Stop after implementation and verification for independent security review. Report the exact diff, complete edit decision coverage, missing-target behavior, provenance and precedence evidence, checks, hashes, and limitations. A passing implementation does not accept this Goal or close the roadmap decision item.

## Escalate If

Stop and report before proceeding if the Goal or acceptance criteria must change, an architectural invariant must change, scope must expand, an unapproved public/external contract is needed, canonical documents conflict, the baseline differs materially, or a security-sensitive/destructive change or data migration would be required. Also stop if the accepted read or write implementation/tests need modification or an existing check fails. Preserve the accumulated work; do not reset, clean, weaken failure behavior, or invent a fallback.
