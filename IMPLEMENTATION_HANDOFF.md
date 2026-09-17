# Implementation Handoff

Task ID: 20260915-sandboxed-shell-network-closed
Baseline: 664871d9276049322f30acfb58e792462ad8538f

## Goal

Preserve roadmap Goal 3, **Sandboxed shell with network closed**: model and user shell commands execute only inside verified OS containment, with a constructed environment and no permitted network access.

**Current authorized outcome:** autonomously finish the backend-feasibility checkpoint, including the decisive synthetic full-cycle experiment, corrections, and independent assessment. Deliver one decision-ready report; do not stop after each probe or ask the owner to relay review messages. Do not implement or enable production shell execution. Completing this checkpoint does not complete Goal 3.

## Context

**Owner workflow instruction (2026-09-17):** the owner hands this document to the executor once. The executor owns investigation, routine technical decisions, consultations, verification, and corrections through completion. The owner explicitly permits consultation with other agents/models. Use available advisors when useful without asking the owner to choose models or relay messages. Consult the owner only for a genuinely unresolved consequential choice, missing external authority, or the explicit adoption/acceptance gates. Advisors cannot grant owner authority or waive invariants. This instruction authorizes autonomous completion of this checkpoint, not backend adoption.

[STATE.md](STATE.md) records Goal 2 acceptance and Goal 3 selection for proposal preparation. [ROADMAP.md](ROADMAP.md), Goal 3, retains the full scope, acceptance criteria, and backend/guarantee approval gate. [ARCHITECTURE.md](ARCHITECTURE.md), trust zones and sections 7–10, and [AGENTS.md](AGENTS.md) define the architecture and security invariants.

After revision 3 of [SANDBOX-BACKEND-PROPOSAL.md](docs/SANDBOX-BACKEND-PROPOSAL.md), the owner explicitly authorized **preparation of this bounded assessment beyond the evaluated A/B mechanisms while preserving guarantees**. This handoff conveys that research-only authorization. Do not ask again merely because a candidate falls outside the previously evaluated mechanism class. Existing implementation non-goals still apply to adoption: researching an alternative is not approval to install it, change the architecture, weaken protection, or implement it. Canonical documents remain unchanged in this preparation.

Revision 3, section 10.5 and E10, records B4: an already-existing benign hard-link name in an allowed root can expose content that the accepted file executors refuse using `nlink === 1`. The path classifier can label that name ordinary; neither evaluated A/B profile enforces the executor's object check for arbitrary child file access. A scan before execution is not a runtime boundary. Two rejected SBPL predicate names are evidence about those attempts, not an exhaustive proof that every macOS mechanism is impossible.

Reuse E1–E10 and the existing candidate analysis. Read sections 10.5 and 13.6 first, then only evidence relevant to a new candidate. B1/B6, B5 remainder, B7, and B8 remain implementation-verification obligations; do not redo that work to avoid the B4 decision. B2 needs an explicit compatibility assessment where a candidate depends on mount/object identity. Keep the accepted same-user host-writer limitations distinct from the concrete B4 bypass; do not silently broaden either the guarantee or its exclusions.

### Starting snapshot

HEAD alone is not the starting state. Branch: `codex/mac-migration-snapshot`; index empty. Known modified files: `IMPLEMENTATION_HANDOFF.md`, `ROADMAP.md`, `STATE.md`, `docs/FILE-GATE-AUDIT.md`, `docs/FILE-GATE.md`, `docs/file-gate-hashes.json`, `package.json`, `src/gate/bound-execution.ts`, `src/gate/controlled-traversal.ts`, `test/controlled-traversal.test.ts`, `test/gate-runtime.test.ts`, `test/hash-manifest.test.ts`. Known untracked files: `test/canonical-tmpdir.mjs`, `docs/SANDBOX-BACKEND-PROPOSAL.md`, `docs/SHELL-ISOLATION-FEASIBILITY.md`.

Resume the existing feasibility report (starting SHA-256 `1523795c5dc28c6e84b64ab109124b0312766582c1cb4ac931ebcecfa2ab24ec`); it is the sole editable report, not an immutable anchor. This owner-authorized workflow update replaces handoff SHA-256 `a50ee24a860c256c726d967433c51e15eea60c1cb248c606033a6778806ff341` and does not change the selected Goal or approve a backend.

These are pre-existing inputs. Preserve them, including the entire revision-3 proposal. Every entry in the Goal 2 manifest matched at preparation. Additional SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `STATE.md` | `fe799443acce89fba306187ec762f44cb623d1aa292abe064ee1f5dc1424f96a` |
| `ROADMAP.md` | `27cbb4d3092f82cfec78e56248798089a163f887ee3f925a3ed86bc91493969c` |
| `docs/file-gate-hashes.json` | `7aa0e786815118eb45b99d4ce20770aedaaee70470cf88d1970842924a9b0e96` |
| `test/hash-manifest.test.ts` | `83d89f7a5ef5a2775fe3357a2fdfdcf9d2d8726c2423289a4502418535f12a03` |
| `docs/SANDBOX-BACKEND-PROPOSAL.md` | `4e10c1d5d787b101da47fe439f8d05de47892871a4b40b6500e9b65ec5a7d3f5` |

This authorized replacement supersedes the preceding handoff (`c1d43077782254b9c5a6f479658fa84b34ccf7d2d84058ee87428ccd1e6ad344`) only for the next research checkpoint. No previous PASS applies to a new backend, profile, or implementation. macOS direct-file creation remains fail-closed under the accepted Goal 2 implementation; Linux Class 1 runtime support is not established.

## Scope

- Finish the existing `docs/SHELL-ISOLATION-FEASIBILITY.md` as the sole persistent deliverable. Leave the previous proposal, canonical state, code, tests, dependencies, and this handoff unchanged.
- Reuse the completed comparison of the three approaches. Concentrate remaining work on workspace projection plus the descriptor-relative native prerequisite. Do not restart candidate research, add candidates, or repeat decisive rejections. Native code is permitted only as a temporary synthetic experiment with existing tools; no production helper, installation, or dependency adoption is authorized.
- For each candidate, identify what prevents the original host alias from reaching the child, where object checks occur, and what keeps those checks attached to the actual effects for arbitrary descendants. Distinguish read/import, execution, and mutation/export boundaries.
- Establish feasibility and constraints using current primary documentation/source. Use only narrowly needed synthetic probes with already-available tools, temporary fixtures, and working controls; no installation or host configuration change. Clearly separate documentation, inspection, observed effects, inference, and UNVERIFIED.
- Estimate implementation and maintenance burden qualitatively, including privilege/entitlement requirements, trusted-code/dependency surface, macOS support, Pi integration, ordinary offline build/test usability, and any necessary architecture decision. Stop investigating a candidate once a decisive blocker is established.

## Acceptance Criteria

### Remaining work to finish autonomously

- Preserve the corrected distinction: macOS has `openat`; the inspected Node API lacks `fs.openat`; accepted Goal 2 macOS creation remains refused. Preserve complete probe source and exact evidence before deleting temporary files. Recover lost evidence or rerun only missing decisive cases; never invent historical records.
- Complete one minimal synthetic import → contained execution → export experiment. Import must authorize, verify, and read the same object before exposing bytes. A fake secret and its innocent-name hard-link alias must not enter the projection. Cover permitted/denied controls and relevant substitutions.
- Run an offline build/test in the projection that modifies an existing file and creates a new result. Demonstrate source-tree exclusion and closed networking with working controls. Check inherited descriptors/environment and helper channels as part of that boundary.
- Demonstrate source and host-target binding for export and the native prerequisite for new-file creation. Keep checked objects held through the effect; returning only identities and reopening a path in another helper invocation is not equivalent. Define and test parent-symlink swap, moved-parent semantics, target conflicts, and child-supplied symlinks/hard links. No new delete/rename policy is authorized.
- Record exact commands, source/profile, versions, controls, outputs and limits in the report appendix. Single-component `openat` success is not proof of the entire chain or continued pathname membership after a parent moves. Preserve B3/B4 distinctions.
- Consolidate feasibility, trust boundaries, native build/distribution costs and required decisions. Do not adopt shipping tooling, promise a helper line count, or modify accepted contracts.

### Completion conditions

These criteria close only this research checkpoint. Goal 3 implementation and its acceptance criteria in ROADMAP remain unchanged and unfulfilled.

1. The report begins with one explicit verdict: **feasible candidate with stated prerequisites**, **no evaluated candidate satisfies the current constraints**, or **insufficient evidence with a specific missing prerequisite**. Recommend one next decision, not an unbounded list of open questions.
2. A compact comparison covers each candidate's boundary, B4 handling, applicable B2/B3 limits, closed networking, secret/control-plane protection, configuration/approval propagation, offline workflow, dependencies/privileges, and evidence. Distinguish mechanisms that fit current implementation scope from mechanisms that require a separately approved change.
3. B4 is addressed as a required protection. Trace a synthetic secret with an allowed-name hard-link alias through the proposed data flow, including relevant replacement/race points. Show prevention at execution or a boundary that excludes the object entirely; do not substitute path naming, a preliminary scan, file permissions under the same identity, or wording changes for enforcement. A negative probe must have a working positive control.
4. For any copied/projected workspace, analyze safe import **and** return of results: existing files, new files/directories, renames/deletes, conflicts, symlinks/hard links, and host-side replacement. Distinguish actions actually supported from actions that must fail closed. The accepted macOS creation refusal cannot be waived; if useful write-back requires a new primitive or contract, identify the exact prerequisite and stop short of implementing it. Read-only success alone does not demonstrate the full ordinary build/test/write workflow.
5. A proposed viable candidate includes a concrete trust-boundary sketch, source-backed enforcement mechanism, narrowly scoped decisive evidence, and the remaining proof obligations. Passing a toy probe does not establish complete isolation. A rejection includes the failing requirement and supporting evidence; absence of a tested API or two unknown predicate names is not a universal impossibility proof.
6. The report preserves the full security outcome: no silent weakening of file denials, authority, approvals, containment, or closed network; no transfer of historical review evidence. It ends with a bounded follow-up scope for the chosen decision and identifies any owner approval needed before adoption/implementation.
7. Complete all feasible, authorized decisive checks before delivery. Do not stop with experiments that can still be performed safely in this checkpoint. An insufficient-evidence result requires a concrete unavailable prerequisite or authority boundary, not routine unfinished work.
8. Obtain an independent critical assessment using an available agent/advisor before delivery, focused on invariant preservation, binding, authority and evidence. Resolve findings within scope and recheck affected evidence. Attribute reviewer-run versus executor-run checks and record the reviewed report hash. If independent assistance is unavailable, report that limitation honestly; do not invent a PASS.

## Verification

- Check `git status`, `git rev-parse HEAD`, the anchors above, and the Goal 2 manifest against the current files. `npm run test:manifest` is the existing focused check if needed; do not repeat the full suite for this research-only deliverable.
- Verify claims with current primary sources and pin relevant versions/revisions. Reuse proposal evidence under its original scope; do not relabel it as a fresh run.
- Any new probe records exact commands/profile or minimal code, versions, synthetic fixture setup, positive/negative controls, actual outcomes, and limits. Delete only the temporary fixtures created for that probe. Lack of required tooling or authority is UNVERIFIED, not an invitation to install or bypass execution restrictions.
- Check report links, whitespace, and `git diff --check`; inspect the new untracked report explicitly because Git diff does not include it by default.
- Confirm all pre-existing files other than the designated editable report retain their hashes and that only that report changed during this execution. No implementation tests or independent implementation PASS can be claimed.

## Constraints

- No source/test/configuration/architecture/state/handoff edits, runtime dependencies, installs, profile migration, real data transfer, real credential/Keychain access, host security changes, staging, commit, push, publication, or shell enablement.
- Do not alter the four-Goal plan or create an extra implementation Goal. This remains the Goal 3 backend/guarantee checkpoint.
- Do not weaken B4 into an accepted residual. Preserve the accepted protection; propose a mechanism or report a concrete incompatibility.
- Authorization remains monotonic; approval cannot satisfy DENY or widen containment. Unknown/failed containment stays fail-closed with no unrestricted fallback. Existing shell routes remain blocked.
- Do not assume a new mechanism is allowed to expose host credentials, Pi/control-plane state, inherited capabilities, or networking. VM/container isolation alone is not evidence for safe host sharing or output import.
- Keep the main decision report concise: target at most 200 lines, with only necessary reproduction evidence in an appendix in the same file. Link existing E1–E10 instead of copying them. Completeness of decisive evidence takes priority over the length target.
- Do not keep expanding research after a supported decision is available. A clearly evidenced incompatibility or missing prerequisite is a valid checkpoint result, not Goal 3 completion.

## Execution Notes

1. Reconcile the snapshot and resume existing work. Do not ask again for Goal 2 acceptance, assessment authority, or routine bounded synthetic probes.
2. Make routine, reversible technical decisions independently. Consult available agents/advisors when uncertain, then resolve questions against the contracts and evidence. Do not ask the owner to relay messages or perform technical triage.
3. Continue internally through investigation → decisive experiments → report → independent assessment → fixes and affected verification. Progress updates are informational, not requests for a new prompt. Do not stop just to seek a separate architect turn for routine findings.
4. Stop investigating once a supported feasible design or decisive incompatibility is established and applicable checks are complete. Avoid unrelated improvements, universal proofs, new platforms, and repeated checks without new evidence.
5. Deliver one final report: verdict, demonstrated boundaries, blockers, independent assessment, exact reviewed report hash, and one recommended next action. If owner input is necessary, present one consolidated concrete decision with alternatives and consequences.
6. Backend/guarantee approval remains mandatory before native adoption or production implementation; final acceptance remains the owner's decision. Successful probes or advisor agreement cannot supply that authority.

## Escalate If

Stop the affected probe/action and report before proceeding if it requires:

- weakening the Goal or its acceptance criteria, a security invariant, or the accepted B4 protection;
- adopting a new public/external contract, materially expanding the bounded assessment, or modifying canonical project documentation;
- installing tools/dependencies, obtaining new privileges/entitlements, changing host settings, accessing real secrets/profiles, or bypassing an execution restriction;
- a security-sensitive/destructive action, migration, or data transformation with possible data loss or irreversible effects;
- proceeding from a materially changed or ambiguous baseline.

If a consequential architectural choice remains unresolved after consultation, ask one concise question with evidence, a recommendation, and consequences. An advisor cannot substitute for required owner approval.

Finding that a candidate would need such a change is itself an assessment result. Document it and complete unaffected comparison/reporting; do not request approval to implement it during this checkpoint. Examining previously out-of-scope mechanisms is authorized for this assessment only.
