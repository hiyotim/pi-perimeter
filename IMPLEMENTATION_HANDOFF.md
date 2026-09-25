# Implementation Handoff

Task ID: 20260925-user-install-onboarding
Baseline: b308ed8b8ab1526e5b8287032e56867829279ce3 on main; staged and unstaged changes absent (git status --short empty). The baseline includes the committed startup fix and 1.0.1 staging preparation; local main is two commits ahead of origin/main. No v1.0.1 tag or published pi-perimeter@1.0.1 exists.
Scope Gate: READY

## Goal

Make the supported installation and first-use path understandable from README and demonstrate Pi package-manager behavior in an isolated profile. A new user should be able to identify the package, follow a short installation path, build the native helper, verify loading, and remove it without repository-internal knowledge. Distinguish a locally verified candidate from an actually published working version.

## Context

- Published pi-perimeter@1.0.0 fails to load in Pi 0.84.4 before its gates activate. The correction and 1.0.1 staging preparation are committed locally, but unpushed and unpublished. README currently has no direct npm package-page link or demonstrated pi install route, and its manual installation sequence names broken 1.0.0.
- The installed Pi 0.84.4 package documentation describes pi install npm:<package>@<version>, pi list, and pi remove npm:<package>. Documentation alone does not prove the corrected, unpublished package works through that route.
- test/startup-readiness.test.ts covers loader ownership, ordinary read, .env denial, missing-helper refusal, and contained shell after explicit helper build from an isolated packed-source install. It does not obtain the candidate with pi install or test an npm-published 1.0.1.
- README and this handoff are hash-bound in earlier Goal suites. Accepted historical manifest values are frozen evidence.
- The retained `pi-warden` spelling in `native/piwarden-helper` identifies the existing runtime helper path; this Goal does not rename that helper.

## Scope

- Rework the public onboarding portions of README.md: concise early status and target warning, direct canonical npm link, short install/verify/helper-build/first-use/remove steps, and links to detailed configuration and security limits. Keep the broken-1.0.0 warning prominent until a working version is published.
- Add or adapt isolated evidence for Pi 0.84.4 package-manager install/list/remove behavior, package location, and helper build location. Relate it explicitly to the existing packed-candidate runtime smoke; do not conflate either route with post-publication proof.
- Make only forced current-doc corrections if another public page would contradict README. Bind changed bytes with an additive manifest and explicit changed-file declarations in older suites; preserve historical manifest values. Adjust the CI test budget only for added tests.

## Out of Scope

- Push, tag, publish, dist-tag change, release acceptance, or a claim that a live pi-perimeter@1.0.1 installation works. The later release Goal must verify the exact published artifact and update live-version wording.
- Changes to published 1.0.0 bytes, its tag, historical accepted manifests/audits, P1–P18/R1–R11 guarantees, supported platforms or peer range, runtime enforcement, policy, or native-helper trust.
- A new installer, implicit native build, lifecycle script, runtime dependency, or installation into the real Pi profile as test evidence.

## Risk Gates

- Before making pi install the primary README path, verify the exact Pi 0.84.4 CLI/package-manager contract in installed source/docs and exercise install/list/remove in a disposable agent directory. If the package manager cannot install a local candidate through an equivalent npm-package route, state the evidence split; CLI syntax alone does not establish candidate installation.
- Confirm that the package root Pi reports is the root used by the explicit build:native command. The runtime must continue resolving its helper from its own module URL without catalog fallback.
- Verify the npm package identity and destination of the public link. While 1.0.0 is the only published version, do not present it as a functioning security control or present 1.0.1 as downloadable.

## Acceptance Criteria

1. Near the start, README tells a new reader what the package does, its exact supported target, the broken published-version status, and the canonical clickable npm link.
2. README gives a short, ordered, copyable install/verify/helper-build/first-use/remove path grounded in verified Pi 0.84.4 behavior. Version availability and any unverified step appear beside the relevant command; configuration and security detail remain accessible through links.
3. Isolated evidence demonstrates Pi package-manager installation, pi list package root, and removal without touching the user's Pi profile. Candidate runtime behavior remains covered by the packed-source smoke. The evidence distinguishes these routes and records what must wait for published 1.0.1.
4. An additive manifest binds the exact changed file set, including this handoff where earlier suites cover it. Historical values stay unchanged; relevant tests and the full declared-target checks pass with only documented platform skips.

## Verification

- Criteria 1–2: read README as a first-time user; check its npm and local documentation links; compare each command, profile path, helper path, and version claim with Pi 0.84.4 source/docs and isolated results; run git diff --check.
- Criterion 3: run isolated Pi package-manager install/list/remove evidence and the packed-source startup regression on the declared macOS target. npm run test:package supplies supporting pack/install/uninstall evidence, not proof of Pi CLI behavior. Preserve temporary-fixture cleanup and the canonical-tmpdir preload used by npm test.
- Criterion 4: run all manifest suites and npm run check, then compare Git status including untracked files with the additive binding. Obtain fresh independent review of final bytes before acceptance; an earlier PASS does not transfer after changed hashes.

## Constraints

- Use synthetic files and isolated HOME, npm cache, workspace, and Pi agent directory. Never install into or inspect the real user profile or real credentials.
- Preserve source private: true and version 0.0.0, the staged-only publishable manifest, fail-closed behavior, and the absence of implicit native compilation/download.
- Keep README user-facing and concise. Link to detailed Goal evidence instead of copying internal history into quick start. Claim only behavior shown for Pi 0.84.4 on the declared macOS 27.0 arm64 target.

## Escalate If

- Pi package-manager behavior cannot be exercised safely in isolation, reports an ambiguous package root, or differs materially from the manual install route; stop before advertising it as verified.
- Working onboarding requires runtime/security changes, a new dependency, lifecycle build, or wider platform/version guarantees; do not expand this Goal.
- Baseline, changed-file ownership, or authority to replace historical evidence becomes ambiguous; preserve the existing work and stop.
