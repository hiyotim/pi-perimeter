# v1.0 Guarantee-Stabilization Audit

Task ID: `20260922-stabilize-guarantees`. Phase 7 checklist item:
"Stabilize the supported security guarantees" (step 1 of 4).
Baseline: `0d6764d042952cd0fbcd4fb27eee49220feb5a7c` (index empty;
unstaged `M IMPLEMENTATION_HANDOFF.md, M ROADMAP.md, M STATE.md` — Phase 6
gate-closure record edits; untracked `.commandcode/` session tooling only).

Target: stabilization wording only — no runtime, policy, approval,
sandbox, network, dependency, packaging, or CI behavior change; no
platform-support, publication, or installation claim; no other Phase 7
item. This record carries executor-run evidence only; no reviewer verdict
is claimed here.

## Method

Read each stabilized promise against the artifact it cites (contract
section, audit section, suite on the declared target); read each residual
against its declared bound; read every user-facing guarantee claim in
`README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `THREAT_MODEL.md`,
`docs/COMPATIBILITY.md`, `docs/PACKAGING.md`, `docs/CI-EVIDENCE.md` and
the gate contracts against the stabilized record in
[docs/V1-GUARANTEES.md](V1-GUARANTEES.md). Ran the full local gate
(`npm run check`), the manifest suites, and `git diff --check` on the
declared target. Hosted-run reachability checked with `gh run view`
where recorded.

## Environment facts (executor-run)

- Node `v26.8.1`; `Darwin 27.0.0`, macOS 26A428, arm64.
- `/usr/bin/sandbox-exec` sha256
  `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`
  (matches the pinned identity in `src/sandbox/containment.ts` and
  `docs/COMPATIBILITY.md`).
- `npm ls @earendil-works/pi-coding-agent` → `0.84.4` (the only verified
  Pi version).
- Baseline `npm run check`: typecheck PASS, 388 tests / 387 pass / 0 fail
  / 1 declared platform skip.
- Hosted run `35536080268` (commit `5af0484`, branch `main`) is green
  (`gh run view`: conclusion `success`); it predates this Goal's new
  manifest suite, so the hosted count budget for the final commit is
  re-declared only if the collected set changes (see §Findings).

## Findings and fixes (all inside this Goal, docs + test-binding only)

F1. New stabilized record `docs/V1-GUARANTEES.md`: eighteen promises
(P1–P18) with exact platform/operation/threat boundaries and evidence
pointers (contract section, audit section, suite, manifest), plus eleven
explicit non-promises (R1–R11) carrying the inherited residuals verbatim:
mount isolation UNVERIFIED, same-user host writers (B3, including
projection/broker-endpoint tampering), no descendant-termination
guarantee (variant-B captured-bytes invariant only), Class 1
`/proc/self/fd` Linux runtime-evidence question open, Keychain beyond
the synthetic probe uncovered, endpoint exfiltration to allowed
destinations. No line promises more than its cited evidence.

F2. Agreement check (§8 of the stabilized record): `README.md`,
`SECURITY.md`, `docs/COMPATIBILITY.md`, `docs/PACKAGING.md`, and
`docs/CI-EVIDENCE.md` agree with the stabilized set; `ARCHITECTURE.md`
§§2–5 "not integrated / enforcement planned" status lines describe the
unenforced policy primitives as such (they understate rather than
overstate the integrated gates) and `THREAT_MODEL.md` "Planned response"
vocabulary is historical wording for the same reason — both recorded
explicitly in §8, not rewritten. The gate contracts' stale
pre-acceptance status lines (e.g. the file-gate contract's "acceptance
pending" wording) are accepted evidence bytes bound by
`docs/file-gate-hashes.json`; the live status is `STATE.md`. No
user-facing line was found to promise more than P1–P18, so this Goal
makes no wording change to any user-facing file.

F3. The stabilized record carries no former-name spelling (verified by a
case-insensitive repository-wide search for the two old spellings over
`docs/V1-GUARANTEES.md`, exit 1), so this Goal adds exactly one
retention-list entry (the manifest suite, which reads the shared harness
flag) and no other change to that suite.

F4. Manifest binding: new `docs/v1-guarantees-hashes.json` (10 entries:
the stabilized record, this audit, the raised count budget, the
retention-list suite, the five touched manifest suites, and the manifest
suite itself) asserted by new `test/v1-guarantees-manifest.test.ts`
(3 tests). Every entry this Goal shares with an earlier manifest carries
a fresh identity there, asserted in-suite exactly as the earlier Goals do;
each earlier suite declares its `CHANGED_IN_V1_GUARANTEES` record and
skips those entries in its working-tree comparison. The new suite raises
the collected set 388 → 391, so `test/ci-test-budget.json` is updated
explicitly and only for that reason; the assertion
(`scripts/assert-test-outcome.mjs`) is unchanged.

F5. Scope clean: `git status --short` / `git diff` show docs +
test-binding + audit only. `package.json` still `private: true`, no
lifecycle scripts, CI never publishes, no push, no installation.

## Independent review round 1 (FAIL with 1 blocking + 1 non-blocking)

Reviewer-run (not executor): `npx tsc --noEmit` exit 0; nine manifest
suites 23/23; `test/packaging-identity.test.ts` 3/3;
`test/ci-budget.test.ts` + `test/hash-manifest.test.ts` 16/16;
`test/package-lifecycle.test.ts` 1/1; `git diff --check` clean. All
three v1 manifest hashes re-derived and matching; the other changed
files' hashes recomputed; every earlier manifest's working-tree
comparison passed given its skip set; skip sets checked by hand against
the diff (no missing, no extra declaration). Promises P1–P2, P4, P10,
P13 spot-checked against their cited contract/audit/suite sections plus
a full read of the remaining promises; residuals R1, R3, R5–R6, R8–R11
spot-checked against their bounds. Agreement table read against the
cited lines of the user-facing documents: no overclaim. Scope and risk
gates confirmed (docs + test-binding + audit only; `private: true`, no
lifecycle scripts, CI never publishes; hosted CI never presented as
containment evidence; `ordinary` never presented as proof of no secret
content). Verdict: FAIL on two binding-record defects —
B1 (blocking): F3 claimed two retention-list entries while the diff adds
exactly one and the same audit's F4 and Checks section say one (fixed
here: F3 now states one). B2 (non-blocking): the added skip comments
claimed `docs/v1-guarantees-hashes.json` binds the skipped files'
current bytes while that manifest covered only its own three artifacts,
leaving the seven changed binding files asserted by no manifest (fixed
here: the v1 manifest now covers all ten artifacts with the
fresh-identity and declaration assertions, F4 rewritten accordingly).
Non-blocking observations recorded without change: `test/README.md`
still says containment suites remain planned and
`docs/OPERATION-POLICY-CONTRIBUTIONS.md` still says no Pi enforcement
exists — both pre-existing, unbound, and understating rather than
overclaiming.

## Independent review round 2 (FAIL with 1 blocking + 1 non-blocking)

Reviewer-run (not executor): `npx tsc --noEmit` exit 0; seven suites
20/20 (v1 3/3, ci 3/3, compat 2/2, packaging 3/3, post-transfer 3/3,
release-review 3/3, packaging-identity 3/3); five untouched suites 22/22
(hash, shell, network, ci-budget, package-lifecycle);
`git diff --check` clean. All ten v1 manifest hashes re-derived and
matching; declarations regex-extracted per suite and matched against the
jq intersection of each earlier manifest's keys with the seven changed
binding files (no missing, no extra); fresh identity holds for all
non-self pairs; F3's single-entry claim matches the diff; hosted
arithmetic holds (391 tree = 388 + 3 new tests; 391 − 54 = 337 pass).
Verdict: FAIL on two defects — B1 (blocking): F4 still states the
collected set grows 388 → 390 while the Checks section, the budget, and
the tree say 391 (fixed here: F4 now states 391). B2 (non-blocking):
`SHARED_WITH_EARLIER_MANIFESTS` omits earlier manifests that record
shared artifacts (release-review entries for three suites, both entries
for `test/post-transfer-manifest.test.ts`), leaving 5 of 22 pairs
unasserted and F4's in-suite coverage claim false (fixed here: all five
paths added plus the `COVERED_FILES.includes` guard the precedent suites
carry).

## Independent review round 3 (PASS, no blocking findings)

Fresh re-review of the fixed bytes. Reviewer-run (not executor): all
ten `docs/v1-guarantees-hashes.json` entries re-derived with
`shasum -a 256` and matched exactly; `test/v1-guarantees-manifest.test.ts`
3/3; ci/compatibility/packaging/post-transfer/release-review manifests
plus packaging-identity 17/17; hash/shell/network/ci-budget/
package-lifecycle 22/22; `npx tsc --noEmit` exit 0;
`git diff --check` exit 0. Each earlier suite's `CHANGED_IN_V1_GUARANTEES`
matches exactly the intersection of its manifest's keys with the seven
changed binding files; the `COVERED_FILES` guard is present; F3 (one
entry) and F4 (391, ten entries, three tests) are true; hosted arithmetic
holds (391 − 54 = 337; delta exactly the three new v1 tests; skips stay
54). Scope and risk gates confirmed as in rounds 1–2. Verdict: PASS with
one non-blocking observation fixed inside this Goal — the
`SHARED_WITH_EARLIER_MANIFESTS` map omitted the self pair
(`test/release-review-manifest.test.ts` in
`docs/release-review-hashes.json`), asserting 22 of 23 stale-overlap
pairs (fixed here: the self pair added, asserting all 23).

## Checks (executor-run)

- `npm run check`: typecheck PASS; 391 tests / 390 pass / 0 fail / 1
  declared platform skip (recorded after the manifest-suite addition:
  388 + 3 v1-guarantees tests).
- All manifest suites (file, shell, network, hosted-CI, compatibility,
  packaging, post-transfer, release-review, v1-guarantees): each
  working-tree comparison passes.
- `git diff --check`: clean.
- `test/packaging-identity.test.ts`: passes with exactly one added
  retention-list entry for the new manifest suite (the suite reads the
  shared harness verbose flag); the stabilized record itself carries no
  former-name spelling.
- Hosted run for the final commit: pushed only after the executor's
  final bytes; the run id, commit, and count assertion are recorded here
  before acceptance (appended below), and the count budget above is the
  declared expectation it must report.

## Hosted run for the final commit (executor-observed)

- Run: _recorded after push; `gh run view` output pasted here._
- Assertion: expected `tests 391, pass 337, fail 0, skipped 54`
  (391 − 54 = 337 pass on Linux) against the declared `linux` budget.
  The pass figure is arithmetic from the two declared counts, not a new
  claim: hosted skips stay 54 (no containment suite touched), fail stays
  0, and the collected set grows by exactly the 3 new manifest-suite
  tests.
## Limits

- Stabilization only: closes no other Phase 7 item, no Phase 7 gate, and
  authorizes no release, tag, publication, `private: true` removal,
  provenance wiring, push beyond the review snapshot, or real-profile
  installation.
- Hosted CI verifies counts, not test identities, on Linux only; darwin
  containment evidence is executor-local on the declared target.
- The Class 1 `/proc/self/fd` runtime-evidence question stays open; no
  Linux support follows from this record.
- Acceptance closes only "Stabilize the supported security guarantees"
  and binds to `docs/v1-guarantees-hashes.json` (binding SHA-256 recorded
  in `STATE.md`, not here, to avoid a self-referential hash cycle).
