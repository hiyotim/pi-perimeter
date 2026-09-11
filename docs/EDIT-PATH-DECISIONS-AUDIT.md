# Edit-path default decision independent audit

Date: 2026-09-11

Goal: `20260911-edit-path-default-decisions`

Baseline: `be78e2cc3e4f6608b75e4b68cf5c24a248b0ba9d` on `codex/edit-path-default-decisions`

## Verdict

**PASS.** The independent security review, performed directly by model `opencode-go/deepseek-v4.1-flash` without a subagent, found no implementation defect within the Goal. The implementation is suitable for Goal acceptance.

## Method

The reviewer manually inspected the edit-path implementation and tests and then ran a mutation analysis: 11 targeted mutations were applied in a separate temporary copy of the project, and all handoff checks were rerun. The repository itself was not modified during the mutation analysis. Mutation kills are attributed to the reviewer's temporary copy.

The reviewer was not read-only overall: the reviewer modified only `test/edit-decisions.test.ts`, adding `["edit"]` and `new String("edit")` to the list of invalid operations in the unsupported-operation test. This is a defense-in-depth check that operation comparison rejects coercion and remains within the Goal scope. No production file was changed by the reviewer.

## Verified behavior

- Resolver issuance is checked before any resource property access. Structural objects, spread and assignment copies, inheritance, descriptor and JSON copies, copied brands, throwing getters, and proxies return `DENY/INVALID_RESOURCE`; proxy/getter probes observed zero property accesses before the denial.
- Invalid resource takes precedence over invalid operation. Unsupported operations cannot reach `ALLOW` or `ASK`; the operation comparison is exact and performs no coercion of attacker-controlled values.
- Internal classification runs without a fallback. `secret` and `sensitive` deny for inside, outside, existing, and missing targets, and take precedence over the missing-target and membership rules.
- Every ordinary resource with `targetExists === false` returns `DENY/EDIT_TARGET_MISSING` regardless of workspace membership. Only ordinary existing targets continue: the issued canonical `insideWorkspace` relation yields `ALLOW/WORKSPACE_EDIT` inside and `ASK/EXTERNAL_EDIT` outside.
- A classifier error propagates structurally because `evaluateEditPath` does not intercept it; a classifier error therefore cannot become `ALLOW` or `ASK`.
- Results contain exactly `decision` and `reason`. The accepted read and write functions and their public contracts are unchanged byte-for-byte; the edit addition is an additive 64-line hunk after the accepted write code.
- Tests use fabricated temporary resources and complete literal expectations. They cover both symlink-boundary directions, secret targets, sensitive lexical aliases, template and key overlaps, malformed runtime inputs, broken links, and `ENOTDIR`.

## Mutation evidence

11/11 mutations were killed by the tests:

| Mutation | Result |
| --- | --- |
| Weaken or bypass the provenance/issuance guard | Killed |
| Replace the exact operation check with loose equality | Killed |
| Disable the missing-target denial | Killed |
| Invert the missing-target denial | Killed |
| Disable the membership check | Killed |
| Invert the membership check | Killed |
| Disable `secret` classification handling | Killed |
| Disable `sensitive` classification handling | Killed |
| Skip the internal classifier call | Killed |
| Add an extra result field | Killed |
| Violate decision precedence | Killed |

## Evidence

Supplied independent review evidence:

| Check | Result |
| --- | --- |
| `node --test test/edit-decisions.test.ts` | PASS, 9/9 |
| `node --test test/decisions.test.ts` | PASS, 8/8 |
| `node --test test/write-decisions.test.ts` | PASS, 9/9 |
| `npm run check` | PASS, typecheck and 137/137 tests |
| `git diff --check` | PASS; index was empty during review |
| Independent temporary mutations | 11/11 killed |

After the review report, the primary model re-ran the same checks and independently observed the same focused results (edit 9/9, read 8/8, write 9/9), the same full `npm run check` result (typecheck and 137/137 tests), the same source/test hashes and baseline anchors, clean whitespace checks, and an empty index.

Audited SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `src/policy/decisions.ts` | `0dabdf33db6a2b3738de3d90173e7b20d302aeb9cccba9b483c94c13b2be28be` |
| `test/edit-decisions.test.ts` | `c5b7e955e72923a53d31bbd3eeca784bdb1352fc4962f30dec8f073cdc4c1eca` |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `test/paths.test.ts` | `676e00aaef9f26e70dfad5ea9513a702352d2d707fd5cc0f04f62c0ed3b21398` |
| `test/resources.test.ts` | `f9a03c98a6ee9c01ae9103ede6f87fc37ee656966a14730ffe6e35df31478436` |
| `test/decisions.test.ts` | `a7a25d710e9818ffe85abcaf5b207d6e1481472b2ef7934e51da24fd888b9911` |
| `test/write-decisions.test.ts` | `e0d39598c0cacbab4a2e920b6134d15f9a2fb2c3d39254df712bdc8fa3a58045` |

All baseline anchors other than the intentionally modified `src/policy/decisions.ts` were unchanged.

## Limits

A classifier-error probe through genuine resolver issuance is unreachable because the accepted resolver does not issue a result that triggers a classifier error, so propagation of classifier errors was verified structurally rather than by runtime provocation. This is a limitation of the check, not a defect.

This is a synchronous content-blind path-rule decision, not authorization enforcement, approval, capability, configuration, or containment. It does not validate object type, edit-patch semantics, atomicity, permissions, the complete set of resources touched by an edit, TOCTOU, symlink replacement, hard links, or mounts. Pi integration, approval flow, configuration, shell/network policy, and OS containment remain absent.
