# Implementation Handoff

Task ID: `20260922-stabilize-guarantees`
Baseline: `0d6764d042952cd0fbcd4fb27eee49220feb5a7c` (index empty; unstaged `M IMPLEMENTATION_HANDOFF.md, M ROADMAP.md, M STATE.md` — Phase 6 gate-closure record edits; untracked `.commandcode/` session tooling only)
Scope Gate: READY

## Goal

Stabilize the narrow final v1.0 security-guarantee set: one explicit list of what `pi-perimeter` promises and what it does not, closing only the Phase 7 checklist item "Stabilize the supported security guarantees".

## Context

- Phase 6 gate closed by owner decision 2026-09-22; Goals 1–4 accepted within their documented contracts and declared limitations; `npm run check` 388/387/0/1 at the release-review acceptance commit `0d6764d`.
- Declared target unchanged: macOS 27.0 (26A428) arm64, pinned `/usr/bin/sandbox-exec` identity, Pi `0.84.4` the only verified peer, Node `26.8.1` (target) / `22.19.0` (hosted Linux floor); hosted CI covers the platform-independent Linux suite only.
- Inherited residuals that this Goal must carry forward verbatim, not silently close: mount isolation UNVERIFIED, same-user host writers (B3, including projection/broker-endpoint tampering), no descendant-termination guarantee (variant-B captured-bytes invariant only), Class 1 `/proc/self/fd` Linux runtime-evidence question open, Keychain beyond the synthetic probe uncovered, endpoint exfiltration to allowed destinations.
- Accepted evidence bytes stay bound by their manifests (`docs/*-hashes.json` + suite-enforced `CHANGED_IN_*` records); wording changes to bound files require explicit manifest declarations, never silent rewrites.
- Phase 7 order (owner decision): 1 stabilize → 2 regression-per-guarantee → 3 unknowns bound → 4 independent audit → publication as a separate maintainer decision (push, `private: true` removal, provenance from CI). This Goal is step 1 only.

## Scope

- One stabilized guarantee record: new `docs/V1-GUARANTEES.md` (or equivalent single location) listing each v1.0 promise with its exact platform/operation/threat boundary plus its evidence pointer (contract section, audit section, suite), and each explicit non-promise with its bound.
- Narrow user-facing wording alignment to that record in `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `THREAT_MODEL.md`, `docs/COMPATIBILITY.md`, `docs/PACKAGING.md` — only where a line currently promises more, less, or otherwise than the stabilized set.
- Manifest binding for this Goal's artifacts following the repository's manifest-plus-test pattern: new or extended `docs/*-hashes.json` entry/entries plus suite(s), `CHANGED_IN_*` declarations in every earlier suite whose covered bytes change, explicit `test/ci-test-budget.json` update if and only if the collected set changes, retention-list update in `test/packaging-identity.test.ts` if and only if new files carry old-name mentions.
- Review evidence record for this Goal (audit doc) distinguishing reviewer-run from executor-run checks.

## Out of Scope

- Any runtime, policy, approval, sandbox, network, dependency, packaging, or CI behavior change; any source change under `src/`, `scripts/`, `.github/`, `package.json`/`package-lock.json` behavior.
- Closing any other Phase 7 item (regression-per-guarantee gaps, unknown-resolution, independent v1 audit), closing the Phase 7 gate, releasing, tagging, publishing, removing `private: true`, wiring provenance, pushing, or installing into a real Pi profile.
- Extending platform support, adding a hosted macOS job, verifying new Pi/Node versions, resolving the Class 1 Linux question, or making any mount/B3/descendant/Keychain claim beyond the inherited bound.
- Rewriting accepted evidence bytes without a manifest declaration; smoothing a disagreement by rewording evidence away.

## Risk Gates

- `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `THREAT_MODEL.md`, `COMPATIBILITY.md`, `PACKAGING.md`, `CI-EVIDENCE.md`, `ROADMAP.md`, `STATE.md`, and the gate contracts/audits must agree with the stabilized set; a pre-existing disagreement is a finding to correct inside this Goal or to record explicitly, never to smooth over.
- No guarantee beyond its cited evidence; hosted CI must never be presented as containment evidence; `ordinary` classification must never be presented as proof of no secret content.
- Review evidence must distinguish reviewer-run checks from executor-run checks; acceptance binds to exact bytes/hashes of the reviewed snapshot.

## Acceptance Criteria

1. One stabilized v1.0 guarantee set is published in a single record; every promise names its exact boundary (platform, operations, threat) and its evidence pointer, and every known residual names its explicit bound.
2. `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `THREAT_MODEL.md`, `COMPATIBILITY.md`, and `PACKAGING.md` agree with the stabilized set; every disagreement found is corrected or recorded as an explicit limitation.
3. No runtime, dependency, packaging, or CI behavior changed; no platform support, publication, or installation claim added.
4. This Goal's artifacts are bound by a manifest and its test; `npm run check`, all manifest suites, and `git diff --check` pass locally, and the hosted run for the final commit is green with the declared counts.
5. A fresh independent review of the final snapshot returns PASS with no blocking findings before owner acceptance; acceptance closes only the "Stabilize the supported security guarantees" item.

## Verification

- Criterion 1: read each promise against the artifact it cites (contract/audit section, hosted run id via `gh run view` where reachable, suite on the declared target); read each residual against its declared bound.
- Criterion 2: read every user-facing guarantee claim against the stabilized record; confirm no claim exceeds it.
- Criterion 3: `git status --short` / `git diff` show docs + test-binding + audit only; `package.json` still `private: true`, no lifecycle scripts, CI never publishes.
- Criterion 4: `npm run check`, the manifest suites, `git diff --check`; confirm the hosted run for the final commit is green and the count assertion reports the declared numbers.
- Criterion 5: independent review of the exact final bytes; owner acceptance recorded in `STATE.md`.

## Constraints

- Documentation and test-binding only: no new runtime dependency, no secret, no publication, no real-profile installation.
- Preserve the `AGENTS.md` security invariants; tests use isolated temporary fixtures only; no real credentials.
- Work on `main`; no additional topic branches.
- Exact versions, run identifiers, and hashes only; never invent evidence.
- Prior pattern holds: earlier manifests keep historical entries via declared change sets; a stale PASS never transfers to different bytes.

## Escalate If

- A stabilized promise cannot be sourced to recorded evidence without a code or guarantee change.
- The review exposes a real incompatibility or an open bypass of a claimed protection (release blocker) needing implementation outside this Goal.
- Stabilization would require a support commitment, a platform claim, or publication authority.
- The Goal splits into independently reviewable outcomes (e.g. guarantee wording vs. unknown-resolution) — stop, do not expand; that is a decomposition signal, not an invitation to absorb the next Phase 7 step.
