# Roadmap

This roadmap uses release gates, not dates. A phase is complete only when its listed behavior is implemented, reviewed, tested, and documented without overstating guarantees.

## Remaining implementation plan

Planning decision: 2026-09-13; acceptance/selection updates: 2026-09-15 and 2026-09-19; architecture approval: 2026-09-17. The four-Goal plan is unchanged. Goals 1–3 are accepted; Phases 1–3 are complete within their demonstrated guarantees. Goal 4 is selected and its implementation has not begun. Goal 3 acceptance is bounded by the variant-B contract, target platform and limitations recorded in [STATE.md](STATE.md) and the shell gate audit; it does not add descendant-termination, atomic-tree-snapshot, B3 or mount-isolation guarantees. The phase checklist remains the acceptance ledger, not a second queue of implementation Goals.

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

**Status:** selected by the owner on 2026-09-19; implementation has not begun. A separate implementation handoff must use the accepted Goal 3 commit as its baseline.

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

The following phase checkboxes and release gates retain their acceptance meaning. Closure requires recorded acceptance evidence in STATE; the 2026-09-15 transitions close Phases 1 and 2, and the 2026-09-19 transition closes Phase 3 within the accepted contracts. Phase 4 and later release gates remain open.

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

Current acceptance checkpoint and historical Goal evidence: [STATE.md](STATE.md). The pure policy core, bounded file gates/approvals, and contained shell route are accepted as Goals 1–3 within their documented guarantees. Goal 4 is selected but not yet implemented. Planning or completion of a scope item does not authorize implementation beyond the active checkpoint or further phase advancement.

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

- [ ] Restrict sandbox network access by default.
- [ ] Define allowlisted development services.
- [ ] Add destination- and session-scoped approval.
- [ ] Test redirects, DNS, proxies, loopback, local services, and exfiltration cases.

**Release gate:** documented tests demonstrate the stated network policy on supported platforms, and no broader exfiltration-resistance claim is made.

## Phase 5 — Hardening

- [ ] Adopt or implement an auditable shell parser/AST strategy.
- [ ] Test nested shells, substitutions, redirections, sourced scripts, and subprocesses.
- [ ] Expand symlink and time-of-check/time-of-use adversarial coverage.
- [ ] Investigate macOS Keychain behavior without promising isolation prematurely.
- [ ] Build a maintained adversarial regression suite.
- [ ] Conduct an independent security-focused review.

**Release gate:** all high-priority threats have explicit enforcement evidence, regression coverage, or a clearly documented limitation.

## Phase 6 — Public Beta

- [ ] Add GitHub CI and reproducible checks.
- [ ] Publish a Pi, Node, macOS, and Linux compatibility matrix.
- [ ] Prepare npm packaging and publication safeguards.
- [ ] Define a private vulnerability-reporting channel.
- [ ] Complete security and documentation reviews.

**Release gate:** installation, rollback, compatibility, disclosure, and known limitations are documented and tested; publication requires explicit maintainer action.

## Phase 7 — v1.0

- [ ] Stabilize the supported security guarantees.
- [ ] Maintain regression evidence for every guarantee.
- [ ] Resolve or explicitly bound release-blocking known unknowns.
- [ ] Complete an independent audit appropriate to the claimed boundary.

**Release gate:** v1.0 is released only after the implementation and regression suite support a stable, narrowly worded set of security guarantees.
