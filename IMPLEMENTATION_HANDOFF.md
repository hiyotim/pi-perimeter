# Implementation Handoff

Task ID: 20260915-sandboxed-shell-network-closed
Baseline: b9060dad829a92d3699da3b689fe909446a1e810

## Goal

Complete Goal 3: model and user shell commands execute only inside verified OS containment, with a constructed environment and closed networking. Deliver implementation, regression/effect evidence, documentation, and a fresh independent security review with blocking findings fixed. Finish ready for owner acceptance; do not begin Goal 4.

## Context

- Repository: `pi-warden`. Read [AGENTS.md](AGENTS.md), current [STATE.md](STATE.md), [ROADMAP.md](ROADMAP.md) Goal 3, and [ARCHITECTURE.md](ARCHITECTURE.md) trust boundaries. The later 2026-09-17 canonical decision supersedes historical proposal-only gates and old backend-candidate wording.
- Goals 1 and 2 are accepted. Their direct-file contract stays intact: macOS unsafe creation variants fail closed; existing file effects have identity checks. This Goal adds an independently contained shell route, not a rewrite of accepted policy or a general host delete/rename API.
- The owner approved isolated workspace projection + staging-only Seatbelt + controlled import/export + a minimal native creation/descriptor-envelope component. This is not the earlier direct-workspace Option B. Do not ask for that architecture approval again.
- Initial target: **macOS 27.0 (26A428), arm64**, using existing tools. Other OS builds/architectures are unsupported until separately authorized and evidenced; passing a startup self-test alone does not expand support. No Linux containment claim.
- [SHELL-ISOLATION-FEASIBILITY.md](docs/SHELL-ISOLATION-FEASIBILITY.md) contains research and its limits. [SANDBOX-BACKEND-PROPOSAL.md](docs/SANDBOX-BACKEND-PROPOSAL.md) contains policy/profile issues and B1–B8 obligations; use it as evidence, not as authority to restore direct-workspace execution.
- Research is not production proof: temporary probes were deleted; the purported full native helper source contains omissions; its replacement excerpt uses `O_RDONLY` before truncation. Do not copy those errors or treat snippets as reproducible implementations. The final report hash differs from the last reviewed snapshot; Appendix F attributes that history. No historical PASS transfers to this Goal's code.

### Entry snapshot

Start from the clean committed preparation descendant of Baseline. Between Baseline and the preparation commit, only `STATE.md`, `ROADMAP.md`, and this handoff change. Verify ancestry, that file set, the baseline manifest, and current status before edits; identify your starting HEAD in the execution record. A clean preparation commit is expected, not an unexplained baseline mismatch. Preserve unrelated changes if another actor has subsequently edited the checkout; stop only where attribution or security becomes ambiguous.

| Anchor | SHA-256 |
| --- | --- |
| `docs/file-gate-hashes.json` | `7aa0e786815118eb45b99d4ce20770aedaaee70470cf88d1970842924a9b0e96` |
| `docs/FILE-GATE-AUDIT.md` | `84351b60a571818009757b73d59863fcc4955ffda5f1112a2981f97597813b35` |
| `test/hash-manifest.test.ts` | `83d89f7a5ef5a2775fe3357a2fdfdcf9d2d8726c2423289a4502418535f12a03` |
| `docs/SANDBOX-BACKEND-PROPOSAL.md` | `4e10c1d5d787b101da47fe439f8d05de47892871a4b40b6500e9b65ec5a7d3f5` |
| `docs/SHELL-ISOLATION-FEASIBILITY.md` | `b1fdad250699c3a2951f3a70afe318bd74a919d13c049d3e086945d4cfb0df96` |

Baseline verification on 2026-09-17: `npm run check` passed typecheck and 213/213 tests, including the manifest; diff whitespace check clean. This is preparation-agent evidence. Goal 2 independent review is attributed separately in its audit. Stash `mac-local-before-migration` must remain untouched.

## Scope

Implement one complete shell lifecycle: authorize → import → contain/execute → bind results → authorize/export → clean up/report. All steps below belong to the same Goal and can be completed without owner checkpoints between routine implementation steps.

### 1. Contract and integration

- Recheck the installed/current supported Pi API before integration changes. Record actual Pi/Node versions and the `tool_call`, controlled bash operations, `user_bash`, cancellation and output behavior used. Cover model `bash` and user `!`/`!!` through one containment service. Unsupported shells/tools remain denied. Keep `src/index.ts` thin.
- Keep policy in `src/policy/`, containment and native adapter in `src/sandbox/`, approvals in `src/approvals/`, runtime wiring in `src/gate/`. Add narrowly required native source/build packaging, isolated tests and evidence docs. No unrelated refactors.
- Before dependent code, record the shell contract, protocol, effect set, parser grammar, approval bindings, supported topology, resource limits and lifecycle in `docs/SHELL-GATE.md`. Consult an independent advisor for security ambiguities; resolve routine choices inside the approved design and continue. This design step is not another owner-approval gate.

### 2. Object-mediated projection and export

- Construct a private per-invocation projection and manifests outside the child's authority. Classify and authorize original objects before importing bytes or emitting names. Open without symlink following where appropriate, verify identity/type/link count and read the same descriptor; never substitute a later path reopen for binding. Bound traversal, size, output and resource use; failures must not expose partial unauthorized data.
- Exclude `.git`, secrets, sensitive resources, authoritative/project policy sources and protected control-plane zones. Preserve all classifier reasons and overlap semantics, including `.env.example` being sensitive. Refuse regular files with `nlink != 1` in both directions. Ordinary path classification alone cannot detect a hard-linked secret alias.
- Support only safely confined internal symlinks under an explicit import policy; deny external/broken/ambiguous aliases, and refuse child-created symlinks at export. A narrower supported symlink subset is acceptable when explicit and tested. Case/normalization and mount/topology assumptions must be stated and tested; `st_dev` alone is not proof against all mounts.
- The child receives no direct read/write access to the original workspace. Projection writes may become host effects only through the trusted exporter. Reclassify and apply current effective policy to every exported target, with bound source bytes and target identity; the child cannot supply trusted manifest identities or grants.
- Existing targets: detect source/target substitution, hard links and host conflicts since import; write through the verified writable descriptor. New files/directories: native descriptor-relative, one-component traversal and creation, identity checks and held parent through effect. No JS path-based creation fallback. Validate every component and protocol field; reject traversal, separators, NULs, ambiguous paths and forged/stale requests. The helper is a narrow mechanism, not a policy decision maker.
- No host deletion or rename API. Deletions/renames inside staging must not silently erase or rename host objects. Clearly report unsupported/ignored effects and any separately authorized creates/replacements. Define nonzero-exit, cancellation, timeout, crash and partial-export behavior; no false all-or-nothing claim. **Owner contract decision 2026-09-18 (variant B):** establish observational quiescence before export — the process group empty after kill, no attributed invocation process alive, and the projection stable across consecutive measurement windows; any observed post-exit change refuses export. Full termination of every descendant is NOT guaranteed or claimed: a descendant that leaves the group and is reparented between census samples may survive with no lifetime or resource limit, confined to its fixed writable roots. The export guarantee is the captured-bytes invariant: every applied effect uses exactly the captured, verified, re-authorized content of the frozen export source (payload bytes and captured permission bits); no effect is applied from a live tree, an unfrozen source or a source that failed to freeze, and no influence of a descendant after capture reaches the host. This is not an atomic snapshot of the whole tree and says nothing about descendant influence before capture, which remains child-controlled output subject to per-target re-authorization. Keep captured output bytes sealed through authorization and effect. Cleanup touches only invocation-owned artifacts and leaves no writable authority accessible to descendants.
- Preserve Goal 2 direct-file behavior on macOS. The new native component is for Goal 3 export; enabling previously refused direct file-tool creation is outside this handoff.

### 3. Containment, native component and packaging

- Use a deny-default Seatbelt profile with projection/session-temp as the only mutable data roots. Derive minimal canonical system/toolchain read roots from trusted inputs, not workspace configuration. Never admit the original workspace, broad home parents, credentials or control state through a toolchain exception. Ancestor metadata permissions must not become directory-listing/content permissions.
- Network remains denied for parent and descendants: external, loopback, bind/listen, DNS, proxy and relevant Unix-domain/broker routes. No network grant may open it. No broad Mach allowance or unrestricted fallback to make tests pass.
- Construct the environment, HOME, TMPDIR, PATH, cwd and stdio explicitly. No inherited secrets, startup files, shell hooks or executable resolution from hostile host/project paths before containment. Entry shell is `/bin/bash --noprofile --norc`; nested interpreters remain subject to OS restrictions and documented shell-policy outcomes.
- The native launcher must close/refuse **all** inherited descriptors above deliberately constructed stdio, including high-numbered descriptors; the probe's 3–255 scan is insufficient. Containment must be active before any untrusted execution. Host helpers/protocol channels must not be callable or forgeable by the child; prevent descriptor and IPC authority leaks.
- Choose and document a minimal reproducible native build/package form using already installed tools, with complete source, compiler flags, architecture/version checks and trustworthy helper location. No implicit runtime compilation, untrusted workspace helper substitution, silent toolchain installation, new runtime package dependencies, remote binary download or signing/privileged setup. A missing/unverifiable helper blocks shell use with an actionable reason.
- Startup verification must validate the actual helper/profile/platform and fail closed; invalidate cached success on relevant identity, policy, toolchain or profile changes. Do not claim self-tests prove all races or authorize other OS versions.

### 4. Shell policy and approvals

- Preserve `ALLOW < ASK < DENY` and strict v1 configuration (no new path selector/configuration schema). Derive shell read/mutation requirements through the accepted policy model; mutation restrictions include both applicable write and edit contributions. Invalid configuration or an effective denial blocks the affected shell invocation, never silently swaps in a more permissive profile.
- Use an auditable bounded parser/AST strategy with no new runtime package dependency. Document supported grammar; malformed, over-limit and unsupported syntax initially denies. Regex matching alone is insufficient. Define conservative outcomes for destructive, privilege, credential, system, publish/deploy, network and unknown behavior, including nested shells, substitutions, redirection and scripts.
- If either effective read or mutation outcome is `ASK`, **every invocation** requires a single-use approval binding all applicable ASK outcomes, even a command named `ls` or presumed read-only; static names do not waive it. An `ALLOW` does not waive a stronger command-risk outcome. Approval never overrides DENY or widens containment.
- Shell grants are private, single-use, at most 60 seconds, bound to exact command/parsed form, canonical cwd, session, policy/profile identity and relevant input content. Missing UI, malformed response, expiry, replay or binding change denies. Distinguish shell-execution authority from per-target export authority; neither implies arbitrary host writes or external access. Present exact effects, projection semantics and boundaries in approval UX; resolve the concrete grant composition in the contract.
- For supported sourced/script inputs, one bound read must supply classification, hash and sealed execution bytes, with token rewriting to the sealed read-only copy outside write roots. A hash followed by path re-open is insufficient. Dynamic sources and unbound direct script execution deny. Do not claim universal static understanding of arbitrary descendants; demonstrate containment of their effects.

## Acceptance Criteria

1. All supported model/user shell routes use the same verified containment lifecycle. Unsupported platform, missing helper, failed profile/self-test, invalid policy, cancelled/expired approval or initialization failure cannot spawn an unrestricted command.
2. An ordinary offline local build/test succeeds inside the real production adapter. The original workspace is inaccessible to the child. An end-to-end cycle imports allowed inputs, modifies an existing file, creates a file and parent directory, and exports only individually authorized effects with correct contents and object binding.
3. Sensitive/protected objects and hard-link aliases never enter projection or leak through names, logs, environment, descriptors or toolchain roots. Child-created link tricks cannot trick export. Adversarial source/target swaps, multi-component ancestor swaps, conflict cases and helper protocol attacks produce proved bound effects or refusal.
4. Effective read/write/edit restrictions are honored across import, invocation and export. ASK/DENY/configuration-error matrices and replay/TTL/cwd/session/policy/content changes have effect-level regressions. Existing file-tool behavior remains covered.
5. Descendants retain filesystem and network restrictions. Working positive controls accompany denied network and synthetic Keychain/broker tests. Keychain results cover only the explicitly tested synthetic resource/service boundary, not perfect Keychain isolation.
6. Supported topology, case/Unicode aliases and mount assumptions are explicit. Carry B1/B6 (Keychain), B5 remainder (aliases), B7 (content binding), B8 (per-rule effects) into a production evidence matrix; close each applicable obligation or fail closed on its unsupported variant. Never convert missing evidence for a required guarantee to a harmless residual.
7. Package/install/rollback tests use isolated profiles and caches, include the chosen native artifact/build contract, and prove unsupported installations fail closed. No real user installation, credential access or settings change.
8. Contract, architecture, state, roadmap, compatibility/limitations and audit agree with actual bytes and behavior. Fresh independent review has no unresolved blocking finding; all relevant tests pass on the declared macOS target. Final state is **implemented, verified, awaiting owner acceptance**, not Goal 3 accepted or Phase 3 complete.

## Verification

- At entry: `git status --short`, `git rev-parse HEAD`, baseline ancestry/file-set/hash checks, and `npm run test:manifest`. Read relevant implementation/tests before edits.
- Add regression tests for each changed invariant. Use deterministic interleavings and working unsafe controls where a race claim depends on them; a repeated path check or stress run with no observed failure is not a proof.
- Run `npm run check` for the final code/test/dependency snapshot. Existing focused scripts are `test:configuration`, `test:approvals`, `test:controlled`, `test:gate`, `test:package`, `test:manifest`; use them during diagnosis without needlessly duplicating a passing full run. Add and document the actual native/containment test command; do not leave security tests unregistered or skip the target-platform evidence.
- Native evidence must exercise production binaries/profiles and all entry routes, full offline workflow/export, fd leakage including descriptors above 255, environment/stdin, parser/approval failures, background/daemon-survival negative controls for observational export quiescence and deterministic freeze-time concurrent writers (size-preserving mtime-restoring writes, file and directory substitution, authorization-to-applied-bytes binding), each protected rule/zone, symlink/hard-link/ancestor swaps, in-place conflicts, case/Unicode, network and synthetic Keychain behavior. Mock-only integration and inspected source do not substitute for actual supported Pi/OS effects.
- Preserve complete reproduction sources and bounded non-secret logs/results in the repository evidence layout. Record OS/build/architecture, Pi/Node/compiler/helper/profile identities, commands, controls, failures and limits. Label `EXECUTOR-RUN`, `REVIEWER-RUN`, `INSPECTION`, `UNVERIFIED` accurately.
- Record exact source/test/native/profile/package/contract hashes in a Goal 3 audit/manifest. Keep historical accepted snapshots identifiable. Existing manifest tests must continue passing; if covered files intentionally change, record old versus new identities and update current manifests without transferring the old review to new bytes. Do not rewrite historical research/audit verdicts.
- Independent review must cover the final full security path and exact snapshot, not merely research or selected snippets. Fix blockers within this Goal, then rerun affected checks and obtain a fresh review of changed artifacts. Review-only metadata added afterward must be clearly separated from reviewed payload hashes; never pretend a self-referential audit hash is final.
- Finish with `git diff --check`, inspect the final diff/status, and provide a concise report: outcome, changed artifacts, test/review evidence, remaining bounded limitations, and whether owner acceptance is the only remaining gate.

## Constraints

- No direct-workspace shell backend, VM/container substitution, widened network/Mach permissions, policy weakening, real credentials, privileged mounts/settings, system/toolchain installation, public release or Goal 4 work.
- B3 remains explicit: this architecture does not defend against an independent same-user host writer, including ordinary staging tampering indistinguishable from child output. A held directory descriptor binds an object even if renamed; do not claim permanent residence under the original pathname. These boundaries do not excuse child-controlled escapes or unsafe export.
- Mount protection is unverified research, not an approved universal guarantee. Define a supportable topology and tests without privileged host mutation; if the required boundary cannot be enforced or established, escalate that specific blocker.
- Do not change accepted pure policy semantics or unlock Goal 2 creation as incidental cleanup. Runtime integration and affected current docs/tests may change within Goal 3 with new evidence. Preserve historical evidence and the stash.
- Keep package private. Executor has no commit/push/publication authority from the preparation commits. Leave the reviewed implementation ready for the owner to accept and commit.

## Execution Notes

The owner explicitly requests autonomous completion and consultation with other agents instead of passing routine questions through them. Own the cycle: contract → implementation → targeted debugging → complete verification → independent review → necessary fixes → final report. Use advisors for bounded difficult questions and an independent reviewer for the final security snapshot; follow AGENTS.md resource and delegation limits. If that capability is unavailable, report the missing review gate honestly rather than calling self-review independent.

Do not stop after a plan, component, initial test pass, or routine reviewer finding. Make reversible design decisions within this contract, document them and continue. Consult an advisor before escalating a technical ambiguity. User-facing escalation is reserved for a genuine authority/security/scope decision or required evidence/tooling that cannot be obtained within the authorized environment. No new owner approval is needed to write the contract, implement the approved native component, run isolated tests or fix review findings.

Canonical doc updates to reflect implementation are in scope; preserve the 2026-09-17 approval and distinguish implementation completion from final owner acceptance. This handoff is self-contained for a fresh conversation with repository access; no earlier chat needs to be supplied.

## Escalate If

Stop the affected work, preserve completed work, and report the concrete evidence, recommendation and smallest owner decision if:

- The approved projection/native/Seatbelt design cannot satisfy a required invariant or an evidence-backed supported topology; another mechanism or weaker guarantee is needed.
- A new runtime dependency, external binary, privileged operation, toolchain installation, real credential access, broader OS scope or other unapproved contract is necessary.
- Baseline attribution is ambiguous or unrelated concurrent changes obstruct safe continuation.
- Actual macOS/Pi evidence or an independent review is unavailable after bounded attempts; do not claim completion based on Linux, mocks or a failed reviewer invocation.
- Solving a finding requires materially expanding Goal 3 or contradicting the approved security boundaries.

A report of a real blocker must name what remains incomplete; it must not mark the Goal accepted or start Goal 4. Otherwise continue to the final reviewed result without requesting routine confirmation.
