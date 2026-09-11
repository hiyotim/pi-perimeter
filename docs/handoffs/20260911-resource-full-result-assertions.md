# Implementation Handoff

Task ID: 20260911-resource-full-result-assertions
Baseline: 548032665b57fdbaa4399ad2c0aaaa9ea001a2f6

## Goal

Replace the remaining partial classification assertions in the initial rule table, standalone PEM test, and general ASCII-case table with complete literal expected results, without changing production behavior.

## Context

`STATE.md` records acceptance of `20260911-ssh-private-key-backups` after independent review: resource tests 69/69, complete tests 111/111, typecheck, whitespace checks, and 214/214 independent literal-result probes passed. These are preceding-review results, not new test runs during handoff preparation.

Phase 1B remains open. The remaining test gap is presence-only or projected-field assertions that can miss extra matches, wrong categories, missing evidence, or incorrect order. The three affected tests are `classifies every initial built-in rule`, `classifies PEM as sensitive rather than secret`, and `supports conservative ASCII case-insensitive matching` in `test/resources.test.ts`.

The architecture is unchanged: genuine frozen/readonly Phase 1A result → synchronous path-only classifier → future policy engine. Canonical evidence precedes lexical evidence; matches follow rule order; maximum sensitivity wins. Classification does not authorize or enforce access.

### Working-tree baseline

Branch: `phase-1b-resource-classification`; no staged changes. Start from the accumulated working tree, not HEAD alone. Modified tracked files are `.gitignore`, `ARCHITECTURE.md`, `README.md`, `ROADMAP.md`, `SECURITY.md`, `THREAT_MODEL.md`, `docs/DEVELOPMENT.md`, `src/policy/README.md`, `src/policy/paths.ts`, `test/README.md`, and `test/paths.test.ts`.

Untracked entries are `.opencode-permission-canary.txt`, `.qwen/`, this handoff, `STATE.md`, `src/policy/resources.ts`, and `test/resources.test.ts`. Historical `QWEN_TASK.md` is absent; do not recreate it. Preserve unrelated artifacts.

Starting SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `test/resources.test.ts` | `57e1ab8418a54c42764adde43f361be486f5914ae835d8878efcf07b3066ed80` |
| `src/policy/README.md` | `4f6dd478010d2c24240022b8263cae19b7c48a5c25c1a01a1323cd3ff255764f` |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `STATE.md` | `523b128bfb2f5dcc6f56828fd675c294ba29ed3c6b8baea706c6e02b1ef14c54` |

The preparation output of `git diff --binary | shasum -a 256` is `d25c22fe7710af4be5099b1ea2a86e78c59ebc27abeb94709f4598a3f2e36ae6`. It covers tracked changes only. Record the starting test file for incremental comparison because it is untracked. Stop on material baseline ambiguity rather than resetting or reconstructing from HEAD.

## Scope

Only `test/resources.test.ts`: the three named tests and their directly used test-only types/imports. Remove a type/import only if this change makes it unused. No fixture changes or production edits are expected; report if they become necessary.

## Acceptance Criteria

1. Preserve all current input paths and coverage in the initial built-in rule test, including its separate complete `private.key` case. Every case must compare the entire classification against a literal expected object: top-level sensitivity, complete ordered matches, category, per-match sensitivity, reason, and ordered evidence. Do not drop cases to simplify the migration.
2. The table continues to cover all existing rule reasons: `env-template`, `env-file`, `ssh-directory`, `ssh-private-key-name`, `pem-file`, `private-key-extension`, `aws-credentials`, `aws-sso-cache`, `gcloud-credentials`, `github-cli-credentials`, `kubeconfig`, `docker-auth`, `netrc`, `package-auth-file`, and `git-credential-store`. Preserve multiple representative paths already in the table, including all three GCloud files and package-auth names.
3. The standalone PEM test compares the complete result: top-level `sensitive`, exactly one `private-key` / `pem-file` / `sensitive` match, and evidence `["canonical-path", "lexical-path"]`.
4. Preserve all four general ASCII-case inputs. `.ENV.PRODUCTION`, `.AWS/CREDENTIALS`, and `PRIVATE.P12` have their complete existing single-match results. `.SSH/ID_ED25519` has top-level `secret` and exactly two matches, in order: sensitive `ssh-directory`, then secret `ssh-private-key-name`, both category `ssh-credentials`, both with canonical-then-lexical evidence. Do not omit the directory match.
5. Expected classifications are authored from the documented contract and reviewed behavior. Do not derive them from classifier output, production rule data, a mirrored matcher, snapshots automatically accepted from actual output, or result filtering/sorting/deduplication. A test-only wrapper may pass actual and literal expected values to deep comparison, but must not normalize either side or ignore fields.
6. The three migrated tests no longer rely on `matches.some(...)`, reason/category projections, unordered containment, or top-level sensitivity alone to establish classification correctness. They must reject added/removed matches, wrong categories/reasons/sensitivities, missing/reordered evidence, and reordered multi-match results.
7. Preserve all other tests and their coverage: accepted compound templates, SSH backups/public variants, mixed `.key`/`.p12`/`.pfx` evidence, cloud paths, Unicode near misses, canonical/lexical aliases, nonexistent targets, provenance rejection, and resolver failures. Existing tests that already assert top-level sensitivity plus the complete matches array are sufficient; no wholesale stylistic migration is required.
8. Production source, runtime exports, dependencies, classifier semantics, fixtures, canonical project state, and documentation remain unchanged. Tests continue to use genuine resolver results and isolated fabricated resources; never read real credentials or home configuration.

## Verification

Before editing, verify HEAD, branch, status, and the baseline anchors. Record the starting test file and review the incremental diff explicitly; ordinary `git diff` omits it.

Run in order:

```sh
node --test test/resources.test.ts
npm run check
git diff --check
git status --short --branch
```

`npm run check` runs typecheck and all path/resource tests. Inspect the literal expected objects against the unchanged rule contract, particularly the two-match ASCII SSH case and canonical-before-lexical evidence. Confirm every original table input remains covered and no partial-only check remains in the three targeted tests. Check that production and checkpoint hashes remain unchanged. Report actual results and failures; do not change production behavior to satisfy new expectations.

## Constraints

- No changes outside the named test file; no general test-suite rewrite, fixture overhaul, matcher additions, or duplication of production classification logic.
- Preserve Phase 1A, provenance, readonly/freeze protections, canonicalization, ENOTDIR behavior, all accepted classifiers and public contracts.
- No canonical document/checkpoint updates during execution. Documentation consistency review and final Phase 1B acceptance are later work.
- No Pi integration, authorization/enforcement, approvals, shell/network policy, sandboxing, configuration/provider changes, dependency updates, real credentials, or installation.
- Preserve accumulated work. No staging, commits, pushes, resets, branch changes, cleanup, or phase advancement.

## Execution Notes

Stop after verification for independent review. Report the incremental diff, preserved input/rule coverage, the complete ASCII SSH expectation, and actual check results. Passing this Goal does not complete Phase 1B: documentation consistency review and the final independent audit remain necessary before any completion or commit decision.

## Escalate If

Stop and report before changing the Goal or acceptance criteria, violating an invariant, materially expanding scope, changing an unapproved public/external contract, introducing an unplanned security-sensitive/destructive change, performing a migration/transformation with potential data loss, contradicting or requiring changes to canonical documents, or proceeding from a materially changed/ambiguous baseline. Also stop if an expected result reveals a production defect, fixtures need changing, or checks fail outside scope. Preserve existing work.
