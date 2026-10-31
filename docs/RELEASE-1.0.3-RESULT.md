# 1.0.3 publication and verification result

Date: 2026-10-31. Task: `20261031-macos-27-2-v103`. Baseline: `a82707b6fa612ac21ea28292a149074908ba090b`. Source commit: `8a5c2894f632d59678d7e0f2f523139a5e24e357`. [PR #4](https://github.com/hiyotim/pi-perimeter/pull/4) merged as `7b2d4b8451e89f2521b2d340863593d1c317488e`. Annotated tag `v1.0.3` object: `44922b869ada0716a622df6c6fb852f0a59b5884`. The [GitHub Release](https://github.com/hiyotim/pi-perimeter/releases/tag/v1.0.3) and npm `pi-perimeter@1.0.3` are published; npm latest is 1.0.3.

## Fix and verification

macOS 27.2 changed the system sandbox-exec identity. The release admits its exact qualified SHA-256 alongside the historical identity. Platform, metadata and helper checks remain required; unknown identities and unavailable containment still refuse execution. There is no configuration override, automatic trust or unrestricted fallback.

On macOS 27.2 (26B123), Darwin 27.2.0 arm64 and Node 26.8.1, the complete locked Pi 0.84.4 check passed 444 tests / 443 pass / 0 fail / 1 declared skip. Pi 1.4.0 typechecking and applicable regressions passed 442 / 441 / 0 / 1. Two historical version-pinned integrations were preserved and exercised by the locked run. Native containment, network, export, helper refusal and invalid-profile launch checks passed. Physical approval UI and provider conversations remain unverified.

Independent runtime review passed. Independent release review found one successor-discovery regression gap, which was fixed and covered by a biting removal test; bounded re-review and final evidence review passed. Final source metadata checks passed 55/55. See [qualification](MACOS-27.2-QUALIFICATION.md) and [structured release results](release-results-1.0.3.json).

## Delivery and immutable artifact

Candidate push and PR CI passed: [41205510937](https://github.com/hiyotim/pi-perimeter/actions/runs/41205510937), [41205540708](https://github.com/hiyotim/pi-perimeter/actions/runs/41205540708). Merged main CI [41205616225](https://github.com/hiyotim/pi-perimeter/actions/runs/41205616225) passed. Verify-only Release [41205667571](https://github.com/hiyotim/pi-perimeter/actions/runs/41205667571) passed on the released commit with publication skipped. Tag CI [41205815426](https://github.com/hiyotim/pi-perimeter/actions/runs/41205815426) and publish workflow [41205815433](https://github.com/hiyotim/pi-perimeter/actions/runs/41205815433) passed. Hosted Linux outcome: 444 tests / 388 pass / 0 fail / 56 declared platform skips.

Clean committed staging matched all 193 release-manifest entries; staging tree SHA-256 `f4fd4ac435a2a850f9756679e28a0cc5673f8c95aa3a01716af0bfeed9d9c361`. The frozen release manifest SHA-256 is `197a97059e3bc5fcba8504903ecb7950b425e28dbcf9ed4975d0968dd96375fa`.

The actual npm archive contains 133 files. SHA-1 `7d7bad3534536c676caa0ba5ff9c8f0b61445034`; SHA-256 `741e25ad371c213b8bbe747227e4eaeb6be7e63034444ed12f2006a360bb73ec`. SHA-512 integrity matches npm metadata, and every packaged file matches the reviewed staging, including all 39 runtime-source files. The installed package also matched all 133 archive files before helper compilation. No tests, dependencies or compiled helper artifacts shipped.

The provenance subject SHA-512 matches the downloaded archive. Its source URI is `git+https://github.com/hiyotim/pi-perimeter@refs/tags/v1.0.3`, its resolved gitCommit is `7b2d4b8451e89f2521b2d340863593d1c317488e`, and its invocation is publish run 41205815433. This verifies availability and field correspondence, not independent signature cryptography. npm initially returned 404 while processing the accepted publication; no second publication was attempted.

## Actual-registry lifecycle and cleanup

A separately installed Pi 1.4.0 installed `npm:pi-perimeter@1.0.3` into a disposable profile and listed its expected root. Before helper compilation, 11/11 SDK checks passed. After an explicit installed-package helper build, 13/13 passed, including contained model shell, both user !/!! event routes, closed networking and controlled export into synthetic workspace files. Real Pi remove succeeded, packages became empty and the installed package directory was absent.

The environment used separate HOME, agent directory, npm configurations/cache and TMPDIR; child environments did not inherit provider credentials. No real credentials or ordinary Pi profile were used. All disposable dependency/source/helper/profile/cache directories were deleted after retaining local verification logs and the public registry archive. The generated staging directory was removed. The ordinary Pi profile was untouched.

## Historical bindings

The tag, archive and `docs/release-hashes-1.0.3.json` remain frozen. Subsequent documentation closeout updates only the current source binding using `node scripts/bind-release-1.0.3.mjs --current-only`. All 22 earlier historical hash manifests remain byte-for-byte unchanged. Reproduce release staging from v1.0.3; source closeout documents do not change the published archive.
