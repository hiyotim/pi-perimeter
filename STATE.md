# Project State

Updated: 2026-09-12
Branch: `codex/monotonic-authorization-join`
Implementation baseline: `6a63f09d5845c4e2d044fe46441384db0e0d96a5`

## Current checkpoint

**MONOTONIC POLICY AUTHORITY CONTRACT ACCEPTED AND COMMITTED.** Phase 1A path resolution, Phase 1B path-only classification, and the fixed read-path, write-path, and edit-path decision primitives exist without Pi enforcement. The owner accepted `20260911-monotonic-policy-authority-contract` after an independent security/architecture review returned PASS with no defects. The contract and its audit record were committed as `03a427e5b9aa3b34d22dc7bda4b1aba10e318c64` (`docs: define monotonic policy authority contract`) and local `main` was fast-forwarded to it. The contract fixes a documentation-only authority model under `ALLOW < ASK < DENY`: the strictest applicable outcome wins; project-controlled configuration cannot weaken policy; trusted user/global contributions currently may only preserve or strengthen the baseline; approval and containment remain separate. The monotonic authority roadmap item and Phase 1 release gate remain open because no parser, schema, merge primitive, configuration loading, approval, enforcement, or Pi integration exists. No delete/rename policy, shell/network policy, or OS containment is implemented.

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

## Accepted read-path Goal

`20260911-read-path-default-decisions`: **GOAL ACCEPTED.** The first decision primitive is limited to a single read path: sensitive/secret deny, ordinary missing target denies, ordinary existing canonical in-workspace target allows, ordinary existing external target asks. Invalid provenance and unsupported operations deny before those rules. It uses existing resolver/classifier contracts and introduces no enforcement or configurable exceptions.

Before implementation, the separately prepared [Git transition prompt](docs/BRANCH-TRANSITION.md) was completed: the exact accepted Phase 1B snapshot was committed, local `main` was fast-forwarded, `codex/read-path-default-decisions` was created, and the handoff baseline was refreshed to the actual commit. The transition task did not begin implementation and this checkpoint does not authorize an automatic transition into it; implementation starts only under a separate explicit instruction. The implementation Goal itself is unchanged.

The fixed design is [docs/READ-PATH-DECISIONS.md](docs/READ-PATH-DECISIONS.md), the executed contract is [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md), and the independent verdict is recorded in [docs/READ-PATH-DECISIONS-AUDIT.md](docs/READ-PATH-DECISIONS-AUDIT.md). The review found no defects. It passed 8/8 focused tests, typecheck and 119/119 complete tests, whitespace checks, and 16/16 independently designed assertions. Source and test scope remained exactly `src/policy/decisions.ts` and `test/decisions.test.ts`; all five baseline anchors were unchanged.

The roadmap decision checkbox remains open because this Goal covers only one read path and does not complete the structured decision engine. Broader operation policies and monotonic configuration authority remain Phase 1 work. No Pi integration, installation, push, or Phase 2 work is authorized by this checkpoint.

The accepted Goal commit contains exactly ten reviewed files: the decision source and tests, its fixed design and independent audit record, the executed handoff, the architecture/state updates, and preserved transition/handoff history. The commit excluded `.gitignore`, `.qwen/`, and `.opencode-permission-canary.txt`. The index was empty after commit. Local `main` was fast-forwarded to this commit without a merge commit. No push was performed.

## Accepted write-path Goal

`20260911-write-path-default-decisions`: **GOAL ACCEPTED after independent security review PASS with no findings.** The second decision primitive adds one fixed write path while preserving the accepted read function byte-for-byte: sensitive/secret deny everywhere, ordinary inside targets allow whether existing or missing, ordinary external targets ask whether existing or missing, and invalid provenance or unsupported operations deny first. Resolver issuance is checked before any property access, invalid resource takes precedence over invalid operation, the operation comparison is exact and non-coercing, classification is internal with no fallback, and membership uses the issued canonical relation. Independent evidence: focused write tests 9/9, accepted read tests 8/8, `npm run check` typecheck and 128/128 tests, whitespace checks, and 11/11 independent probes. The review verified the additive 59-line write hunk and confirmed the accepted read source and the other five baseline anchors were unchanged. The independent verdict and hashes are recorded in [docs/WRITE-PATH-DECISIONS-AUDIT.md](docs/WRITE-PATH-DECISIONS-AUDIT.md). The accepted Goal commit contains exactly the six reviewed files, excludes `.gitignore`, `.qwen/`, `.opencode-permission-canary.txt`, and the transition prompt, and was created without push. Local `main` was fast-forwarded to the commit without a merge commit. The roadmap decision checkbox remains open because write covers only one of several operation paths.

## Accepted edit-path Goal

`20260911-edit-path-default-decisions`: **GOAL ACCEPTED after independent security review PASS with no implementation defects.** The independent review was performed directly by model `opencode-go/deepseek-v4.1-flash` without a subagent: manual inspection plus 11 targeted mutations in a separate temporary project copy, with all handoff checks rerun. The reviewer was not read-only overall; it modified only `test/edit-decisions.test.ts`, adding `["edit"]` and `new String("edit")` to the invalid operations as coercion defense-in-depth. No production file was changed by the reviewer.

Verified behavior: resolver issuance is checked before any resource property access; invalid resource takes precedence over invalid operation; the operation comparison is exact and non-coercing; classification is internal with no fallback; `secret` and `sensitive` deny everywhere and precede the missing-target and membership rules; every ordinary missing target returns `DENY/EDIT_TARGET_MISSING`; ordinary existing canonical inside targets allow and ordinary existing external targets ask. A classifier error propagates structurally because `evaluateEditPath` does not intercept it; runtime provocation through genuine resolver issuance is unreachable and recorded as a check limitation, not a defect.

Independent evidence: focused edit tests 9/9, accepted read tests 8/8, accepted write tests 9/9, `npm run check` typecheck and 137/137 tests, whitespace checks, and an empty index. The primary model re-ran these checks after the review report and observed the same focused/full results, hashes, anchors, clean whitespace, and empty index. The additive 64-line edit hunk preserved the accepted read and write source byte-for-byte and left the other six baseline anchors unchanged. The accepted Goal commit contains exactly the seven reviewed files as `139fa4abdff13a1240aa6488cb23e70bd7f80d15` (`feat: add default edit-path decisions`), excludes `.gitignore`, `.qwen/`, `.opencode-permission-canary.txt`, and both transition prompts, and was created without push; local `main` was fast-forwarded to it without a merge commit.

## Accepted monotonic policy authority contract

`20260911-monotonic-policy-authority-contract`: **GOAL ACCEPTED after independent security/architecture review PASS with no findings.** The only Goal artifact is [docs/MONOTONIC-POLICY-AUTHORITY.md](docs/MONOTONIC-POLICY-AUTHORITY.md), SHA-256 `6b3333dbb9415e0b58aa14eaaccd90020820b825103e47c3597c7281e676c87d`. It separates built-in defaults, trusted user/global configuration, project-controlled configuration, and future scoped approvals; defines the complete monotonic join; keeps `SANDBOX` orthogonal; specifies fail-closed interpretation; and lists deferred implementation choices without silently selecting them.

Independent evidence: all ten handoff criteria passed; all nine outcome combinations and the requested adversarial cases were inspected; document hash and baseline matched; internal links resolved; CR, trailing whitespace, tabs, BOM, and placeholder scans were clean; `git diff --check` passed; source/tests matched accepted anchors; and the index was empty. Informational observations about a non-exhaustive cross-reference, intentionally stale pre-acceptance checkpoint text, and `git diff --check` not covering untracked files were not defects. See [docs/MONOTONIC-POLICY-AUTHORITY-AUDIT.md](docs/MONOTONIC-POLICY-AUTHORITY-AUDIT.md). This acceptance does not complete the roadmap authority item or authorize a runtime guarantee.

The acceptance commit contains nine project files: the reviewed contract and audit, architecture/state/roadmap updates, the executed handoff, both preserved transition prompts, and local-artifact ignore rules. The `.qwen/` directory and permission canary remain local and untracked. The accepted contract is the baseline for the next bounded pure-policy Goal.

## Selected next Goal

`20260912-monotonic-authorization-join`: **HANDOFF PREPARED; NOT IMPLEMENTED.** The branch `codex/monotonic-authorization-join` starts from the post-acceptance checkpoint `6a63f09d5845c4e2d044fe46441384db0e0d96a5`. The bounded Goal creates only `src/policy/authority.ts` and `test/authority.test.ts` with a fail-closed pairwise join over `ALLOW < ASK < DENY`. It does not load or parse configuration, identify policy sources, integrate existing decisions, implement approvals or containment, or close the monotonic-authority roadmap item.

The active executor contract is [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md). Implementation, acceptance, staging, further commits, Pi integration, and the next Goal require their own execution and review steps.
