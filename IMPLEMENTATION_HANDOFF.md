# Implementation Handoff

Task ID: `20260924-unknowns-bound`
Baseline: `5da9e22efe4026d2940779879c90e8ae37fc6933` (index empty; working tree clean)
Scope Gate: HISTORICAL (step 3 committed as 82a5c4b; review + owner acceptance pending)

## Goal

Resolve or explicitly bound every release-blocking known unknown: close only the Phase 7 checklist item "Resolve or explicitly bound release-blocking known unknowns".

## Context

- Steps 1–2 accepted: `docs/V1-GUARANTEES.md` P1–P18 + R1–R11 is the single stabilized record (manifest `2d59ca09…`, commit `24da69f`, hosted run `35740981632`); per-promise biting regressions bound by `docs/regression-evidence-hashes.json` SHA-256 `8a42fd593997b38a08fd1376add072fab5c4053a09684236602e22394e52687e` (16 entries), commit `c01b53d`, hosted run `35977693960` green (tests 398 / fail 0 / skipped 54), acceptance commit `5da9e22` with hosted run `35979221142` green.
- The known-unknown set is `docs/V1-GUARANTEES.md` §7 (R1–R11); the evidence index is §9; the doc-agreement record is §8.
- Declared target unchanged: macOS 27.0 (26A428) arm64, pinned `/usr/bin/sandbox-exec` identity, Pi `0.84.4` only verified peer, Node `26.8.1` (target) / `22.19.0` (hosted Linux floor); hosted CI covers the platform-independent Linux suite only and is never containment evidence (P18/R11).
- Phase 7 order (owner decision): 1 stabilize (done) → 2 regression-per-guarantee (done) → 3 unknowns bound (this Goal) → 4 independent audit → publication as a separate maintainer decision. This Goal is step 3 only.

## Scope

- Disposition of each R1–R11: either new biting evidence resolving it into a demonstrated bound, or an explicit bound statement with no new claim; per-residual disposition table in a new audit doc.
- New or strengthened regressions under `test/` only where a residual's bound lacks biting evidence; each must defend an observable contract and fail on a plausible bypass.
- Manifest binding for this Goal's artifacts following the repository's manifest-plus-test pattern: new `docs/*-hashes.json` entry/entries plus suite(s), `CHANGED_IN_*` declarations in every earlier suite whose covered bytes change, explicit `test/ci-test-budget.json` update if and only if the collected set changes, retention-list update in `test/packaging-identity.test.ts` if and only if new files carry old-name mentions.
- Re-read of `docs/V1-GUARANTEES.md` §8 doc agreement against the disposition; disagreements listed, never smoothed by rewording evidence away.
- Release-blocker verdict: any open bypass of a claimed P-protection found during this work is recorded as a blocker with its biting regression.
- Narrow source fix under `src/` if and only if this Goal's work exposes an open bypass of a claimed P-protection; each such fix stays inside this Goal with its biting regression and fresh checks.

## Out of Scope

- Closing any other Phase 7 item (independent v1 audit), closing the Phase 7 gate, releasing, tagging, publishing, removing `private: true`, wiring provenance, pushing, or installing into a real Pi profile.
- Rewording the stabilized P1–P18 set beyond corrections this Goal's evidence forces; rewriting accepted evidence bytes without a manifest declaration.
- Extending platform support, adding a hosted macOS job, verifying new Pi/Node versions, narrowing `peerDependencies: "*"`, or making any mount/B3/descendant/Keychain claim beyond the inherited bound unless its Risk Gate evidence is met.
- Refactors, dependency changes, packaging/CI behavior changes, or padding the suite with non-biting tests.
- Acceptance recording itself (`STATE.md`/`ROADMAP.md` acceptance entries and the manifest binding SHA-256, which is recorded in `STATE.md` at acceptance to avoid a self-referential hash cycle, not in the bound audit).

## Risk Gates

- A Linux-support or Class 1 runtime claim requires recorded Linux runtime execution against the accepted bytes; otherwise R4 stays bound with no support claim and none is committed to.
- A narrowed peer/dependency range requires its own verification evidence and decision; otherwise R10 stays bound as declared-not-verified.
- Any mount-isolation, same-user-writer, descendant-termination, Keychain-beyond-probe, or exfiltration-resistance claim requires fixtures and evidence that do not currently exist; without them R1–R3 and R5–R6 stay explicit bounds, never promises.

## Acceptance Criteria

1. Every R1–R11 carries a disposition: either a named biting regression proving the resolved bound on its declared boundary, or an explicit bound statement with no new claim.
2. No open bypass of a claimed P-protection remains unrecorded: each found bypass is filed as a release blocker with its biting regression, or the verdict records none open.
3. P1–P18 wording is unchanged except corrections this Goal's evidence forces; the §8 doc-agreement re-read lists any disagreement instead of rewording evidence away.
4. This Goal's artifacts are bound by a manifest and its test; `npm run check`, all manifest suites, and `git diff --check` pass locally, and the hosted run for the final commit is green with the declared counts.
5. A fresh independent review of the final snapshot returns PASS with no blocking findings before owner acceptance; acceptance closes only the "Resolve or explicitly bound release-blocking known unknowns" item.

## Verification

- Criterion 1: read each R1–R11 against its disposition row (named regression with mutation/bite note, or bound statement) and the artifact each cites.
- Criterion 2: for each new/strengthened regression, restore the guarded defect (or apply the recorded mutation) and confirm the affected suite fails; re-apply the accepted bytes and confirm it passes; read the blocker verdict.
- Criterion 3: diff `docs/V1-GUARANTEES.md` P1–P18 against the step-1 accepted bytes; read the §8 re-read table for unlisted disagreements.
- Criterion 4: `npm run check`, the manifest suites, `git diff --check`; confirm the hosted run for the final commit is green and the count assertion reports the declared numbers; `package.json` still `private: true`, no lifecycle scripts, CI never publishes.
- Criterion 5: independent review of the exact final bytes; owner acceptance recorded in `STATE.md`.

## Constraints

- Preserve the `AGENTS.md` security invariants; fail closed where proceeding would cross a protected boundary; project-controlled configuration never weakens global policy.
- Tests use isolated temporary fixtures only; no real credentials, secret files, home-directory reads, or real-profile installation.
- Per standing owner decision, all work lands directly on `main`; no additional topic branches.
- Exact versions, run identifiers, and hashes only; never invent evidence; prior manifests keep historical entries via declared change sets.
- Documentation states only guarantees demonstrated by the implementation and tests.

## Escalate If

- A residual cannot be resolved or explicitly bounded without changing a P-promise (potential release blocker or guarantee change, not a silent bound edit).
- The work exposes a real bypass of a claimed protection needing implementation beyond a narrow in-Goal fix, a support commitment, a platform claim, or publication authority.
- The Goal splits into independently reviewable/acceptable outcomes (e.g. per-layer residual groups shippable separately) — stop, do not expand; that is a decomposition signal.
- Baseline, ownership, attribution, or overwrite authority becomes ambiguous; stop without changing the handoff.
