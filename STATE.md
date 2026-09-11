# Project State

Updated: 2026-09-11
Branch: `codex/read-path-default-decisions`
HEAD: `e9b2f16cafe79421c8cf59f1d3fc028379888386`

## Current checkpoint

**READ-PATH DEFAULT DECISION GOAL ACCEPTED; COMMIT PREPARATION AUTHORIZED.** Phase 1A path resolution, Phase 1B path-only classification, and the first fixed read-path decision primitive exist without Pi enforcement. The owner accepted `20260911-read-path-default-decisions` after an independent security review PASS and authorized its separate local commit. No Pi tool gates, approval flow, configurable policy, other operation decisions, shell/network policy, or OS containment are implemented.

This file is the canonical acceptance/checkpoint record. `ROADMAP.md` defines phase gates; `ARCHITECTURE.md` defines component and trust boundaries. `IMPLEMENTATION_HANDOFF.md` is the replaceable execution contract for the selected Goal. The older untracked `QWEN_TASK.md` is absent at this checkpoint; its removal was observed during review, not attributed to the implementation. Do not recreate it or treat it as the active instruction.

## Accepted work and evidence

- The provenance readonly contract was accepted at the prior checkpoint: successful resolver issuance, private WeakSet membership, frozen runtime objects, and readonly `ResolvedPath` fields remain required.
- The GitHub/GCloud conventional `.config` matcher correction is present with regression coverage. This checkpoint does not infer a separate historical acceptance verdict for that Goal.
- `20260910-compound-env-template-classification`: **GOAL ACCEPTED** following independent review, explicitly confirmed by the owner. Complete dot-delimited `example`, `sample`, `template`, and `dist` markers classify as sensitive template evidence, without suppressing stronger evidence on either path identity or in another rule.
- The compound-template independent review passed resource tests 44/44, full tests 86/86, typecheck, `git diff --check`, and 69/69 additional adversarial cases. It verified that implementation increment against its handoff baseline.
- `20260910-generic-key-sensitivity`: **GOAL ACCEPTED** at this checkpoint after the independent implementation review and closure of its sole test-contract finding. That review passed 55/55 resource tests, 97/97 total tests, typecheck, and 45/45 independent full-result probes. The reviewer subsequently replaced the affected `private.key` presence-only assertion with a complete literal comparison, as authorized by the owner, and reran 55/55 resource tests, 97/97 total tests, typecheck, and `git diff --check`. This final correction changed only the test; it was not a separate independent review of new production code.

## Architectural checkpoint

`20260911-resource-full-result-assertions`: **GOAL ACCEPTED** based on the fresh independent read-only review supplied by the owner. Reported evidence: all criteria 1–8 verified; exactly six incremental hunks limited to the three targeted tests and unused imports/interface; all fixtures and 68 other tests byte-identical; 22 table paths and all 15 reasons preserved; 28/28 independently derived classifications matched; 69/69 resource tests, typecheck plus 111/111 full tests, and whitespace checks passed; all 11 isolated mutations caused failures in the migrated tests. No defects were reported. During acceptance, HEAD/branch, production source hashes, and tracked-diff hash `d25c22fe7710af4be5099b1ea2a86e78c59ebc27abeb94709f4598a3f2e36ae6` were rechecked against the handoff. The test and mutation results are attributed to the supplied independent review, not a repeated audit during this state-only update.

`20260911-ssh-private-key-backups`: **GOAL ACCEPTED** following independent review. Resource tests passed 69/69, complete tests 111/111, typecheck and `git diff --check` passed, and the reviewer independently exercised 214/214 literal-result cases. Source outside the SSH change, the README outside its SSH addition, other tracked changes, Phase 1A, and this state file matched the preceding checkpoint. The missing historical `QWEN_TASK.md` was disclosed separately. These are preceding-review results, not new test runs during handoff preparation.

Keep the current architecture: raw path → successful Phase 1A result → synchronous path classifier → future policy engine. Canonical and normalized lexical evidence are evaluated independently; maximum sensitivity wins. Classification is content-blind and does not grant permission. Workspace membership cannot override secret evidence. Provenance protects trusted-module issuance/integrity, not hostile same-process code or filesystem TOCTOU.

General full-result assertions are accepted without changing classification semantics. Documentation consistency review and the final independent audit passed; the owner has accepted Phase 1B. The roadmap classification checkbox is closed. Phase 1 as a whole remains incomplete.

## Accepted key-extension contract

Generic terminal `.key` extensions now classify as `sensitive`; `.p12`/`.pfx` remain `secret`. Stronger canonical/lexical or unrelated rule evidence continues to dominate.

Architectural contract for this Goal: retain category `private-key` and reason `private-key-extension`. Emit at most one match for this rule group, in its existing order, with the maximum sensitivity contributed by either identity and the union of matching evidence in canonical-then-lexical order. A `.key` alias to a `.p12`/`.pfx` target (or the reverse) therefore remains one `secret` extension match with both evidence sources. Do not introduce a public reason or change unrelated merging semantics.

This corrects a filename-confidence distinction; it does not make `.key` files safe to read or weaken a future default-deny policy for sensitive resources. Generic `.pem` behavior remains sensitive and unchanged.

## Accepted SSH backup contract

The existing `ssh-private-key-name` rule now recognizes exact conventional basenames `id_rsa`, `id_dsa`, `id_ecdsa`, and `id_ed25519` followed by exactly one of `.bak`, `.backup`, `.old`, or `~`. Unsuffixed names, ASCII case folding, category/reason/sensitivity, rule order, and canonical/lexical evidence behavior are preserved.

The selected suffix set is deliberately bounded: no repeated/chained suffixes, arbitrary date suffixes, substring matching, or public-key variants. A public-looking path may still receive secret evidence from its genuine private-key symlink target; exclusion applies per identity, not as a global override. This is a filename convention, not complete backup or content detection. No architectural expansion is needed.

## Final documentation review and independent audit

On 2026-09-11, the owner requested continuation with documentation consistency review and the final independent audit remaining. The documentation pass corrected current-status, resolver-fixture, and GitHub/GCloud scope wording in five documents; no production or test files changed. A separate read-only reviewer then returned **PASS** for the accumulated Phase 1B implementation, tests, and corrected documentation, with no remaining findings. See [docs/PHASE-1B-AUDIT.md](docs/PHASE-1B-AUDIT.md) for scope, source anchors, evidence, environment, and limitations.

Fresh independent evidence: 69/69 resource tests; typecheck and 111/111 full tests; whitespace checks; 92/92 independent synthetic probes (74 complete classification results, 17 provenance/freeze attacks, 1 ENOTDIR case); and expected compiler rejection of six readonly assignments and one missing-brand structural value. The primary agent inspected test/probe logs and rechecked unchanged source/test hashes. These are the independent reviewer's test runs, not duplicate primary-agent runs.

## Phase 1B acceptance and commit boundary

Final owner acceptance was recorded on 2026-09-11 in response to the proposed next steps. Only the Phase 1B classification checkbox is closed. The separately authorized Git transition created the Phase 1B commit `feat: add audited path-only resource classification` (`e9b2f16cafe79421c8cf59f1d3fc028379888386`): exactly the 15 candidate files were staged from the verified patch, all committed blob hashes matched the manifest, `npm run check` passed (typecheck and 111/111 tests), `git diff --cached --check` passed, and the index was empty afterward. Local `main` was fast-forwarded to that commit without a merge commit. No push was performed.

A separate 15-file Phase 1B commit candidate was prepared before next-Goal planning edits; see [docs/PHASE-1B-COMMIT.md](docs/PHASE-1B-COMMIT.md). It excludes local artifacts and next-Goal planning. It is preserved as the historical description of the snapshot that was committed.

## Selected next Goal

`20260911-read-path-default-decisions`: **GOAL ACCEPTED.** The first decision primitive is limited to a single read path: sensitive/secret deny, ordinary missing target denies, ordinary existing canonical in-workspace target allows, ordinary existing external target asks. Invalid provenance and unsupported operations deny before those rules. It uses existing resolver/classifier contracts and introduces no enforcement or configurable exceptions.

Before implementation, the separately prepared [Git transition prompt](docs/BRANCH-TRANSITION.md) was completed: the exact accepted Phase 1B snapshot was committed, local `main` was fast-forwarded, `codex/read-path-default-decisions` was created, and the handoff baseline was refreshed to the actual commit. The transition task did not begin implementation and this checkpoint does not authorize an automatic transition into it; implementation starts only under a separate explicit instruction. The implementation Goal itself is unchanged.

The fixed design is [docs/READ-PATH-DECISIONS.md](docs/READ-PATH-DECISIONS.md), the executed contract is [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md), and the independent verdict is recorded in [docs/READ-PATH-DECISIONS-AUDIT.md](docs/READ-PATH-DECISIONS-AUDIT.md). The review found no defects. It passed 8/8 focused tests, typecheck and 119/119 complete tests, whitespace checks, and 16/16 independently designed assertions. Source and test scope remained exactly `src/policy/decisions.ts` and `test/decisions.test.ts`; all five baseline anchors were unchanged.

The roadmap decision checkbox remains open because this Goal covers only one read path and does not complete the structured decision engine. Broader operation policies and monotonic configuration authority remain Phase 1 work. No Pi integration, installation, push, or Phase 2 work is authorized by this checkpoint.
