# Regression-Evidence-per-Guarantee Audit

Task ID: `20260922-regression-evidence-per-guarantee`. Phase 7 checklist item:
"Maintain regression evidence for every guarantee" (step 2 of 4).
Baseline: `1e75222640902894180d3fe8a9fc1a6b91dc406b` (index empty;
unstaged `M STATE.md` — Continuation-block condensation only, 4 lines;
untracked `.commandcode/` session tooling only).

Target: gap analysis of P1–P18 against the `docs/V1-GUARANTEES.md` §9
suites, plus new or strengthened biting regressions for genuinely
uncovered or weakly covered guarantee behavior only. No guarantee
rewording, no platform-support change, no publication or installation
claim, no other Phase 7 item. This record carries executor-run evidence
only; no reviewer verdict is claimed here. The independent review
section below is filled by the reviewer, not the executor.

## Method

Read each stabilized promise against the artifact it cites (contract
section, audit section, suite on the declared target); read each
residual against its declared bound. Five read-only scouts enumerated
every `test("...")` title in the §9 suites and classified each as
biting (fails on mutation-restore, passes on accepted bytes, proves the
promised effect or refusal on the declared boundary), structural-only,
or a gap. New tests were added only where the scouts found a genuine
gap; each was then mutation-probed (guard restored or bypass
reintroduced; the affected suite must fail) and reverted to the
accepted bytes (suite must pass). Ran the full local gate
(`npm run check`), the manifest suites, and `git diff --check` on the
declared target.

## Environment facts (executor-run)

- Node `v26.8.1`; `Darwin 27.0.0`, macOS 26A428, arm64.
- `/usr/bin/sandbox-exec` sha256
  `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`
  (matches the pinned identity in `src/sandbox/containment.ts`).
- Baseline `npm run check`: typecheck PASS, 391 tests / 390 pass / 0 fail
- The native helper is built (binary plus build manifest present), so the
  darwin-gated containment suites execute locally rather than skipping.

## Findings and fixes (all inside this Goal, tests + binding + audit only)

F1. Gap analysis verdict: P1–P5, P8–P14, P16–P18 each map to at least
one named biting regression on the declared boundary (per-promise
table below). Six genuine gaps were closed with new or strengthened
regressions (F2); no source change under `src/` was needed — none of
the new regressions exposed an open bypass of a claimed protection, so
no in-Goal implementation fix was triggered.

F2. New or strengthened regressions (4 new tests, 2 strengthened;
all isolated temporary fixtures; all platform-independent so they
also run in hosted Linux CI):

1. `test/gate-runtime.test.ts` —
   `a hostile project policy that allows a protected path still denies
   it` (new, P7). A project `policy.json` allowing `read` cannot lift
   a protected-zone denial (`PROTECTED_RESOURCE`, zero approval
   calls); a sibling directory sharing the zone path prefix is still
   readable, proving component-aware (not string-prefix) zone
   matching. Bites: dropping the protected-merge in the authorizer
   (both P7 titles fail); replacing the component-aware check with a
   string-prefix check (this title fails).
2. `test/gate-runtime.test.ts` — `secret resources are denied hard
   and never approvable` (strengthened, P6). Now drives a willing
   approval UI and asserts zero approval calls, proving a
   `SECRET_RESOURCE` denial never opens a dialog. Bites: the same
   authorizer-merge removal (fails with the P7 titles).
3. `test/controlled-traversal.test.ts` — `find never descends into a
   symlinked directory that points outside the root` (new, P4).
   An includable internal directory behind the symlink label is still
   reached directly, but the walker never descends through the link
   itself; outside bytes never reach `find` output. Bites: descending
   into symlinks (followlinks bypass) fails this title.
4. `test/shell-policy.test.ts` — `a protected or denied export
   target denies the shell invocation even with an open network scope`
   (new, P15). A `DENY` resource outcome and an invalid configuration
   each deny the invocation while the network scope is open, proving
   network access cannot override `DENY` or remove the configuration
   gate. Bites: moving the resource/configuration checks after the
   network-open allowance (fails).
5. `test/packaging-identity.test.ts` — `the distribution carries no
   lifecycle script and no CI publish step` (new, P17). Fails on any
   `pre`/`post` script in `package.json`, on any publish-shaped step
   (`npm publish`, `NPM_TOKEN`, `NODE_AUTH_TOKEN`, `--provenance`,
   `id-token: write`) in the CI workflow, and on provenance use in
   the lifecycle evidence. Bites: adding a `postinstall` script or a
   publish step (fails).
6. `test/gate-runtime.test.ts` — `shell routes are either contained
   or blocked; nothing runs uncontained` (strengthened, P8). The
   no-containment-path dialect assertion is now exact (`no
   containment path`) instead of a broad `blocked` match, so a
   regression that reroutes the dialect to a different block reason
   still fails this title.
F3. Manifest binding: new `docs/regression-evidence-hashes.json`
(16 entries: this audit, the raised count budget, the four changed
regression suites, the nine touched manifest suites, and the manifest
suite itself) asserted by new
`test/regression-evidence-manifest.test.ts` (3 tests). Every entry
this Goal shares with an earlier manifest carries a fresh identity
there, asserted in-suite exactly as the earlier Goals do; each
earlier suite declares its `CHANGED_IN_REGRESSION_EVIDENCE` record
and skips those entries in its working-tree comparison. The new
tests all run on Linux, so the collected set grows 391 → 398 and
`test/ci-test-budget.json` is updated explicitly and only for that
reason; the assertion (`scripts/assert-test-outcome.mjs`) is
unchanged. The new manifest suite reads the shared harness verbose
flag, so exactly one retention-list entry is added (the suite
itself); this audit carries no former-name spelling.

F4. No `src/` change: the mutation probes confirm the existing
enforcement already refuses every probed bypass; the probes fail the
suites only while the guard is removed. There is no release-blocker
fix inside this Goal.

F5. Scope: the security change is tests + test-binding + audit only
(no `src/`, `scripts/`, `package.json`, or CI behavior change); the
snapshot additionally carries the Goal bookkeeping edits to
`STATE.md` and `IMPLEMENTATION_HANDOFF.md`. `package.json` still
`private: true`, no lifecycle scripts, CI never publishes, no push,
no installation.

## Per-promise evidence table (executor-read)

Promise | Biting regression(s) (file :: title) | Bite note
---|---|---
P1 | authority :: `returns the stricter outcome for all nine ordered pairs`; `is idempotent, commutative, and associative`; `fails closed to DENY for every invalid runtime input without coercion`; `does not invoke proxy traps`; merge :: `merges one contribution for every valid pair`; `equals the accepted pairwise fold for all 27 valid triples`; `does not invoke Array.prototype[Symbol.iterator] when it is replaced` | lattice, fold equivalence, coercion/proxy/iterator hardening; single-ASK approval semantics proven in P6 suites, not here
P2 | configuration :: all 11 titles, core `valid restrictions are exact-operation only and cannot weaken ASK or DENY baselines`; `one invalid source denies every operation without salvaging valid entries`; `rejects substitution of an issued project snapshot across genuine workspaces` | schema strictness, whole-source failure domains, immutability, workspace binding
P3 | decisions/write-decisions/edit-decisions :: `emits the complete selected result for every table row and overlap` (each op) plus forgery (`requires genuine resolver issuance`), broken-link/ENOTDIR fail-closed ordering; resources :: 69-title classification matrix; paths :: prefix/traversal/symlink/fail-closed/brand families | baseline table plus classification and identity inputs; refusal proven by the table tests
P4 | gate-runtime :: `unknown and dynamically registered model-facing tools fail closed`; `a lost or foreign controlled-tool registration blocks search tools at the gate`; `initialization failure cannot silently restore unprotected tools`; `controlled ls executes through the gate-issued memo and fails closed without it`; `controlled search bindings are consumed exactly once…`; `session lifecycle transitions invalidate the gate-issued memo`; `malformed and forged inputs fail closed…`; controlled-traversal :: all 5 titles plus new `find never descends into a symlinked directory…` | unknown-tool, override, degraded, no-bypass, replay, session, framing bites; per-entry classification without read-then-filter
P5 | gate-runtime :: `P1 regression: final-target symlink swap…`; `P1 regression: object substitution…`; `approval-window object substitution is refused…`; `P0: escape via planted ancestor symlink…`; `P0: planting a symlink at an EXISTING verified parent…`; `ancestor-directory substitution is refused…`; `hard-link alias of a secret is refused…`; `external target execution plans are anchored at the filesystem root`; both platform-class arms of `creation keeps working…` / `write creates…` | pre-dialog capture, ancestor/final swaps, nlink rule, root-anchored plans, descriptor-relative vs direct-leaf refusal arms
P6 | approvals :: `approval prompt displays the exact operation…`; `approved grants are one-time and bound to operation and canonical path`; `refusal, unavailable UI, page failure, and malformed responses all fail closed`; gate-runtime :: `external read asks and approval blocks or grants exactly once`; strengthened `secret resources are denied hard and never approvable` (zero approval calls); `approval-window object substitution is refused…` | dialog content, unit replay/mismatch, fail-closed matrix, ASK integration, DENY-never-approvable, plan-carried-unchanged
P7 | gate-runtime :: `protected control-plane resources override workspace allowance and any approval`; new `a hostile project policy that allows a protected path still denies it` (plus component-prefix proof); projection :: `a protected control-plane zone is never projected`; export :: `excluded and protected paths are refused even when the child creates them` | override above allowance/approval/config, zone matching exactness, projection/export refusal rows
P8 | shell-containment :: `an ordinary offline build and test workflow succeeds inside containment`; `the child cannot reach the original workspace, credentials or the control plane`; `networking is closed, with working host-side controls`; `the descriptor envelope closes every inherited descriptor above stdio`; `nested sandbox-exec is refused inside containment`; `a prepared invocation is disposed without leaving writable authority`; gate-runtime :: strengthened `shell routes are either contained or blocked…` (exact dialect reason) | real-process containment rows; failure paths end in distinct refusals, never an uncontained run
P9 | projection :: `the projection excludes protected, sensitive and project-controlled objects`; `no excluded content reaches the projection`; `symlink policy is explicit…`; seatbelt-profile :: `the generated profile denies by default, with no network or Mach rule`; shell-containment :: isolation, descriptor-envelope, constructed-environment rows | import classification/exclusions, deny-default profile, exact constructed environment
P10 | shell-grammar :: `unsupported constructs are refused with a specific code`; `parse limits are enforced rather than approximated`; shell-plan :: risk-table, wrapper anti-downgrade (incl. wrapper-flags, nesting-depth, stale-index regressions), `network-reaching dispatcher forms are classified`; shell-policy :: `unknown and destructive command classes require approval`; `DENY always wins over ALLOW and ASK inputs` | bounded refusal codes, limits, classification tables, DENY-wins/ASK-always
P11 | shell-approvals :: `a grant is usable exactly once and only for its exact bindings`; `every bound input change invalidates the grant`; `the bound network scope distinguishes grants…`; `expiry, forged and absent grants fail closed`; `missing UI, refusal, malformed responses and throws all fail closed` | single-use 60 s fully-bound grants, scope binding, expiry/forgery/no-UI refusals
P12 | export :: scan/apply refusal rows, unbound-ancestor, DENY-never-calls-helper; quiescence :: census attribution, group/survivor/post-exit refusals, descriptor-bound freeze/measure rows, no-read-after-refusal rows; shell-containment :: survivor/freeze-failure/quiescence-refusal/auth-binding rows | quiescence-gated, descriptor-bound captured-bytes export, per-target re-authorization
P13 | seatbelt-profile :: `a non-empty network scope adds exactly one rule: the broker endpoint`; network-effects :: `the route enforces destination identity at tunnel-open time and everything else stays closed`; `the tunnel dials the pinned address, never a fresh resolution of the host`; `the broker serves no tunnel before it is armed`; `a duplicate host in the pinned set merges ports, never replaces them`; network-policy :: representability, exact host+port coverage | one-rule profile, exact-match matrix, no re-resolution, arming, port-merge
P14 | network-policy :: `project configuration can only restrict the trusted scope, never widen it`; network-effects :: `an approved port on a trusted host extends that host's port set (no overwrite, no widening)`; shell-approvals :: scope-distinguishes-grants, single-use, expiry/replay/mismatch rows | monotonicity, merge-no-overwrite, approval binding
P15 | network-effects :: `with an empty scope the child reaches nothing, exactly as in Goal 3`; `the constructed environment carries only the loopback proxy values; the control plane stays closed`; new shell-policy :: `a protected or denied export target denies the shell invocation even with an open network scope` | empty-scope behavioral denial, loopback-only environment, DENY/configuration precedence over open scope
P16 | package-compat :: all 4 titles (unpublished manifest, Node range, Pi entry, CI isolation strings); seatbelt-profile :: `unsupported platforms are refused rather than approximated` (off-target arm) | declared-target floor pins; off-target refusal by mechanism
P17 | packaging-identity :: publishable-identity, qualified-mention, retention-list rows plus new `the distribution carries no lifecycle script and no CI publish step`; package-lifecycle :: isolated pack/install/rollback cycle | unpublished identity, allowlist contents, inert safeguards, no-publish absence assertions
P18 | ci-budget :: all 14 titles driving the real count assertion on synthetic logs (inside-budget pass, extra/reappeared-skip refusal, fail refusal, grown/shrunk-collection refusal, undeclared-platform refusal); ci-manifest :: byte-binding rows; platform suites skip (never pass vacuously) off-target by their own platform conditions | counts-not-identities assertion, Linux-only boundary, skip-not-vacuous tagging
R1–R11 | stated as bounds, not behaviors; no new claim | mount UNVERIFIED, B3 same-user writers, variant-B captured-bytes only, Class 1 Linux question open, Keychain synthetic-probe only, endpoint exfiltration declared, content-blindness, relay surface, no host delete/rename, version/peer bounds, evidence bounds

## Mutation checks (executor-run)

Each probe restores the guarded defect (or an equivalent bypass),
confirms the affected suite fails, then re-applies the accepted bytes
(confirms it passes). Working tree verified clean after every probe.

- Authorizer protected-merge removal (`if (protectedDenial)` forced
  false): `gate-runtime` fails on the P7 override title and the new
  hostile-override title. Reverted; suite passes.
- Component-aware zone check replaced with a string-prefix check:
  `gate-runtime` fails exactly on the new hostile-override title
  (sibling-prefix arm). Reverted; suite passes.
- Shell resource-outcome loop emptied (resource DENY never seen):
  `shell-policy` fails exactly on the new P15 title. Reverted; suite
  passes.
- Symlink descent added to the controlled walker (followlinks bypass):
  `controlled-traversal` fails exactly on the new dir-symlink title.
  Reverted; suite passes.
- Lifecycle `pre` script added to `package.json` (probe of the new
  P17 absence test): `packaging-identity` fails exactly on the new
  title. Reverted; suite passes.

## Platform tagging (executor-observed)

`shell-containment`, `network-effects` (20 + 12 titles) and the
helper-gated `quiescence` rows execute on the declared target (helper
present) and carry `{ skip }` off-target; `seatbelt-profile` carries
darwin-gated positives plus one inverted off-target refusal test;
all pure-logic suites run on every platform. Hosted Linux CI covers
the platform-independent set only and is never containment evidence.

## Checks (executor-run)

- `npm run check`: typecheck PASS; 398 tests / 397 pass / 0 fail / 1
  declared platform skip (recorded after the regression additions:
  391 + 4 new regression tests + 3 manifest-suite tests).
- All manifest suites (file, shell, network, hosted-CI,
  compatibility, packaging, post-transfer, release-review,
  v1-guarantees, regression-evidence): each working-tree comparison
  passes.
- `git diff --check`: clean.
- `test/packaging-identity.test.ts`: passes with exactly one added
  retention-list entry for the new manifest suite (the suite reads
  the shared harness verbose flag); this audit itself carries no
  former-name spelling.
- Hosted run for the final commit: pushing is out of scope for this
  Goal, so no hosted run exists yet for these bytes. The budget above
  is the declared expectation the first hosted run must report
  (tests 398, fail 0, skipped 54); the pass figure stays arithmetic
  from the two declared counts.

## Limits

- Evidence maintenance only: closes no other Phase 7 item, no Phase 7
  gate, and authorizes no release, tag, publication, `private: true`
  removal, provenance wiring, push, or real-profile installation.
- Hosted CI verifies counts, not test identities, on Linux only;
  darwin containment evidence is executor-local on the declared
  target.
- The Class 1 `/proc/self/fd` runtime-evidence question stays open;
  no Linux support follows from this record.
- Acceptance closes only "Maintain regression evidence for every
  guarantee" and binds to `docs/regression-evidence-hashes.json`
  (binding SHA-256 recorded in `STATE.md`, not here, to avoid a
  self-referential hash cycle).

## Independent review round 1 (reviewer-run; no blocking findings)

Reviewer-run (not executor): all 16 `docs/regression-evidence-hashes.json`
entries recomputed byte-identical to the working tree;
`npx tsc --noEmit` clean; the new manifest suite 3/3, the nine touched
manifest suites 24/24, `test/packaging-identity.test.ts` +
`test/ci-budget.test.ts` 18/18, and the four changed regression suites
47/47 (28 gate-runtime + 6 traversal + 9 shell-policy + 4 packaging-identity) all pass, with `git diff --check` clean and a static test-title
count of 398 matching the raised budget (391 + 4 new + 3 manifest
tests; no test removed). Spot-checked bite claims (P4 dir-symlink, P6
secret-no-dialog, P7 hostile-override with component-aware zone proof,
P8 exact dialect reason, P15 DENY/configuration precedence over an open
network scope, P17 absence assertions) hold by code reading; scope
gates hold (no `src/` change, `package.json` `private: true`, no
lifecycle scripts, no publish step in CI, `docs/V1-GUARANTEES.md`
unrewritten, hosted CI never presented as containment evidence). The
executor's mutation probes and the full `npm run check` 398/397/0/1
stay executor-run, not reviewer-run. Verdict: no blocking findings;
four non-blocking findings fixed inside this Goal —
(1) the shared-manifest map now asserts all 42 artifact-manifest pairs
with no vacuous `undefined` comparison;
(2) `DECLARED_CHANGE_SETS` now validates the release-review suite's
record too;
(3) the compatibility suite's release-review skip line is restored;
(4) the audit's manifest-count arithmetic and scope statement are
corrected. Full finding text in the review payload at
`agent://RegressionReview`.
## Independent review round 2, delta (reviewer-run; PASS, no blocking findings)

Scope: the round-1 fixes only (corrected shared-manifest map, the
release-review declared set, the restored compatibility skip, the
corrected audit counts, the three refreshed manifest entries).
Reviewer-run (not executor): the three refreshed entries plus one
spot-checked untouched entry match the working tree and the manifest
recomputes all 16 entries with zero mismatches; `npx tsc --noEmit`
exit 0; `test/regression-evidence-manifest.test.ts` 3/3,
`test/compatibility-manifest.test.ts` 2/2, the other eight
manifest-binding suites 22/22, `git diff --check` clean. The shared
map equals the earlier manifests' key sets exactly (14 artifacts, 42
pairs, every pair resolving to a recorded entry); `DECLARED_CHANGE_SETS`
carries the nine suites that declare `CHANGED_IN_REGRESSION_EVIDENCE`
including release-review; the compatibility suite skips via all five
records. Scope gates hold (no `src/` change, `private: true`, no
lifecycle scripts, no publish step, the stabilized record unrewritten).
Verdict: PASS with two non-blocking count-statement findings fixed
inside this Goal (F3's nine-suite arithmetic; the round-1 section's
42-pair figure). Full finding text in the review payload at
`agent://RegressionDelta`.
## Independent review round 3, delta (reviewer-run; PASS, no blocking findings)

Scope: the round-2 fixes only (F3 nine-suite arithmetic, round-1
section 42-pair figure, four-suite 47/47 count, round-2 section
added; one refreshed audit entry).
Reviewer-run (not executor): all 16 entries of
`docs/regression-evidence-hashes.json` recompute with zero mismatches
including the refreshed audit entry; `npx tsc --noEmit` exit 0;
`test/regression-evidence-manifest.test.ts` 3/3; the nine touched
manifest suites 24/24; packaging-identity + ci-budget 18/18;
`git diff --check` clean; static test-title count 398 matching the
raised budget; no trailing whitespace, CR, tabs, or missing final
newline in the delta files. F3 arithmetic now reads four changed
regression suites plus nine touched manifest suites plus the manifest
suite itself (1 + 1 + 4 + 9 + 1 = 16), matching the test-enforced
16-entry `COVERED_FILES`; the round-1 section's 42-pair figure matches
the shared map exactly (14 artifact keys, 42 pairs). Scope gates hold
(no `src/`/`scripts/`/`package.json`/`package-lock.json`/`.github`
change, `private: true` with no lifecycle script, no publish or
provenance step in CI, `docs/V1-GUARANTEES.md` unrewritten). Verdict:
PASS with no blocking findings; two pre-delta, non-delta observations
only (round-1 section's 47/47 figure, now corrected; Limits clause's
`STATE.md` binding SHA-256, an owner-acceptance step). Full finding
text in the review payload at `agent://RegressionFinal`.
## Independent review round 4, final bytes (reviewer-run; PASS, no blocking findings)

Scope: the exact current bytes including the round-2 and round-3
sections (audit entry
`b398a7100d95af654b7915a62e96f0899b32aaa24a3d51279d034eb51cee925d`,
16 entries). Reviewer-run (not executor): all 16 entries recompute
byte-identical to the working tree; `npx tsc --noEmit` exit 0;
`test/regression-evidence-manifest.test.ts` 3/3; the nine touched
manifest suites 24/24; packaging-identity + ci-budget 18/18; the four
changed regression suites 47/47 (28 + 6 + 9 + 4); `git diff --check`
clean; static test-title count 398 matching the raised budget
(391 + 4 new + 3 manifest tests). Every figure matches these bytes
(F3 four/nine/self = 16; shared map 14 keys, 42 pairs, no vacuous
comparison; no whitespace defects). Scope gates hold (no `src/`,
`scripts/`, `package.json`, `package-lock.json`, or `.github` change;
`private: true`, no lifecycle scripts, CI never publishes, the
stabilized record unrewritten). Verdict: PASS with no blocking
findings; the only open item is the Limits-clause `STATE.md`
acceptance binding (an owner-acceptance step). Full finding text in
the review payload at `agent://RegressionFinal2`.
