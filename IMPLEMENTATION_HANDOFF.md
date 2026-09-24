# Implementation Handoff

Task ID: `20260922-regression-evidence-per-guarantee`
Baseline: `1e75222640902894180d3fe8a9fc1a6b91dc406b` (index empty; unstaged `M STATE.md` — Continuation-block condensation only, 4 lines; untracked `.commandcode/` session tooling only)
Scope Gate: READY

## Goal

Maintain biting regression evidence for every stabilized v1.0 guarantee (P1–P18) and every declared bound (R1–R11): close only the Phase 7 checklist item "Maintain regression evidence for every guarantee".

## Context

- Step 1 accepted 2026-09-22: `docs/V1-GUARANTEES.md` P1–P18 + R1–R11 is the single stabilized record; `docs/V1-GUARANTEES-AUDIT.md` + `docs/v1-guarantees-hashes.json` (10 entries) bind it; binding triple (manifest SHA-256 `2d59ca09…`, commit `24da69f`, hosted run `35740981632` green) is in STATE.md Continuation.
- Evidence index is `docs/V1-GUARANTEES.md` §9: each P cites contract section + audit section + suite(s) + manifest; each R cites its bound, not a behavior.
- Declared target unchanged: macOS 27.0 (26A428) arm64, pinned `/usr/bin/sandbox-exec` identity, Pi `0.84.4` only verified peer, Node `26.8.1` (target) / `22.19.0` (hosted Linux floor); hosted CI covers the platform-independent Linux suite only and is never containment evidence (P18/R11).
- Collected set at baseline: `test/ci-test-budget.json` `linux` budget tests 391 / fail 0 / skipped 54; local gate `npm run check` (typecheck + full suite, 1 declared platform skip).
- Inherited residuals carry forward verbatim (R1–R11): mount UNVERIFIED, B3 same-user writers, variant-B captured-bytes only, Class 1 Linux question open, Keychain synthetic-probe only, endpoint exfiltration declared.
- Phase 7 order (owner decision): 1 stabilize (done) → 2 regression-per-guarantee (this Goal) → 3 unknowns bound → 4 independent audit → publication as a separate maintainer decision. This Goal is step 2 only.

## Scope

- Gap analysis of P1–P18 against §9 suites: for each promise, confirm at least one biting regression (fails pre-fix / on mutation-restore, passes post-fix) proving the promised effect or refusal on the declared boundary, including platform-tagged containment suites that skip (never pass vacuously) off-target.
- New or strengthened regressions under `test/` for genuinely uncovered or weakly covered guarantee behavior only; each new test must defend an observable contract and fail on a plausible bypass.
- Manifest binding for this Goal's artifacts following the repository's manifest-plus-test pattern: new or extended `docs/*-hashes.json` entry/entries plus suite(s), `CHANGED_IN_*` declarations in every earlier suite whose covered bytes change, explicit `test/ci-test-budget.json` update if and only if the collected set changes, retention-list update in `test/packaging-identity.test.ts` if and only if new files carry old-name mentions.
- Review evidence record for this Goal (audit doc) distinguishing reviewer-run from executor-run checks; per-promise evidence table mapping P1–P18 to the exact regression(s) plus mutation/bite note.
- Narrow source fix under `src/` if and only if a new regression exposes an open bypass of a claimed P-protection (release blocker); each such fix stays inside this Goal with its biting regression and fresh checks.

## Out of Scope

- Closing any other Phase 7 item (unknown-resolution, independent v1 audit), closing the Phase 7 gate, releasing, tagging, publishing, removing `private: true`, wiring provenance, pushing, or installing into a real Pi profile.
- Rewording the stabilized guarantee set beyond corrections this Goal's evidence forces; rewriting accepted evidence bytes without a manifest declaration; smoothing a disagreement by rewording evidence away.
- Extending platform support, adding a hosted macOS job, verifying new Pi/Node versions, resolving the Class 1 Linux question, or making any mount/B3/descendant/Keychain claim beyond the inherited bound.
- Refactors, dependency changes, packaging/CI behavior changes, or padding the suite with non-biting tests.

## Risk Gates

- No guarantee beyond its cited evidence; a promise whose regression cannot bite on the declared boundary is a finding (bound it as an R-item or file a release-blocker), never a vacuously passing test.
- Hosted CI must never be presented as containment evidence; `ordinary` classification must never be presented as proof of no secret content; count assertion verifies counts, not test identities.
- Review evidence must distinguish reviewer-run checks from executor-run checks; acceptance binds to exact bytes/hashes of the reviewed snapshot; a stale PASS never transfers to different bytes.

## Acceptance Criteria

1. Every P1–P18 maps to at least one named biting regression proving its promised effect or refusal on its declared boundary; every R1–R11 names its explicit bound with no new claim.
2. No open bypass of a claimed protection remains: each added or strengthened regression fails when its guarded behavior is mutated/restored and passes on the accepted bytes.
3. Platform tagging holds: darwin-only containment suites execute on the declared target and skip (never pass vacuously) off-target; hosted Linux evidence covers the platform-independent set only.
4. This Goal's artifacts are bound by a manifest and its test; `npm run check`, all manifest suites, and `git diff --check` pass locally, and the hosted run for the final commit is green with the declared counts.
5. A fresh independent review of the final snapshot returns PASS with no blocking findings before owner acceptance; acceptance closes only the "Maintain regression evidence for every guarantee" item.

## Verification

- Criterion 1: read each P1–P18 against its named regression(s) and the artifact each cites (contract/audit section, suite on the declared target); read each R1–R11 against its declared bound.
- Criterion 2: for each new/strengthened regression, restore the guarded defect (or apply the recorded mutation) and confirm the affected suite fails; re-apply the accepted bytes and confirm it passes.
- Criterion 3: run the containment suites on the declared target and confirm execution; confirm off-target they skip by their own platform conditions (no vacuous pass); confirm the hosted run covers the Linux budget only.
- Criterion 4: `npm run check`, the manifest suites, `git diff --check`; confirm the hosted run for the final commit is green and the count assertion reports the declared numbers; `package.json` still `private: true`, no lifecycle scripts, CI never publishes.
- Criterion 5: independent review of the exact final bytes; owner acceptance recorded in `STATE.md`.

## Constraints

- Preserve the `AGENTS.md` security invariants; fail closed where proceeding would cross a protected boundary; project-controlled configuration never weakens global policy.
- Tests use isolated temporary fixtures only; no real credentials, secret files, home-directory reads, or real-profile installation.
- Work on `main`; no additional topic branches.
- Exact versions, run identifiers, and hashes only; never invent evidence; prior manifests keep historical entries via declared change sets.
- Documentation states only guarantees demonstrated by the implementation and tests.

## Escalate If

- A P-promise has no biting regression without a code or guarantee change (potential release blocker or R-item, not a silent test edit).
- The work exposes a real bypass of a claimed protection needing implementation beyond a narrow in-Goal fix, a support commitment, a platform claim, or publication authority.
- The Goal splits into independently reviewable/acceptable outcomes (e.g. per-layer guarantee groups shippable separately) — stop, do not expand; that is a decomposition signal.
- Baseline, ownership, attribution, or overwrite authority becomes ambiguous; stop without changing the handoff.
