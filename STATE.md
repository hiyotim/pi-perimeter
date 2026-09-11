# Project State

Updated: 2026-09-11
Branch: `phase-1b-resource-classification`
HEAD: `548032665b57fdbaa4399ad2c0aaaa9ea001a2f6`

## Current checkpoint

**PHASE 1B ACCEPTED.** On 2026-09-11, following the final independent audit PASS, the owner authorized the proposed acceptance update and preparation of the next bounded Goal. Phase 1A path resolution and Phase 1B path-only classification exist as unenforced primitives. No Pi tool gates, authorization decisions, approvals, shell/network policy, or OS containment are implemented. The accumulated working tree remains uncommitted; HEAD alone does not contain the current classifier.

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

Final owner acceptance was recorded on 2026-09-11 in response to the proposed next steps. Only the Phase 1B classification checkbox is closed. A separate Phase 1B commit is being prepared for review; actual staging, commit, and push are not part of this preparation. Local artifacts and unrelated changes must not be included implicitly.

At this acceptance checkpoint, `IMPLEMENTATION_HANDOFF.md` describes the accepted assertion Goal and must not be executed again. Next-Goal preparation is authorized separately; no new production implementation, Pi integration, installation, staging, commit, or push is authorized by this record.
