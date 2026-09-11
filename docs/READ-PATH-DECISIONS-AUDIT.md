# Read-path default decision independent audit

Date: 2026-09-11

Goal: `20260911-read-path-default-decisions`

Baseline: `e9b2f16cafe79421c8cf59f1d3fc028379888386` on `codex/read-path-default-decisions`

## Verdict

**PASS.** The independent read-only security review found no implementation, test, or documentation defect within the Goal. The implementation is suitable for Goal acceptance. The reviewer did not modify repository files, stage, commit, push, inspect `.qwen`, or access credentials.

## Verified behavior

- Resolver issuance is checked before any resource property access. Structural objects, spread and assignment copies, inheritance, descriptor and JSON copies, copied brands, throwing getters, and proxies return `DENY/INVALID_RESOURCE`; an independent proxy probe observed no trap calls.
- Invalid resource takes precedence over invalid operation. Unsupported operations cannot reach `ALLOW` or `ASK`.
- Internal classification runs without a fallback. `secret` and `sensitive` precede missing-target and workspace decisions; ordinary missing targets deny; ordinary existing canonical in-workspace targets allow; ordinary existing external targets ask.
- Results contain exactly `decision` and `reason`. Type checks preserve the exact `read` operation, nominal resolver input, readonly result fields, and valid decision/reason pairs.
- Tests use fabricated temporary resources and complete literal expectations. They cover both symlink-boundary directions, secret targets, sensitive lexical aliases, template and key overlaps, malformed runtime inputs, broken links, and `ENOTDIR`.

## Evidence

| Check | Result |
| --- | --- |
| `node --test test/decisions.test.ts` | PASS, 8/8 |
| `npm run check` | PASS, typecheck and 119/119 tests |
| `git diff --check` | PASS |
| `git diff --cached --check` | PASS; index was empty during review |
| Independent temporary probes | PASS, 16/16 assertions |

Audited SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `src/policy/decisions.ts` | `a8750065fcd40f653cb127aca3d32580529c83cb277d167621bc0d6be29db9f1` |
| `test/decisions.test.ts` | `a7a25d710e9818ffe85abcaf5b207d6e1481472b2ef7934e51da24fd888b9911` |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `test/paths.test.ts` | `676e00aaef9f26e70dfad5ea9513a702352d2d707fd5cc0f04f62c0ed3b21398` |
| `test/resources.test.ts` | `f9a03c98a6ee9c01ae9103ede6f87fc37ee656966a14730ffe6e35df31478436` |
| `docs/READ-PATH-DECISIONS.md` before acceptance-status update | `a0eb69fd323daf69a6606a24b2ede5c4cbcd3f89e0c8a76ba06975e4cb6fde92` |

## Limits

This is a synchronous path-rule result, not authorization enforcement, approval, capability, configuration, or containment. It does not validate object type or recursive traversal. Classification remains content-blind; TOCTOU, hard links, mounts, symlink races, and hostile same-process code remain outside its guarantee. Pi integration and decisions for write, edit, delete, shell, network, and other operations are absent.
