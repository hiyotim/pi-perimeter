# 1.0.2 publication and verification result

Date: 2026-10-02. Task: `20261002-release-v102`. Original maintenance baseline: `4f64eb714bec9acd474b1328b933e05c67955206`. Release baseline: `16f869b654ec68c747ad00a51fcb07ca562fd39f`. Released result commit: `dcf01cea7b0bbbe0a486fef4773879420734d756`; annotated tag `v1.0.2` object `393a7461c1d3cacadff79a22ae3c84a71040ced8`. [Source PR #2](https://github.com/hiyotim/pi-perimeter/pull/2) merged as `847ee38da9cbb9296e7f6c16440c8849e71f7d70`; its main CI `37057943914` succeeded. The [GitHub Release](https://github.com/hiyotim/pi-perimeter/releases/tag/v1.0.2) was published on 2026-10-02. Subsequent documentation closeout preserves the tagged bytes.

## Delivery and identity

Fresh independent maintenance FULL/VERIFY and release-delta reviews passed. The release review binds maintenance manifest `e953f142adad0ac1d15a14c51b436b09354f9b120fcf9e3e9abc855577756c67` and version-specific manifest `570715823e9a2d3660c95ae474540602c6d8ca9439269a86841492de69d1fc31`. All 181 staging-manifest entries matched. Source production runtime, lockfile and workflows are unchanged.

Candidate push/PR CI runs `37055400788` / `37055549403` succeeded. Verify-only Release run [37055631802](https://github.com/hiyotim/pi-perimeter/actions/runs/37055631802) succeeded on the exact candidate and skipped publication. The fresh tag then triggered [publish run 37056068587](https://github.com/hiyotim/pi-perimeter/actions/runs/37056068587), which succeeded, and tag CI `37056068574` succeeded. Hosted counts: 435 tests, 381 pass, 0 fail, 54 declared platform skips. The earlier complete disposable macOS candidate check passed 435/434/0/1.

The real npm registry reports `pi-perimeter@1.0.2` as `latest`. The archive downloaded successfully: 124 files, SHA-1 `1778c6f516c81a112edb8bc6160798cb08ac5970`, SHA-256 `20b13648bad0be9b352901ea31a5bfe6e452eb2046a17b0750dcd7a018989e0b`. Its SHA-512 integrity matched the registry. Every packaged file hash matched the reviewed staging manifest, including the manifest's separately reviewed digest. All 38 tracked runtime-source files were present and unchanged; no tests, dependencies, credentials or native build outputs shipped. SECURITY.md and 41 relative links from the README/security/usage/index documents were present.

The npm provenance statement was fetched: its SHA-512 subject matched the downloaded archive and its resolved dependency URI was exactly `git+https://github.com/hiyotim/pi-perimeter@refs/tags/v1.0.2` with `digest.gitCommit` equal to `dcf01cea7b0bbbe0a486fef4773879420734d756`. These fields were fetched again and asserted directly after the runtime exercise. This checks provenance availability and correspondence, not an independent cryptographic signature verification. Full metadata and structured outcomes: [release-results-1.0.2.json](release-results-1.0.2.json).

## Actual package exercise and cleanup

On macOS `27.0.1` (`26A434`) arm64, Node `26.8.1` and a separately installed Pi `1.0.0`, the real registry package passed install/list/loading/readiness, seven tool owners, ordinary read, synthetic secret denial, approval refusal without UI, unknown/MCP/codemode refusal, existing-file write/edit, controlled search/listing, unbound execution refusal and missing-helper refusal: 11/11 checks. After an explicit helper build in the disposable installed package, the probe passed 13/13 checks, including contained model shell, both user !/!! event routes, closed networking and authorized export. All 124 installed archive files matched the registry archive before helper compilation.

The temporary package was uninstalled and its settings entry removed. The entire separate peer/profile/project/helper/cache fixture was deleted. Ordinary Pi/Node hashes and sampled profile metadata remained unchanged. Authentication-file contents were not read; no real credentials were copied and no model request was made.

Physical approval dialogs and provider conversations remain UNVERIFIED. Broader OS/peer/security guarantees, same-user adversarial isolation, mount isolation and Keychain isolation are not accepted by this release. The source and actual package checks establish only their documented combinations and operations.

## Historical bindings

`docs/release-hashes-1.0.2.json` remains frozen and belongs to the tagged candidate, not later documentation closeout commits. Current maintenance hashes and `docs/release-hashes-1.0.2-postpublication.json` bind the subsequent evidence/continuation wording. Old tags, archives and historical manifests are preserved. Reproducing 1.0.2 staging requires the tagged commit; later releases require their own version-specific manifest.
