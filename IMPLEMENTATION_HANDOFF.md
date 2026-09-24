# Implementation Handoff

Task ID: `20260924-v1-independent-audit`
Baseline: `b1bab7561131e5e49371bdd303f913928187065c` (index empty; working tree clean)
Scope Gate: HISTORICAL (step 4 committed as 0bc06da; review + owner acceptance pending)

## Goal

Complete an independent audit appropriate to the claimed v1.0 boundary: close only the Phase 7 checklist item "Complete an independent audit appropriate to the claimed boundary".

## Context

- Steps 1–3 accepted on `main`: stabilized guarantees P1–P18 + R1–R11 (`docs/V1-GUARANTEES.md`, manifest `2d59ca09…`, commit `24da69f`, hosted run `35740981632`); per-promise biting regressions (manifest `8a42fd59…`, 16 entries, commit `c01b53d`, hosted run `35977693960`); R1–R11 dispositions with blocker verdict none open (`docs/UNKNOWN-BOUNDS-AUDIT.md`, manifest `2b7ad6b5…`, 16 entries, commit `82a5c4b`, hosted run `35984659993`); acceptance docs commit `b1bab75` (hosted run green, tests 404 / fail 0 / skipped 54).
- The claimed boundary is `docs/V1-GUARANTEES.md` P1–P18 (promises with exact platform/operation/threat bounds) plus R1–R11 (explicit non-promises); evidence index §9, doc agreement §8.
- Declared target unchanged: macOS 27.0 (26A428) arm64, pinned `/usr/bin/sandbox-exec` identity, Pi `0.84.4` only verified peer, Node `26.8.1` (target) / `22.19.0` (hosted Linux floor); hosted CI covers the platform-independent Linux suite only and is never containment evidence (P18/R11).
- Phase 7 order (owner decision): 1 stabilize (done) → 2 regression-per-guarantee (done) → 3 unknowns bound (done) → 4 independent audit (this Goal) → gate decision and publication as separate maintainer decisions. This Goal is step 4 only.

## Scope

- Independent audit of the exact final snapshot in fresh context(s): re-derive every manifest hash against the working tree, re-run the reviewer-owned checks (typecheck, manifest suites, affected regression suites, `git diff --check`), adversarial code reading of the enforcement chain (authorizer, controlled tools, containment, broker, approvals, freeze/measure/export), and a verdict per P1–P18 (promise holds on its boundary) and per R1–R11 (bound stands with no new claim).
- Audit record as a new doc (executor-run vs reviewer-run sections kept distinct) plus manifest binding for this Goal's artifacts following the repository's manifest-plus-test pattern: new `docs/*-hashes.json` entry/entries plus suite(s), `CHANGED_IN_*` declarations in every earlier suite whose covered bytes change, explicit `test/ci-test-budget.json` update if and only if the collected set changes, retention-list update in `test/packaging-identity.test.ts` if and only if new files carry old-name mentions.
- Adversarial findings and their fixes stay inside this Goal; every fix carries its biting regression and fresh checks, and the affected evidence is re-reviewed (no stale PASS transfers to different bytes).
- Narrow source fix under `src/` if and only if the audit exposes an open bypass of a claimed P-protection (release blocker); each such fix stays inside this Goal with its biting regression and fresh checks.

## Out of Scope

- Closing the Phase 7 gate, releasing, tagging, publishing, removing `private: true`, wiring provenance, pushing, or installing into a real Pi profile.
- Rewording the stabilized P1–P18 set beyond corrections the audit forces; rewriting accepted evidence bytes without a manifest declaration; smoothing a disagreement by rewording evidence away.
- Extending platform support, adding a hosted macOS job, verifying new Pi/Node versions, resolving the Class 1 Linux question, or making any mount/B3/descendant/Keychain claim beyond the inherited bound.
- Refactors, dependency changes, packaging/CI behavior changes, or padding the suite with non-biting tests.
- Acceptance recording itself (`STATE.md`/`ROADMAP.md` acceptance entries and the manifest binding SHA-256, which is recorded in `STATE.md` at acceptance to avoid a self-referential hash cycle, not in the bound audit).

## Risk Gates

- The audit must run in fresh context(s) against the exact final bytes; an audit reusing prior-context evidence or transferring a stale PASS to different bytes is invalid.
- Review evidence must distinguish reviewer-run checks from executor-run checks; acceptance binds to exact bytes/hashes of the reviewed snapshot.
- Any Linux-support, mount-isolation, same-user-writer, descendant-termination, Keychain-beyond-probe, or exfiltration-resistance claim requires fixtures and evidence that do not currently exist; without them the inherited R-bounds stand.

## Acceptance Criteria

1. A fresh-context independent audit of the exact final snapshot returns PASS with no blocking findings, covering every P1–P18 against its cited evidence and every R1–R11 against its bound.
2. Every audit finding was fixed inside this Goal with its biting regression and re-verified; no open bypass of a claimed protection remains unrecorded.
3. P1–P18 wording is unchanged except corrections the audit forces; the doc-agreement re-read lists any disagreement instead of rewording evidence away.
4. This Goal's artifacts are bound by a manifest and its test; `npm run check`, all manifest suites, and `git diff --check` pass locally, and the hosted run for the final commit is green with the declared counts.
5. Owner acceptance closes only the "Complete an independent audit appropriate to the claimed boundary" item; the Phase 7 gate decision and publication remain separate explicit maintainer decisions.

## Verification

- Criterion 1: read the audit verdict, its scope (exact commit SHA), and the per-promise/per-residual coverage against `docs/V1-GUARANTEES.md` §§1–9.
- Criterion 2: for each finding, read the fix, its biting regression, and the re-verification (mutation fail / accepted-bytes pass); read the blocker verdict.
- Criterion 3: diff `docs/V1-GUARANTEES.md` P1–P18 against the step-1 accepted bytes; read the doc-agreement table for unlisted disagreements.
- Criterion 4: `npm run check`, the manifest suites, `git diff --check`; confirm the hosted run for the final commit is green and the count assertion reports the declared numbers; `package.json` still `private: true`, no lifecycle scripts, CI never publishes.
- Criterion 5: owner acceptance recorded in `STATE.md`; no gate closure or publication claimed.

## Constraints

- Preserve the `AGENTS.md` security invariants; fail closed where proceeding would cross a protected boundary; project-controlled configuration never weakens global policy.
- Tests use isolated temporary fixtures only; no real credentials, secret files, home-directory reads, or real-profile installation.
- Per standing owner decision, all work lands directly on `main`; no additional topic branches.
- Exact versions, run identifiers, and hashes only; never invent evidence; prior manifests keep historical entries via declared change sets.
- Documentation states only guarantees demonstrated by the implementation and tests.

## Escalate If

- The audit surfaces a bypass needing implementation beyond a narrow in-Goal fix, a support commitment, a platform claim, or publication authority.
- A residual cannot stay bounded without changing a P-promise (potential release blocker or guarantee change, not a silent bound edit).
- The Goal splits into independently reviewable/acceptable outcomes (e.g. per-layer audits shippable separately) — stop, do not expand; that is a decomposition signal.
- Baseline, ownership, attribution, or overwrite authority becomes ambiguous; stop without changing the handoff.
