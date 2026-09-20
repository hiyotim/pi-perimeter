# Hosted CI Evidence

Task ID: `20260920-hosted-ci-reproducibility`.
Phase 6 checklist item: "Add GitHub CI and reproducible checks".
Repository: `pi-warden/pi-warden` (public); working line `main`.

This record contains hosted-run identities, the declared platform limits, the count
assertion, and the accepted bytes this Goal changed. Hosted results and executor-local
results are distinguished throughout; nothing here is a reviewer verdict.

## 1. What the hosted check runs

`.github/workflows/ci.yml`, one job `check` on `ubuntu-latest`:

1. `actions/checkout` and `actions/setup-node` pinned to the commits their release tags
   point at (`v7.0.1`, `v7.0.0`), never to a moving ref, with `permissions: contents:
   read`.
2. Node `22.19.0`, the floor this package declares in `engines`.
3. `npm ci --ignore-scripts`: lockfile install, no lifecycle scripts.
4. `npm run check` (typecheck plus `node --test` over `test/*.test.ts`), output captured
   with `set -o pipefail` so a failing suite cannot be masked by the pipe.
5. `node scripts/assert-test-outcome.mjs <log> test/ci-test-budget.json linux`.

No secret is required and no network access beyond the npm registry fetch performed by
`npm ci` occurs.

## 2. Hosted run history

| Run | Commit | Trigger | Result |
| --- | --- | --- | --- |
| 34985125954 | `664871d` (Goal 2 snapshot) | push `codex/mac-migration-snapshot` | **failure**: 209/210, test 69, "the Goal 2 artifact hash manifest matches the final working tree" |
| 35523982904 | `2fa89b6` (`main` consolidation) | push `main` | success: tests 356, pass 302, fail 0, skipped 54 |
| 35524137666 | `964b408` (Goal selection record) | push `main` | success, same counts |

The 2026-09-15 failure had never been recorded; `STATE.md` now records the correction.
The runs for this Goal's own commits are recorded in `STATE.md` with the acceptance.

## 3. Declared platform limits

The hosted runner is Linux. This project's declared containment target is macOS 27.0
(26A428) arm64, and `verifyPlatform` (`src/sandbox/containment.ts`) requires darwin,
`arm64`, the declared Darwin major, and a pinned `/usr/bin/sandbox-exec` sha256
(`scripts/build-native.mjs` additionally refuses every non-darwin platform). A
GitHub-hosted macOS runner satisfies none of those conditions by design.

Therefore:

- Hosted CI cannot supply containment evidence on any platform. The Goal 3 and Goal 4
  containment evidence stays executor-local and is recorded in `docs/SHELL-GATE-AUDIT.md`
  and `docs/NETWORK-GATE-AUDIT.md`.
- The 54 tests skipped in the hosted Linux run are exactly the darwin-only suites
  (containment, projection, export, quiescence, seatbelt profile, network effects). They
  are skipped by their own declared platform conditions; the workflow does not exclude
  or disable them.
- No Linux (or other platform) support claim is made. The hosted Linux run does execute
  the platform-independent suites, including `src/gate/bound-execution.ts`, which selects
  the descriptor-relative execution path (`/proc/self/fd`) when
  `descriptorRelativeExecutionAvailable()` succeeds. Whether that closes the Goal 2
  reviewer follow-up requires a dedicated claim with its own evidence and an owner
  decision; this record does not make that claim.

## 4. Count assertion

`test/ci-test-budget.json` declares, per platform key, `minTests`, `fail` and `skipped`.
`scripts/assert-test-outcome.mjs` refuses the run when the TAP summary is missing or
internally inconsistent, when a count is outside the declaration, when the platform has
no declared budget, or when the budget is not declared as integers. Its behavior is
covered by `test/ci-budget.test.ts` against synthetic logs in isolated temporary
directories.

The assertion exists because a printed count is not a check: without it, a new skip
condition, a suite that stopped being collected, or a masked failure would still look
green. The `linux` budget is `minTests 356, fail 0, skipped 54`. `minTests` is a floor
rather than an exact total, so adding tests does not require a budget update, while
adding or removing a skip does — the skip count is the quantity that can hide lost
coverage.

## 5. Accepted bytes changed by this Goal

`docs/file-gate-hashes.json` (Goal 2 manifest) covers `.github/workflows/ci.yml`, so the
workflow change had to be reconciled with that accepted record. This Goal follows the
`CHANGED_IN_GOAL_4` mechanism recorded in `docs/SHELL-GATE-AUDIT.md`: the earlier
manifest keeps the historical accepted bytes, the later Goal's own manifest binds the
current bytes, and the earlier Goal's test declares the changed entry instead of
asserting it.

| Artifact | Accepted bytes | Current bytes |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `891d1c476016c632b77ee7b590afe867c046b6139102f4300b0ecbe5a63c3d63` (still recorded in the Goal 2 manifest) | `64d7f1f01db02d2e341d45303b14cd34083216842b559d3fda4062b5d65acf55` |
| `test/hash-manifest.test.ts` | `83d89f7a5ef5a2775fe3357a2fdfdcf9d2d8726c2423289a4502418535f12a03` | `5ce61ec3127c3bb7073cd92bc2abbc259515a936a339add5b9b83907230e26c3` |
| `docs/file-gate-hashes.json` | (see note) | byte-identical to the value this Goal started from, `9698efea51aaa47a47679fa0520d395cbcc3d5282e4e2b7131106a86da13fd1d` |

`test/hash-manifest.test.ts` now carries
`CHANGED_IN_HOSTED_CI = {".github/workflows/ci.yml"}`, skips that entry in its
working-tree comparison, and asserts that the split is exact. `docs/ci-hashes.json`
binds the current bytes of this Goal's artifacts and `test/ci-manifest.test.ts`
enforces them, so the changed workflow stays drift-checked after leaving the Goal 2
manifest.

Note on the Goal 2 manifest: its acceptance-time value `7aa0e786…` (named in `STATE.md`)
was already superseded by Goal 3, which refreshed the `package.json` and `src/index.ts`
entries; the current value `9698efea…` is what this Goal started from and left
untouched. `STATE.md`'s acceptance wording is corrected by this Goal's record rather
than silently replaced.

## 6. Limits of this record

- Hosted evidence exists only for the Linux, platform-independent suite.
- The count assertion is only as strong as the declared budget; the budget is reviewed
  with the workflow rather than derived at runtime.
- No containment guarantee, platform support claim, or release readiness is
  strengthened by this Goal, and no released artifact exists to install.
