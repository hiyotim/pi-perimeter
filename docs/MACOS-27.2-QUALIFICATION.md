# macOS 27.2 and Pi 1.4.0 qualification

Task: `20261031-macos-27-2-v103`. Baseline: `a82707b6fa612ac21ea28292a149074908ba090b`. Released: `pi-perimeter@1.0.3`.

## Boundary and change

On macOS 27.2 (26B123), Darwin 27.2.0 arm64, the system sandbox-exec SHA-256 is `10cf4a46a575e4747d2419cf343800db0d11ae6e6e9b8415998d3d8f336b2a92`. Its on-disk signature and Apple anchor requirement passed `codesign --verify --all-architectures --strict --verbose=2 -R='anchor apple' /usr/bin/sandbox-exec` outside the Codex runner sandbox. Verification inside that runner could not establish trust; the external control check also verified /bin/ls.

The candidate adds this exact digest beside the historical `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`. Darwin 27, arm64, the fixed system path, metadata checks, helper identity and containment enforcement remain required. Unknown binaries stay refused. Project configuration and environment variables cannot add trusted hashes. No automatic trust or unrestricted fallback exists. Passing the identity gate alone does not qualify another OS update.

## Reproduction and isolation

Create a canonical disposable root named `/private/tmp/pi-perimeter-v103-<unique>` with `home`, `agent`, `peer`, `workspace`, `cache` and `tmp` directories. Construct the child environment explicitly with HOME, PI_CODING_AGENT_DIR and TMPDIR pointing there, an ordinary PATH, and isolated npm cache/user/global configuration. Do not inherit provider credentials. Install Pi 1.4.0 under `peer` and the candidate under `agent/npm`; configure only that package in the disposable agent settings.

Run `node test/pi-1.4.0-probe.mjs <root> 1.0.3` from its workspace before helper compilation, then build the installed package helper with `npm --prefix <installed-package-root> run build:native` and repeat the probe. The probe asserts the peer and package versions, profile paths, seven tool owners, file operations/refusals, unknown tool refusal, gate bindings, contained model/user shell and controlled export. Use real Pi install/list/remove for lifecycle verification.

The complete locked-peer check uses a separate source copy with real dependencies inside its workspace and a freshly compiled helper. An initial harness used a node_modules symlink outside that workspace; projection correctly refused the symlink and the contained build could not find tsc. Replace that fixture symlink with an actual isolated npm ci installation; do not change projection policy.

## Results

The isolated Pi 1.4.0 package probe passed 11/11 checks before helper compilation and 13/13 after compilation, including contained model shell, both user shell event routes, closed networking and export. Pi 1.4.0 typechecking and the applicable regression selection passed 441 tests / 440 pass / 0 fail / 1 declared skip. Two original integrations explicitly pinned to Pi 0.84.4 were excluded without editing them.

The initial complete locked-peer run collected 443 tests: 441 passed, one failed on a stale package-name retention-list entry, and one declared skip remained. Native containment, network, export and the new missing/corrupt helper and failed sandbox initialization checks passed. The stale declaration was removed and its focused check passed. The final complete locked-peer run passed **444 tests / 443 pass / 0 fail / 1 declared skip**. The final Pi 1.4.0 selection passed **442 tests / 441 pass / 0 fail / 1 declared skip**. Both include the native suites on macOS 27.2. Typechecking passed for both peers. [Structured results](macos-27.2-results.json) record the counts and log digests.

Independent runtime review passed with no confirmed defects; the reviewer separately ran all four pure platform tests. Independent release review reproduced the exact binder outputs without writes, verified idempotence, the existing-tag refusal, current-only preservation and all 22 frozen historical manifests. It found one current-evidence test gap: a removed historical suite could avoid successor validation. The checker now discovers suites independently from the filesystem, requires their bindings, and includes a regression that removes the maintenance suite from a copy of the real binding. The focused regression passes. Independent bounded re-review passed after the repair, with 51/51 manifest tests and no blocking findings. Primary final metadata checks passed 55/55 after recording the full-run outcomes.

Publication and actual-registry verification passed. The downloaded archive matched all 133 staging files and registry integrity; real Pi install/list/helper/tool/shell/remove passed 11/11 and 13/13. [Release result](RELEASE-1.0.3-RESULT.md) records the immutable tag, workflow, archive and provenance correspondence.

Physical approval dialogs and provider-backed conversations are unverified. Old macOS evidence remains historical. The ordinary user Pi profile is outside this task.

## Bindings

Run `node scripts/bind-release-1.0.3.mjs` before freezing the release candidate to reproduce exact successor declarations, current source hashes and version-specific staging hashes. Earlier manifests remain byte-for-byte unchanged. After the v1.0.3 tag exists, only `--current-only` is allowed for source closeout evidence; the release manifest stays frozen.
