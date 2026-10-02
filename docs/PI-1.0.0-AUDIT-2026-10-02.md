# Pi 1.0.0 isolated compatibility exercise

Date: 2026-10-02. Task: `20261002-publication-maintenance`. Baseline: `4f64eb714bec9acd474b1328b933e05c67955206`. The owner authorized testing on this Mac after confirming there was no external test Mac, subject to preserving the ordinary Pi installation and profile and removing the disposable test environment afterwards. This supersedes the earlier external-only testing constraint for this isolated exercise.

## Environment and isolation

- Actual host: macOS `27.0.1`, build `26A434`, Darwin `27.0.0`, arm64; Node `26.8.1`.
- Containment mechanism: `/usr/bin/sandbox-exec`, SHA-256 `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`, equal to the previously pinned identity. The runtime checks Darwin major, architecture, binary ownership/mode, and this hash; it does not compare the marketing OS build string.
- Separate source snapshot and separate npm-installed Pi `1.0.0` under a disposable canonical `/private/tmp` directory. No global installation, self-update, or real-profile package registration was performed.
- Child processes used an explicit environment with a fixture home, fixture agent directory, fixture caches, fixture temporary root, and empty npm configuration. Provider credential variables were not inherited. No credentials were copied or read and no model-generation request was made.
- Ordinary Pi CLI bytes, Node executable bytes, and metadata for the existing profile's settings, authentication file, models, MCP configuration, and resource directories were captured for preservation checks. Authentication-file contents were not read.

## Checks and results

The corrected source snapshot first passed `npm run check` with the locked Pi `0.84.4`: **435 tests, 434 pass, 0 fail, 1 declared skip**. This includes the isolated packaging, startup, containment, export, network, and maintenance-binding checks. The packed candidate included the security policy and every relative file link from the README and security policy.

With Pi `1.0.0` substituted only in that temporary snapshot, typechecking passed after updating the test-only runtime stub with the new `ToolInfo.exposure` and `ExtensionActions.getSettings` fields. Production `src/` was unchanged. The complete applicable regression selection passed: **433 tests, 432 pass, 0 fail, 1 declared skip**. The two excluded tests, `startup-readiness.test.ts` and `user-install-onboarding.test.ts`, explicitly assert Pi `0.84.4` and had passed in the locked-peer run; they were not weakened or relabeled as new-peer evidence. The separate real-Pi exercise below covers the new peer's loading and package lifecycle.

Using the real registry and the separate Pi `1.0.0` CLI:

1. `pi install npm:pi-perimeter@1.0.1` succeeded into the disposable agent directory.
2. `pi list` reported the pinned package and its disposable installed root.
3. Before helper compilation, the SDK/event-dispatcher probe passed 11 checks: real loading and readiness; seven tool owners; ordinary read; synthetic secret denial; external read refused without approval UI; unknown/codemode/MCP refusal; existing-file write and edit; controlled listing/find/grep; unbound direct-tool execution refusal; missing-helper refusal.
4. Explicit helper compilation succeeded inside the installed disposable package.
5. After compilation, the probe passed 13 checks, including contained model shell with closed networking, contained replacement results from both user `!` and `!!` event routes, and export of shell changes into the synthetic workspace.
6. The installed published package and source snapshot had **38/38 identical runtime-source files**, with no missing files or hash mismatches. Packaging/documentation and test-fixture changes do not alter runtime bytes.
7. `pi remove npm:pi-perimeter` succeeded; the package settings entry and installed directory were gone.

The reproducible probe is `test/pi-1.0.0-probe.mjs`. It requires an explicit disposable fixture root under `/private/tmp`, a matching fixture home and agent directory, a separately installed peer under `peer/`, and the package under `agent/npm/`. It executes no model-generation request. It is deliberately separate from the two locked-0.84.4 regressions and does not silently test another peer version.

Two initial probe failures were harness errors: a scalar edit request was corrected to the supported `edits` array; a direct call to the trusted SDK's low-level `executeBash` was corrected to the actual `user_bash` event dispatcher used by interactive `!`/`!!`. Inspection of Pi `1.0.0`'s `InteractiveMode.handleBashCommand` confirmed that a replacement result stops local shell execution. No physical interactive-terminal automation or provider-backed model conversation is claimed.

## Preservation and limits

The original Pi CLI and Node executable hashes were unchanged. The sampled personal-profile metadata was unchanged, including the settings and authentication-file metadata. This is a bounded preservation check, not a byte-for-byte read of personal credentials or all session history. The disposable package was uninstalled successfully. The full disposable fixture was deleted after the final checks; cleanup and the final 86/86 focused check are recorded in [MAINTENANCE-2026-10-02.md](MAINTENANCE-2026-10-02.md).

The observed compatibility boundary is these operations with Pi `1.0.0` on this exact macOS/Node/architecture combination and these runtime bytes. Earlier accepted guarantees and immutable release manifests remain historical evidence. No guarantee is expanded to other OS builds, other peer versions, arbitrary extensions, direct trusted SDK calls, or unintegrated tools. `codemode` and MCP tools remain blocked. Approval refusal was exercised with no interactive approval UI; a physical approval dialog was not exercised. Fresh independent review, owner acceptance of any changed support claim, GitHub CI for the final commit, and a corrected release remain separate pending steps.
