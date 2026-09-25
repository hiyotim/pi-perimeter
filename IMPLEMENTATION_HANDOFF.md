# Implementation Handoff

Task ID: 20260925-release-v101
Baseline: 8c1e5b09bb14e4c3e9e7c6be550fb50a3ee8c41d on main; staged, unstaged, and untracked changes absent. Local main is four commits ahead of origin/main; no local v1.0.1 tag. The completed onboarding handoff is historical and hash-bound at SHA-256 6eb5e8556047a464399daa20dc91094a6a6a998b877e57bdbd26caa222cb774f.
Scope Gate: READY

## Goal

Release a verified pi-perimeter@1.0.1 that contains the startup correction and accepted onboarding, then demonstrate that a new user can obtain the published package through Pi 0.84.4 and use its supported macOS route. The result is the exact published artifact and an accurate public installation path, not merely a green local candidate.

## Context

- Published 1.0.0 fails at factory load in Pi 0.84.4 before its gates activate. The session_start readiness correction, versioned release machinery, and isolated package-manager onboarding are committed locally in 8365b34, b308ed8, and 1bfabc5; acceptance is recorded in STATE.md at 8c1e5b0. No v1.0.1 release evidence exists in this baseline.
- docs/release-hashes-1.0.1.json binds the earlier staging-preparation bytes, not the final release tree. Fifteen of its 28 recorded paths now differ after onboarding. The accepted historical manifest values and the completed onboarding handoff bytes remain in Git history; this active handoff replaces the working-tree file and must be declared as changed in the next binding. The final candidate needs an additive, version-specific binding selected by the release workflow.
- The repository release workflow publishes only on a matching vX.Y.Z tag push through npm Trusted Publishing with provenance; workflow_dispatch is verify-only. Source package.json remains private at 0.0.0 and only deterministic release-staging/ is publishable.
- The retained pi-warden spelling in native/piwarden-helper is an accepted helper-path identity, not a package name to publish or install.

## Scope

- Reconcile the current final-candidate file set and hashes with an additive v1.0.1 release binding. Make the smallest workflow/verifier/test changes needed to select and enforce that binding without changing historical 1.0.0 or staging-preparation manifest values. Include the new onboarding files, this replaced handoff, and any changed release metadata in the candidate assessment.
- Prepare a clean, reviewable release candidate with accurate versioned README instructions, exact supported target and limitations, and a release audit that separates prepublication checks from later hosted and registry evidence. Do not state that 1.0.1 is downloadable before registry proof.
- Verify the deterministic staging artifact and publish safeguards on the exact candidate, complete the repository checks on the declared target, and obtain fresh independent review of the candidate bytes and release path.
- After explicit maintainer authorization for the concrete candidate, use the existing protected release route. Record the tag/commit, hosted workflow result, npm metadata and provenance, then exercise an isolated Pi 0.84.4 install/list/helper-build/startup/remove flow using the actual npm-hosted 1.0.1 bytes. Update current public status and installation wording only to claims supported by those observations.

## Out of Scope

- Rewriting or republishing 1.0.0, its tag, accepted historical manifest values/audits, or the committed historical onboarding handoff in Git history. Do not silently rewrite the prep binding to match later bytes.
- Runtime enforcement or native-helper behavior changes, new dependencies, lifecycle scripts, implicit builds/downloads, platform or peer-version widening, or a real user Pi-profile install as test evidence.
- Publishing by local npm publish, token-based publishing, workflow_dispatch, a second publish step, or any route other than the guarded tag-push workflow.

## Risk Gates

- Before a release action, verify the remote branch/tag state and npm package/version ownership and availability. A conflicting remote head, existing v1.0.1 tag, or existing npm 1.0.1 requires stopping and reconciliation; never force-push or overwrite a release.
- Confirm the final release binding is additive and that the workflow actually selects it for v1.0.1. The tag/version guard, dispatch verify-only behavior, OIDC provenance, source private: true, and staged-only publish path must still hold. A green manifest unit test alone is not staging proof.
- Build and verify staging from a clean, committed candidate; run the full relevant checks and a verify-only hosted run when available. Put the candidate diff, manifest, staging result, review verdict, and exact proposed external actions before the maintainer before requesting release authorization. No push or tag is authorized by this handoff.
- After publication, obtain fresh registry metadata and the exact tarball. Isolated published-package behavior must use that tarball through Pi's npm-package route rather than a loopback registry or local pack substitute.

## Acceptance Criteria

1. The final 1.0.1 candidate has an additive exact-file binding that the release workflow selects and the staging verifier enforces; historical 1.0.0, prep, startup, and onboarding evidence remains unchanged or explicitly superseded without rewriting accepted bytes.
2. The clean committed candidate passes full relevant checks on the declared target, deterministic staging verification, publish-path safeguards, and fresh independent review with no release-blocking findings. A verify-only hosted run passes before any publishing tag is pushed.
3. After explicit approval of that candidate and release action, the matching v1.0.1 tag-push workflow succeeds and publishes pi-perimeter@1.0.1 with provenance. The npm version, dist-tag, tarball shasum/integrity, tag commit, and workflow run agree with the reviewed candidate.
4. A disposable Pi 0.84.4 profile installs pi-perimeter@1.0.1 from the actual npm registry, pi list reports the expected package root, the explicit helper build works on the declared macOS target, representative startup/authorization/containment checks pass, and pi remove cleans the isolated profile. README and current status then give a direct, copyable 1.0.1 install path and record the observed limits.

## Verification

- Criterion 1: compare the candidate manifest's exact key set and hashes with tracked release files; run the relevant manifest suites; inspect the workflow's selected path, tag/version guard, and publish condition. Check historical manifest and tag diffs are empty.
- Criterion 2: run npm run check, git diff --check, the existing release-staging builder/verifier for 1.0.1, and the release safeguard tests on the declared target; compare the staged file set with the manifest. Review exact final bytes independently. Confirm the verify-only workflow result before a tag push.
- Criterion 3: compare the pushed tag commit and successful release workflow log with npm metadata, integrity, and provenance for 1.0.1. Record the values and links in the release audit and STATE.md; do not infer publication from a local pack or a queued workflow.
- Criterion 4: run an isolated Pi install/list/build/startup/remove exercise against npm-hosted 1.0.1, using synthetic fixtures and the existing startup-readiness behavior checks as the reference. Check README links and commands against the observed registry/package root; distinguish installer evidence from the existing loopback and manually installed candidate smokes.

## Constraints

- Preserve P1–P18/R1–R11 and the documented macOS 27.0 arm64, Pi 0.84.4 boundary. Unknown or failed containment, ownership, helper trust, network, or approval conditions must fail closed. No credential fixtures from a real profile.
- Maintain one publish path: protected tag push, npm Trusted Publishing/OIDC, provenance, no token or local publish. The source remains private: true at 0.0.0; do not install development code into the real Pi profile.
- Treat candidate preparation, authorization to push/tag, hosted publishing, and postpublication verification as distinct evidence states. An earlier PASS does not transfer after relevant bytes change. Keep claims of downloadable functionality conditional until the actual npm artifact passes the published-package checks.

## Escalate If

- The final candidate requires changing runtime/security behavior, broadening supported targets, or replacing accepted historical bytes rather than adding a release binding; stop and seek a new scope decision.
- The remote/tag/registry state differs from the baseline, the dry-run/hosted checks fail, release review has blocking findings, or OIDC/provenance/publish gates do not hold; do not push the publishing tag.
- Postpublication metadata or installed behavior diverges from the reviewed candidate; report the exact mismatch and do not claim a working release or attempt to overwrite the immutable npm version.
