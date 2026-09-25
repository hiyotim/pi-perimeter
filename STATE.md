# Project State

Updated: 2026-09-25
Branch at planning update: `codex/operation-policy-contribution-contract`
Current branch: `main`; the released result is `0fa75fd2fe32473edf012a410660666ba5da67ce` and the accepted tag is `v1.0.1`. Earlier branch snapshots below are historical.
Goal 3 implementation start baseline: `b9060dad829a92d3699da3b689fe909446a1e810` (accepted Goal 2 corrective pass and Goal 3 research). The subsequent preparation commit changes only STATE, ROADMAP, and IMPLEMENTATION_HANDOFF. Historical Goal 1 planning baseline: `c10e8f384e678c41792937d340d716d25e592e28`.
Accepted merge implementation baseline (historical): `6622dce90ddad2fa60b9a7b9c276e2154e2910e6`
Result (2026-09-24): step 2 snapshot committed as c01b53d45e58dcf210610f18d4b98af564406459 on main, hosted run 35977693960 green.
Result (2026-09-24): step 3 snapshot ready for authorized commit+push — Task ID 20260924-unknowns-bound; manifest docs/unknown-bounds-hashes.json SHA-256 2b7ad6b55bfd654f5d42dd9a24e9e2b3927a85136eafec223399bc094ae83bd9 (16 entries); local `npm run check` 404 tests / 403 pass / 0 fail / 1 declared platform skip; hosted run id to be filled after push. Owner authorized commit+push of ONLY this Phase 7 step 3 snapshot in-session 2026-09-24. No acceptance claimed here.

## Owner acceptance (pi-perimeter@1.0.1, 2026-09-25)

The owner accepted Task `20260925-release-v101` on 2026-09-25 after the reported fresh FULL and VERIFY reviews passed without blocking findings. The accepted result commit is `0fa75fd2fe32473edf012a410660666ba5da67ce`; the published tag `v1.0.1` points to `041b4e89b4bb5cc5988fda5ce5a51f85488c6a52`. Acceptance covers the published npm artifact, its provenance, the isolated Pi `0.84.4` installation and startup evidence, and the public installation wording recorded in the release result below and [docs/RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md](docs/RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md). The completed [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) is **HISTORICAL**: its baseline remains `8c1e5b09bb14e4c3e9e7c6be550fb50a3ee8c41d`, and its result commit is recorded separately above. Its released bytes and all earlier release manifests stay unchanged. Support remains limited to the declared macOS target and Pi peer; the non-blocking wording/test-comment observations do not expand the release guarantee.

## Release result (pi-perimeter@1.0.1, 2026-09-25)

Task ID: `20260925-release-v101`. **The `1.0.1` release is executed and this entry supersedes the "no `v1.0.1` tag, hosted CI run, or published-artifact verification" limits in ## Continuation below; no earlier record is rewritten.** Tag `v1.0.1` (annotated object `29e76abf7b7a2632427cf335333f591bbc8b3dd9` on commit `041b4e89b4bb5cc5988fda5ce5a51f85488c6a52` on `main` (pushed to `origin/main`). Precondition verify-only hosted run `36173700726` (`workflow_dispatch` on `main`, success): guard `1.0.1` → `docs/release-hashes-1.0.1-final.json`; linux `tests 431, fail 0, skipped 54`; staging tree sha256 `327824cec0815802648abd877de61de6e08a8ed5c3f65df358dab7d3a6dd5bb7`; 36/36 verified; pack 105 files. Publish run `36173840730` (`v1.0.1` push, success): publish step with provenance; `+ pi-perimeter@1.0.1`; tarball shasum `8387c82ddb3f730512b6d43d577954981e3f24fd`; integrity `sha512-2yQU3dTIdYh61JPyIbgHKMQwYeb/LPlGUg4OXZmeUYV4Y8dX1svaUSkfjgum5lIw0Iaqhg3DxcUPAPGlyzMy5w==`; provenance `provenance/v1`, transparency log `2960126766` (publish notice) and attestation bundle tlog logIndex `2960155223`. Registry: `pi-perimeter@1.0.1`, dist-tag `latest` = `1.0.1`, tarball `https://registry.npmjs.org/pi-perimeter/-/pi-perimeter-1.0.1.tgz` (shasum/integrity as above, matching the reviewed bytes; fileCount 105, unpackedSize 1288031; attestations predicateType `https://slsa.dev/provenance/v1`). Isolated published-package exercise (executor-run, real npm registry, isolated `HOME`/`TMPDIR`/`PI_CODING_AGENT_DIR`/caches, synthetic fixtures, fixture removed): 11/11 checks PASS — `pi install npm:pi-perimeter@1.0.1` exit 0; settings `["npm:pi-perimeter@1.0.1"]`; installed version `1.0.1`; installed tree equals registry tarball bytes (105 files, 0 hash mismatches); `pi list` reported the source and root `<agentDir>/npm/node_modules/pi-perimeter`; pre-helper startup/authorization probe showed no loader errors, 7 tool owners equal to the installed `src/index.ts`, `.env` denied (`SECRET_RESOURCE`), ordinary read allowed, shell fail-closed (`HELPER_MISSING`); `npm --prefix <root> run build:native` exit 0 with `native/build-manifest.json` in the reported root; with-helper probe executed a contained shell (`STARTUP_SMOKE`, network closed with no destination scope) on darwin/arm64 with the pinned `sandbox-exec` identity; `pi remove npm:pi-perimeter` exit 0 with the isolated profile cleaned. Declared target throughout: macOS 27.0 (`26A428`) arm64, Node `v26.8.1`, Pi `0.84.4`. Nothing was installed into the real Pi profile. Full evidence: [docs/RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md](docs/RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md); public install path `pi install npm:pi-perimeter@1.0.1` in [README.md](README.md).

## Continuation

- Current: `20260925-release-v101` accepted 2026-09-25; published `pi-perimeter@1.0.1`; result `0fa75fd`.
- Review: Fresh FULL and VERIFY reviews PASS per release report; verify-only, publish, and final CI runs succeeded.
- Limits: Only the declared macOS target and Pi `0.84.4` are verified; other platforms and peers remain outside the claim.
- Next: No further release Goal selected; preserve this accepted state until the owner requests new work.

The owner accepted `20260925-user-install-onboarding` on 2026-09-25 after the reported fresh independent review PASS. The completed [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) is **HISTORICAL**: its original baseline is `b308ed8b8ab1526e5b8287032e56867829279ce3`, and its separate result commit is `1bfabc5e5aed482f7c0685f8eef0670d4b709d7d`. The handoff bytes remain unchanged because [docs/user-install-onboarding-hashes.json](docs/user-install-onboarding-hashes.json) binds them. The accepted scope is README onboarding, the direct npm package link, and isolated Pi `0.84.4` install/list/remove evidence. The owner-reported checks were 428 tests / 427 pass / 0 fail / 1 declared skip; the local closure rechecked the committed 19/19 manifest hashes and 2/2 onboarding manifest tests. No push, tag, publication, live npm `1.0.1` install, or hosted CI run is accepted by this decision.

## Release acceptance (pi-perimeter@1.0.0, macOS-only, 2026-09-24)

Task ID: `20260924-release-v1`. **Accepted by the owner on 2026-09-24; `pi-perimeter@1.0.0` is the controlled published distribution (macOS-only v1.0).** Acceptance binds to [docs/release-hashes.json](docs/release-hashes.json), SHA-256 `ca0fb1c322fb873c85d1f556c6978175411344911cd6bc594dc7d2725ef72ded` (20 entries), tag `v1.0.0` on `30ac49a`, and release run `36031377325` (success; `tests 413, fail 0, skipped 54`; staging verified 20/20; publish with provenance). Registry identity: `pi-perimeter@1.0.0`, dist-tag `latest`, tarball `https://registry.npmjs.org/pi-perimeter/-/pi-perimeter-1.0.0.tgz`, shasum `6352fefae4cfd3d6c19acceeeaa2f8c7941374fa`, integrity `sha512-J3LgKV1kwKFzdydiqUyEWhv9Dw0jGUoIAC+hTC4g9vn9wcoNlN8A17JOSFfgSZ/i3bDAp5qMYRkUdQyEkvX5Gw==`, provenance attested (transparency log `2942073251`, SLSA `provenance/v1`). Review: fresh release review PASS with no blocking findings; local `npm run check` 413/412/0/1, all manifest suites PASS, `git diff --check` clean. Scope: P17/PACKAGING revision + staging safeguards + binding only; source tree stays `private: true` at `0.0.0`; P1–P16, P18, R1–R11 untouched; old acceptances keep their historical bytes. No installation into a real Pi profile was performed as evidence.

## Phase 7 gate closure (macOS-only v1.0, 2026-09-24)

**Owner decision: the Phase 7 release gate is closed as a macOS-only v1.0.** The supported platform is exactly the declared target (macOS 27.0 26A428, arm64, pinned `sandbox-exec` identity, Pi `0.84.4`, Node `26.8.1`); Linux and Windows are explicitly unsupported — R4 (Class 1 Linux runtime evidence) stays open with no runtime execution recorded, and no Linux or Windows support claim is made now or implied later without its own evidence and decision. Evidence: steps 1–4 acceptances with their bindings (`2d59ca09…`/`24da69f`, `8a42fd59…`/`c01b53d`, `2b7ad6b5…`/`82a5c4b`, `32cb0399…`/`6202286`), each with fresh review PASS and green hosted run. `private: true`, unpublished, uninstalled. Publication is a separate maintainer decision and is not authorized here.

## Phase 7 step 4 acceptance (2026-09-24)

Task ID: `20260924-v1-independent-audit`. **Accepted by the owner on 2026-09-24; the Phase 7 checklist item "Complete an independent audit appropriate to the claimed boundary" is closed.** Acceptance binds to [docs/independent-audit-hashes.json](docs/independent-audit-hashes.json), SHA-256 `32cb0399a29b71d7f8b4716f25afdd8f9583d81990fcf748236c5e60ba57070f` (12 entries), commit `6202286b3a9cc569ba2806ef52cea1c327a78991` on `main` (pushed), and hosted run `36023554431` (success; `tests 407, fail 0, skipped 54`). Audit: two fresh-context audits of `b1bab75` (P1–P18 HOLD, R1–R11 stand, 7 non-blocking findings, none open-bypass) plus fresh final-bytes review and delta review of the citation-fix bytes, all PASS with no blocking findings; local `npm run check` 407/406/0/1, all manifest suites PASS, `git diff --check` clean. Scope: docs + binding only; no P1–P18 rewording, no `src/`, `scripts/`, `package.json`, or CI change; `private: true`, unpublished, uninstalled. The Phase 7 gate decision and publication remain separate explicit maintainer decisions and are not closed here.

## Phase 7 step 3 acceptance (2026-09-24)

Task ID: `20260924-unknowns-bound`. **Accepted by the owner on 2026-09-24; the Phase 7 checklist item "Resolve or explicitly bound release-blocking known unknowns" is closed.** Acceptance binds to [docs/unknown-bounds-hashes.json](docs/unknown-bounds-hashes.json), SHA-256 `2b7ad6b55bfd654f5d42dd9a24e9e2b3927a85136eafec223399bc094ae83bd9` (16 entries), commit `82a5c4bb60892155693b629858c1dd680fe06793` on `main` (pushed), and hosted run `35984659993` (success; `tests 404, fail 0, skipped 54`). Dispositions: R7/R8/R9/R11 resolve-with-evidence, R1–R6/R10 explicit-bound-no-claim; blocker verdict none open; §8 re-read no overclaims. Review: fresh independent PASS 2026-09-24, no blocking findings; local `npm run check` 404/403/0/1, all manifest suites PASS, `git diff --check` clean. Scope: tests + test-binding + audit only; no P1–P18 rewording, no `src/`, `scripts/`, `package.json`, or CI change; `private: true`, unpublished, uninstalled. No other Phase 7 item is closed; the Phase 7 gate stays open.

## Phase 7 step 2 acceptance (2026-09-24)

Task ID: `20260922-regression-evidence-per-guarantee`. **Accepted by the owner on 2026-09-24; the Phase 7 checklist item "Maintain regression evidence for every guarantee" is closed.** Acceptance binds to [docs/regression-evidence-hashes.json](docs/regression-evidence-hashes.json), SHA-256 `8a42fd593997b38a08fd1376add072fab5c4053a09684236602e22394e52687e` (16 entries), commit `c01b53d45e58dcf210610f18d4b98af564406459` on `main` (pushed), and hosted run `35977693960` (success; `tests 398, fail 0, skipped 54`). Review: rounds 1–4 reviewer-run PASS 2026-09-22, no blocking findings; local `npm run check` 398/397/0/1, all manifest suites PASS, `git diff --check` clean. Scope: tests + test-binding + audit only; no `src/`, `scripts/`, `package.json`, or CI change; `docs/V1-GUARANTEES.md` unrewritten; `private: true`, unpublished, uninstalled. No other Phase 7 item is closed; the Phase 7 gate stays open.

## Current checkpoint

**GOALS 1–4 ACCEPTED; PHASES 1–4 COMPLETE WITHIN THEIR DOCUMENTED GUARANTEES AND DECLARED LIMITATIONS. GOAL 4 (Task `20260919-restricted-networking-e2e-evidence`) WAS IMPLEMENTED AND VERIFIED ON THE DECLARED TARGET, RECEIVED A FRESH INDEPENDENT REVIEW PASS ON 2026-09-20, AND WAS ACCEPTED BY THE OWNER ON 2026-09-20. THE IMPLEMENTATION IS COMMITTED AS `6e6c967eb2483d8d8502cd30456c55bd332cfb12` (`feat: implement restricted network gate with end-to-end evidence`) AND NOW SITS ON `main`, WHICH IS LEVEL WITH `origin/main` (AHEAD/BEHIND 0/0) AND PUSHED; NOTHING IS PUBLISHED OR INSTALLED INTO A REAL PROFILE. NO NEW GOAL IS SELECTED.**

Owner acceptance (2026-09-20): the owner authorized recording the Goal 4
acceptance after the fresh independent review. Acceptance binds to
[docs/network-gate-hashes.json](docs/network-gate-hashes.json), SHA-256
`152c7fa25fe2b95ad5d61005e677eabf341ef269884653c879551ad14385b972` (20
entries), whose assertions passed in the review, and to the Goal 3/Goal 2
manifest checks over the preserved bytes. The implementation exists as local
commit `6e6c967eb2483d8d8502cd30456c55bd332cfb12`; the earlier "nothing is
committed" wording in this file described the pre-commit executor checkpoint
and is superseded by this record. At that acceptance, push, publication, and
real-profile installation were not yet authorized; the later 2026-09-20 owner
decision pushed `main` (see the repository transition below).

Fresh independent review (2026-09-20, fresh context, exact HEAD
`6e6c967eb2483d8d8502cd30456c55bd332cfb12`, read-only): **PASS, no blocking
findings.** Reviewer-run evidence: all three hash manifests recomputed against
the working tree (Goal 4 manifest 20/20 matched with the recorded manifest
SHA-256; Goal 2 manifest 19/19; the Goal 3 manifest's twelve
deliberately-changed entries verified against the explicit
`CHANGED_IN_GOAL_4` split in `test/shell-manifest.test.ts`, which is itself
test-enforced); `npm run check` PASS (typecheck plus 355/356 registered
scenarios with the single declared non-darwin skip); `npm run test:manifest`
PASS; `git diff --check` PASS. The adversarial review covered the broker
CONNECT parsing (case-sensitive method, IPv6-bracket and userinfo refusal,
port regex plus pinned-membership check), pinned-only dialing with no
re-resolution, the `arm()` gate and dispose lifecycle, the numeric IPv4/IPv6
address classification including embedded forms, profile rule emission
(exactly one host-generated validated port rule; empty scope byte-identical
to Goal 3), strict project-source monotonicity, the approval bindings
(network scope, profile hash, environment hash; single-use consumption before
`executePreparedInvocation`), and the one-directional destination extraction
(a destination hidden from extraction is unreachable through the broker, so
extraction misses fail closed). Non-blocking observations, recorded without
code changes: leading-zero CONNECT port spellings normalize to the same
pinned port (no authority widening); the NAT64 special case in
`isPublicIPv6` does not require zero groups 2–5 (not exploitable on the
declared route); broker idle timeouts destroy quiet tunnels (fail closed,
reliability); STATE's pre-acceptance "nothing is committed" wording was
stale relative to HEAD (superseded by this record). The declared §12
limitations (relay surface, endpoint exfiltration, tool variance, stale
pins, non-darwin targets) are unchanged and accurately bounded.

Goal 4 implementation status (executor record, 2026-09-19): the restricted
network route is implemented on the accepted Goal 3 shell gate and exercised on
the declared target (macOS 27.0, 26A428, arm64; `sandbox-exec` identity matches
the pinned value; Pi `0.84.4`, Node `v26.8.1` re-verified). Design:

- Enforcement vocabulary evidence: on the declared target the SBPL parser
  rejects every destination-exact network form (probed: literal IPv4/IPv6,
  hostnames, CIDR — only `*` and `localhost` hosts with an explicit port are
  expressible), so destination identity cannot be a profile filter; the system
  resolver additionally refuses sandboxed clients (child-originated DNS does
  not exist even with Mach allowances granted).
- Enforcement: a per-invocation network broker in the host process
  (`src/sandbox/network-broker.ts`) pins the composed destination scope
  (trusted allowlist entries plus invocation-approved representable
  destinations), resolved once host-side at preparation with public-address
  validation, and enforces exact host+port identity at tunnel-open time to the
  pinned addresses. The generated Seatbelt profile gains exactly one network
  rule — the broker endpoint, one TCP port on local addresses
  (`src/sandbox/seatbelt.ts`; the profile language has no single-address
  form) — and never a Mach rule. With an empty scope the enforcement profile
  and the constructed environment are byte-identical to Goal 3 and every
  reachable effect is unchanged; only the report and approval-prompt text carry
  the Goal 4 wording.
- Policy layer: `src/policy/network.ts` (pure destination validation, trusted/
  project composition under strict monotonicity, https-URL target extraction,
  approval-scope derivation), the optional `network` section in the same
  version-1 schema (`src/policy/configuration.ts`), per-command risk classes
  and the network decision paths (`src/policy/shell-policy.ts`,
  `src/policy/shell-plan.ts`), invocation bindings carrying the bound network
  scope (`src/approvals/shell-approvals.ts`), and the runtime wiring
  (`src/gate/shell-runtime.ts`, `src/sandbox/containment.ts`).

Artifacts:

- Contract: [docs/NETWORK-GATE.md](docs/NETWORK-GATE.md) — destination model,
  composition, approvals, enforcement, guarantee wording N1–N7 and limitations.
- Evidence: [docs/NETWORK-GATE-AUDIT.md](docs/NETWORK-GATE-AUDIT.md) — the
  probe matrix, the end-to-end positive controls (a real dependency fetch
  through the production adapter to the authorized destination set only),
  the refusal/effect matrix, the eighteen adversarial mutation checks (all
  bite), three independent review rounds with their findings and fixes, and
  exact artifact identities with their Goal 3/Goal 1 provenance.
- Manifest binding: [docs/network-gate-hashes.json](docs/network-gate-hashes.json),
  SHA-256 `152c7fa25fe2b95ad5d61005e677eabf341ef269884653c879551ad14385b972`
  (20 entries, including the amended shell gate contract), asserted by
  `test/network-manifest.test.ts`. The Goal 3 and
  Goal 2 manifests are unchanged and their tests now bind the preserved bytes;
  changed artifacts received fresh identities.

Fresh executor evidence recorded locally on macOS (declared target):
`npm run check` PASS (typecheck plus 355/356 registered scenarios with the
single inverted non-darwin skip; exact counts in the audit §5), `git diff
--check` clean. Eighteen fail-open mutations (destination substitution, port check,
profile rule, binding serialization, public-address filter, unapproved-ASK,
closed-scope denial, proxy variables, `http://` extraction, project port
union, embedded-IPv4 extraction, approved-port overwrite, broker duplicate
merge, pre-arming service, IPv6 extraction) each make their affected
registered suite fail. Three independent review rounds (the second and third
on the DeepSeek flash model) found one blocking and eighteen non-blocking
findings (round 1: two, round 2: eight, round 3: eight);
all were fixed within the Goal with biting regressions or corrected claims,
and the affected checks were repeated (docs/NETWORK-GATE-AUDIT.md §8). An ordinary dependency fetch (`npm install ms`) succeeded through
the containment adapter (`runContainedShellCommand`, the evidence/test
lifecycle checkpoint) with its registry traffic tunneled to
`registry.npmjs.org:443` only. Goal 4 remains not owner-accepted; no commit and
no push. The three independent review rounds and their resolutions are recorded in
[docs/NETWORK-GATE-AUDIT.md](docs/NETWORK-GATE-AUDIT.md) §8. After the
final-snapshot independent audit, the Goal 4 documentation was corrected
without any source or test change (audit §8: finding total, §7 accepted-old
hashes, contract §6.1 extraction wording, stale Goal 4 status lines in ROADMAP
and STATE), and the corrected documents are re-bound in the manifest below.

Accepted Goal 3 status is unchanged and bound as recorded below. The sections
below record the accepted Goal 3 checkpoint and the historical authority.

Implementation status (accepted 2026-09-19): the contained shell route is
implemented (`src/policy/shell-*.ts`, `src/sandbox/**`,
`src/gate/shell-runtime.ts`, `src/approvals/shell-approvals.ts`,
`src/sandbox/native/piwarden-helper.c`) and exercised by the registered suites on
the declared target. Artifacts:

- Contract: [docs/SHELL-GATE.md](docs/SHELL-GATE.md) — routes, projection,
  profile, grammar, approvals, topology, limits and guarantee wording.
- Evidence and provenance: [docs/SHELL-GATE-AUDIT.md](docs/SHELL-GATE-AUDIT.md)
  — executor-run effect evidence, changed accepted bytes with old/new hashes,
  the round-by-round independent review record, and the bounded limitations.
- Snapshot binding: [docs/shell-gate-hashes.json](docs/shell-gate-hashes.json)
  (33 entries, including the audit) and
  [docs/file-gate-hashes.json](docs/file-gate-hashes.json) for the Goal 2 files.

Independent review: eight separate fresh-context reviewer passes (rounds 1–8,
recorded in the audit) ran against successive snapshots. Rounds 1–6 each found
real defects in the classification layer plus one host-crash path and one
target-destroying path; every finding was fixed with a biting regression and
re-verified in the following round. Round 7 returned **PASS with no blocking
finding**; the bounded documentation-delta and inline-flag verifications are
recorded in the audit's §17. The containment guarantees (no uncontained spawn
path, workspace isolation, closed networking, per-target export authorization)
held in every round.

Post-review correction (2026-09-18): the owner's acceptance review found that
the quiescence step proved only the original process group empty, and that a
regression accepted a detached descendant while reporting `quiescent: true`.
Both were fixed within this Goal: quiescence is now three-condition
(process group empty, no attributed invocation process alive, projection
unchanged for two consecutive windows — any change after the entry process
exited refuses), attribution comes from a native process-table census sampled
during and after the run, attributed survivors are killed and refuse the export,
and the export source is a frozen copy taken outside every writable root. The
envelope evidence now covers inherited descriptors 3, 300 and 1024. The
previous "unprovable process group" test was replaced; see
docs/SHELL-GATE-AUDIT.md §18 for the exact changes and regressions. That
section's claim that the frozen source keeps an unattributable survivor out of
"every byte, structure and decision the host authorizes and applies"
overclaimed (it described post-capture isolation only) and is superseded by the
variant-B contract decision below and by §11/G5 of the contract.

Owner contract decision (2026-09-18, variant B): the owner approved amending the
Goal 3 export contract — descendant termination is no longer guaranteed or
claimed; an unattributable survivor's lifetime and resource consumption are
accepted as unconstrained; the export guarantee is the captured-bytes invariant
(every applied effect consists exactly of the captured, verified,
re-authorized content of the frozen export source — payload bytes and
captured permission bits), which is not an atomic tree
snapshot and does not promise absence of descendant influence before or during
the capture (a write racing an already-opened object is detectable unless it
preserves the size and exact modification time; a write or substitution landing
before an object's own measurement is bounded only by the scan's manifest
comparison and per-target re-authorization — both declared in §11).
Implementation continued within this decision:
[IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) and the contract's
§11/G5 were rewritten to the amended contract, the freeze module's comment was
corrected, a test-only deterministic freeze interleaving hook was added, four
freeze-race regressions (mtime-restore residual, file substitution refusal,
directory-to-file refusal, directory-to-symlink caught by the pre-apply
re-measurement) and a contained-run authorization-binding regression were
added, and docs/SHELL-GATE-AUDIT.md §19 records the change and evidence.
Additional census/lsof heuristics were explicitly not authorized and were not
implemented. Goal 3 remains not owner-accepted; no commit and no Goal 4.

Blocker fix (2026-09-18, same day): the owner reported that the §19
freeze-time race work exposed a real bypass — a mid-freeze swap of a projected
directory for a symlink to an external fixture, undone before the pre-apply
re-measurement, copied foreign bytes into the frozen source while the
re-measurement stayed blind (`snapshotDeviation` empty). The executor
reproduced it deterministically and fixed the source-read binding: the frozen
capture is now **descriptor-bound** (new audited helper `freeze` mode, protocol
version 2) — the host opens and identity-verifies both root descriptors, and
every name lookup during the copy is a single component resolved against held
directory descriptors, so no swap can redirect a read; directory descent never
follows symlinks; regular files are re-checked (identity, link count, size,
mtime at nanosecond precision) after their bytes are read; the projection root
identity recorded at import is verified by the freeze and by every quiescence
measurement. A deterministic swap→copy→restore regression with an external
synthetic secret asserts the refusal, the blindness of the measurement layer
(documented), and that no external byte and no host effect occurs. The other
host-side readers were checked for the same bypass class; findings and the
independent review of the whole capture chain are recorded in
docs/SHELL-GATE-AUDIT.md §20. Goal 3 remains not owner-accepted; no commit and
no Goal 4.

Blocker fix (2026-09-18, second same-day pass): the owner then reported that
the measurement layer itself still walked the child-modifiable projection by
path — a deterministic swap of a projected directory for a symlink to an
external fixture landing immediately before that directory's enumeration
placed the outside directory's names into the snapshot, the deviation
diagnostics and the quiescence result, and the root check, the re-measurement
and the export refusal could not repair a poisoned measurement. The executor
closed the bypass class for measurement: a new audited helper `measure` mode
(protocol still 2) performs every projection measurement descriptor-bound —
single-component lookups against held, identity-verified directory
descriptors, `O_NOFOLLOW` directory descent with a post-open identity check
(the two together refuse a swapped component at access time), symlink entries
contributing only their link text — and `snapshotProjection`,
`establishTreeQuiescence` and the pre-apply re-measurement were rewired to it;
a partial measurement is never used. Deterministic regressions with an
external synthetic name assert the access-time refusal and that the name
reaches no snapshot, diagnostic or result, and that a held swap is measured as
a symlink and caught by the next window or the scan's manifest comparison.
The whole chain of host-side traversals of the child-modifiable projection was
re-checked, and the fresh independent review of the boundary returned PASS
WITH FINDINGS (two non-blocking wording-precision items, resolved); see
docs/SHELL-GATE-AUDIT.md §21. No new residual was declared. Goal 3 remains not
owner-accepted; no commit and no Goal 4.

Post-review correction (2026-09-18, third same-day pass): the owner then
rejected the remaining diagnostic-only read of the live projection — the
export flow called scanProjection unconditionally with
`frozenRoot ?? staging`, so after a refused quiescence or a refused freeze the
host walked, read and diffed the child-modifiable tree, and its per-entry
refusals, change records and removal reports reached the diagnostics; the
owner rejected declaring that read safe merely because nothing is applied
afterwards. The fallback scan, the live payload reads and the removal
computation are now removed: with no trusted frozen source the export ends
with the already-known refusal reason and no projection walk at all, and
`scanProjection`'s single production call receives only a successfully frozen
source. Runtime regressions for both branches (quiescence refused; freeze
refused) prove with an external synthetic fixture that the live scan and its
payload reads do not run (no per-entry refusals reappear), that external and
staged names/bytes reach no result, and that no host effect occurs; a
mutation check shows both regressions fail when the fallback is restored. The
chain and the no-read-after-refusal discipline are recorded in
docs/SHELL-GATE-AUDIT.md §22. Goal 3 remains not owner-accepted; no commit and
no Goal 4.

Declared limitations at acceptance: *observational quiescence, accepted as the
variant-B contract boundary (2026-09-18)* — a child descendant that calls
`setsid()` and is reparented between census samples cannot be attributed,
killed or refused on by an unprivileged observer (macOS exposes no session id
and reparenting destroys the lineage); its lifetime and resource consumption
are not bounded by pi-warden; it stays confined to the disposable projection,
session home and session temp, and after the freeze capture it cannot change
the captured, verified and re-authorized content (payload bytes and captured
permission bits) that the host applies; a write racing an already-opened
capture object is detectable unless it preserves the size and exact
modification time, while a write or substitution landing before an object's
own measurement is bounded only by the scan's manifest comparison — the
declared pre-capture residual, and its bytes remain child-controlled output
subject to per-target re-authorization; a same-user host writer is outside the
claim (B3, including ordinary projection tampering); mount isolation is
UNVERIFIED; descendants are not parsed; `sandbox-exec` is pinned and an OS
update blocks the shell route until re-verified; the projection costs a full
copy per invocation; deletions and renames inside the projection have no host
effect; an abrupt host kill can leave one invocation directory in the system
temporary directory. Full list in the audit.

Owner acceptance (2026-09-19): after the final reviewed snapshot and its
variant-B limitations were presented, the owner explicitly accepted Goal 3,
authorized the local acceptance commit, and selected Goal 4. Acceptance binds
to [docs/shell-gate-hashes.json](docs/shell-gate-hashes.json), SHA-256
`d5e4e5f2f8497d4da39826130e37f23287b066fe1369fcd3a4a87f971b97cfaa`,
whose three manifest checks passed again immediately before this transition.
The prior final evidence remains 329/330 registered tests with the one declared
platform skip, typecheck PASS, `git diff --check` PASS, and a fresh independent
review PASS with no findings after the fallback removal. This decision accepts
the declared variant-B boundary; it does not add descendant-termination,
atomic-tree-snapshot, B3 same-user-writer, or mount-isolation guarantees.
At that transition, publication, installation into a real Pi profile, and push
were not yet authorized; the later 2026-09-20 owner decision pushed `main` (see
the repository transition below).
Goal 4 is selected for a separate autonomous implementation handoff based on
the accepted commit; no Goal 4 implementation is included in this snapshot.

Historical status text for the architecture approval follows.

**GOAL 3 ARCHITECTURE APPROVED; IMPLEMENTATION AUTHORIZED, IMPLEMENTED AND VERIFIED, NOT ACCEPTED.** On 2026-09-17 the owner approved proceeding with the proposed isolated-workspace architecture, requested committing the existing work, and requested an autonomous implementation handoff. This supersedes the earlier proposal-only gate for the architecture below. The shell routes were blocked at the time of that approval and are now implemented behind the same authorization, containment and export lifecycle. Phase 3 remains unaccepted and Goal 4 remains unauthorized.

This file is the canonical acceptance/checkpoint and Goal-selection record. [ROADMAP.md](ROADMAP.md) retains the four-Goal plan and phase/release gates; all four Goals are accepted and the Phase 6 and Phase 7 release gates remain open. [ARCHITECTURE.md](ARCHITECTURE.md) defines component and trust boundaries; earlier status wording there and in reviewed Goal 2 artifacts describes the pre-acceptance snapshot, while this record supplies the later owner decisions. [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) currently holds the bounded Phase 6 private-vulnerability-reporting task; it is not authorization for a further Goal or phase advancement. The older untracked `QWEN_TASK.md` is absent; do not recreate it or treat it as active instruction.

## Private vulnerability-reporting channel (Phase 6 checklist item)

Task ID: `20260920-private-vulnerability-reporting`. **Implemented and accepted
by the owner on 2026-09-20; the bounded Phase 6 checklist item "Define a private
vulnerability-reporting channel" is closed.** This is not one of Goals 1–4. It
adds no runtime, policy, approval, sandbox, network, test, build, package, CI,
dependency, or manifest change, and it does not advance Phase 6 or close its
release gate.

- Channel: GitHub private vulnerability reporting for `pi-warden/pi-warden`,
  documented at `https://github.com/pi-warden/pi-warden/security/advisories/new`
  and discoverable from [SECURITY.md](SECURITY.md). Report visibility is limited
  to the repository's security managers and administrators (and the reporter)
  until an advisory is published; no confidentiality, acknowledgement,
  remediation, availability, or response-time commitment beyond that is claimed.
- Reviewed documentation bytes: [SECURITY.md](SECURITY.md) SHA-256
  `7ca71e08f2d365c49760a8d94ce3852785ea7d6eb323ce4b089932c5cd23a6ca`,
  [CONTRIBUTING.md](CONTRIBUTING.md) SHA-256
  `c2b91b039aa9106052f479e8a43c9f816d54b9d12a3cb33f4221a8d6388a0860`, and
  [docs/VULNERABILITY-REPORTING-AUDIT.md](docs/VULNERABILITY-REPORTING-AUDIT.md)
  at its pre-acceptance revision SHA-256
  `8dc512df1ee332629f3f4415a36448c42f6f0b503ab806db736d696b7e992707`. The
  accepted revision of that record is
  `01cc398864e68c1c61459a82967573c8eeba1b08d9dd753a04c259ebfed124da`; it differs
  only by the added acceptance section and the corrected `.gitignore`
  attribution. `README.md` needed no change; its existing link to `SECURITY.md`
  remains accurate.
- Verification evidence is executor-run and recorded in the audit: channel
  configuration reads, the access-control comparison, and one authorized
  synthetic report containing no vulnerability content delivered through the
  documented route. **No independent-review artifact for these bytes exists in
  the repository**, so the independent security/documentation review the handoff
  requires before acceptance is not recorded here and no documented independent
  PASS is claimed; the owner acceptance binds to the audited bytes above. That gap
  was closed later the same day by the review recorded below, which changed none of
  the accepted bytes.
- Pre-transition anchors, unchanged by this Goal and matching the handoff pins
  (the owner's Goal 4 acceptance updates): `STATE.md` SHA-256
  `c7cf85c1062a88c33d5a2b8783ffe03ea6e02af79fac2fbf23880dabed8fadf3` and
  `ROADMAP.md` SHA-256
  `6956e2d9a447d6e9f339e74b1908ba622328cf18852069c0753a8a3e87453a3e`.
- Attribution: the `.gitignore` change removing the stale `.qwen/` entry is an
  owner working-tree change, confirmed by the owner on 2026-09-20, and lies
  outside this Goal's scope. The untracked `.commandcode/` directory is session
  tooling and stays untracked.

### Independent review (2026-09-20, closes the gap recorded above)

A fresh independent reviewer pass ran in a separate context on model
`z-ai/glm-5.3-flash`, read-only, against the current state of this item at commit
`9a99881`. **Verdict: PASS, no blocking findings.**

Reviewer-run evidence (live, not read from this record): `gh api` confirmed the
repository is public with private vulnerability reporting `{"enabled":true}`; the
advisory list contains exactly one entry whose `state`, `published_at`,
`created_at` and summary match the audit field for field; collaborators and org
members each number one, matching the intended-recipient claim; the same advisory
returns `404` unauthenticated while the authenticated list returns it, matching
the access-control comparison. The reviewer also re-derived the pinned bytes
(`SECURITY.md` `7ca71e08…`, `CONTRIBUTING.md` `c2b91b03…`, the audit's accepted
revision `01cc3988…`), grepped the whole repository for wording that still claims
the channel is unavailable (none: `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`,
`STATE.md` and `docs/` all agree), and confirmed the disclosure scope matches the
accepted Goals 1–4 limits without promising coverage the project lacks.

It reported two cosmetic observations, recorded without any change: `ROADMAP.md`'s
prospective phrasing inside the release-gate paragraph is made unambiguous by the
status annotations on the checklist entry, and the audit's self-pinned
pre-acceptance hash cannot be re-derived from `HEAD` by design (the accepted
revision hash does verify). No accepted byte was changed by this review, so the
original acceptance binding above remains intact.

## Repository transition to main and hosted-CI Goal selection (2026-09-20)

Owner decision (2026-09-20): consolidate the working branch into `main`, push
`main`, and continue all further work directly on `main` without additional topic
branches. The branch `codex/mac-migration-snapshot` was fast-forwarded into
`main` (`c10e8f3..2fa89b6`, ten commits) and pushed to `origin/main`
(<https://github.com/pi-warden/pi-warden>) on 2026-09-20. The Goal 4 network
gate, the Goal 3 shell gate, the Goal 2 corrective pass, their audits, and the
accepted documentation transitions are therefore public on that remote. No npm
publication, release, or real-profile installation is authorized by this
transition. The local branch `codex/mac-migration-snapshot` still exists and
points at the same commit.

Owner decision (2026-09-20): select the next bounded Goal — **hosted CI and
reproducibility evidence**, Task ID `20260920-hosted-ci-reproducibility`, closing
only the Phase 6 checklist item "Add GitHub CI and reproducible checks". The
npm name collision is recorded as a known blocker for the later packaging Goal
and is deliberately not resolved here: `pi-warden` is already published on the
public npm registry by another maintainer (latest `0.28.4`, registry metadata
observed 2026-09-20), so this project cannot publish under that unscoped name.

Hosted-run provenance correction (established 2026-09-20): one hosted run already
exists and had never been recorded. Run `34985125954`
(2026-09-15T14:57Z, triggered by the push of the Goal 2 snapshot commit
`664871d`) **failed**: 209/210 tests passed and test 69, "the Goal 2 artifact
hash manifest matches the final working tree", failed. Wording in this file,
[docs/FILE-GATE-AUDIT.md](docs/FILE-GATE-AUDIT.md), and
[docs/CONFIGURATION-AUTHORIZATION-AUDIT.md](docs/CONFIGURATION-AUTHORIZATION-AUDIT.md)
that hosted GitHub Actions "has not run" is qualified by this record: no hosted
run covers the accepted Goal 1–4 bytes, and the only recorded hosted execution is
red on the Goal 2 snapshot. Establishing the current hosted state on a clean
checkout is the first task of the selected Goal; no reproducibility claim may be
made before that evidence exists.

## Hosted CI Goal: accepted (2026-09-20)

Task ID: `20260920-hosted-ci-reproducibility`. Status: **implemented,
hosted-verified, independently reviewed, and accepted by the owner on 2026-09-20;
the Phase 6 checklist item "Add GitHub CI and reproducible checks" is closed.**
This record is the acceptance-transition record that
[docs/CI-EVIDENCE.md](docs/CI-EVIDENCE.md) §2 points at, and it carries the hosted
run for the reviewed snapshot. Acceptance binds to
[docs/ci-hashes.json](docs/ci-hashes.json), SHA-256
`796fcf2b8b7a928ab045e4e38ea886f3fb1afc67d618755bc125722796d52c1e`, and to the
fresh independent review PASS of the reviewed bytes at `1f6b1e7`. Nothing is
published, released, or installed, and the acceptance does not close the Phase 6
release gate or advance any other Phase 6 item.

### What changed

- `.github/workflows/ci.yml`: `actions/checkout` and `actions/setup-node` pinned to
  the commits their release tags point at (`v7.0.1`, `v7.0.0`) with
  `permissions: contents: read` kept; `workflow_dispatch` added; the check runs
  under `set -o pipefail` so a failing suite cannot be masked by the log pipe;
  a final step asserts the declared test counts.
- `scripts/assert-test-outcome.mjs`, `test/ci-test-budget.json`,
  `test/ci-budget.test.ts`, `test/ci-manifest.test.ts`, `docs/CI-EVIDENCE.md`,
  `docs/ci-hashes.json`: exact per-platform count assertion (fail closed on a
  missing, inconsistent, or undeclared summary and on a malformed budget), the
  declared `linux` budget `tests 373, fail 0, skipped 54`, behavioral tests over
  isolated temporary fixtures, and the evidence record.
- `test/hash-manifest.test.ts`: carries `CHANGED_IN_HOSTED_CI =
  {".github/workflows/ci.yml"}`, skips that historical entry, and asserts the split
  is exact.

### Accepted bytes changed

| Artifact | Accepted bytes | Current bytes |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `891d1c476016c632b77ee7b590afe867c046b6139102f4300b0ecbe5a63c3d63` (still recorded in `docs/file-gate-hashes.json`) | `64d7f1f01db02d2e341d45303b14cd34083216842b559d3fda4062b5d65acf55` |
| `test/hash-manifest.test.ts` | `83d89f7a5ef5a2775fe3357a2fdfdcf9d2d8726c2423289a4502418535f12a03` | `5ce61ec3127c3bb7073cd92bc2abbc259515a936a339add5b9b83907230e26c3` |
| `docs/file-gate-hashes.json` | unchanged | `9698efea51aaa47a47679fa0520d395cbcc3d5282e4e2b7131106a86da13fd1d` |

The Goal 2 manifest keeps its historical entry for the workflow, per the
`CHANGED_IN_GOAL_4` precedent; the current bytes are bound by
[docs/ci-hashes.json](docs/ci-hashes.json), SHA-256
`796fcf2b8b7a928ab045e4e38ea886f3fb1afc67d618755bc125722796d52c1e`, and enforced
by `test/ci-manifest.test.ts`. The Goal 2 acceptance anchor `7aa0e786…` had
already been superseded by Goal 3; the evidence record states that rather than
silently replacing it.

### Hosted evidence

- Run `34985125954` (2026-09-15, `664871d`): failure, 209/210, the Goal 2 manifest
  test. Previously unrecorded; this Goal records the correction.
- Runs `35523982904` (`2fa89b6`), `35524137666` (`964b408`), `35524360355`
  (`a507be4`), `35525006502` (`f8f7257`), `35525523512` (`1f6b1e7`): success.
- The assertion step of run `35525523512` reported, on the hosted Linux runner:
  `pi-warden CI count assertion passed for linux: tests 373, pass 319, fail 0,
  skipped 54, todo 0, cancelled 0 (declared tests 373, fail 0, skipped 54)`. This is
  executor-observed output from the hosted run, not reviewer evidence.

### Independent review

Three reviewer passes ran in a separate context on model `z-ai/glm-5.3-flash`,
read-only, and each ran its own checks rather than trusting this record:

1. Mechanism review on `f8f7257`: **PASS** with one medium finding (the budget used
   a floor, so a test could disappear silently, and the docstring/evidence text
   overstated the protection) and three low findings (`todo`/`cancelled` missing
   from the arithmetic, missing malformed-budget and unreadable-log regressions,
   and the undocumented coupling to Node 22's TAP shape). Reviewer-run evidence
   included synthetic-log mutation checks and a deletion probe.
2. Evidence review on `f8f7257`: **PASS** with one medium finding (the record's
   present-tense claim that later runs "are recorded" in STATE before any such
   record existed) and one low finding (the hosted-macOS sentence was broader than
   the code). Reviewer-run evidence included `gh run view` checks of the run
   history, skip-line counts, and hash recomputation.
3. Fresh review of the fix delta on `1f6b1e7`: **PASS**, all five findings closed,
   no new findings. This reviewer could not reach the network, so it verified the
   manifest hashes and the delta itself but not the hosted runs; those remain
   executor-observed as recorded above.

An earlier reviewer pass on `f8f7257` stopped at its turn limit without a verdict
and is therefore not evidence. Its partial observation about the skip composition
was verified by the executor against the hosted log (network-effects 12,
quiescence 16, seatbelt-profile 6, shell-containment 20) and corrected the record.
All findings were fixed inside this Goal; because the fixes changed bytes, the
fresh `1f6b1e7` review was obtained instead of transferring the earlier PASS.

Executor-run local evidence for the reviewed snapshot: `npm run check` PASS
(typecheck plus 373 tests, 372 pass, 0 fail, 1 declared platform skip) and
`git diff --check` clean.

### Declared limits

- Hosted CI covers the platform-independent suite on Linux only. No macOS job is
  added: the tests' skip predicates are their own `process.platform === "darwin"`
  checks, while containment additionally requires the pinned Darwin major and
  `sandbox-exec` identity, so a hosted runner cannot pass the containment suites.
  Hosted CI supplies no containment evidence.
- The assertion verifies counts, not test identities; a rename or a one-for-one
  swap inside the same counts is not detected.
- The outstanding Goal 2 follow-up (runtime evidence for the Class 1
  `/proc/self/fd` execute-time path) is **not** closed here and no Linux or other
  platform support claim is made; the record states the question instead.
- One Phase 6 checklist item is closed by this Goal on acceptance; the Phase 6
  release gate, the compatibility matrix, packaging, and the release-candidate
  reviews remain open.

## Compatibility matrix Goal: accepted (2026-09-20)

Task ID: `20260920-compatibility-matrix`. Status: **implemented, hosted-verified,
independently reviewed, and accepted by the owner on 2026-09-20; the Phase 6
checklist item "Publish a Pi, Node, macOS, and Linux compatibility matrix" is
closed.** Acceptance binds to [docs/compatibility-hashes.json](docs/compatibility-hashes.json),
SHA-256 `0657cfd7803e11b4e7d4f7842667eaa250b461be96945cfb95852dea77d9e841`, and to
the fresh independent review PASS of the reviewed bytes at `b81ae5d`. Nothing is
published, released, or installed, and the acceptance does not close the Phase 6
release gate or advance any other Phase 6 item.

### What changed

- [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md): one matrix over Pi, Node,
  OS/architecture and distribution, where every cell is either verified with the
  exact version and its evidence pointer, or explicitly unsupported/declared with
  the mechanism (or the absence of one) stated, plus a "Not claimed" section and an
  evidence index. Owner decisions applied: verified rows only, no support
  commitment, and `peerDependencies: "*"` left as declared but documented as
  unverified beyond `0.84.4`.
- [README.md](README.md) Platform section points at the matrix without widening it.
- `docs/compatibility-hashes.json` and `test/compatibility-manifest.test.ts` bind
  the Goal's artifacts; `test/ci-manifest.test.ts` declares
  `CHANGED_IN_COMPATIBILITY`; the declared `linux` CI budget rises from `tests 373`
  to `tests 376` because this Goal adds three tests.

### Accepted bytes changed

| Artifact | Accepted bytes | Current bytes |
| --- | --- | --- |
| `docs/CI-EVIDENCE.md` | `546dc26f7c4ae728942db2e24fcbae733d8cd9a8f48556118d07feb79aa1c34e` | `127f4ac1477e9c577302f5e26898a0318153bb55bcacd6fbdd3816b6471508f3` |
| `test/ci-test-budget.json` | `3287e756c97947a8d57bcfe443cc7cecbaba5acdf94a63957b651c8f68aaebb9` | `ea1e11ce5262337af8f9a26f6e8d32572ceb7ff47c130fbec2490364dc126049` |
| `test/ci-manifest.test.ts` | `4f3550f1d4d6e69e7e00dda9f0f130d3723bb819a559e44950adfbecbcad06ef` | `3fc8de374f42f0726e9e3f8d03282b6db22c32a40a226f82e75fa3e34cd75012` |
| `docs/ci-hashes.json` | unchanged | `796fcf2b8b7a928ab045e4e38ea886f3fb1afc67d618755bc125722796d52c1e` |

The hosted-CI manifest keeps its historical entries for the three changed
artifacts, its own bytes are unchanged so the hosted-CI acceptance binding stays
valid, and [docs/compatibility-hashes.json](docs/compatibility-hashes.json),
SHA-256 `0657cfd7803e11b4e7d4f7842667eaa250b461be96945cfb95852dea77d9e841`, binds
the current bytes.

### Hosted evidence

Runs `35531506720` (`f92e557`) and `35531992518` (`b81ae5d`) both succeeded, and
the assertion step reported `tests 376, pass 322, fail 0, skipped 54, todo 0,
cancelled 0` against the declared budget. These are executor-observed outputs, not
reviewer evidence, and they satisfy the run-recording promise made by
[docs/CI-EVIDENCE.md](docs/CI-EVIDENCE.md) §2.

### Independent review

Two reviewer passes ran in a separate context on model `z-ai/glm-5.3-flash`,
read-only, each running its own checks:

1. Review of `f92e557`: **PASS** with one medium finding (the Node-below-floor cell
   was labelled fail-closed although `engines` is advisory and nothing refuses it at
   runtime) and one low finding (the hosted-CI evidence record still stated the old
   `tests 373` budget, leaving two documents disagreeing). Reviewer-run evidence
   included the citation checks behind each cell, `gh run view` of the hosted runs,
   independent `shasum` recomputation, and the three manifest suites.
2. Fresh review of the fix delta on `b81ae5d`: **PASS**, both findings closed, no new
   findings, and confirmation that `docs/ci-hashes.json` is byte-identical across the
   Goal so the hosted-CI acceptance binding is intact. Non-blocking observation,
   recorded without a code change: the "How to read this" taxonomy does not literally
   cover the Distribution cell's externally-blocked state, although the cell text and
   body are factual.

### Attribution note

The uncommitted owner edit to `AGENTS.md` (the "Continuity documents" section) was
swept into commit `f92e557` by this Goal's `git add -A`. It is the owner's content,
not this Goal's output, and it is disclosed here rather than re-attributed by
rewriting published history.

### Declared limits

- The matrix reports the verified rows and the refusals only; it is not a support
  commitment, and it does not close the Phase 6 release gate or any other Phase 6
  item.
- The Pi row's `0.86.1` gap and the unverified `peerDependencies: "*"` range remain
  open; narrowing the range or verifying `0.86.1` needs its own decision.
- The Class 1 `/proc/self/fd` runtime-evidence question stays open, and no Linux or
  Windows support follows from this Goal.

## Phase 5 ledger reconciliation: accepted (2026-09-20)

Task ID: `20260920-ledger-reconciliation`. Status: **accepted by the owner on
2026-09-20.** Documentation-only: no runtime, policy, approval, sandbox, network,
test, budget, or manifest artifact changed, and no Goal or phase was advanced. The
Phase 5 release gate remains open and remains an owner decision.

- The six Phase 5 hardening checklist items were distributed across the owning
  Goals; each is now ticked in [ROADMAP.md](ROADMAP.md) with the artifact that
  demonstrates it (the bounded shell grammar and content binding in
  [docs/SHELL-GATE.md](docs/SHELL-GATE.md) §8–§9; the shell grammar/plan/containment
  suites; the Goal 2 corrective pass in [docs/FILE-GATE-AUDIT.md](docs/FILE-GATE-AUDIT.md)
  plus the Goal 3 freeze/measure races in [docs/SHELL-GATE-AUDIT.md](docs/SHELL-GATE-AUDIT.md)
  §20–22; the synthetic-Keychain probe; the adversarial suites enforced by the hosted
  count budget; and the recorded reviewer passes).
- The Phase 5 release gate is **not** closed. Whether its condition is met remains an
  owner decision, and the residuals it would inherit are named in the ROADMAP entry.
- Surfaced gap: `20260920-private-vulnerability-reporting` is the one accepted item
  whose bytes carry no recorded independent review. That is stated in its own
  acceptance record and now in the ROADMAP tick; obtaining one remains open.

### Independent review

Two reviewer passes ran in a separate context on model `z-ai/glm-5.3-flash`,
read-only. The first returned **FAIL** on `e109a62` with two real overstatements —
a Keychain citation naming a document that never states that boundary, and a
blanket "every accepted Goal" claim that the private-vulnerability-reporting
acceptance contradicts — plus one low ambiguity about implying that the
darwin-only containment suites execute on the Linux runner. All three were fixed;
the fresh pass on `b9ba949` returned **PASS** with every finding closed and no new
findings. The reviewer verified each cited artifact itself rather than trusting
this record.

Hosted runs for both commits succeeded: `35532776558` for `e109a62` and
`35533015720` for `b9ba949`. No budget or manifest change was needed, because this
item adds no tests.

## npm packaging Goal: implementation and independent review (2026-09-20)

Task ID: `20260920-npm-packaging`. Status: **implemented, hosted-verified, and
independently reviewed; owner acceptance pending.** Nothing is published, no version
exists, and no release gate is closed.

### What changed

- **Distribution rename `pi-warden` → `pi-perimeter`** on the distribution surface
  only: `package.json` name plus the lockfile root, `README.md`, `CONTRIBUTING.md`,
  `AGENTS.md`, `SECURITY.md`, the `LICENSE` holder, the distribution row in
  [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md), and the package-lifecycle identity
  assertions (tarball name, install paths, installed manifest).
- **Publishable metadata and safeguards:** `repository`, `homepage`, `bugs`,
  `publishConfig` (`access: public`, `provenance: true`), and
  [docs/PACKAGING.md](docs/PACKAGING.md) — identity, where the former name is retained
  and why, packaged contents, publication safeguards and the release checklist.
  `private: true` stays, so npm refuses to publish; no lifecycle scripts exist; CI never
  publishes; `native/` is out of `files`, so a locally compiled helper cannot enter the
  tarball. The dry run reports 81 files, 325.8 kB packed and 1.1 MB unpacked.
- **Boundary enforcement:** `test/packaging-identity.test.ts` fails on a new old-name
  occurrence outside the declared retention list, on an existing declared file that lost
  the name (absent build artifacts are tolerated), on an unqualified identity mention in
  a distribution file, and on a reverted package identity. Runtime identifiers (the
  helper binary, `PIWARDEN_*`, policy paths, reason prefixes) and the accepted,
  hash-bound contracts and audits keep the former name deliberately; renaming those would
  require re-verifying the containment and network evidence.
- **Changed accepted bytes:** `package.json`, `README.md`,
  `docs/COMPATIBILITY.md`, `test/ci-test-budget.json` (declared count 376 → 382),
  `test/package-lifecycle.test.ts`, and five earlier manifest tests now carry
  `CHANGED_IN_PACKAGING`. No earlier manifest was rewritten;
  [docs/packaging-hashes.json](docs/packaging-hashes.json) binds the current bytes
  (18 entries).

### Hosted evidence

Runs `35534062740` (`ea13956`) and `35534438438` (`abdbf8d`) succeeded with the
assertion reporting `tests 382, pass 328, fail 0, skipped 54` on the hosted Linux
runner. Run `35534002828` (`6a0ccf3`) failed because a clean checkout has no compiled
helper and the identity scan treated a declared-but-absent build artifact as rot; the
scan now tolerates absence, verified by running the suite with the artifacts moved
aside. These are executor-observed results.

### Independent review

Two reviewer passes ran in a separate context on model `z-ai/glm-5.3-flash`,
read-only, and both ran their own checks:

1. Review of `ea13956`: **PASS** with one medium finding — the `files` allowlist
   contained `native/`, so a locally built `native/piwarden-helper` and its build
   manifest really entered the tarball, contradicting the documented guarantee. The
   reviewer reproduced both defeat vectors of the identity test and confirmed no `src/`
   change.
2. Fresh review of the fix delta on `abdbf8d`: **PASS**, the finding closed for real
   (`npm pack --dry-run` shows the C source but neither build artifact, despite both
   existing on disk), no regression, with one low observation recorded without a change:
   the document's packed size reads 325.8 kB while the dry run reproducibly prints
   325.9 kB on the reviewer's run — gzip/version drift at 0.1 kB granularity, already
   framed as a run snapshot.

### Limits and outstanding owner action

- Nothing is published; provenance is not wired up (it needs a release workflow with
  `id-token: write`), and `peerDependencies: "*"` remains a declared, not a verified,
  range.
- The repository has **not** moved: `repository`, `homepage`, `bugs` and the reporting
  route in `SECURITY.md` deliberately still describe `github.com/pi-warden/pi-warden`.
  The owner will transfer it to a personal account renamed `pi-perimeter`; a separate
  post-transfer pass must update those URLs, the PVR route, the local `origin`, any
  remaining hosted references to the old owner/repo, re-check PVR, and re-run the local
  and hosted checks with a fresh review.

## npm packaging Goal: accepted; repository transferred (2026-09-20)

Task ID: `20260920-npm-packaging`. Status: **accepted by the owner on 2026-09-20.**
The acceptance covers the post-transfer revision of this Goal's artifacts: the owner
accepted the packaging Goal as recorded below and then performed the repository
transfer, and the URL corrections the Goal's own contract required were made in the
same pass and reviewed separately. Nothing is published, no version exists, and no
release gate is closed.

**Repository transfer (2026-09-20, owner action).** The repository moved out of the
`pi-warden` organization to the owner's personal account and was renamed:
`pi-warden/pi-warden` → **`hiyotim/pi-perimeter`** (the old URL redirects). The
`pi-warden` organization still exists and no longer holds this project; nothing in the
repository depends on it. Verified against the new location the same day: the repository
is public, private vulnerability reporting is still `{"enabled":true}`, Actions is
enabled and the preserved run history is visible, and the synthetic advisory from the
reporting-channel Goal transferred with the repository (one entry, `triage`,
`published_at: null`, the recorded `created_at` and summary), with access control
unchanged (authenticated list one entry, unauthenticated list empty, the advisory
itself `404`).

**Post-transfer pass.** Canonical surface updated to the new location:
`package.json` `repository`/`homepage`/`bugs`, the published reporting route in
[SECURITY.md](SECURITY.md), the packaging document, and the identity test's expected
URLs. Historical records were not rewritten: the reporting-channel audit gained a
dated post-transfer section and an explicit note that its acceptance-bound
`SECURITY.md` hash is superseded by
[docs/post-transfer-hashes.json](docs/post-transfer-hashes.json), and
[docs/CI-EVIDENCE.md](docs/CI-EVIDENCE.md) keeps its original repository locator with an
appended dated note. Five earlier manifest suites declare the post-transfer change set
they cover (`CHANGED_IN_POST_TRANSFER`) rather than rewriting historical entries; the
declared `linux` CI count rises 382 → 385 for the new manifest suite.

**Hosted and local evidence.** Hosted run `35535376079` on the new repository succeeded
with the assertion reporting `tests 385, pass 331, fail 0, skipped 54`, so GitHub Actions
works after the transfer. Locally, `npm run check` reports typecheck plus 385 tests, 384
pass, 0 fail, 1 declared platform skip, and `npm pack --dry-run` reports
`pi-perimeter@0.0.0`, 82 files, 327.0 kB packed and 1.1 MB unpacked.

**Independent reviews.**

1. The packaging Goal's review of `ea13956` returned **PASS** with one medium finding
   (the `files` allowlist shipped the locally built helper) and the fresh review of the
   fix at `abdbf8d` returned **PASS** with the finding closed and one low observation
   recorded without change.
2. The post-transfer delta review at `c13f8c3` returned **PASS** with one medium finding
   — this record's predecessor in the Continuation block still described the transfer as
   outstanding, which this section fixes — one low finding that the CI evidence record
   had been edited in place instead of appended to (now append-only), and one low
   finding that the reporting-channel audit did not state that its acceptance-bound
   `SECURITY.md` hash was superseded (now stated). The reviewer re-verified the transfer
   facts with `gh`, confirmed every remaining old-organization reference is historical or
   another maintainer's npm entry, and confirmed no earlier manifest was rewritten.

### Declared limits

- Unpublished: `private: true` still blocks `npm publish`, provenance is not wired up,
  and the release checklist in [docs/PACKAGING.md](docs/PACKAGING.md) is not satisfied.
- `peerDependencies: "*"` remains a declared, not a verified, range.
- The Phase 6 release gate stays open: the release-candidate security and documentation
  reviews are still outstanding, and publication remains an explicit maintainer action.

## Selected next Goal and planning decision

On 2026-09-13 the owner authorized a planning-only replacement of the remaining micro-Goal queue with these four implementation Goals:

1. **Configuration authorization** — complete configuration loading, validation, source/operation association, and composition with accepted read/write/edit baselines. **ACCEPTED; UNENFORCED.** Task ID: `20260913-configuration-authorization`.
2. **Pi file gates and scoped approvals** — **ACCEPTED on 2026-09-15; Phase 2 complete within the demonstrated contract and limitations.** Task ID: `20260915-pi-file-gates-scoped-approvals`. The fresh independent PASS covers the corrective-pass artifacts identified below; owner acceptance is the subsequent decision recorded in this transition.
3. **Sandboxed shell with network closed** — **ACCEPTED on 2026-09-19 within the variant-B contract and declared limitations; Phase 3 complete.** Task ID: `20260915-sandboxed-shell-network-closed`. The implementation adds a bounded shell grammar and risk model, single-use fully bound shell approvals, a deny-default Seatbelt profile with closed networking, a native launcher that constructs the child descriptor envelope, per-object workspace projection with identity binding, and descriptor-bound export through the native helper. Evidence, accepted bytes and declared limitations are in [docs/SHELL-GATE-AUDIT.md](docs/SHELL-GATE-AUDIT.md) and the manifest bound above.
4. **Restricted networking and end-to-end security evidence** — **ACCEPTED on 2026-09-20; Phase 4 complete.** Task ID: `20260919-restricted-networking-e2e-evidence`. The implementation adds a per-invocation network broker with destination-exact pinned enforcement on the accepted Goal 3 closed-network shell route, the optional trusted `network` allowlist with strict project-source monotonicity, invocation-scoped destination approvals bound into the shell grant, and the end-to-end evidence. The fresh independent review PASS and the owner acceptance bind to [docs/network-gate-hashes.json](docs/network-gate-hashes.json), SHA-256 `152c7fa25fe2b95ad5d61005e677eabf341ef269884653c879551ad14385b972`; the implementation is commit `6e6c967eb2483d8d8502cd30456c55bd332cfb12`, since pushed to `origin/main` by the 2026-09-20 repository transition. Declared limitations (§12 of the contract) remain the acceptance boundary.

The Goal scopes, acceptance criteria, exclusions, and checkpoints are fixed in [ROADMAP.md](ROADMAP.md). Goal 2 covers all six supported file tools, scoped approvals, complete resource/effect mediation, enforcement-time identity, protected control-plane resources, unknown-tool/shell blocking, and package/compatibility verification in one cycle. Its concrete integration and approval design must be explicit before dependent code and reviewed with the resulting implementation. No permission-widening configuration or weakening of accepted policy/provenance contracts is authorized.

Historical Goal 1-to-Goal 2 transition: it recorded acceptance/selection and authorized replacement of that handoff without implementation, staging, commit, branch change, push, or publication. Its HEAD was `c10e8f384e678c41792937d340d716d25e592e28`; the then-uncommitted Goal 1 snapshot was required input to Goal 2. This historical baseline does not replace the current baseline above.

## Goal 3 architecture approval and autonomous implementation (2026-09-17)

Approved direction: a private workspace projection, per-object authorized and descriptor-bound import, staging-only Seatbelt containment with closed networking, and controlled descriptor-bound export. A small, auditable native component for safe new-file/directory export and construction of the child descriptor envelope is authorized. This is not approval of the earlier direct-workspace Option B: shell children receive no direct access to the original workspace. Policy and approval remain trusted host responsibilities; the helper supplies narrow mechanisms, not authority.

Approved initial scope: macOS 27.0 (26A428), arm64; no broader platform claim. Exclude `.git`, secrets, sensitive/control-plane resources and hard-linked file aliases from projection. No automatic host delete/rename effects. Retain the declared B3 boundary (same-user host writers, including ordinary staging-file tampering) and object-binding rather than permanent pathname-residency semantics. Mount isolation remains UNVERIFIED, not approved as a guarantee; any supported topology must have an explicit bounded contract and evidence before acceptance. No weakening of Goal 2 or policy monotonicity is authorized.

The executor may implement, test, document, consult independent advisors, obtain independent review and fix findings within Goal 3 without asking the owner at routine intermediate steps. Use existing toolchains and an auditable zero-new-runtime-package-dependency design; helper build/package mechanics and bounded parser details are executor design work within this architecture. New dependencies, privileged setup, a different containment class, or reduced security guarantees need an explicit decision. Final owner acceptance remains separate. Goal 4, publication, installation into a real Pi profile, and executor commit/push are not authorized.

Research references: [feasibility report](docs/SHELL-ISOLATION-FEASIBILITY.md), SHA-256 `b1fdad250699c3a2951f3a70afe318bd74a919d13c049d3e086945d4cfb0df96`, and [proposal revision 3](docs/SANDBOX-BACKEND-PROPOSAL.md), SHA-256 `4e10c1d5d787b101da47fe439f8d05de47892871a4b40b6500e9b65ec5a7d3f5`. These are historical research evidence, not a production implementation specification or PASS. The final feasibility bytes differ from its last reviewer snapshot; its helper excerpts are incomplete, and the shown native replacement excerpt has an inconsistent read-only open before truncation. Production behavior must be independently implemented and tested, with complete retained reproduction sources.

Preparation verification: on 2026-09-17, `npm run check` passed typecheck and 213/213 tests (including the manifest); `git diff --check` was clean. Reviewed Goal 2 manifest/audit and research hashes matched. This is a fresh executor-run baseline check, not a new independent implementation review. The owner authorized snapshot and preparation commits; no push was requested. Stash `mac-local-before-migration` is retained.

The sections below record historical authority and evidence at their original checkpoints. Their proposal-only/no-commit restrictions do not override this later approval. Accepted artifact bytes and historical reviews remain preserved; any implementation changes require new evidence rather than reassignment of old PASS verdicts.

## Goal 2 acceptance and Goal 3 proposal authorization (2026-09-15)

The owner explicitly confirmed: accept Goal 2 with its documented limitations and select Goal 3 **only to prepare the sandbox backend/guarantee proposal**, with a mandatory stop before dependencies or implementation. This closes Phase 2 and its demonstrated filesystem hardening items; it does not close Phase 3, broader hardening/release gates, or authorize Goal 4.

Acceptance binds to [docs/file-gate-hashes.json](docs/file-gate-hashes.json), SHA-256 `7aa0e786815118eb45b99d4ce20770aedaaee70470cf88d1970842924a9b0e96`, and the fresh independent PASS in [docs/FILE-GATE-AUDIT.md](docs/FILE-GATE-AUDIT.md), SHA-256 `84351b60a571818009757b73d59863fcc4955ffda5f1112a2981f97597813b35`. All manifest entries were rechecked against actual bytes at this transition and matched. The manifest test is anchored at `83d89f7a5ef5a2775fe3357a2fdfdcf9d2d8726c2423289a4502418535f12a03`. Prior test counts and independent-review results below remain attributed to those runs; this documentation transition does not constitute a new implementation review.

Accepted limitations: macOS direct-file creation and missing-parent creation fail closed and remain unavailable; existing direct targets retain the reviewed identity checks. Linux Class 1 has no recorded runtime execution against these bytes, and hosted CI has not run; no Linux runtime support claim is accepted. Documented traversal, inode/mount, and output-accounting residuals remain as recorded. Shell/network access remains blocked. The acceptance does not waive these boundaries or convert structural review into runtime evidence.

Preserve reviewed code, tests, package/CI files, contracts, audit, and manifest byte-for-byte. Their pending-owner status wording is historical evidence; the later owner acceptance lives here. The pre-transition state/roadmap hashes were `5f7d64fb4e9c079747a2fcb4ccc459419d0317dd421cc5bf1664536efb753c8c` and `9317cdc172c36b4e1364ad7627ee3d6eff389fcee6e1080a76b72d62cf20c410`. This authorized transition changes only STATE, ROADMAP, and the Goal 3 handoff, updating its state/roadmap anchors. HEAD and the pre-existing corrective pass remain intact; no staging, commit, push, installation, or implementation is authorized here.

Next authorized deliverable: a concrete backend/guarantee proposal under the Goal 3 handoff, including current upstream evidence, dependency surface, macOS limitations, shell/environment/approval boundaries, and an effect-test matrix. Proposal preparation may use bounded synthetic probes; no production sandbox dependency or dependent runtime implementation precedes approval.

## Goal 2 corrective-pass evidence (historical pre-acceptance record, 2026-09-15)

**At the pre-acceptance corrective-pass checkpoint, Goal 2 was implemented but NOT accepted.** On 2026-09-15 the owner reproduced a write outside the workspace on the pre-fix bytes: a creation target\'s parent directory was replaced with a symlink between the per-ancestor verification and the final `O_CREAT|O_EXCL|O_NOFOLLOW` open, which protects only the final path component. The pre-finding executor evidence (208/208 `npm run check`, 21/21 `test:gate`) and all earlier review wording were recorded against pre-finding bytes; they do not close this finding and are not an independent review. Acceptance and Goal 3 authority were absent at that checkpoint; the later transition above supersedes that status.

The corrective pass now recorded by the executor in [docs/FILE-GATE-AUDIT.md](docs/FILE-GATE-AUDIT.md):

- keeps descriptor-relative chain execution (creation and existing targets) where the platform supports it, and fails closed on every creation variant where it does not — on macOS (no `/proc/self/fd`, `/dev/fd` not traversable) existing-target effects bind through an `O_NOFOLLOW` open verified against the plan's dev/ino, pre-approval size/timestamp, and `nlink === 1`;
- anchors external-target execution plans at the filesystem root (the prior plan built external chains relative to the workspace root and produced parent-relative components);
- classifies directory entries in controlled `find`/`grep` before emission or descent, so sensitive/secret/protected directory names and subtrees are withheld;
- refreshes the contract ([docs/FILE-GATE.md](docs/FILE-GATE.md)), audit ([docs/FILE-GATE-AUDIT.md](docs/FILE-GATE-AUDIT.md)), and hash manifest ([docs/file-gate-hashes.json](docs/file-gate-hashes.json)) together; `npm run test:manifest` matches the working tree again.

Fresh executor evidence recorded locally on macOS (Node v26.8.1, isolated fixtures): `npm run check` PASS 213/213, `npm run test:gate` PASS 26/26, `npm run test:controlled` PASS 5/5, `npm run test:configuration` PASS 11/11, `npm run test:package` PASS 1/1, `npm run test:manifest` PASS, and `git diff --check` clean. These are executor results, not reviewer evidence.

The fresh independent FULL review was then performed by a separate reviewer agent on 2026-09-15 (macOS, read-only, fresh context, no prior review evidence reused) against the exact enforcement/test/contract hashes recorded in [docs/FILE-GATE-AUDIT.md](docs/FILE-GATE-AUDIT.md). **Verdict: PASS with no blocking findings.** The reviewer rechecked the working-tree hashes, ran `npm run check` (typecheck plus 213/213 registered scenarios) and `git diff --check` itself, and confirmed the working tree did not change during the review. Limitations/follow-ups it reported: the execute-time descriptor-relative (Linux `/proc/self/fd`) path cannot run on macOS and was verified structurally, with a follow-up to exercise it on Linux or hosted CI, and no hosted CI run exists for these bytes. Non-blocking observations (no defect in the reviewed guarantee): the `ls` secondary guard compares entry count against the byte constant; UTF-8 byte accounting in the output cap is approximate; the `consumeGrant` helper is not wired into the runtime (single-use is enforced and tested through the runtime binding map); path-string directory descent remains the already-declared bounded traversal residual. These findings were independent review evidence, not owner acceptance; the subsequent owner decision is recorded above.

On 2026-09-15 the owner authorized creating branch `codex/mac-migration-snapshot`, one working-tree snapshot commit with this honest Goal 2 status, and a push to the existing GitHub remote for continuation on macOS. No merge, release, npm publication, Goal 3 start, or weakening of security/release gates is authorized by this snapshot.

## Goal preparation and provenance

**Goal 2 implementation note (executor record, 2026-09-15; superseded for acceptance by the corrective-pass status section above):** the working tree contains a local implementation of `20260915-pi-file-gates-scoped-approvals`, recorded by the executor at the time as corrective-pass complete: enforcement under `src/gate/` (including `bound-execution.ts` descriptor identity binding after the owner-reported symlink-swap probe), scoped approvals under `src/approvals/`, protected control-plane under `src/policy/control-plane.ts`, the contract in [docs/FILE-GATE.md](docs/FILE-GATE.md), and the provenance record in [docs/FILE-GATE-AUDIT.md](docs/FILE-GATE-AUDIT.md) with sha256 manifest [docs/file-gate-hashes.json](docs/file-gate-hashes.json). Machine evidence recorded for this run on Linux (after the post-review fix round: approval-window object-substitution refusal and hard-link alias refusal): `npm run check` PASS (typecheck plus 208/208 registered scenarios), `npm run test:gate` PASS 21/21, `npm run test:package` PASS (real isolated npm pack/install/uninstall cycle with temporary fixture dirs and cache, no real home/profile/credential or repository install touched), `npm run test:manifest` PASS (recorded artifact hashes match the final working tree), and `git diff --check` clean; shell and network remain blocked, and no Phase 3 containment exists. Owner acceptance/Phase 2 closure is pending; Goal 2 is NOT owner-accepted and Goal 3 is not authorized. Goal 1's acceptance record and audit evidence are unchanged, and that implementation round performed no staging, commit, or push.

- The completed Goal 1 handoff, Task ID `20260913-configuration-authorization`, anchored execution at `c10e8f384e678c41792937d340d716d25e592e28` plus the recorded planning files. Its SHA-256 before authorized replacement was `86a1ae0735e4c3a0f8f642a8dcff305bedd0b65b97ff105d63d3b0acb053728f`. The active handoff path subsequently held Goal 2 and now holds Goal 3; it is not evidence of the old execution contract.
- [docs/OPERATION-POLICY-CONTRIBUTIONS.md](docs/OPERATION-POLICY-CONTRIBUTIONS.md) began as a pre-existing untracked draft. Goal 1 reconciled it with the authority contract and concrete [configuration authorization contract](docs/CONFIGURATION-AUTHORIZATION.md); the exact reviewed snapshots are included in Goal 1 acceptance.
- The accepted [authority contract](docs/MONOTONIC-POLICY-AUTHORITY.md), all accepted Goal records, audit artifacts and hashes remain unchanged. Its deferred-item list remains a list of design obligations; the one-separate-Goal-per-item scheduling requirement is superseded solely by the new roadmap. Permission limits, provenance, fail-closed behavior, and review requirements are not superseded.
- Older transition prompts and [archived handoffs](docs/handoffs/20260911-resource-full-result-assertions.md) remain historical evidence, not a future execution queue. Historical statements below that no next Goal was selected describe their original checkpoints; the current selection above controls future planning.

The completed Goal 1 handoff recorded four planning-file anchors observed at execution start; all matched. Goal 1 implementation files are incremental to that dirty-worktree baseline. Next preparation must preserve and identify the now-accepted, uncommitted implementation rather than treating HEAD alone as the accepted state. No pre-existing implementation change was reset or discarded.

## Accepted configuration authorization Goal

`20260913-configuration-authorization`: **GOAL ACCEPTED on 2026-09-15.** Owner acceptance is recorded from the request to proceed to Goal 2 after the independent PASS and the corrected provenance report. The first review's cross-workspace snapshot-substitution finding was fixed by private canonical-workspace binding, with a complete-result regression and independent probe. The [audit report](docs/CONFIGURATION-AUTHORIZATION-AUDIT.md), SHA-256 `4e9917b5192a5e687bc7ded4ba4521e246dcf900692618ea9a4f002ea45db2f2`, records the final reviewed source/test/contract/CI hashes and the independent current-contract review.

The contract's earlier `54628f8c…` hash was traced to its previous status line; restoring only that line reproduced the old hash. The full current contract, hash `5980e8bb157aad5a8574471377b992741ae1d374ae23088cafdbc246f22db622`, received a fresh independent read-only PASS. All other seven manifest hashes remained unchanged. This acceptance preserves the audit and reviewed documents byte-for-byte; their pending-owner wording describes the pre-acceptance snapshot, and this canonical record supplies the later owner decision.

Reported reviewer evidence: `npm ci --ignore-scripts` PASS with 0 reported vulnerabilities, `npm run test:configuration` PASS, `npm run check` PASS for typecheck and all eight test files, whitespace/diff checks PASS, and the independent cross-workspace substitution probe PASS. During this transition, the audit SHA and all eight reviewed artifact hashes were checked against the actual files; the index was empty and HEAD matched. No code/test/CI change occurred, so implementation tests and independent code review were not repeated. These earlier test results are attributed to the audit, not new runs here.

Hosted GitHub Actions has not run; acceptance covers the implemented workflow, inspected configuration, and local checks, not a hosted execution result. Trusted-user-root authority still comes from the trusted caller; loading is not general TOCTOU protection. `src/index.ts` remains unchanged and non-enforcing. Phase 1 is complete; Phase 2 and later gates remain open, and no public-beta or v1 acceptance is implied.

## Accepted history

The following acceptance records are preserved from the preceding checkpoint. The new scheduling decision neither reopens accepted Goals nor attributes new execution or review evidence to them.

## Accepted work and evidence

- The provenance readonly contract was accepted at the prior checkpoint: successful resolver issuance, private WeakSet membership, frozen runtime objects, and readonly `ResolvedPath` fields remain required.
- The GitHub/GCloud conventional `.config` matcher correction is present with regression coverage. This checkpoint does not infer a separate historical acceptance verdict for that Goal.
- `20260910-compound-env-template-classification`: **GOAL ACCEPTED** following independent review, explicitly confirmed by the owner. Complete dot-delimited `example`, `sample`, `template`, and `dist` markers classify as sensitive template evidence, without suppressing stronger evidence on either path identity or in another rule.
- The compound-template independent review passed resource tests 44/44, full tests 86/86, typecheck, `git diff --check`, and 69/69 additional adversarial cases. It verified that implementation increment against its handoff baseline.
- `20260910-generic-key-sensitivity`: **GOAL ACCEPTED** at this checkpoint after the independent implementation review and closure of its sole test-contract finding. That review passed 55/55 resource tests, 97/97 total tests, typecheck, and 45/45 independent full-result probes. The reviewer subsequently replaced the affected `private.key` presence-only assertion with a complete literal comparison, as authorized by the owner, and reran 55/55 resource tests, 97/97 total tests, typecheck, and `git diff --check`. This final correction changed only the test; it was not a separate independent review of new production code.

## Architectural checkpoint

`20260911-resource-full-result-assertions`: **GOAL ACCEPTED** based on the fresh independent read-only review supplied by the owner. Reported evidence: all criteria 1–8 verified; exactly six incremental hunks limited to the three targeted tests and unused imports/interface; all fixtures and 68 other tests byte-identical; 22 table paths and all 15 reasons preserved; 28/28 independently derived classifications matched; 69/69 resource tests, typecheck plus 111/111 full tests, and whitespace checks passed; all 11 isolated mutations caused failures in the migrated tests. No defects were reported. During acceptance, HEAD/branch, production source hashes, and tracked-diff hash `d25c22fe7710af4be5099b1ea2a86e78c59ebc27abeb94709f4598a3f2e36ae6` were rechecked against the handoff. The test and mutation results are attributed to the supplied independent review, not a repeated audit during this state-only update.

`20260911-ssh-private-key-backups`: **GOAL ACCEPTED** following independent review. Resource tests passed 69/69, complete tests 111/111, typecheck and `git diff --check` passed, and the reviewer independently exercised 214/214 literal-result cases. Source outside the SSH change, the README outside its SSH addition, other tracked changes, Phase 1A, and this state file matched the preceding checkpoint. The missing historical `QWEN_TASK.md` was disclosed separately. These are preceding-review results, not new test runs during handoff preparation.

Keep the current architecture: raw path → successful Phase 1A result → synchronous path classifier → future policy engine. Canonical and normalized lexical evidence are evaluated independently; maximum sensitivity wins. Classification is content-blind and does not grant permission. Workspace membership cannot override secret evidence. Provenance protects trusted-module issuance/integrity, not hostile same-process code or filesystem TOCTOU.

General full-result assertions are accepted without changing classification semantics. Documentation consistency review and the final independent audit passed; the owner has accepted Phase 1B. The roadmap classification checkbox is closed. Phase 1 as a whole remains incomplete.

## Accepted key-extension contract

Generic terminal `.key` extensions now classify as `sensitive`; `.p12`/`.pfx` remain `secret`. Stronger canonical/lexical or unrelated rule evidence continues to dominate.

Architectural contract for this Goal: retain category `private-key` and reason `private-key-extension`. Emit at most one match for this rule group, in its existing order, with the maximum sensitivity contributed by either identity and the union of matching evidence in canonical-then-lexical order. A `.key` alias to a `.p12`/`.pfx` target (or the reverse) therefore remains one `secret` extension match with both evidence sources. Do not introduce a public reason or change unrelated merging semantics.

This corrects a filename-confidence distinction; it does not make `.key` files safe to read or weaken a future default-deny policy for sensitive resources. Generic `.pem` behavior remains sensitive and unchanged.

## Accepted SSH backup contract

The existing `ssh-private-key-name` rule now recognizes exact conventional basenames `id_rsa`, `id_dsa`, `id_ecdsa`, and `id_ed25519` followed by exactly one of `.bak`, `.backup`, `.old`, or `~`. Unsuffixed names, ASCII case folding, category/reason/sensitivity, rule order, and canonical/lexical evidence behavior are preserved.

The selected suffix set is deliberately bounded: no repeated/chained suffixes, arbitrary date suffixes, substring matching, or public-key variants. A public-looking path may still receive secret evidence from its genuine private-key symlink target; exclusion applies per identity, not as a global override. This is a filename convention, not complete backup or content detection. No architectural expansion is needed.

## Final documentation review and independent audit

On 2026-09-11, the owner requested continuation with documentation consistency review and the final independent audit remaining. The documentation pass corrected current-status, resolver-fixture, and GitHub/GCloud scope wording in five documents; no production or test files changed. A separate read-only reviewer then returned **PASS** for the accumulated Phase 1B implementation, tests, and corrected documentation, with no remaining findings. See [docs/PHASE-1B-AUDIT.md](docs/PHASE-1B-AUDIT.md) for scope, source anchors, evidence, environment, and limitations.

Fresh independent evidence: 69/69 resource tests; typecheck and 111/111 full tests; whitespace checks; 92/92 independent synthetic probes (74 complete classification results, 17 provenance/freeze attacks, 1 ENOTDIR case); and expected compiler rejection of six readonly assignments and one missing-brand structural value. The primary agent inspected test/probe logs and rechecked unchanged source/test hashes. These are the independent reviewer's test runs, not duplicate primary-agent runs.

## Phase 1B acceptance and commit boundary

Final owner acceptance was recorded on 2026-09-11 in response to the proposed next steps. Only the Phase 1B classification checkbox is closed. The separately authorized Git transition created the Phase 1B commit `feat: add audited path-only resource classification` (`e9b2f16cafe79421c8cf59f1d3fc028379888386`): exactly the 15 candidate files were staged from the verified patch, all committed blob hashes matched the manifest, `npm run check` passed (typecheck and 111/111 tests), `git diff --cached --check` passed, and the index was empty afterward. Local `main` was fast-forwarded to that commit without a merge commit. No push was performed.

A separate 15-file Phase 1B commit candidate was prepared before next-Goal planning edits; see [docs/PHASE-1B-COMMIT.md](docs/PHASE-1B-COMMIT.md). It excludes local artifacts and next-Goal planning. It is preserved as the historical description of the snapshot that was committed.

## Accepted read-path Goal

`20260911-read-path-default-decisions`: **GOAL ACCEPTED.** The first decision primitive is limited to a single read path: sensitive/secret deny, ordinary missing target denies, ordinary existing canonical in-workspace target allows, ordinary existing external target asks. Invalid provenance and unsupported operations deny before those rules. It uses existing resolver/classifier contracts and introduces no enforcement or configurable exceptions.

Before implementation, the separately prepared [Git transition prompt](docs/BRANCH-TRANSITION.md) was completed: the exact accepted Phase 1B snapshot was committed, local `main` was fast-forwarded, `codex/read-path-default-decisions` was created, and the handoff baseline was refreshed to the actual commit. The transition task did not begin implementation and this checkpoint does not authorize an automatic transition into it; implementation starts only under a separate explicit instruction. The implementation Goal itself is unchanged.

The fixed design is [docs/READ-PATH-DECISIONS.md](docs/READ-PATH-DECISIONS.md), the executed contract is [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md), and the independent verdict is recorded in [docs/READ-PATH-DECISIONS-AUDIT.md](docs/READ-PATH-DECISIONS-AUDIT.md). The review found no defects. It passed 8/8 focused tests, typecheck and 119/119 complete tests, whitespace checks, and 16/16 independently designed assertions. Source and test scope remained exactly `src/policy/decisions.ts` and `test/decisions.test.ts`; all five baseline anchors were unchanged.

The roadmap decision checkbox remains open because this Goal covers only one read path and does not complete the structured decision engine. Broader operation policies and monotonic configuration authority remain Phase 1 work. No Pi integration, installation, push, or Phase 2 work is authorized by this checkpoint.

The accepted Goal commit contains exactly ten reviewed files: the decision source and tests, its fixed design and independent audit record, the executed handoff, the architecture/state updates, and preserved transition/handoff history. The commit excluded `.gitignore`, `.qwen/`, and `.opencode-permission-canary.txt`. The index was empty after commit. Local `main` was fast-forwarded to this commit without a merge commit. No push was performed.

## Accepted write-path Goal

`20260911-write-path-default-decisions`: **GOAL ACCEPTED after independent security review PASS with no findings.** The second decision primitive adds one fixed write path while preserving the accepted read function byte-for-byte: sensitive/secret deny everywhere, ordinary inside targets allow whether existing or missing, ordinary external targets ask whether existing or missing, and invalid provenance or unsupported operations deny first. Resolver issuance is checked before any property access, invalid resource takes precedence over invalid operation, the operation comparison is exact and non-coercing, classification is internal with no fallback, and membership uses the issued canonical relation. Independent evidence: focused write tests 9/9, accepted read tests 8/8, `npm run check` typecheck and 128/128 tests, whitespace checks, and 11/11 independent probes. The review verified the additive 59-line write hunk and confirmed the accepted read source and the other five baseline anchors were unchanged. The independent verdict and hashes are recorded in [docs/WRITE-PATH-DECISIONS-AUDIT.md](docs/WRITE-PATH-DECISIONS-AUDIT.md). The accepted Goal commit contains exactly the six reviewed files, excludes `.gitignore`, `.qwen/`, `.opencode-permission-canary.txt`, and the transition prompt, and was created without push. Local `main` was fast-forwarded to the commit without a merge commit. The roadmap decision checkbox remains open because write covers only one of several operation paths.

## Accepted edit-path Goal

`20260911-edit-path-default-decisions`: **GOAL ACCEPTED after independent security review PASS with no implementation defects.** The independent review was performed directly by model `opencode-go/deepseek-v4.1-flash` without a subagent: manual inspection plus 11 targeted mutations in a separate temporary project copy, with all handoff checks rerun. The reviewer was not read-only overall; it modified only `test/edit-decisions.test.ts`, adding `["edit"]` and `new String("edit")` to the invalid operations as coercion defense-in-depth. No production file was changed by the reviewer.

Verified behavior: resolver issuance is checked before any resource property access; invalid resource takes precedence over invalid operation; the operation comparison is exact and non-coercing; classification is internal with no fallback; `secret` and `sensitive` deny everywhere and precede the missing-target and membership rules; every ordinary missing target returns `DENY/EDIT_TARGET_MISSING`; ordinary existing canonical inside targets allow and ordinary existing external targets ask. A classifier error propagates structurally because `evaluateEditPath` does not intercept it; runtime provocation through genuine resolver issuance is unreachable and recorded as a check limitation, not a defect.

Independent evidence: focused edit tests 9/9, accepted read tests 8/8, accepted write tests 9/9, `npm run check` typecheck and 137/137 tests, whitespace checks, and an empty index. The primary model re-ran these checks after the review report and observed the same focused/full results, hashes, anchors, clean whitespace, and empty index. The additive 64-line edit hunk preserved the accepted read and write source byte-for-byte and left the other six baseline anchors unchanged. The accepted Goal commit contains exactly the seven reviewed files as `139fa4abdff13a1240aa6488cb23e70bd7f80d15` (`feat: add default edit-path decisions`), excludes `.gitignore`, `.qwen/`, `.opencode-permission-canary.txt`, and both transition prompts, and was created without push; local `main` was fast-forwarded to it without a merge commit.

## Accepted monotonic policy authority contract

`20260911-monotonic-policy-authority-contract`: **GOAL ACCEPTED after independent security/architecture review PASS with no findings.** The only Goal artifact is [docs/MONOTONIC-POLICY-AUTHORITY.md](docs/MONOTONIC-POLICY-AUTHORITY.md), SHA-256 `6b3333dbb9415e0b58aa14eaaccd90020820b825103e47c3597c7281e676c87d`. It separates built-in defaults, trusted user/global configuration, project-controlled configuration, and future scoped approvals; defines the complete monotonic join; keeps `SANDBOX` orthogonal; specifies fail-closed interpretation; and lists deferred implementation choices without silently selecting them.

Independent evidence: all ten handoff criteria passed; all nine outcome combinations and the requested adversarial cases were inspected; document hash and baseline matched; internal links resolved; CR, trailing whitespace, tabs, BOM, and placeholder scans were clean; `git diff --check` passed; source/tests matched accepted anchors; and the index was empty. Informational observations about a non-exhaustive cross-reference, intentionally stale pre-acceptance checkpoint text, and `git diff --check` not covering untracked files were not defects. See [docs/MONOTONIC-POLICY-AUTHORITY-AUDIT.md](docs/MONOTONIC-POLICY-AUTHORITY-AUDIT.md). This acceptance does not complete the roadmap authority item or authorize a runtime guarantee.

The acceptance commit contains nine project files: the reviewed contract and audit, architecture/state/roadmap updates, the executed handoff, both preserved transition prompts, and local-artifact ignore rules. The `.qwen/` directory and permission canary remain local and untracked. The accepted contract is the baseline for the next bounded pure-policy Goal.

## Accepted monotonic authorization join Goal

`20260912-monotonic-authorization-join`: **GOAL ACCEPTED after fresh independent security review PASS with no findings.** The accepted `joinAuthorizationOutcomes` primitive implements the complete pairwise join under `ALLOW < ASK < DENY`, fails closed to `DENY` for invalid direct runtime inputs, and is idempotent, commutative, and associative. It uses only exact, non-coercing primitive comparisons and introduces no side effects, dependencies, reason codes, configuration semantics, approvals, containment, enforcement, or integration.

The reviewer detected that an earlier independently reviewed worker artifact did not match the later files present in the selected branch. That earlier verdict was not reused. The exact selected-branch hashes received a fresh read-only review: focused tests passed 8/8, typecheck and all 145 registered scenarios passed, 90/90 independent adversarial checks passed, whitespace checks were clean, and all pre-existing tracked files matched handoff HEAD `f7edf7e2af4c92fbe4369705b1b6f0c44d8f2ad2`. See [docs/MONOTONIC-AUTHORIZATION-JOIN-AUDIT.md](docs/MONOTONIC-AUTHORIZATION-JOIN-AUDIT.md).

This Goal supplies only a pairwise primitive. It does not ensure that every applicable policy contribution is found or joined, determine which decisions are affected by invalid configuration, or implement configuration loading. The roadmap authority item remains open. No next Goal is selected by this checkpoint; replacing [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md), staging, committing, pushing, integration, or phase advancement requires an explicit next action.

## Accepted monotonic authorization merge Goal

`20260912-monotonic-authorization-merge`: **GOAL ACCEPTED after fresh independent manual review PASS with no defect in the exact Goal hashes.** The accepted `mergeAuthorizationOutcomes` primitive completes N-ary monotonic composition for contributions a trusted caller has already judged applicable: with zero contributions it returns the validated baseline unchanged, the strictest outcome wins under `ALLOW < ASK < DENY`, the result equals the accepted pairwise fold for all valid combinations, and contribution order and grouping do not matter. Invalid direct inputs fail closed to `DENY` using exact, non-coercing comparisons without invoking coercion hooks, getters, proxy traps, iteration, or attacker-controlled callbacks. `SANDBOX` is not an authorization outcome, and the module adds no runtime dependency, side effect, logging, reason code, approval, containment, configuration, or Pi behavior.

A P1 on the earlier `for...of` contribution traversal, which resolves `Array.prototype[Symbol.iterator]`, was resolved before the accepted hashes were frozen by iterating only the own `length` and numeric indices of the engine-created rest array. The accepted suite retains replaced/getter/deleted iterator regression tests, and an acceptance-time red-to-green probe confirmed the earlier shape invokes the hostile iterator while the accepted code does not (zero iterator calls, no throw).

Evidence: the reviewer completed a full manual read of production code and tests but could not run npm or hash commands; the executor's machine checks before and after review and the acceptance-time re-runs observed focused merge tests 16/16, authority tests 8/8, typecheck PASS, `npm run check` 161/161 registered scenarios, `git diff --check` PASS, matching exact hashes, and the independent hostile-iterator probe with zero calls. The three pre-existing documentation changes were committed separately as `108f98e1e786bd9f40c8c2c691650f7012292035` before the Goal commit and were not Goal artifacts. See [docs/MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md](docs/MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md).

The primitive covers only the join of already-associated contributions. It does not load, parse, or validate configuration; identify policy sources; associate a contribution with an affected decision; select affected decisions; resolve precedence; store or consume approvals; enforce policy; or integrate with Pi. The roadmap authority item and the Phase 1 release gate remain open. No next Goal is selected by this checkpoint; replacing [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md), staging, committing, pushing, integration, or phase advancement requires an explicit next action.

## Phase 7 step 4 snapshot authorization (2026-09-24)

Task ID: `20260924-v1-independent-audit`. The OWNER authorized commit+push of ONLY this Goal's snapshot in-session 2026-09-24 when the handoff Verification passes (user instruction; overrides the handoff's no-push line for this snapshot only). NO acceptance is claimed here, NO gate closure, NO publication: acceptance of the "Complete an independent audit appropriate to the claimed boundary" item, the Phase 7 gate decision, and publication remain separate explicit maintainer decisions owned by later sessions.
