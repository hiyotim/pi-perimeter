# Roadmap

This roadmap uses release gates, not dates. A phase is complete only when its listed behavior is implemented, reviewed, tested, and documented without overstating guarantees.

## Remaining implementation plan

Planning decision: 2026-09-13; acceptance/selection updates: 2026-09-15, 2026-09-19, and 2026-09-20; architecture approval: 2026-09-17. The four-Goal plan is unchanged. Goals 1–4 are accepted; Phases 1–4 are complete within their demonstrated guarantees and declared limitations. Goal 4 was accepted by the owner on 2026-09-20 after a fresh independent review PASS binding to [docs/network-gate-hashes.json](docs/network-gate-hashes.json); its implementation is local commit `6e6c967eb2483d8d8502cd30456c55bd332cfb12` on `codex/mac-migration-snapshot`, not pushed. Goal 3 acceptance is bounded by the variant-B contract, target platform and limitations recorded in [STATE.md](STATE.md) and the shell gate audit; it does not add descendant-termination, atomic-tree-snapshot, B3 or mount-isolation guarantees. The phase checklist remains the acceptance ledger, not a second queue of implementation Goals.

Each Goal has one technical outcome and includes its related contract decisions, implementation, regression tests, documentation, and verification. These are internal scope/checklist items, not separate Goals. Work proceeds through one implementation cycle, machine checks, an independent review of the final snapshot, and acceptance. Findings and their fixes stay within that Goal; relevant changed artifacts require fresh checks and review before acceptance. No PASS transfers to different source/test hashes. Review evidence must distinguish reviewer-run checks from executor-run checks.

This scheduling decision supersedes only the older requirement to create a separate Goal for every deferred item, including section 10 of the accepted [authority contract](docs/MONOTONIC-POLICY-AUTHORITY.md). Its security semantics, provenance requirements, explicit design decisions before dependent implementation, and independent-review requirements remain binding. The former [operation contribution draft](docs/OPERATION-POLICY-CONTRIBUTIONS.md) was reconciled, reviewed, and accepted within Goal 1; it is not an additional documentation Goal. [STATE.md](STATE.md) records handoff provenance and historical planning records.

Across all Goals, preserve the [security invariants](AGENTS.md), [trust boundaries](ARCHITECTURE.md), isolated fixtures, full literal assertions where applicable, and regression coverage for discovered bypasses. Adversarial tests belong to the affected Goal; targeted mutation/probe evidence is required where needed to establish the claimed invariant, not as a separate Goal per test. Independent implementation review and owner acceptance remain distinct. Existing maintainer decision gates for authority, dependencies, approval scope, and platform guarantees remain in force; grouping tasks does not silently settle them or require a new Goal for routine work within the selected scope.

### Goal 1: Configuration authorization

**Status:** accepted on 2026-09-15; unenforced. Scope and criteria below are retained as the completed Goal's contract.

**Outcome:** complete the authority chain from configuration input to effective decisions for the accepted `read`, `write`, and `edit` operations, without Pi enforcement.

**Scope/checklist:**

- Resolve the operation contribution contract and implement validated, immutable in-memory values with safe provenance, exact operation association, and distinct absence/invalid states.
- Define and implement one minimal versioned declarative schema and parser, one trusted user/global source and one project source, their locations and loading lifecycle, source identity, composition, and configuration-failure domains. Validate source identity through trusted loading context, never project-supplied authority labels or an unchecked pathname.
- Compose all applicable restrictions with the accepted baseline decisions and merge; provide accurate structured decision/reason/source information without secret values.
- Keep deterministic interpretation and decisions in the policy layer; isolate filesystem loading in a narrow trusted adapter. Loading must not introduce Pi, process, approval, or sandbox side effects into pure policy evaluation.
- Add isolated end-to-end configuration/decision regressions, update affected current-status documentation, and add GitHub CI with reproducible policy checks and dependency verification.

**Scope bounds:** operation-scoped restrictions only, one source of each role, and no permission-widening configuration. No path selectors, multiple-global-source framework, migrations, executable configuration, standing exceptions, delete/rename APIs, approvals, tool gates, shell, or network implementation. Exact representation/API and loading choices are design work inside this Goal and must be documented before dependent code; they must preserve the accepted authority contract. Broader scopes are not prerequisites for Phase 1 acceptance.

**Acceptance:**

- Tests exercise temporary configuration files through loading, validation, association, baseline evaluation, and complete effective results for all three operations. All applicable restrictions reach composition; weaker contributions cannot lower the baseline or another restriction.
- Absent optional configuration retains defaults. Unknown keys/versions/operations, malformed or duplicate/ambiguous entries, invalid supplied values, and loading errors fail closed for every decision consuming the invalid source. An uncertain failure domain is never treated as unaffected access. Missing required information denies.
- Project-controlled data, aliases, or symlinks cannot acquire trusted-source authority, redefine the workspace, replace classification, or transfer resolver provenance. Accepted policy inputs cannot be mutated after validation. Validation on protected runtime input paths does not invoke hostile getters, proxy traps, coercion, iteration, or callbacks.
- Existing path, classification, decision, join, and merge regressions remain intact; `npm run check`, relevant adversarial checks, and documentation/diff checks pass. No implementation or documentation claims Pi enforcement.

**Checkpoint/review:** independent security/architecture review of the complete configuration authority chain and its exact artifacts, then owner acceptance. Only demonstrated behavior closes the Phase 1 authority item and release gate. Goal 2 depends on that acceptance.

### Goal 2: Pi file gates and scoped approvals

**Status:** accepted by the owner on 2026-09-15 after the corrective pass and fresh independent FULL PASS; Phase 2 complete within the demonstrated contract. Task ID: `20260915-pi-file-gates-scoped-approvals`. The accepted bytes fix the owner-reproduced ancestor-symlink-swap creation escape by descriptor-relative execution or fail-closed refusal, external-plan anchoring, and directory classification. macOS direct-file creation remains unavailable; Linux Class 1 lacks runtime evidence for this snapshot and hosted CI has not run. Other documented residuals remain bounded. [STATE.md](STATE.md) binds acceptance to the unchanged audit/manifest; no OS containment, network access, or broader platform guarantee is implied.

**Outcome:** every supported Pi file operation uses central authorization, matching approval where needed, and controlled execution.

**Scope/checklist:**

- Re-verify current upstream Pi APIs and record supported versions; gate `read`, `write`, `edit`, `grep`, `find`, and `ls`, with explicit coverage for unknown/new tools.
- Define the complete resource/effect set of those operations, including directory traversal and missing creation targets; implement enforcement-time identity checks or controlled replacements for file tools.
- Implement precise approval UX and protected state with exact operation/resource/use/time/session boundaries, expiration and revocation. Configuration cannot create approval or lower an `ASK`.
- Protect host control-plane resources, including Pi credentials, authoritative configuration, and approval state. The current path-only classifier is not a complete inventory of those resources.
- Integrate filesystem race/adversarial coverage and non-secret status reporting. Verify package contents, installation and rollback using isolated Pi profiles, publication safeguards, and Pi/Node compatibility.

**Acceptance:**

- Every supported tool has integration evidence for permitted, approval-required, denied, and failure paths. A directory approval does not authorize arbitrary descendant reads or external symlink traversal. Filtering output after unauthorized access is not enforcement.
- Approval satisfies only the matching effective `ASK`, never `DENY` or containment. Missing UI, timeout, malformed response, replay, expiration, or material target/operation/session change blocks execution.
- Execution is demonstrably bound to the checked resource. A repeated `realpath` is not presented as eliminating TOCTOU; unsafe unsupported variants are blocked. Hard-link, mount, and other object-identity limits are explicitly tested/bounded without claiming unsupported isolation.
- Missing coverage fails closed. Unknown tools and model/user shell paths remain blocked until integrated and accepted in Goal 3. Policy regressions, actual Pi integration tests, package smoke tests, and hostile filesystem/approval tests pass without using real profiles or credentials.

**Checkpoint/review:** independent review of the complete host file execution and approval path, then owner acceptance closes Phase 2 and the demonstrated filesystem hardening items. This does not establish subprocess containment. Goal 3 depends on this acceptance.

### Goal 3: Sandboxed shell with network closed

**Status:** **accepted by the owner on 2026-09-19 within the documented variant-B contract and limitations; Phase 3 complete.** Task ID: `20260915-sandboxed-shell-network-closed`. The accepted design is private workspace projection + staging-only Seatbelt + per-object import/export + minimal native creation/descriptor-envelope component: bounded shell grammar and policy, single-use fully bound shell approvals, deny-default Seatbelt containment with closed networking, a constructed descriptor envelope, per-object import with identity binding, and descriptor-bound controlled export. The full regression/effect evidence is in [docs/SHELL-GATE-AUDIT.md](docs/SHELL-GATE-AUDIT.md) against [docs/SHELL-GATE.md](docs/SHELL-GATE.md), with exact accepted identities recorded in [STATE.md](STATE.md). Initial target: macOS 27.0 (26A428), arm64. No direct original-workspace shell access, `.git` projection, host delete/rename, new runtime package dependencies, or Goal 4 work is part of this accepted snapshot. B3 remains declared and mount guarantees remain UNVERIFIED; unsupported topologies fail closed. The outcome and acceptance criteria below are retained as the accepted contract.

**Outcome:** model and user shell commands execute only inside verified OS containment, with a constructed environment and no permitted network access.

**Scope/checklist:**

- Backend evaluation and owner architecture selection are complete for the approved projection design. Implement its bounded contract; do not restart candidate research or adopt a different backend without a material blocker and owner decision.
- Implement the adapter, initialization/failure handling, and one controlled route for model `bash`, user `!`/`!!`, and subprocesses.
- Construct a minimal child environment and enforce filesystem restrictions protecting credentials and Pi/control-plane state; verify inheritance of restrictions by descendants.
- Adopt an auditable bounded parser/AST strategy and conservative policy for destructive, privilege, credential, system, publish/deploy, and unknown shell behavior. Exercise nested shells, substitutions, redirections, sourced scripts, and subprocesses as part of this Goal.
- Verify closed networking, filesystem bypasses, and relevant Keychain/brokered-service behavior with fake data. Record actual macOS evidence and platform limitations; extend the compatibility matrix without implying Linux support.

**Acceptance:**

- An ordinary local build/test workflow succeeds in actual containment on the declared macOS target. Missing, unsupported, or failed containment blocks every shell entry path; no unrestricted fallback exists.
- Descendants retain restrictions. Fake credentials and protected filesystem targets are inaccessible, and secret host environment data is not inherited. Tests prove effects, not merely successful initialization messages.
- Network remains closed, including relevant local/proxy/alternate routes in the claimed boundary; network approvals cannot open it in this Goal.
- Dangerous and unsupported shell forms have explicit conservative outcomes; regex-only classification is never the security boundary. Platform-tagged regression and hostile tests substantiate each guarantee; unavailable target-platform evidence blocks acceptance.

**Checkpoint/review:** the backend/guarantee architecture checkpoint is satisfied within the 2026-09-17 approval. Independently review the finished shell execution path and exact evidence. Owner acceptance closes Phase 3 and its demonstrated Phase 5 items. Goal 4 must not open network access before this checkpoint passes.

### Goal 4: Restricted networking and end-to-end security evidence

**Status:** **accepted by the owner on 2026-09-20; Phase 4 complete.** Task ID: `20260919-restricted-networking-e2e-evidence`. The accepted design is the per-invocation network broker on the Goal 3 closed-network shell route: destination-exact pinned enforcement (host-side resolution, public-address validation, no re-resolution at tunnel time), the optional trusted `network` allowlist with strict project-source monotonicity, invocation-scoped destination approvals bound into the single-use shell grant, and exactly one host-generated broker-endpoint rule in the Seatbelt profile. The fresh independent review PASS (2026-09-20, no blocking findings) and the owner acceptance bind to [docs/network-gate-hashes.json](docs/network-gate-hashes.json), SHA-256 `152c7fa25fe2b95ad5d61005e677eabf341ef269884653c879551ad14385b972`; evidence is in [docs/NETWORK-GATE-AUDIT.md](docs/NETWORK-GATE-AUDIT.md) against [docs/NETWORK-GATE.md](docs/NETWORK-GATE.md). The implementation is local commit `6e6c967eb2483d8d8502cd30456c55bd332cfb12`; push, publication, and real-profile installation remain unauthorized. Declared limitations (§12: relay surface, endpoint exfiltration, tool variance, stale pins, non-darwin targets) are the acceptance boundary. The outcome and acceptance criteria below are retained as the accepted contract.

**Outcome:** narrowly permitted development connections work without weakening the accepted filesystem, authorization, approval, or process boundaries.

**Scope/checklist:**

- Extend the accepted closed-network sandbox with narrow development allowlists and destination/session-scoped user approvals, reusing the existing approval layer.
- Bind enforcement to actual destinations across redirects, DNS/rebinding, proxies, loopback, local services, and supported protocols; unsupported or ambiguous routes fail closed.
- Exercise malicious repositories across configuration, file tools, shell execution, and network access. Maintain regressions for network bypasses and cross-layer exfiltration scenarios.
- Complete the remaining hardening evidence, supported-platform matrix, non-secret status reporting, security claims, and known limitations needed to prepare a public-beta candidate.

**Acceptance:**

- Supported development network workflows work; unknown destinations require matching approval. Approval does not transfer across destinations or sessions, and redirects/proxies cannot widen its scope.
- Destination-identity or enforcement failure blocks the connection. Allowing network access cannot reveal host credentials, expand filesystem permissions, override `DENY`, or remove required containment.
- Every high-priority threat has enforcement/regression evidence or an explicitly bounded claim. An open bypass of a claimed protection remains a release blocker. Allowed endpoints can receive workspace data accessible to the process; no broader exfiltration-resistance claim is made.
- Complete relevant checks and actual platform/network adversarial tests pass for the release candidate; source/test/review provenance and current documentation agree.

**Checkpoint/review:** independent review of network enforcement and its end-to-end interactions, then owner acceptance closes Phase 4 and the remaining demonstrated Phase 5 items. Beta/v1 release acceptance is not implied.

## Release gates and ownership

The dependency chain is Goal 1 acceptance -> Goal 2 acceptance -> Goal 3 acceptance -> Goal 4 acceptance. Pure authority, host file execution, subprocess containment, and opening network access remain separate security checkpoints. Unsupported operations are denied/unavailable; generic delete/rename APIs, path-selector frameworks, and additional OS support are not silently added to the queue. Effects needed by a supported tool must still be covered within its owning Goal.

Phase 5 tests are distributed across the owning Goals, not postponed to a later hardening implementation cycle. Phase 6 preparation is assigned as follows: CI/reproducibility to Goal 1; package contents, install/rollback, publication safeguards and Pi/Node compatibility to Goal 2; OS compatibility evidence to Goals 3-4; final claims and cross-layer evidence to Goal 4. An explicit unsupported Linux entry is valid; a compatibility matrix is not a promise to implement Linux support.

The Phase 6 and Phase 7 gates below remain separate release checkpoints, not additional queues of micro-Goals. Before public beta, establish the private reporting channel and complete security/documentation review of the actual release candidate, including installation, rollback, compatibility and limitations. A Goal review can supply release evidence only where its exact snapshot and scope cover the release criteria; an unrelated or stale PASS is insufficient. v1.0 still requires stable guarantees, maintained regression evidence, resolved or explicitly bounded blockers, and an independent audit appropriate to the claimed boundary. Publishing requires explicit maintainer action. New findings are not pre-accepted or dismissed to fit the four-Goal plan.

## Phase acceptance ledger

The following phase checkboxes and release gates retain their acceptance meaning. Closure requires recorded acceptance evidence in STATE; the 2026-09-15 transitions close Phases 1 and 2, the 2026-09-19 transition closes Phase 3 within the accepted contracts, and the 2026-09-20 transition closes Phase 4 within the Goal 4 contract and declared limitations. On 2026-09-20 the acceptance of `20260920-private-vulnerability-reporting`, `20260920-hosted-ci-reproducibility`, `20260920-compatibility-matrix` and `20260920-npm-packaging` closed four Phase 6 checklist items without closing that phase's release gate or advancing the phase; the same transition consolidated the working branch into `main`, transferred the repository to `hiyotim/pi-perimeter`, and reconciled the Phase 5 items to their owning-Goal evidence without closing the Phase 5 release gate. Phase 5 items are distributed across the owning Goals, and the later release gates remain open.

## Phase 0 — Foundation

- [x] Project documentation and terminology.
- [x] Planned architecture and trust boundaries.
- [x] Threat model and attack matrix.
- [x] Development rules and contribution workflow.
- [x] Test strategy for isolated security fixtures.
- [x] Minimal, non-enforcing Pi package skeleton.

**Release gate:** all documents agree that no security enforcement exists yet; the manifest follows current Pi package conventions; no runtime dependency is introduced.

## Phase 1 — Pure Policy Core

- [x] Path normalization and canonicalization.
- [x] Component-aware workspace containment.
- [x] Existing-target and creation-target handling.
- [x] Symlink resolution and documented race limitation.
- [x] Secret path and resource classification (Phase 1B accepted after final independent audit; path-only, unenforced primitive).
- [x] Structured `ALLOW`, `ASK`, and `DENY` decisions with reason codes (fixed default decisions for `read`, `write`, and `edit` accepted; unenforced primitives).
- [x] Monotonic configuration authority rules (bounded configuration loading, validation, source/operation association, workspace-bound snapshots, and affected-decision handling accepted in Goal 1 on 2026-09-15).

**Release gate:** a platform-independent policy core passes table-driven and adversarial tests using temporary fixtures, with no Pi or sandbox side effects.

Current acceptance checkpoint and historical Goal evidence: [STATE.md](STATE.md). The pure policy core, bounded file gates/approvals, contained shell route, and restricted networking are accepted as Goals 1–4 within their documented guarantees and declared limitations. No new Goal is selected; the Phase 6 and Phase 7 release gates remain open and require their own evidence and explicit maintainer action. Planning or completion of a scope item does not authorize implementation beyond the active checkpoint or further phase advancement.

## Phase 2 — Pi Tool Gates

- [x] Gate `read`, `write`, and `edit`.
- [x] Gate `grep`, `find`, and `ls`.
- [x] Define coverage behavior for unknown/new model-facing tools.
- [x] Implement precise approval UX and scoped approval state.
- [x] Re-verify supported Pi APIs and compatibility range.

**Release gate:** every supported in-process file tool demonstrably uses the central policy model; missing coverage fails closed; approval scope and timeout behavior have regression tests.

## Phase 3 — Sandboxed Shell

- [x] Re-evaluate available OS-level containment mechanisms.
- [x] Investigate Anthropic Sandbox Runtime and select the evidenced Seatbelt projection design instead.
- [x] Route model `bash` and user `!`/`!!` commands through containment.
- [x] Construct a sanitized child environment.
- [x] Block on missing, unsupported, or failed sandbox initialization.
- [x] Prove there is no unrestricted fallback within the accepted contract.

**Release gate:** ordinary shell workflow runs in verified containment on supported macOS versions; failure-path and bypass tests pass; provider authentication remains outside child processes by default.

## Phase 4 — Network

- [x] Restrict sandbox network access by default.
- [x] Define allowlisted development services.
- [x] Add destination- and session-scoped approval.
- [x] Test redirects, DNS, proxies, loopback, local services, and exfiltration cases.

**Release gate:** documented tests demonstrate the stated network policy on supported platforms, and no broader exfiltration-resistance claim is made. (Closed on 2026-09-20 by the Goal 4 acceptance; session-scoped standing grants are deliberately not implemented — the trusted allowlist is the standing authority and everything else is per-invocation, per [docs/NETWORK-GATE.md](docs/NETWORK-GATE.md) §6.4.)

## Phase 5 — Hardening

Ledger reconciliation (2026-09-20, task `20260920-ledger-reconciliation`): these items were distributed across the owning Goals and are closed below by their accepted evidence. This reconciliation does **not** close the phase's release gate.

- [x] Adopt or implement an auditable shell parser/AST strategy. (Goal 3: bounded lexer/parser with fixed limits in `src/policy/shell-grammar.ts`; the profile, not the parser, is the enforcement boundary, and command substitution and backticks are denied rather than parsed — [docs/SHELL-GATE.md](docs/SHELL-GATE.md) §8, with content binding for sourced and literal script inputs in §9.)
- [x] Test nested shells, substitutions, redirections, sourced scripts, and subprocesses. (Goal 3: `test/shell-grammar.test.ts`, `test/shell-plan.test.ts`, `test/shell-containment.test.ts`, including pipeline/list/subshell/redirection structure, sourced-input binding, and nested `sandbox-exec` refusal inside containment.)
- [x] Expand symlink and time-of-check/time-of-use adversarial coverage. (Goal 2 corrective pass: the ancestor-symlink-swap creation escape and descriptor-relative execution in [docs/FILE-GATE-AUDIT.md](docs/FILE-GATE-AUDIT.md); Goal 3: descriptor-bound freeze and measurement races with the declared pre-capture residual in [docs/SHELL-GATE-AUDIT.md](docs/SHELL-GATE-AUDIT.md) §20–22.)
- [x] Investigate macOS Keychain behavior without promising isolation prematurely. (Goal 3: the synthetic-Keychain effect test in `test/shell-containment.test.ts`; the probe's boundary is recorded as a result row in [docs/SHELL-GATE-AUDIT.md](docs/SHELL-GATE-AUDIT.md), and nothing beyond that probe is covered by any guarantee — no isolation claim is made.)
- [x] Build a maintained adversarial regression suite. (The containment, network, freeze-race and manifest suites run inside `npm run check`; on every push the hosted CI check enforces the run's outcome and its declared skip set through the count budget in [docs/CI-EVIDENCE.md](docs/CI-EVIDENCE.md), while the darwin-only containment suites execute in the executor-local macOS runs, since they skip on the Linux runner.)
- [x] Conduct an independent security-focused review. (Independent reviewer passes are recorded for the accepted Goals 1–4, for the hosted-CI and compatibility-matrix Goals, and — recorded 2026-09-20 after the gap was surfaced by this reconciliation — for `20260920-private-vulnerability-reporting`, including the eight rounds in [docs/SHELL-GATE-AUDIT.md](docs/SHELL-GATE-AUDIT.md). Every accepted item now carries a recorded independent review.)

**Release gate:** all high-priority threats have explicit enforcement evidence, regression coverage, or a clearly documented limitation. (Not closed by this reconciliation: whether that condition is met is an owner decision, and the declared residuals — mount isolation UNVERIFIED, same-user host writers (B3), no descendant-termination guarantee, the Class 1 Linux runtime-evidence gap, and Keychain beyond the synthetic probe — are the boundary any such acceptance would inherit.)

## Phase 6 — Public Beta

- [x] Add GitHub CI and reproducible checks. (Closed 2026-09-20 as the bounded Phase 6 item `20260920-hosted-ci-reproducibility`: actions pinned by commit, a fail-closed assertion of the declared per-platform test counts, and [docs/CI-EVIDENCE.md](docs/CI-EVIDENCE.md) as the evidence record. Hosted coverage is the Linux platform-independent suite only; no containment evidence and no platform support claim.)
- [x] Publish a Pi, Node, macOS, and Linux compatibility matrix. (Closed 2026-09-20 as `20260920-compatibility-matrix`: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) reports verified rows only, marks Linux and Windows unsupported, and commits to no support.)
- [x] Prepare npm packaging and publication safeguards. (Closed 2026-09-20 as `20260920-npm-packaging`: distribution renamed to `pi-perimeter`, package metadata and `publishConfig` in place, `private: true` blocking publication, no lifecycle scripts, CI never publishing, packaged contents verified by a dry run with the build-output directory excluded, install/rollback covered by `test/package-lifecycle.test.ts`, and the release checklist in [docs/PACKAGING.md](docs/PACKAGING.md). Publication itself remains unauthorized and the release gate below stays open.)
- [x] Define a private vulnerability-reporting channel. (Closed 2026-09-20 as the bounded Phase 6 item `20260920-private-vulnerability-reporting`; see [docs/VULNERABILITY-REPORTING-AUDIT.md](docs/VULNERABILITY-REPORTING-AUDIT.md) and [STATE.md](STATE.md). An independent review of the item was recorded the same day, closing the audit-trail gap surfaced by the Phase 5 reconciliation; the channel and its recorded advisory moved with the repository transfer.)
- [x] Complete security and documentation reviews. (Closed 2026-09-22 as the bounded Phase 6 item `20260922-release-candidate-reviews`: security review of installation, rollback, compatibility, disclosure and known limitations plus documentation-agreement review across `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `THREAT_MODEL.md`, `COMPATIBILITY.md`, `PACKAGING.md`, `CI-EVIDENCE.md` and the gate contracts/audits against the actual release-candidate bytes; five corrected claims, audit [docs/RELEASE-REVIEW-AUDIT.md](docs/RELEASE-REVIEW-AUDIT.md), manifest `docs/release-review-hashes.json`, fresh independent re-review PASS with no blocking findings. Docs + test-binding only; no behavior change.)

**Release gate:** installation, rollback, compatibility, disclosure, and known limitations are documented and tested; publication requires explicit maintainer action. (All five checklist items are closed and the gate was closed by explicit owner decision on 2026-09-22: install/rollback via `test/package-lifecycle.test.ts` and `docs/PACKAGING.md`, compatibility via `docs/COMPATIBILITY.md`, disclosure via `SECURITY.md` plus the private reporting channel, limitations via the gate contracts/audits and the release review; `npm run check` 388/387/0/1 at the acceptance commit. Publication remains a separate explicit maintainer decision that has not been taken.)

## Phase 7 — v1.0

- [x] Stabilize the supported security guarantees. (Closed 2026-09-22 as `20260922-stabilize-guarantees`: `docs/V1-GUARANTEES.md` P1–P18 + R1–R11, audit `docs/V1-GUARANTEES-AUDIT.md`, manifest `docs/v1-guarantees-hashes.json` SHA-256 `2d59ca09f8d2bdb195164bfba5de630cc8e8410186df7822b5dc33a1bb56cfe5`, commit `24da69f`, hosted run `35740981632` green with tests 391 / pass 337 / fail 0 / skipped 54, rounds 1–4 reviewed with round 3 PASS and round 4 delta PASS. Docs + test-binding only; no behavior change.)
- [x] Maintain regression evidence for every guarantee. (Closed 2026-09-24 as `20260922-regression-evidence-per-guarantee`: per-promise biting regressions P1–P18 in `docs/REGRESSION-EVIDENCE-AUDIT.md`, manifest `docs/regression-evidence-hashes.json` SHA-256 `8a42fd593997b38a08fd1376add072fab5c4053a09684236602e22394e52687e`, commit `c01b53d`, hosted run `35977693960` green with tests 398 / fail 0 / skipped 54, rounds 1–4 reviewed PASS. Tests + binding + audit only; no behavior change.)
- [x] Resolve or explicitly bound release-blocking known unknowns. (Closed 2026-09-24 as `20260924-unknowns-bound`: R1–R11 dispositions in `docs/UNKNOWN-BOUNDS-AUDIT.md` (R7/R8/R9/R11 resolve-with-evidence, R1–R6/R10 explicit-bound-no-claim; no open blockers), manifest `docs/unknown-bounds-hashes.json` SHA-256 `2b7ad6b55bfd654f5d42dd9a24e9e2b3927a85136eafec223399bc094ae83bd9`, commit `82a5c4b`, hosted run `35984659993` green with tests 404 / fail 0 / skipped 54, fresh review PASS. Tests + binding + audit only; no behavior change.)
- [x] Complete an independent audit appropriate to the claimed boundary. (Closed 2026-09-24 as `20260924-v1-independent-audit`: fresh-context audits P1–P18 HOLD / R1–R11 stand in `docs/INDEPENDENT-AUDIT.md`, manifest `docs/independent-audit-hashes.json` SHA-256 `32cb0399a29b71d7f8b4716f25afdd8f9583d81990fcf748236c5e60ba57070f`, commit `6202286`, hosted run `36023554431` green with tests 407 / fail 0 / skipped 54, final-bytes + delta review PASS. Docs + binding only; no behavior change.)

**Release gate:** v1.0 is released only after the implementation and regression suite support a stable, narrowly worded set of security guarantees. (Closed 2026-09-24 by explicit owner decision as macOS-only v1.0: declared target only; Linux/Windows explicitly unsupported with R4 open; evidence is the four step acceptances in [STATE.md](STATE.md). **Published 2026-09-24 as `pi-perimeter@1.0.0`** (dist-tag `latest`, from the deterministic staging artifact via the release workflow with provenance; release run `36031377325`; binding `ca0fb1c3…`).)

## v1.0.1 recovery checkpoint (2026-09-25)

The startup correction (`8365b34`), versioned release staging preparation (`b308ed8`), and user installation onboarding (`1bfabc5`) are committed locally on `main`. The owner accepted the onboarding Goal on 2026-09-25 after the reported independent review PASS; its bound evidence is [docs/user-install-onboarding-hashes.json](docs/user-install-onboarding-hashes.json) and [docs/INSTALL-ONBOARDING-AUDIT.md](docs/INSTALL-ONBOARDING-AUDIT.md). These local commits are not pushed. The `v1.0.1` release, hosted workflow, publication, and verification of the npm-downloaded artifact remain a separate bounded Goal and maintainer decision. The next planning action is to prepare that release handoff; this checkpoint does not authorize publication.

## v1.0.1 published (2026-09-25)

Task ID `20260925-release-v101`, Criterion 4: tag `v1.0.1` (annotated object `29e76abf7b7a2632427cf335333f591bbc8b3dd9`) on commit `041b4e89b4bb5cc5988fda5ce5a51f85488c6a52` on `main`, pushed to `origin/main`. Verify-only hosted run `36173700726` (success; guard `1.0.1` → `docs/release-hashes-1.0.1-final.json`; linux `tests 431, fail 0, skipped 54`; staging tree sha256 `327824cec0815802648abd877de61de6e08a8ed5c3f65df358dab7d3a6dd5bb7`; 36/36 verified) preceded publish run `36173840730` (`v1.0.1` push, success; `+ pi-perimeter@1.0.1` with provenance). Registry: `pi-perimeter@1.0.1`, dist-tag `latest`, tarball shasum `8387c82ddb3f730512b6d43d577954981e3f24fd`, integrity `sha512-2yQU3dTIdYh61JPyIbgHKMQwYeb/LPlGUg4OXZmeUYV4Y8dX1svaUSkfjgum5lIw0Iaqhg3DxcUPAPGlyzMy5w==`, provenance `provenance/v1` (transparency log `2960126766`, attestation bundle tlog `2960155223`). The isolated published-package exercise (real registry, isolated profile, synthetic fixtures) passed 11/11: install/list/helper-build/startup/remove on the declared target with no real-profile install. Public path is now `pi install npm:pi-perimeter@1.0.1` ([README.md](README.md)); `1.0.0` stays published but broken and superseded. Evidence: [docs/RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md](docs/RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md), recorded in [STATE.md](STATE.md); the recovery checkpoint above is preserved as history.
