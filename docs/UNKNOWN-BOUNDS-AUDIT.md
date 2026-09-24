# Unknown-Bounds Audit

Task ID: `20260924-unknowns-bound`. Phase 7 checklist item:
"Resolve or explicitly bound release-blocking known unknowns" (step 3 of 4).
Baseline: `5da9e22efe4026d2940779879c90e8ae37fc6933` (index empty at start;
working tree carries only this Goal's `test/` additions plus this audit).

Target: disposition of every `docs/V1-GUARANTEES.md` §7 residual (R1–R11)
as either a demonstrated bound (named biting regression on the declared
boundary) or an explicit bound with no new claim, plus three new biting
regressions where a bound lacked one. No guarantee rewording, no
platform-support change, no publication or installation claim, no `src/`
change, no other Phase 7 item. This record carries executor-run evidence
only; no reviewer verdict is claimed here.

Risk gates (from the handoff, honoured throughout): mount-isolation,
same-user-writer, descendant-termination, Keychain-beyond-probe, and
exfiltration-resistance claims require fixtures and evidence that do not
currently exist, so R1–R3 and R5–R6 stay explicit bounds, never promises.
A Linux-support or Class 1 runtime claim requires recorded Linux runtime
execution against the accepted bytes, so R4 stays bound. A narrowed
peer/dependency range requires its own verification evidence and decision,
so R10 stays bound as declared-not-verified.

## Method

Read each R1–R11 against its declared bound in `docs/V1-GUARANTEES.md` §7
and against the test code that does or does not prove it. Read the
user-facing guarantee claims in `README.md`, `SECURITY.md`,
`ARCHITECTURE.md`, `THREAT_MODEL.md`, `docs/COMPATIBILITY.md`,
`docs/PACKAGING.md`, `docs/CI-EVIDENCE.md`, and the gate contracts against
the stabilized record (§8 re-read below). Added three biting regressions
under `test/` only, each mutation-probed (guard/bypass reintroduced; the
affected suite must fail) and reverted to the accepted bytes (suite must
pass). Ran the affected suites and the full local gate
(`npm run check`), plus `git diff --check`, on the declared target.

## Environment facts (executor-run)

- Node `v26.8.1`; `Darwin 27.0.0`, macOS 26A428, arm64.
- `/usr/bin/sandbox-exec` sha256
  `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`
  (matches the pinned identity in `src/sandbox/containment.ts` and
  `docs/COMPATIBILITY.md`).
- The native helper is built, so the darwin-gated containment suites
  execute locally rather than skipping.
- Baseline `npm run check` at `5da9e22`: typecheck PASS (recorded by the
  prior Goal's acceptance; re-run here after this Goal's changes, see
  Checks).

## New biting regressions (3 new tests, all isolated tmp/pure fixtures)

All three run on every platform (no darwin gate), use isolated temporary
fixtures or pure in-memory tables only, use synthetic payload bytes only,
and required no `src/` change: none of the probes exposed an open bypass
of a claimed protection, so no in-Goal implementation fix was triggered.

1. `test/quiescence.test.ts` —
   `a setsid-reparented descendant is not attributable to the invocation
   (R3 bound)` (new, R3). A pure `ProcessTable` unit test: entry pid 100
   (group leader), attributed child 101 in the group, a setsid survivor
   pid 400 (`ppid` 1, own group 400), and its child 401. Asserts
   `attributeInvocationProcesses` returns exactly `[100, 101]`, proving
   the census cannot attribute a reparented lineage — the accepted R3
   limitation, not a termination proof. Bites: replacing the three-rule
   attribution predicate with an unconditional admit (probe: the title
   fails with actual `[100, 101, 400, 401]`); any widened attribution
   (session sweep, all-process kill list) that would falsely convert the
   limitation into a termination guarantee.
2. `test/resources.test.ts` —
   `classification is content-blind: secret bytes in an ordinary filename
   still classify ordinary (R7 bound)` (new, R7). Writes synthetic
   fixture bytes shaped like secret material (no real credential) to
   `notes.txt`, `.env`, and `keys/id_rsa` in an isolated tmp workspace;
   asserts `notes.txt` classifies `{ sensitivity: "ordinary", matches:
   [] }` while the same bytes under `.env` and `keys/id_rsa` classify
   `secret`. Proves classification ignores bytes (path evidence only).
   Bites: a content-sniffing mutation that escalates verdicts by scanning
   bytes (probe: a `notes.txt`-escalation guard fails this title) or any
   future secret-discovery overclaim.
3. `test/package-compat.test.ts` —
   `the Pi peer range stays a declared star, not a verified range (R10
   bound)` (new, R10). Asserts
   `peerDependencies["@earendil-works/pi-coding-agent"] === "*"` with the
   reason that narrowing needs its own verification evidence and
   decision. Bites: a silent narrowing (probe: `^0.84.4` fails this
   title) or any unverified range change; it forbids, rather than
   performs, narrowing.

Mutation-probe record: each probe was applied, the affected suite was run
and observed to fail exactly on the new title (R3: actual `[100, 101,
400, 401]` vs expected `[100, 101]`; R7: assertion failure on the
ordinary verdict; R10: assertion failure on the star equality), then the
probe was reverted (`git checkout --` for the `src/` probes, `cp` restore
for the `package.json` probe) and the suite passes. Working tree verified
to contain only the three `test/` additions plus this audit after every
probe (`git status --short`, `git diff --stat src/` empty).

## Per-residual disposition table (executor-read)

| Residual | Declared bound, gist | Biting regression(s) (file :: title) or NONE | Bite note | Disposition |
| --- | --- | --- | --- | --- |
| R1 | Mount isolation UNVERIFIED. Mount below the workspace refused when observed (device-mismatch refusal); no unprivileged fixture can create a real mount crossing. Bound: P5, P9, P12 refuse on observed mismatch; nothing beyond. | Refusal arm: `test/export.test.ts` :: `apply refuses an effect whose ancestor is not a bound object`; same file :: `helper requests are validated before any process is spawned`; `test/shell-containment.test.ts` :: `export effects are bound to verified objects and refuse ancestor swaps`; same file :: `a post-verification ancestor swap still lands in the verified directory`; `test/quiescence.test.ts` :: `the freeze verifies the recorded staging-root identity` + `the measure helper re-verifies the root descriptor itself (defense in depth)` + `the freeze helper re-verifies both root descriptors itself (defense in depth)`. Isolation arm: NONE (correctly). | Ancestor-swap redirect, unbound-ancestor escape, and symlink-component redirect all refused; verified create still works. No test creates a real mount crossing — matches the declared UNVERIFIED bound (`docs/SHELL-GATE.md` §11). | explicit-bound-no-claim |
| R2 | Same-user host writers (B3) outside every claim. Same-user host process can read/modify anything the user can at any time, including projection tampering and the armed loopback broker endpoint. Bound: P9, P12–P14 assume no same-user writer; accepted limitation, not a bypass. | NONE (correctly: the bound is an assumption, not a behavior). Nearest neighbor `test/network-effects.test.ts` :: `the broker serves no tunnel before it is armed` proves pre-arm 503 refusal only. | A test would restate the assumption vacuously or smuggle a new promise. | explicit-bound-no-claim |
| R3 | No descendant-termination guarantee (variant B). Quiescence proves termination of everything attributable only; a `setsid()` + reparented child is unattributable, unbounded in lifetime/resources. Export is exactly the captured-bytes invariant. Pre-capture influence bounded, not absent. | New: `test/quiescence.test.ts` :: `a setsid-reparented descendant is not attributable to the invocation (R3 bound)`. Existing: `test/quiescence.test.ts` :: `quiescence refuses an attributed survivor and attempts to kill it` + `quiescence refuses a projection that changes after the entry process exited` + `quiescence succeeds only with an empty group, no survivor and a stable projection` + census/pid-reuse rows; same file :: `a size-preserving, mtime-restoring write racing the freeze is not detectable (declared residual)`; `test/shell-containment.test.ts` :: `an attributed detached survivor refuses the export and produces no host effect` + `a silent detached survivor cannot change what is applied (frozen export source)` + `a quiescence refusal ends the export without walking or reading the live projection`. | Widened-attribution probe fails the new title; pid-reuse false-positive/negative bites; racing-write residual test bites any atomic-snapshot overclaim (frozen bytes are the writer's bytes). Mechanism in `src/sandbox/census.ts` (group-member / child-of-entry / child-of-attributed only) and `src/sandbox/quiescence.ts` (session handle zero on the declared target). | explicit-bound-no-claim |
| R4 | Class 1 Linux runtime evidence stays open. Descriptor-relative path is the Linux path and platform-independent suites exercise it in CI configuration, but no Linux runtime execution against the accepted bytes was recorded. No Linux support follows. | NONE (correctly). Hosted CI is counts-only on Linux; CI-configuration exercise is not recorded runtime execution. | No support claim without recorded execution. | explicit-bound-no-claim |
| R5 | Keychain: synthetic probe only. Exactly one synthetic-Keychain effect test bounds the claim. No Keychain isolation promised. | `test/shell-containment.test.ts` :: `a synthetic Keychain item is reachable on the host and not inside containment` (host control reads the synthetic item; contained read must not yield it; search list unchanged; synthetic file removed). | Contained read of the synthetic item and search-list mutation both defeated. Broader isolation would need fixtures that do not exist. | explicit-bound-no-claim |
| R6 | Endpoint exfiltration declared, not prevented. An allowed endpoint can receive any child-readable data (P15/N6); destinations are a policy-approval boundary, not data confinement. | `test/shell-approvals.test.ts` :: `an approval prompt states the exact effects and boundaries` (requires the "permitted destinations can receive any data the command can read" disclosure); `test/network-effects.test.ts` :: `the route enforces destination identity at tunnel-open time and everything else stays closed` (positive control: the pinned tunnel opens when host-reachable). | Removing the disclosure or closing the pinned route fails the pair; together they prove declared-not-prevented. | explicit-bound-no-claim |
| R7 | Classification is content-blind. An `ordinary` result proves nothing about contents; path classification is defense in depth, not secret discovery. | New: `test/resources.test.ts` :: `classification is content-blind: secret bytes in an ordinary filename still classify ordinary (R7 bound)`. Existing name-side rows: `test/resources.test.ts` :: `classifies ordinary and generic credential-looking filenames as ordinary` and the classification matrix. | Content-sniff escalation probe fails the new title; same-bytes/secret-name controls prove the name-only boundary. | resolve-with-evidence |
| R8 | Relay surface of the broker rule. Profile rule port-exact but local-address-scoped (no single-address form); a same-port other-address local listener is also reachable in-invocation. No remote destination granted; port host-generated per invocation. Same-user callers are R2. | `test/seatbelt-profile.test.ts` :: `a non-empty network scope adds exactly one rule: the broker endpoint` (rule text deep-equals the single `localhost:<port>` line; no Mach rule; no wildcard port; closed scope emits no network rule); same file :: `the generated profile denies by default, with no network or Mach rule`; `test/network-effects.test.ts` scoped-matrix rows (neighbor-port direct-denied, UDP/listen/DNS closed). | Second network rule, destination-exact rule, Mach rule, or wildcard port fails the pin; neighbor/UDP/listen/DNS rows prove no remote route. The local-scope relay follows from the asserted rule text plus the profile-language fact (`docs/NETWORK-GATE.md` §2/N1). | resolve-with-evidence |
| R9 | No host delete/rename effects; limited creation. Projection deletions/renames have no host effect; missing entries reported ignored. Direct file-tool creation unavailable on macOS, exists only where descriptor-relative execution binds it. Kill-leftover dir and per-run copy cost are declared facts. | `test/export.test.ts` :: `deletions and renames inside the projection have no host effect` (delete ignored, rename visible as delete-ignored plus create); same file :: `child-created symlinks, hard links and type changes are refused at export`; `test/shell-containment.test.ts` helper-binding block (create-over-existing refused: no last-writer-wins; verified create still works); `test/gate-runtime.test.ts` P0 planted-symlink refusals + creation arms. | Host delete/rename applied, last-writer-wins overwrite, or symlink-escape create fails these rows. Cost/leftover sentences are declared facts, not behaviors. | resolve-with-evidence |
| R10 | Version and peer bounds. `peerDependencies: "*"` declared, not verified; Pi `0.84.4` only verified peer; `22.19.0 < version ≠ 26.8.1` untested; TLS SNI opaque to the broker. | New: `test/package-compat.test.ts` :: `the Pi peer range stays a declared star, not a verified range (R10 bound)`. SNI-opacity and version-matrix rows: doc-declared only (`docs/COMPATIBILITY.md`, `docs/NETWORK-GATE.md` §12). | Silent narrowing/widening without verification evidence fails the pin; the pin forbids rather than performs narrowing. | explicit-bound-no-claim |
| R11 | Evidence bounds. Hosted CI verifies counts, not identities, on Linux only; never containment evidence. Darwin containment is executor-local. Stale PASS never transfers; each acceptance binds its manifest SHA-256 in `STATE.md`. | `test/ci-budget.test.ts` all 14 titles driving the real count assertion on synthetic logs (inside-budget pass; extra/disappeared-skip, failure, shrunk/grown-collection, undeclared-platform, malformed-budget refusals); off-target platform suites skip (never pass vacuously) by their own conditions; manifest suites plus the retention list prove byte-binding. | Count-equality cannot detect identity substitution at identical counts — that is the declared bound itself, not a bypass. | resolve-with-evidence |

Net: R7–R9, R11 resolve-with-evidence; R1–R6, R10 explicit-bound-no-claim;
R4 explicit-bound-no-claim. No P1–P18 wording change was forced by any of
the above: every finding is consistent with the stabilized record.

## Blocker verdict: no open bypass of a claimed P-protection found

No read test, contract section, or audit probe reviewed in this Goal
exposes an unrecorded bypass of a claimed P-protection, so no narrow
`src/` fix was triggered and none is recorded as a release blocker. The
prior Goal's mutation probes (authorizer protected-merge removal,
string-prefix zone substitution, emptied resource-outcome loop,
followlinks walker, lifecycle pre-script) all fail their cited suites and
pass reverted; this Goal's three probes do the same for the new titles.

Scope caveat: this verdict rests on code reading plus the recorded
executor/reviewer runs and mutation checks. The darwin-gated containment
rows execute locally on the declared target (helper present) and skip on
other hosts; no fresh off-target execution was performed here, and hosted
CI remains counts-only evidence by declaration.

## §8 doc-agreement re-read (2026-09-24, against the stabilized record)

Re-read every user-facing guarantee claim against `docs/V1-GUARANTEES.md`.
Verdict per document (disagreements listed, never smoothed by rewording
evidence away):

| Document | Verdict |
| --- | --- |
| `README.md` (status, Goal, implementation status, does-not-provide list, Platform, Installation, Security notice) | Agrees. The does-not-provide list matches R2, R4–R6, R7, R9; the Platform section matches P16/R4 (shell blocked off-target; Class 1 question open); installation matches P17. |
| `SECURITY.md` (What to trust / Do not trust, three controls, disclosure) | Agrees. Trust bullets match P1–P2, P4, P8–P9, P13–P14; distrust bullets match R2, R4–R9; approval/containment separation matches §1 of the stabilized record. |
| `ARCHITECTURE.md` (status, §1 integration, §§8–11 sandbox/network/environment/status) | Agrees for the integrated routes. §§2–5 status lines ("not integrated", "enforcement planned") describe the unenforced policy primitives as such; they do not describe the integrated gates, whose behavior is owned by P1–P7 and the gate contracts. Recorded here, not rewritten: those lines understate rather than overstate. The §2 time-of-check paragraph likewise describes the primitive's limits, not the descriptor-bound enforcement Goals 2–3 add; recorded, not rewritten. |
| `THREAT_MODEL.md` (vocabulary, matrix, network/credential/sandbox sections) | Agrees. The network section marks Goal 4 implemented with the R2/R6/R8 residuals; Keychain and content-blindness match R5/R7. The "Planned response" column header and the monotonic-authority "plans" wording are historical vocabulary that understates the accepted Goals 1–4; recorded here, not rewritten. The Status section's "all responses planned unless marked otherwise" understates the marked-implemented Goal 4 network rows and the accepted Goals 1–3; recorded, not rewritten. |
| `docs/COMPATIBILITY.md` (matrix, per-dimension sections, not-claimed list) | Agrees verbatim with P16–P18 and R4/R10–R11. |
| `docs/PACKAGING.md` (identity, safeguards, checklist, outstanding) | Agrees with P17; it creates no guarantee (stated in its Outstanding section). |
| `docs/CI-EVIDENCE.md` (workflow, limits, assertion, accepted bytes) | Agrees with P18/R11; hosted runs after its acceptance live in `STATE.md` and the per-Goal audits by design (append-only bound bytes). |
No line in the documents above was found to promise more than P1–P18,
so this Goal makes no wording change to any of them. Any future line
that does is a finding against the stabilized record until corrected or
added there as an explicit R-item.

## Checks (executor-run)

- Affected suites: `test/quiescence.test.ts`, `test/resources.test.ts`, `test/package-compat.test.ts` pass with the three new titles (95 tests / 95 pass when run together).
- `npm run check` exact numbers: typecheck PASS; full suite 401 tests / 397 pass / 3 fail / 1 declared platform skip. The 3 failures are the expected pre-binding signal, not behavior regressions: `test/hash-manifest.test.ts` mismatches `test/package-compat.test.ts` (Goal 2 manifest covers it) and `test/shell-manifest.test.ts` mismatches `test/quiescence.test.ts` (Goal 3 manifest covers it) — both await the separate binding session's `CHANGED_IN_*` declarations — and the contained-workflow row fails only because it runs the manifest suite inside containment (cascade of the first). Baseline at `5da9e22` was 398 tests / 397 pass / 0 fail / 1 skip; this Goal adds exactly 3 platform-independent tests (398 → 401).
- `git diff --check`: clean.
- `test/packaging-identity.test.ts`: this audit carries no former-name
  spelling (verified by case-insensitive search for the two old spellings
  over this file, exit 1), so no retention-list change is needed from it;
  the three `test/` additions likewise carry none.
- untouched: `docs/V1-GUARANTEES.md` P-wording, `package.json`, CI,
  `src/`, `scripts/`, every `docs/*-hashes.json`, every manifest suite,
  `test/ci-test-budget.json`. Binding of this Goal's artifacts is owned by
  a separate session.

## Limits

- Disposition only: closes no other Phase 7 item, no Phase 7 gate, and
  authorizes no release, tag, publication, `private: true` removal,
  provenance wiring, push, or real-profile installation.
- Hosted CI verifies counts, not test identities, on Linux only; darwin
  containment evidence is executor-local on the declared target.
- The Class 1 `/proc/self/fd` runtime-evidence question stays open; no
  Linux support follows from this record.
- Acceptance closes only "Resolve or explicitly bound release-blocking
  known unknowns"; the manifest binding SHA-256 is recorded in `STATE.md`
  at acceptance to avoid a self-referential hash cycle, not here.
