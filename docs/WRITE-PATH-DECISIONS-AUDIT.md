# Write-path default decision independent audit

Date: 2026-09-11

Goal: `20260911-write-path-default-decisions`

Baseline: `d5b4a189fc49183416dd3d0f62be1a09c5ab8eda` on `codex/write-path-default-decisions`

## Verdict

**PASS.** The independent read-only security review found no implementation, test, or documentation defect within the Goal. The implementation is suitable for Goal acceptance. The reviewer did not modify repository files, stage, commit, push, inspect `.qwen`, or access credentials. This record does not attribute any file change to the reviewer.

## Verified behavior

- Resolver issuance is checked before any resource property access. Structural objects, spread and assignment copies, inheritance, descriptor and JSON copies, copied brands, throwing getters, and proxies return `DENY/INVALID_RESOURCE`; independent proxy/getter probes observed zero property accesses before the denial.
- Invalid resource takes precedence over invalid operation. Unsupported operations cannot reach `ALLOW` or `ASK`; the operation comparison is exact and performs no coercion of attacker-controlled values.
- Internal classification runs without a fallback. `secret` and `sensitive` deny for inside, outside, existing, and missing targets, and take precedence over missing-target and membership rules.
- Ordinary inside targets return `ALLOW/WORKSPACE_WRITE` whether existing or missing; ordinary external targets return `ASK/EXTERNAL_WRITE` whether existing or missing. Membership uses the issued canonical `insideWorkspace` relation rather than a textual prefix.
- Results contain exactly `decision` and `reason`. The read function and its public contract are unchanged byte-for-byte; the write addition is an additive 59-line hunk after the accepted read code.
- Tests use fabricated temporary resources and complete literal expectations. They cover both symlink-boundary directions, secret targets, sensitive lexical aliases, template and key overlaps, malformed runtime inputs, broken links, and `ENOTDIR`.

## Evidence

Supplied independent review evidence:

| Check | Result |
| --- | --- |
| `node --test test/write-decisions.test.ts` | PASS, 9/9 |
| `node --test test/decisions.test.ts` | PASS, 8/8 |
| `npm run check` | PASS, typecheck and 128/128 tests |
| `git diff --check` and `git diff --cached --check` | PASS; index was empty during review |
| Independent temporary probes | PASS, 11/11 |

Acceptance-time verification performed while preparing this record (the primary agent's own runs, distinct from the review):

| Check | Result |
| --- | --- |
| `node --test test/write-decisions.test.ts` | PASS, 9/9 |
| `node --test test/decisions.test.ts` | PASS, 8/8 |
| `npm run check` | PASS, typecheck and 128/128 tests |
| `git diff --check` and `git diff --cached --check` | PASS; index was empty |
| Scope | only the additive `src/policy/decisions.ts` hunk and the new `test/write-decisions.test.ts` |

Audited SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `src/policy/decisions.ts` | `26066ff31d4c99f5e3b4b252bfd68d718823e3078db971cc038ec4e4676bc8ed` |
| `test/write-decisions.test.ts` | `e0d39598c0cacbab4a2e920b6134d15f9a2fb2c3d39254df712bdc8fa3a58045` |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `test/paths.test.ts` | `676e00aaef9f26e70dfad5ea9513a702352d2d707fd5cc0f04f62c0ed3b21398` |
| `test/resources.test.ts` | `f9a03c98a6ee9c01ae9103ede6f87fc37ee656966a14730ffe6e35df31478436` |
| `test/decisions.test.ts` | `a7a25d710e9818ffe85abcaf5b207d6e1481472b2ef7934e51da24fd888b9911` |

## Limits

This is a synchronous path-rule result, not authorization enforcement, approval, capability, configuration, or containment. It does not validate object type, overwrite semantics, atomicity, parent permissions, the complete set of resources touched by an operation, TOCTOU, symlink replacement, hard links, mounts, or recursive traversal. Classification remains content-blind. Pi integration, configurable policy, approval flow, shell/network policy, and OS containment remain absent.
