# Implementation Handoff

Task ID: `20260920-compatibility-matrix`
Baseline: `b286dd3` (hosted-CI acceptance); index empty; untracked `.commandcode/` only; `AGENTS.md` carries an uncommitted owner edit outside this Goal.
Scope Gate: READY

## Goal

Publish one compatibility matrix for Pi, Node, the declared macOS target, and the
unsupported platforms, stating only what has been verified, and closing only the Phase 6
checklist item "Publish a Pi, Node, macOS, and Linux compatibility matrix".

## Context

- Owner decisions (2026-09-20): the matrix may state verified rows plus explicit
  unsupported/fail-closed rows and must make no support commitment; `peerDependencies:
  "*"` stays as it is, documented as unverified beyond the verified Pi version; no
  `package.json` change.
- Verified evidence in the repository: Pi `0.84.4` (installed peer; extension surface
  re-read for Goals 3 and 4); Node `26.8.1` on macOS 27.0 (26A428) arm64 (Goals 1–4
  local evidence including containment); Node `22.19.0` on hosted Linux CI
  (platform-independent suites; runs recorded in `docs/CI-EVIDENCE.md`); containment
  target macOS 27.0 (26A428) arm64 with Darwin major `27` and the pinned
  `/usr/bin/sandbox-exec` sha256 `58839ef0…`.
- Platform statements already published: `README.md` "Platform", `SECURITY.md`
  status/limits, the declared-target table in `docs/SHELL-GATE.md`, and
  `docs/CI-EVIDENCE.md` §3.
- The locally installed `pi` CLI is `0.86.1`; no evidence covers it.

## Scope

- `docs/COMPATIBILITY.md`: one matrix with a row per dimension (Pi version, Node
  version, OS/architecture, npm distribution) and, per cell, either the exact version
  with the evidence pointer that demonstrates it, or an explicit unsupported/fail-closed
  status, or untested. The document also states the non-claims (see acceptance criteria).
- `README.md`: point the Platform section at the matrix without restating or widening
  it, keeping the existing fail-closed wording.
- Bind the Goal's artifacts the way the repository already does: a manifest plus a test,
  and a declared change marker in the earlier CI manifest test for the count budget this
  Goal changes.

## Out of Scope

- Changing `package.json` (`engines`, peer range), the containment target, the pinned
  `sandbox-exec` identity, or any runtime, policy, approval, sandbox, or network
  behavior.
- Adding a hosted macOS job, extending platform support, verifying `0.86.1`, or
  publishing, releasing, tagging, or installing anything.
- Any guarantee beyond the recorded evidence; the release-candidate reviews and the other
  Phase 6 items.

## Risk Gates

- Never state a platform as supported, or "works", where only specific suites, a single
  machine, or a hosted run were exercised.
- Never widen or restate the declared containment target; other macOS versions and
  architectures stay fail-closed.
- The matrix, `README.md`, `SECURITY.md`, `ROADMAP.md`, and the audits must agree; a
  pre-existing disagreement is a finding to correct or report, not wording to smooth
  over.
- Adding a test file changes the declared CI budget: update the budget explicitly and let
  the assertion enforce it, rather than widening or weakening the assertion.

## Acceptance Criteria

1. One published matrix covers Pi, Node, macOS, and Linux, names Windows as unsupported,
   and marks each cell verified-with-provenance, unsupported/fail-closed, or untested.
2. Every verified cell cites the artifact that demonstrates it (audit section, hosted run
   id, or test suite) and the exact version; no cell claims more than its evidence.
3. The document states the non-claims: no support commitment; hosted CI is not
   containment evidence; no Linux or Windows support; the Class 1 `/proc/self/fd`
   runtime-evidence question stays open; `peerDependencies: "*"` is unverified beyond the
   verified version.
4. `README.md`, `SECURITY.md`, `ROADMAP.md`, and the audits agree with the matrix.
5. The Goal's artifacts are bound by a manifest and its test, the CI budget is updated
   explicitly, and `npm run check` plus the manifest suites pass locally and hosted.
6. No runtime, policy, approval, sandbox, network, dependency, or packaging change, and
   no platform support claim.

## Verification

- Read every cell against the artifact it cites; confirm each cited run id with `gh run
  view` where reachable.
- Run `npm run check`, the manifest suites, and `git diff --check`; confirm the hosted run
  for the final commit is green and the count assertion reports the declared numbers.
- Obtain an independent review of the matrix's claims and consistency before owner
  acceptance.

## Constraints

- Documentation and test-binding only: no new runtime dependency, no secret, no
  publication.
- Exact versions and run identifiers only; never invent evidence.
- Work on `main`; no additional topic branches.

## Escalate If

- A cell cannot be sourced to recorded evidence.
- Publishing the matrix would require a support commitment or a change to the declared
  target.
- The matrix exposes a real incompatibility (for example the extension failing on a
  current Pi version) that would need code or guarantee changes.
