# Independent Audit (v1)

Task ID: `20260924-v1-independent-audit`. Phase 7 checklist item:
"Complete an independent audit appropriate to the claimed boundary"
(step 4 of 4).
Baseline: `b1bab7561131e5e49371bdd303f913928187065c` (exact HEAD at audit;
working tree carries only this Goal's handoff rewrite plus the record below).

Target: the claimed v1.0 boundary — `docs/V1-GUARANTEES.md` P1–P18
(promises with exact platform/operation/threat bounds) plus R1–R11
(explicit non-promises) — against the exact final bytes. No guarantee
rewording, no platform-support change, no publication or installation
claim, no `src/` change, no other Phase 7 item. This record keeps
executor-run evidence and reviewer-run evidence in strictly distinct
sections; no reviewer verdict is claimed in the executor-run section and
no executor recollection substitutes for the transcribed reviewer runs.

Risk gates (from the handoff, honoured throughout): the audit ran in
fresh contexts against the exact final bytes; reviewer-run checks are
distinguished from executor-run checks below; acceptance binds to exact
bytes/hashes of the reviewed snapshot. A Linux-support, mount-isolation,
same-user-writer, descendant-termination, Keychain-beyond-probe, or
exfiltration-resistance claim requires fixtures and evidence that do not
currently exist; without them the inherited R-bounds stand. Hosted CI
covers the platform-independent Linux suite only and is never
containment evidence (P18/R11).

## Executor-run vs reviewer-run

- Executor-run (§Environment, §Checks): commands the executor of this
  Goal ran on the declared target to re-verify the reviewers' evidence
  and to bind this Goal's own artifacts. Counts and SHAs below are
  observed, not transcribed.
- Reviewer-run (§Reviewer-run evidence, §Per-promise verdicts,
  §Per-residual verdicts, §Findings): verbatim transcription of the two
  independent read-only audits of exact HEAD `b1bab75` (alpha §§1–7,
  beta verdict), each item re-verified by the executor with `gh` or a
  local run before transcription. Exact ids/SHAs only; nothing invented.

Two independent read-only audits of exact HEAD `b1bab75` already
returned PASS with no blocking findings; this Goal is the binding plus
the authorized ship. No `src/`, `package.json`, CI, or
`docs/V1-GUARANTEES.md` wording change is made here.

## Environment facts (executor-run)

- Node `v26.8.1`; npm `11.19.0`; `Darwin 27.0.0`, macOS 26A428, arm64 —
  the declared target.
- `git rev-parse HEAD` → `b1bab7561131e5e49371bdd303f913928187065c`
  (== baseline; no drift).
- `git status --short` at audit → `M IMPLEMENTATION_HANDOFF.md` only:
  the in-flight handoff rewrite for this Goal. The file appears in no
  `docs/*-hashes.json` COVERED_FILES and no manifest suite binds it
  (grep exit 1), so it does not disturb any byte-binding.
- `package.json`: `private: true`; zero `pre*`/`post*` scripts;
  `peerDependencies` exactly `{"@earendil-works/pi-coding-agent": "*"}`;
  `publishConfig` `{ access: public, provenance: true }` present but
  inert (`private: true` blocks publish; no `id-token: write`, no
  `npm publish` / token / `--provenance` in `ci.yml`,
  `scripts/assert-test-outcome.mjs`, or `test/package-lifecycle.test.ts`,
  grep exit 1). CI (27 lines: checkout → setup-node 22.19.0 →
  `npm ci --ignore-scripts` → `npm run check` → assert-budget) never
  publishes; `permissions: contents: read`.

## Reviewer-run evidence (transcribed, each item re-verified)

Manifest-file SHAs (recomputed executor-run, match both auditors):

| Manifest | SHA-256 |
| --- | --- |
| `docs/ci-hashes.json` | `796fcf2b8b7a928ab045e4e38ea886f3fb1afc67d618755bc125722796d52c1e` |
| `docs/compatibility-hashes.json` | `0657cfd7803e11b4e7d4f7842667eaa250b461be96945cfb95852dea77d9e841` |
| `docs/file-gate-hashes.json` | `9698efea51aaa47a47679fa0520d395cbcc3d5282e4e2b7131106a86da13fd1d` |
| `docs/network-gate-hashes.json` | `152c7fa25fe2b95ad5d61005e677eabf341ef269884653c879551ad14385b972` |
| `docs/packaging-hashes.json` | `9dc00b9cd9ab7b4ad297e95452b206bbbc5c0405443257f095fcf4bbc3b62209` |
| `docs/post-transfer-hashes.json` | `7f1608c64d7053e84a1960815b6cd350c8e59e2d9f5c615b3be39fc6975e33a9` |
| `docs/regression-evidence-hashes.json` | `8a42fd593997b38a08fd1376add072fab5c4053a09684236602e22394e52687e` |
| `docs/release-review-hashes.json` | `92968811dd4ea55b5eb09d97ded07b63d06f7d8571746b43dd58e5827aebc0c4` |
| `docs/shell-gate-hashes.json` | `d5e4e5f2f8497d4da39826130e37f23287b066fe1369fcd3a4a87f971b97cfaa` |
| `docs/unknown-bounds-hashes.json` | `2b7ad6b55bfd654f5d42dd9a24e9e2b3927a85136eafec223399bc094ae83bd9` |
| `docs/v1-guarantees-hashes.json` | `2d59ca09f8d2bdb195164bfba5de630cc8e8410186df7822b5dc33a1bb56cfe5` |

Manifest re-derivation (both auditors; executor-run recomputation
agrees): `unknown-bounds` 16/16 OK at the tip; every other manifest's
mismatches are exactly the suite-enforced declared historical entries,
each bound by a later manifest through its own `CHANGED_IN_*` record
(`CHANGED_IN_UNKNOWN_BOUNDS` in 8 suites, `CHANGED_IN_REGRESSION_EVIDENCE`,
`CHANGED_IN_V1_GUARANTEES`, and the earlier Goal sets read verbatim).
The cross-manifest declaration-consistency tests pass, i.e. no mismatch
is undeclared and no declaration dangles; no entry resolves to bytes
bound nowhere.

Reviewer-run checks (both auditors; executor-run re-ran each):

- `npm run check` (full) → tests 404 / pass 403 / fail 0 / skipped 1
  (the 1 skip is the declared off-target platform row).
- All manifest suites standalone → tests 30 / pass 30 / fail 0.
- `git diff --check` → clean (exit 0).
- `test/ci-test-budget.json` → `linux: { tests: 404, fail: 0, skipped: 54 }`;
  the local 1-skip vs Linux 54-skip gap is the declared platform split
  (darwin-gated containment executes locally, skips on hosted Linux).
- Hosted run `35986716481` → `headSha b1bab75…`, conclusion success,
  workflow CI, `2026-09-24T10:21:11Z` (re-verified via `gh run view`;
  exact HEAD, green).

## Per-promise verdicts (reviewer-run: all HOLD)

Transcribed from alpha §4 (evidence: file:line + biting suite):

| P | Verdict | Evidence |
| --- | --- | --- |
| P1 monotonic join | HOLD | `src/policy/merge.ts:30-63` strictest-wins, invalid→DENY, own-index traversal; `src/policy/effective.ts:134-136`; suites `authority`, `merge` |
| P2 bounded config | HOLD | `src/policy/config-loader.ts:32-33` fixed components, `:124-139` exactly-one-user+one-project, loader-issued identity; suite `configuration` |
| P3 path baselines | HOLD | `src/policy/decisions.ts` + `effective.ts:137-143` DENY preserved; suites `decisions`, `write-decisions`, `edit-decisions`, `resources`, `paths` |
| P4 central mediation, fail-closed | HOLD | `src/gate/runtime.ts:400-403` unknown tool → block, `:392-394` powershell → block, `:430-440` hard-linked root denied; `controlled-traversal.ts:92-148`; suites `gate-runtime`, `controlled-traversal`, `package-compat` |
| P5 bound execution | HOLD | `bound-execution.ts:12-53` two-class design; plan-before-approval `runtime.ts:453-470`; `nlink===1` + dev/ino + size/mtime `:473-502`; suite `gate-runtime` |
| P6 single-use approvals | HOLD | `approvals.ts:76-110` fail-closed outcomes; consume-once-delete `runtime.ts:521-547`; shell grants `shell-approvals.ts:181-205` + command-equality `runtime.ts:663-678`; suite `approvals` |
| P7 control-plane | HOLD | `control-plane.ts:58-99` issued-zone brand, component-aware membership, structural DENY; authorizer above all outcomes `:63-100`; `index.ts:26-43`; suites `gate-runtime`, `projection`, `export` |
| P8 containment-or-nothing | HOLD | `containment.ts:105-152` `verifyPlatform`, no-fallback header `:1-9`, every failure `ShellRefusal`; suite `shell-containment` |
| P9 projection + env | HOLD | `projection.ts` exclusions (`nlink!==1` refuse `:182`); `containment.ts:199-226` constructed env; `freeze.ts:1-9`; suites `projection`, `seatbelt-profile`, `shell-containment` |
| P10 bounded grammar | HOLD | `shell-policy.ts:133-146` precedence; `:159-168` unknown/destructive→ASK; carve-out `:140-142`; suites `shell-grammar`, `shell-plan`, `shell-policy` |
| P11 shell approval binding | HOLD | `shell-approvals.ts:19-47` full bindings; `:212-213` WeakSet registry; TTL 60 s; suite `shell-approvals` |
| P12 export + quiescence | HOLD | `containment.ts:672-790` freeze→scan-frozen→re-measure→re-authz→apply; `export.ts:68-105` sealed-buffer checks; `shell-runtime.ts:428-470`; suites `export`, `quiescence`, `shell-containment` |
| P13 pinned network | HOLD | `network-broker.ts:271-460` exact match, pinned-address dialing, pre-arm 503; `seatbelt.ts:345-403` one-rule/zero-rule, no Mach rule; suites `network-policy`, `network-effects`, `seatbelt-profile` |
| P14 scope composition | HOLD | `shell-runtime.ts:148-153` per-host port merge; broker dies with invocation; suites `network-policy`, `network-effects`, `shell-approvals` |
| P15 no weakening | HOLD | Same code paths on the network route; empty-scope byte-identity; audit §§4,8 |
| P16 declared target | HOLD | `verifyPlatform`; `package-compat` suite incl. R10 star-pin test |
| P17 unpublished/inert | HOLD | `private: true`, no lifecycle scripts, CI never publishes; suites `packaging-identity`, `package-lifecycle` |
| P18 counted evidence | HOLD | Budget + `assert-test-outcome.mjs` + `ci-budget`/`ci-manifest` suites; hosted success on exact HEAD; Linux-counts-only |

Beta concurs per-P1–P18 HOLD with the same code citations (authorizer
DENY-first `authorizer.ts:50-108`, monotonicity `merge.ts`/`effective.ts`/
`shell-policy.ts`, descriptor-bound execution, `verifyPlatform`, one-rule
profile, single-use 60 s grants, captured-bytes export, pinned broker).

## Per-residual verdicts (reviewer-run: all bounds stand)

Transcribed from alpha §5 (beta concurs on all eleven):

| R | Verdict | Basis |
| --- | --- | --- |
| R1 mount isolation | bound stands | Refusal-on-observed-mismatch arms; no isolation created or claimed |
| R2 same-user writers | bound stands | Explicit assumption, correctly test-free (pre-arm 503 row does not overclaim) |
| R3 no descendant termination | bound stands | Biting title `quiescence.test.ts:64` proves unattributability via the 3-rule predicate (`census.ts:122-153`) |
| R4 Class 1 Linux open | bound stands | No Linux runtime execution recorded; hosted runs counts-only |
| R5 Keychain probe-only | bound stands | Single synthetic-item row; no isolation promise |
| R6 exfiltration declared | bound stands | Disclosure requirement + positive-control pair; destinations are an approval boundary |
| R7 content-blind | bound stands | Biting title `resources.test.ts:2529` (same bytes: `notes.txt` ordinary vs secret names) |
| R8 broker relay surface | bound stands | Single-rule deep-equals + scoped-matrix rows |
| R9 no delete/rename, limited creation | bound stands | Delete-ignored/rename-split rows, link/type-change refusals |
| R10 version/peer bounds | bound stands | Biting star-pin `package-compat.test.ts:57`; SNI opacity doc-declared |
| R11 evidence bounds | bound stands | 14-title budget suite; skip-never-vacuous; byte-binding via manifests + SHA binding |

## Doc-agreement re-read (reviewer-run: agree)

`README.md`, `SECURITY.md`, `COMPATIBILITY`/`PACKAGING`/`CI-EVIDENCE`
records agree verbatim with P1–P18/R1–R11 (both auditors, confirmed by
grep). `ARCHITECTURE.md` §§2–5 status lines ("not integrated",
"enforcement planned") and the §2 time-of-check paragraph describe the
unenforced policy primitives, not the integrated gates — they understate
rather than overstate. `THREAT_MODEL.md` "Planned response" vocabulary
likewise understates the accepted Goals 1–4. Recorded, not rewritten,
exactly as the prior audit §8 does. No line promises more than P1–P18;
no P-wording change forced.

## Findings (reviewer-run)

**BLOCKING: none.** No open bypass of any claimed P-protection was
found by either auditor; no `src/` fix triggered; no blocker filed.

Non-blocking observations, recorded WITHOUT code changes (the handoff
allows `src/` fixes iff an open bypass of a claimed protection exists;
none exists, and refactors/non-biting tests are out of scope):

1. (alpha) `consumeGrant` (`approvals.ts:118-131`) has no production
   caller; file-tool single-use rests on `authorizedCalls` deletion
   (`runtime.ts:527-530`) and export-approval grants are discarded
   un-consumed (`shell-runtime.ts:467-473`). Still single-use (nothing
   persists to replay); the tested primitive and the enforced mechanism
   are different objects.
2. (alpha) `authorizeExportEffect` lets a loader throw propagate instead
   of converting to DENY (`shell-runtime.ts:459`, unlike
   `authorizer.ts:67-71`). Still fails closed (caught at
   `executeAuthorizedShellRoute:486-489` → blocked); reason-fidelity only.
3. (alpha) Broker hostname normalization is one-sided: CONNECT target
   lowercased (`network-broker.ts:339`) but `byHost` keys stored
   as-pinned. An uppercase scope entry would 403 its own destination —
   fail-closed availability wart, not a bypass.
4. (alpha) Shell static-resource scan skips nonexistent operand targets
   (`shell-runtime.ts:189` early-return). Creation effects stay covered
   by per-target export re-authorization — declared design, recorded so
   no future reader mistakes the static scan for a creation gate.
5. (alpha + beta) Working tree carries the unbound
   `M IMPLEMENTATION_HANDOFF.md` (this Goal's own handoff). Harmless to
   the binding (in no manifest scope); accepted/recorded accordingly.
6. (beta) `publishConfig.provenance: true` retained alongside
   `private: true` — inert by design, documented in `PACKAGING.md`; any
   future `private: true` removal must re-audit provenance/CI wiring as
   a release decision.
7. (beta) `peerDependencies: "*"` + `engines >=22.19.0` remain
   declared-broader-than-verified — correctly bound by R10/P16;
   narrowing needs its own evidence/decision.

## Binding of this Goal's artifacts (executor-run)

- New record: `docs/INDEPENDENT-AUDIT.md` (this file).
- New manifest: `docs/independent-audit-hashes.json` (12 entries: this
  audit, the budget, the retention suite, every touched manifest suite,
  and the new suite itself), asserted by
  `test/independent-audit-manifest.test.ts` (3 tests, copied from the
  unknown-bounds manifest-suite template with the same enforcement
  strength). File-level SHA-256 of `docs/independent-audit-hashes.json`
  is bound at owner acceptance in STATE.md (not quoted here, to avoid a
  self-referential hash cycle); entry count 12.
- `CHANGED_IN_INDEPENDENT_AUDIT` (named exactly so) declared in every
  earlier suite whose covered bytes change: `ci`, `compatibility`,
  `packaging`, `post-transfer`, `release-review`, `v1-guarantees`,
  `regression-evidence`, `unknown-bounds` (8 suites). `file-gate`,
  `shell-gate`, and `network-gate` covered bytes are untouched, so they
  carry no declaration. No mismatch undeclared; no declaration dangles
  (cross-manifest consistency tests green).
- Budget: `test/ci-test-budget.json` linux tests 404 → 407 (the new
  suite adds exactly 3 platform-independent tests); skipped stays 54.
- Retention: `test/packaging-identity.test.ts` gains one entry for the
  new suite file (it reads the shared harness verbose flag, whose name
  carries the runtime identifier). This audit carries no former-name
  spelling (verified by case-insensitive search over the new files),
  so no other retention change.
- `STATE.md` is in no manifest COVERED_FILES (grep exit 1), so the
  dated authorization record below causes no self-referential hash
  cycle and `STATE.md` is added to no manifest.

## Checks (executor-run, final snapshot)

- `npm run check`: typecheck PASS; full suite 407 tests / 406 pass /
  0 fail / 1 declared platform skip.
- All manifest suites standalone: 33 / 33 pass (30 earlier + 3 new).
- `git diff --check`: clean.
- Hosted run `35994073510` (`8443215`, success, tests 407 / pass 353 /
  fail 0 / skipped 54) green against budget tests 407 / fail 0 /
  skipped 54.
- Hosted run `35994514371` (`e9ff633`, success, tests 407 / pass 353 /
  fail 0 / skipped 54) green against budget tests 407 / fail 0 /
  skipped 54.
- Post-binding corrections: `d44cfa3` corrected the stale in-doc
  manifest SHA (`de7443fa…` → `c829dcdd…`, the true value at the time)
  and recomputed the doc entry (`e35f42…`); `671e624` then removed the
  self-quoting manifest-file SHA per the handoff/STATE.md cycle
  convention, leaving the file-level SHA of
  `docs/independent-audit-hashes.json` bound at owner acceptance in
  STATE.md (new doc entry `8b1213be…`). Each fix re-ran `npm run
  check` (407/406/0/1), all manifest suites (33/33), and
  `git diff --check` (clean), with hosted runs `35993080540`
  (`d44cfa3`, success, tests 407 / fail 0 / skipped 54) and
  `35993521475` (`671e624`, success, tests 407 / pass 353 / fail 0 /
  skipped 54) green against budget tests 407 / fail 0 / skipped 54.
  Post-`671e624` corrections are chained above through `8443215`; the
  final snapshot is HEAD at owner acceptance (see `git log`; file-level
  SHA of `docs/independent-audit-hashes.json` bound in STATE.md at
  acceptance); no file-level SHA of `docs/independent-audit-hashes.json`
  is quoted here.

## Limits

- Binds only the independent-audit item; closes no gate and authorizes
  no release, tag, publication, `private: true` removal, provenance
  wiring, or real-profile installation.
- Hosted CI verifies counts, not test identities, on Linux only; darwin
  containment evidence is executor-local on the declared target.
- The Class 1 Linux runtime-evidence question stays open; no Linux
  support follows from this record.
- Overall verdict (binding): **PASS — no blocking findings.** Both
  fresh-context audits of exact HEAD `b1bab75` hold every P1–P18
  boundary and every R1–R11 bound on the cited evidence; this Goal adds
  the record and its manifest binding with no source, packaging, or CI
  behavior change.
