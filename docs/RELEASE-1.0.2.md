# 1.0.2 release preparation record

Date: 2026-10-02. Task: `20261002-release-v102`. Release baseline: `16f869b654ec68c747ad00a51fcb07ca562fd39f`; original maintenance baseline: `4f64eb714bec9acd474b1328b933e05c67955206`.

The owner approved the proposed independent review, commit/push/PR/merge after CI, and separate patch release. `1.0.2` was absent from the real npm registry and GitHub tags when selected. No old version, tag, archive or accepted historical manifest will be rewritten.

## Change and boundary

The patch delivers the concise user README, separate-profile guide, documentation index, accurate configuration/compatibility/security wording, packaged security policy and linked root documents, and current Pi compatibility evidence prepared in maintenance. Install instructions target this release. Production `src/`, the lockfile and workflows are unchanged from the maintained baseline; no new tools, containment permissions or formal platform guarantees are introduced.

The source tree remains private at `0.0.0`. The existing staging builder copies the committed tracked tree and transforms only the package version to `1.0.2` and removes `private`. The version-specific manifest is `docs/release-hashes-1.0.2.json`: it binds every tracked candidate file except itself, plus the builder's `.release-version`, with the transformed package hash. The manifest is excluded from its own digest to avoid self-reference. The staging verifier checks the exact staged file set independently. Earlier release manifests remain frozen; the maintenance successor binding remains test-enforced.

## Required delivery sequence

1. Independent review of the release delta and bindings, then commit/push a release PR and require green CI.
2. Dispatch the existing Release workflow in verify-only mode on the exact candidate with version `1.0.2`. It must pass tests/count assertion, deterministic staging, hash verification and pack dry run; dispatch does not publish.
3. Push the fresh `v1.0.2` tag only after verification. The existing trusted-publisher workflow publishes with provenance.
4. Fetch the actual registry archive; verify version, integrity, provenance, packaged documentation and unchanged runtime identities. Exercise install/list/load/helper/file/shell/remove in a disposable Pi `1.0.0` profile with fake data, no real credentials or model requests; remove the fixture.
5. Merge the release PR after successful publication/verification so public main does not instruct users to install an unavailable version. Create the GitHub release for the verified tag and record exact source/tag/run/artifact/result identities.

Maintenance source independent review passed, and its push/PR CI passed (435/381/0/54). The most recent macOS source check passed 435/434/0/1, with prior Pi `1.0.0` applicable checks 433/432/0/1 and a published `1.0.1` exercise. These are historical evidence for those snapshots, not verification of the forthcoming registry archive. Physical approval UI/provider conversations remain unverified. Candidate review, hosted release staging, publication, real-registry verification and final closure are pending at this preparation checkpoint.
