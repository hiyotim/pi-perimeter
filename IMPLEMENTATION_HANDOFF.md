# Implementation Handoff

Task ID: 20260915-pi-file-gates-scoped-approvals
Baseline: c10e8f384e678c41792937d340d716d25e592e28

## Goal

Implement the selected Goal 2: every supported Pi file operation (`read`, `write`, `edit`, `grep`, `find`, `ls`) must use central authorization, a matching scoped user approval when required, and controlled execution bound to the checked resources. Include fail-closed tool coverage, protected control-plane resources, integration/adversarial tests, and package/compatibility verification in one cycle. Model and user shell execution remain blocked; no OS sandbox or network permissions are implemented.

## Context

[STATE.md](STATE.md) records owner acceptance of Goal 1 and Phase 1 on 2026-09-15, followed by selection of this Goal. Its scope and gates are fixed in [ROADMAP.md](ROADMAP.md); follow [AGENTS.md](AGENTS.md) and the boundaries in [ARCHITECTURE.md](ARCHITECTURE.md). Preparation does not start implementation.

The accepted core provides resolver-issued immutable paths, content-blind classification, fixed read/write/edit decisions, monotonic configuration composition, and workspace-bound policy snapshots. `evaluateEffectivePath` supports only the three exact policy operations; file-tool traversal and complete operation effects still need an explicit mapping to that model. The Pi entry point is empty, and approvals are unimplemented. The [configuration contract](docs/CONFIGURATION-AUTHORIZATION.md) and [independent audit](docs/CONFIGURATION-AUTHORIZATION-AUDIT.md) describe the accepted guarantees and limits.

HEAD is not the full accepted snapshot: Goal 1 remains uncommitted. At preparation, branch was `codex/operation-policy-contribution-contract` and index was empty. Known modified tracked files were `ARCHITECTURE.md`, `IMPLEMENTATION_HANDOFF.md`, `README.md`, `ROADMAP.md`, `STATE.md`, `package.json`, `src/policy/README.md`, and `test/README.md`. Known untracked files were the CI workflow, three configuration/contribution/audit documents, three configuration policy modules, and `test/configuration.test.ts`. The eight reviewed artifacts must match the audit's manifest at execution start. All older policy modules/tests remain at HEAD.

Additional starting SHA-256 anchors, including the accepted audit and current transition documents:

| File | SHA-256 |
| --- | --- |
| `STATE.md` | `7636657f164d3708dfe764c76c758d84d6cd1e5167616e1933926802d7161191` |
| `ROADMAP.md` | `e82c570f5787b3c1767323cecb450a3e9ca39189a307ba0ce7dfe105fdc665e6` |
| `ARCHITECTURE.md` | `e20560bfbd0abe182a43dc6f4770300e0c9a46d3582c9bc5ef4e8d76fa7e1358` |
| `README.md` | `c8094c779610c64624b02b6c6a1012d98374b8ca2c2c95fd8d3fa3c5481228c2` |
| `src/policy/README.md` | `2052d05d67d6171db2cfeadca92bd6205a0fa88584da33e01e756c15a32a02b2` |
| `test/README.md` | `3e787057f66d0721197b9da53f02245de7c321dc7e940b5a71fade3f9780fed3` |
| `package.json` | `7a390601f627bad4608171b24a76855784c128c9eea6202c03556c607b5f590c` |
| `package-lock.json` | `2709b341207788d1f2d4e4a04b59802329b33f6e2a78278a5050614172db49c7` |
| `docs/CONFIGURATION-AUTHORIZATION-AUDIT.md` | `4e9917b5192a5e687bc7ded4ba4521e246dcf900692618ea9a4f002ea45db2f2` |

This handoff replaces the completed Goal 1 handoff (SHA-256 `86a1ae0735e4c3a0f8f642a8dcff305bedd0b65b97ff105d63d3b0acb053728f`) under the owner's transition request. Do not treat pre-existing accepted code as a new Goal 2 change or discard it to obtain a clean baseline. Reviewed documents retain their pre-acceptance status wording to preserve evidence; STATE records the later acceptance.

Installed Pi `0.84.4` extension documentation was inspected during preparation. It exposes mutable tool-call inputs, runtime tool registration, session lifecycle changes, and a separate user-bash route. This observation is not current-upstream verification or a security guarantee; verify the supported release/source and actual execution paths before integration changes.

## Scope

- Re-verify current upstream Pi APIs and choose/document the supported Pi/Node range. Cover startup/reload/session transitions, tool registration/activation, input mutation and execution ordering, all six file tools, and model/user shell routes.
- Keep `src/index.ts` thin. Add the needed integration and controlled file-operation modules under `src/`; retain pure policy in `src/policy/` and approval UX/state in `src/approvals/`. Define complete effects/resources, traversal behavior, file-type handling, creation/overwrite/edit semantics, and mapping of search/list tools to central policy.
- Consume the accepted effective configuration model without dropping applicable restrictions or allowing cross-workspace snapshot substitution. Define when policy and resource identity are checked again after approval or session changes.
- Implement precise approvals with protected state, exact operation/resource/use/time/session bounds, expiration, revocation, and cancellation. Define these semantics before dependent implementation and preserve applicable maintainer decision gates.
- Protect Pi credentials/state, authoritative configuration, and approval state from model-facing access or modification. Identify resources from trusted context, not repository claims or an assumption that filename classification is exhaustive.
- Add isolated Pi integration, filesystem/approval adversarial, package installation/rollback and compatibility tests; extend CI as needed. Limit package/dependency/test-configuration changes to this scope and review any added trusted dependencies.
- Update directly affected contracts, usage/status documentation, and compatibility evidence. Preserve historical audit artifacts; record new behavior and review evidence separately without changing the four-Goal plan.

## Acceptance Criteria

1. All six file tools have explicit semantics and actual Pi integration evidence for allowed, approval-required, denied, and failure cases. Every resource/effect they touch is mediated by central policy, including recursive descendants, search content, metadata, creation parents, and helper-process access where applicable. Valid ordinary workspace operations work; unsupported unsafe variants fail closed rather than claiming coverage.
2. `read`/`write`/`edit` preserve their accepted baseline and configuration semantics. Search/list operations cannot bypass an applicable read or stronger restriction through a different tool name. The operation mapping is documented and tested; this Goal does not silently broaden the accepted JSON v1 operation vocabulary or permit weaker configuration behavior.
3. Raw/malformed tool input, resolution/classification/loading failures, forged resource/source values, and snapshot/session/workspace substitution cannot reach an effect. Sensitive/secret and protected control-plane denials override workspace allowance and any approval. Repository/model/tool-output data cannot create trusted source identity or approval state.
4. A directory authorization never grants arbitrary access to descendants or external symlink targets. A denied resource is not read first and filtered from output later. Traversal, symlink aliases/escapes, missing targets and ancestors, file types, and helper operations have explicit complete-result/effect tests.
5. Actual execution is bound to the checked operation and resource identities, including after user interaction, input mutation, concurrent calls, and filesystem replacement. Tests cover final-target and ancestor substitution and failed/partial execution. A second `realpath` alone is not TOCTOU protection; unsafe unsupported cases are blocked. Hard-link, mount, and other identity limits are tested/bounded without claiming unsupported inode isolation.
6. Approval displays the exact operation, canonical resources, reason, scope/duration and protection status. It satisfies only a matching effective `ASK`; it never overrides `DENY`, changes configuration outcomes, or grants containment. Absence, refusal, unavailable UI, malformed response, timeout, expiration, cancellation, revocation, replay, or changed target/operation/session blocks the requested effect. Concurrent requests cannot reuse one approval beyond its displayed use scope.
7. Coverage is fail-closed for unknown/new or unintegrated model-facing tools, including dynamic registration/activation and lifecycle transitions. Actual model `bash` and user `!`/`!!` execution paths are blocked without spawning an unrestricted shell. File-gate or approval initialization failure cannot silently restore original unprotected tools. No coverage claim rests only on a startup tool-name list or a success message.
8. User/global configuration and approval state remain outside repository-controlled authority. Pi authentication/state and configured policy locations are protected even where generic path classification reports ordinary. Status/errors expose decision and protection state without secret payloads or misleading claims of OS containment.
9. Existing policy/configuration regressions and new integration/adversarial suites pass. Tests use actual supported Pi interfaces and isolated fake workspaces, user roots, Pi profiles and credentials; mocked hook return values alone do not prove coverage. Relevant platform evidence is recorded; unavailable evidence for a claimed guarantee blocks its acceptance.
10. Package contents, isolated installation and rollback, supported Pi/Node versions, and publication safeguards are documented and tested. CI runs all relevant suites with reproducible dependency installation. No real Pi profile is modified and no package is published. The final implementation is ready for independent review of the complete host file/approval boundary, with no Phase 3 containment or network implementation.

## Verification

- At execution start run `git status --short` and `git rev-parse HEAD`; verify the starting anchors and the audit's eight artifact hashes. Capture the complete tracked and untracked starting snapshot before changing code so Goal 2's incremental diff remains attributable.
- Inspect current primary Pi documentation, released package metadata, and source for the selected compatibility range. Record exact versions/commits and verify actual tool/replacement, input mutation, dynamic registration, user-bash, lifecycle, and UI behavior before relying on them.
- Use targeted tests for diagnosis as needed. Run `npm run check` for typecheck and the complete existing/new suite; run relevant integration/package/platform checks not included by that command. `npm run test:configuration` is available for configuration-focused diagnosis.
- Verify reproducible installation with the repository's `npm ci --ignore-scripts` workflow in an isolated test environment and validate package contents, installation, rollback and CI coverage. Do not invent hosted CI or unsupported-platform results; distinguish inspection, local runs, and hosted runs.
- Independently derive adversarial cases for omitted resources, cross-tool/configuration bypasses, control-plane access, symlink/ancestor races, post-check input mutation, concurrent approval consumption, stale policy/session state, dynamic tools, and shell escape routes. Keep every discovered bypass as a regression and use targeted probes/mutations where required.
- Review the complete incremental diff, new files, dependency surface, claims and links; run `git diff --check` and inspect untracked-file whitespace separately. Record actual results, limitations, reviewed source/test hashes, and final status.
- Goal 1 audit results are prior evidence. During transition/preparation only hashes and documentation consistency were checked; implementation tests and independent code review were not rerun.

## Constraints

Preserve accepted policy/provenance/configuration contracts, monotonic authority, secret/sensitive denials, and fail-closed behavior. A matching user approval satisfies an `ASK`; it does not lower policy restrictions or make a `DENY` approval-eligible. Preserve configuration snapshot-to-workspace binding and all regression coverage.

No general path-selector framework, multiple-global-source framework, migrations, standing configuration exceptions, generic delete/rename APIs, shell execution, OS sandbox adapter, environment-for-child-execution feature, or network permissions are in scope. Blocking shell is required here; enabling it belongs to Goal 3. A shell sandbox cannot be assumed to protect host file operations.

Do not weaken tests to make integration pass, refactor unrelated subsystems, read real credentials, install into real Pi configuration, overwrite accepted audit evidence, or claim arbitrary hostile same-process/OS isolation. No staging, commits, branch changes, push, publication, Phase 2 acceptance, or progression to Goal 3 is authorized by this handoff.

## Execution Notes

Integration design, complete-resource policy, approval lifecycle, controlled file execution, tests and packaging form one Goal. Define their security semantics and verify upstream capabilities before dependent code. Keep internal tasks within this cycle; do not create separate Goals per tool or test. Preserve explicit decision/review gates for authority, approval scope, dependencies and guarantees.

Finish the implementation, relevant checks, in-scope fixes and documentation before a single independent security review of the final complete host file/approval path. Findings remain within this Goal; materially changed artifacts require fresh relevant review evidence. Owner acceptance is separate and must precede closure of Phase 2 or Goal 3 implementation.

## Escalate If

Stop and report if work requires changing this Goal or its acceptance criteria; weakening or changing an architectural/security invariant or accepted configuration contract; materially expanding scope; changing an unapproved public/external contract beyond the explicitly scoped Pi integration; introducing an unplanned security-sensitive/destructive change; a migration/transformation with possible data loss; contradiction with canonical planning; or material baseline/attribution ambiguity.

Also report unsupported upstream interception/coverage, execution-time identity guarantees that cannot be established, or unavailable required platform evidence. Do not replace these blockers with permissive fallbacks or misleading coverage claims. Exact integration, resource mapping, and approval-design decisions expressly within this scope are internal work, not automatic requests for a new Goal.
