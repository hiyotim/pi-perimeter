# Release-Candidate Security and Documentation Review

Task ID: `20260922-release-candidate-reviews`. Phase 6 checklist item:
"Complete security and documentation reviews".
Baseline: `5af04842eda8de2aeb008883058dbe9d2f53315d` (index empty; untracked
`.commandcode/` session tooling only).

Target: the release candidate as-is on `main` — `pi-perimeter`, `private: true`,
provenance unwired, nothing published or installed into a real profile.
Containment evidence is darwin-only; hosted CI covers the platform-independent
Linux suite only.

## Method

Read every user-facing claim in `README.md`, `SECURITY.md`,
`ARCHITECTURE.md`, `THREAT_MODEL.md`, `docs/COMPATIBILITY.md`,
`docs/PACKAGING.md`, `docs/CI-EVIDENCE.md` and the gate contracts against the
artifact each claim cites. Ran `npm run check` (typecheck plus the full suite),
`git diff --check`, the manifest suites, `npm pack --dry-run`, and `gh run`
evidence locally on the declared target. This record carries executor-run
evidence only; no reviewer verdict is claimed here.

## Environment facts (executor-run)

- Node `v26.8.1`; `Darwin 27.0.0`, macOS 26A428, arm64.
- `/usr/bin/sandbox-exec` sha256
  `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`
  (matches the pinned identity in `src/sandbox/containment.ts` and
  `docs/COMPATIBILITY.md`).
- `npm ls @earendil-works/pi-coding-agent` → `0.84.4` (the only verified Pi
  version); the `pi` CLI on PATH is `0.86.1`, covered by no evidence.
- `npm pack --dry-run` on the reviewed tree → `pi-perimeter@0.0.0`, 84 files
  (82 at HEAD plus this Goal's two new docs, which ship under `files: docs`),
  330.8 kB packed, 1.1 MB unpacked; `package.json` has `private: true`, no lifecycle scripts,
  `peerDependencies: {"@earendil-works/pi-coding-agent": "*"}`
  (declared range, not a verified one), `engines.node >=22.19.0` (advisory).
- `npm run check` at baseline: typecheck PASS, 385 tests / 384 pass / 0 fail /
  1 declared platform skip; after this Goal's manifest suite: 388 / 387 / 0 / 1.
  `git diff --check` clean.
- Hosted CI, branch `main`: run `35536080268` (commit `5af0484`, current HEAD)
  succeeded; its assertion step reported
  `tests 385, pass 331, fail 0, skipped 54, todo 0, cancelled 0`
  against the declared `linux` budget. No hosted run covers containment.

## Findings and fixes (all inside this Goal, docs only)

F1. `README.md` Platform and `SECURITY.md` "Do not trust" stated the file
gates "stay blocked" on Linux. False against the accepted contract:
`docs/FILE-GATE.md` defines Class 1 descriptor-relative execution as the
Linux path ("executor-verified locally on Linux with `/proc/self/fd`"), and
the platform-independent suites (which select that path where available)
run in hosted Linux CI. What is true is narrower: Goal 2 recorded no Linux
runtime execution against the accepted bytes, and the Class 1
runtime-evidence question stays open (`docs/CI-EVIDENCE.md` §3). Fixed both
files to that wording; the shell route stays blocked off-target by
`verifyPlatform` (`src/sandbox/containment.ts`), which the file gates do not
call.

F2. `docs/COMPATIBILITY.md` listed Linux file-gate routes under
"Unsupported or refused". Same false claim as F1. Fixed: the matrix row and
the Linux section now state the route executes there without a support
claim, with the Class 1 question open.

F3. `ARCHITECTURE.md` status said Goal 4 "is implemented and verified ...
awaiting owner acceptance". Stale: Goal 4 was accepted 2026-09-20
(`STATE.md`). Fixed to the accepted status.

F4. `ARCHITECTURE.md` §1 "Pi integration" said "**Planned**" for `read`,
`write`, `edit`, `grep`, `find`, `ls`, `bash`, `user_bash`. Stale for the
eight supported routes (Goals 2–4 accepted); only future tools remain
planned. Fixed.

F5. `THREAT_MODEL.md` network section said Goal 4 "awaiting owner
acceptance" (stale, same acceptance as F3), and the document title still
named only `pi-warden` while the distribution is `pi-perimeter`. Fixed both.

## Recorded, not changed

R1. `docs/FILE-GATE.md` status still says "Owner acceptance and Phase 2
closure remain separate and pending", and its §79 says no hosted run is
recorded. Both are stale as live claims, but the file's bytes are bound by
the accepted Goal 2 manifest (`docs/file-gate-hashes.json`), so accepted
evidence bytes are not rewritten; the live status is `STATE.md` (Goal 2
accepted 2026-09-15, corrective pass reviewed). Same treatment as prior
Goals gave accepted bytes.

R2. Hosted runs after the compatibility-matrix acceptance (`35531992518`)
that no record binds: the packaging-doc runs and `35535376079` (recorded in
`STATE.md`), plus `35536080268` for the current HEAD (recorded here, §
Environment facts). `docs/CI-EVIDENCE.md` stays append-only on its bound
bytes by design; run coverage after its acceptance lives in `STATE.md` and
this audit.

R3. `ROADMAP.md:191` (the Phase 6 closure note for
`20260920-compatibility-matrix`) summarizes the matrix as "marks Linux and
Windows unsupported". After this Goal's F2/F7 correction the live matrix
refuses only non-declared Darwin majors, non-arm64 architectures, the shell
route off-target, and Windows; the Linux file gates execute there with the
Class 1 runtime-evidence question open and no support claim. `ROADMAP.md`
is not covered by any hash manifest, so it is not rewritten by a docs Goal;
the live status is the matrix itself, and the roadmap line is historical
closure wording for the accepted matrix Goal.

## Guarantee/evidence agreement (verified, no change needed)

- Closed-network → restricted-network transition: `NETWORK-GATE.md` N1–N7
  bounded by shell-gate §11 variant-B boundary; empty scope byte-identical
  to Goal 3; endpoint exfiltration, relay surface, B3, and mount-UNVERIFIED
  stated in both contracts and `SECURITY.md`.
- Approvals: single-use, exact binding, `DENY` never approvable — stated
  identically in `FILE-GATE.md`, `SHELL-GATE.md` §10, `NETWORK-GATE.md` §6,
  `SECURITY.md`.
- Keychain: no isolation claim anywhere beyond the synthetic probe
  (`SHELL-GATE-AUDIT.md`); `SECURITY.md` lists it under "Do not trust".
- Distribution: `README.md`, `COMPATIBILITY.md`, `PACKAGING.md` agree that
  `npm:pi-warden` is another maintainer's package, `pi-perimeter` is
  unpublished at `0.0.0`, and no installation path exists. Publication
  safeguards verified live: `private: true`, no lifecycle scripts, CI never
  publishes, provenance not wired.
- Pinned identities re-derived live: `sandbox-exec` sha256, Pi `0.84.4`
  peer, Node `26.8.1`/`22.19.0`, Darwin major `27` — all match the matrix.

## Independent review round 1 (2026-09-22, FAIL with 2 blocking + 2 non-blocking)

Reviewer-run (not executor): `npx tsc --noEmit` exit 0; nine manifest suites
24/24; `npm test` 388 / 387 / 0 / 1; `git diff --check` clean; all 13
manifest hashes re-derived and matching; sandbox-exec pin and live binary
matching; hosted run `35536080268` green on HEAD `5af0484` with the recorded
assertion counts. Verdict: FAIL on substance-preserving incompleteness —
ARCHITECTURE.md §9 still said Goal 4 "awaiting owner acceptance" while the
header (fixed here) said accepted, and COMPATIBILITY.md's unsupported list
still refused Linux file-gate routes while the patched row/paragraph said
they execute there. Both fixed here (F6–F7). Non-blocking: the budget was
missing from the shared-identity map (now covered), and SECURITY.md carried
a duplicated creation non-claim (removed).

F6. ARCHITECTURE.md §9 "awaiting owner acceptance" → "accepted 2026-09-20".
F7. COMPATIBILITY.md unsupported list now refuses only non-declared Darwin
majors, non-arm64 architectures, and the shell route off-target; Linux file
gates live only in the corrected Linux paragraph (executes, evidence open).

## Independent review round 2 (2026-09-22, PASS, no blocking findings)

Fresh re-review of the fixed bytes (HEAD `5af0484` + 12 modified tracked
files + untracked `.commandcode/`, this audit, `docs/release-review-hashes.json`,
`test/release-review-manifest.test.ts`). Reviewer-run, not executor:
`npx tsc --noEmit` exit 0; nine manifest suites 24/24; `npm test`
388 / 387 / 0 / 1 (matches the raised `linux` budget 385 → 388, skips
unchanged at 54); `git diff --check` clean; all 13 manifest entries
re-derived and matching (manifest under review SHA-256
`fb91659a2c3e8f0eb5d293f1574b0ff7c27e48cbde141f002a8a45bbfaf95257`);
shared-identity and declaration records exact; zero `awaiting owner
acceptance` in `ARCHITECTURE.md`; matrix row, unsupported list and Linux
paragraph agreeing; one file-creation non-claim in `SECURITY.md`; hosted run
`35536080268` green on `5af0484` with the recorded counts; pinned
Node/peer/`sandbox-exec` identities re-verified live. Scope clean
(docs + test declarations + budget only). Two non-blocking observations,
both fixed after the PASS and therefore outside its reviewed bytes:
the `npm pack` figures below described HEAD, not the reviewed tree
(corrected to 84 files / 330.8 kB), and `ROADMAP.md:191` still summarizes
the matrix as "marks Linux and Windows unsupported" (recorded as R3;
`ROADMAP.md` is manifest-unbound, so it is not rewritten by this Goal).

## Owner acceptance (2026-09-22)

The owner accepted `20260922-release-candidate-reviews` after the fresh
independent re-review PASS. Acceptance binds to `docs/release-review-hashes.json`
(13 entries; the binding SHA-256 is recorded in [STATE.md](STATE.md), not here,
to avoid a self-referential hash cycle). It closes only the Phase 6 checklist
item "Complete security and documentation reviews"; the Phase 6 release gate,
any publication decision, and any push/publication/installation stay unauthorized and open.
Two nuances acknowledged at acceptance: the pack figures above describe the
reviewed tree (84 files / 330.8 kB, +2 docs over HEAD), and `ROADMAP.md:191`
keeps the historical matrix-Goal summary while the live status is the
corrected matrix (recorded as R3 above).

## Limits

- Owner acceptance recorded above (2026-09-22); it closes only this checklist
  item, not the Phase 6 gate.
- Hosted CI verifies counts, not test identities, on Linux only; darwin
  containment evidence is executor-local on the declared target.
- The Class 1 `/proc/self/fd` runtime-evidence question stays open; no
  Linux support follows from this review.
- Acceptance closes only this checklist item; the Phase 6 gate and any
