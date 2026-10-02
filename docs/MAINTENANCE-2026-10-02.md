# Publication and compatibility maintenance

Task: `20261002-publication-maintenance`. Baseline: `4f64eb714bec9acd474b1328b933e05c67955206`. The owner requested fixes after a read-only publication audit. Scope: distribution documentation and packaged documentation; no runtime, authorization, approval, containment, network, or supported-platform expansion.

## Source corrections

- The package includes an explicit list of root Markdown documents, including the security policy and the root documents linked from its README. Arbitrary future root files are not automatically selected. The existing isolated pack/install/remove regression checks the README and security-policy links against the packed file list.
- Package metadata no longer embeds obsolete release status. The current repository README will ship in a future release; the existing `1.0.1` archive is immutable and still contains prepublication wording.
- Agent instructions describe implemented enforcement within the verified boundary.
- The README explains that `pi list` confirms registration, not successful loading or protection. First-use verification uses only disposable synthetic fixtures and requires the expected allow/deny/refusal behavior.
- The compatibility matrix records the subsequent isolated Pi `1.0.0` exercise and exact macOS/Node combination, without rewriting earlier acceptance records. Unknown tools remain blocked, including `codemode` and MCP tools. Extension code itself remains trusted host code.
- Historical hash manifests are preserved. A separate maintenance binding covers the changed source files and the exact successor declarations in older manifest suites; it is not runtime evidence or release acceptance.

## Evidence and unresolved work

The 2026-10-02 audit read GitHub metadata, Actions results, official Pi `1.0.0` source, and the real npm registry. The `1.0.1` tarball downloaded successfully, contained 105 files, and had SHA-1 `8387c82ddb3f730512b6d43d577954981e3f24fd`. GitHub `main` matched the baseline and its latest Linux CI succeeded: 433 tests, 379 pass, 0 fail, 54 skips. Those checks precede these edits.

The initial external-only constraint was superseded by the owner's explicit permission to test on this Mac with a disposable Pi copy/profile/project and subsequent cleanup. The ordinary Pi installation and real profile were not used. The locked-peer source checks passed 435/434/0/1; Pi `1.0.0` typechecking and applicable regressions passed 433/432/0/1, and the real published-package lifecycle/tool/shell exercise succeeded. [Exact method and limits](PI-1.0.0-AUDIT-2026-10-02.md). These changes remain uncommitted, unpushed, unreleased, and not independently accepted.

## Verification and remaining closure

1. Local isolated source checks and actual packed-document link checks passed. Hosted Linux CI for the eventual final commit remains pending; its declared budget is 435 tests / 0 failures / 54 skips.
2. Separate Pi `0.84.4` and `1.0.0` exercises ran with temporary homes, profiles, caches, and synthetic workspaces on the actual macOS `27.0.1` (`26A434`) arm64 host. The pinned containment identity matched. No real credentials, real-profile package install, or model-generation request was used.
3. The new-peer published-package exercise covered install/list/remove, real loading and readiness, tool ownership, supported file operations, synthetic secret denial, external approval refusal, unknown-tool refusal, missing-helper refusal, explicit helper build, contained shell and both user-shell event routes, closed networking, and controlled export. Applicable containment/network regressions and typechecking passed. The preserved reproduction probe checks fixture isolation before use. Physical UI approval and provider-backed conversations were not exercised.
4. Obtain fresh independent review of the final changed bytes. Publish only after the maintainer's release decision and version-bound artifact verification. Verify the resulting real npm archive after publication. Do not relabel `1.0.1` as already repaired.

Earlier accepted guarantees stay bound to their original peer/target. The new exercise is evidence only for its exact documented combination and methods, pending independent review and formal support acceptance. Linux CI cannot close the macOS containment gate. Enabling new tools or extending to arbitrary OS/peer versions requires separate implementation and evidence; disabling fail-closed checks is not a compatibility repair.

## Maintainer actions prepared, not executed

- Mark the broken npm version with `npm deprecate pi-perimeter@1.0.0 "Fails to load in Pi 0.84.4 before security gates activate. Use pi-perimeter@1.0.1; see the repository compatibility matrix."` using the maintainer's npm account. No credential is stored or requested by this task.
- Prepare a new patch release after external checks and independent review. The release workflow must receive an explicit version and a fresh version-specific release manifest. No old tag, archive, or accepted manifest is rewritten.
- The Pi `1.0.0` runtime qualification succeeded within the recorded limits. A test-only host stub was updated for new tool-exposure/settings API fields; production runtime bytes stayed unchanged. No unrestricted peer-range support is inferred.

## Final isolated check and cleanup (2026-10-02)

After the test-stub and documentation updates, the locked Pi `0.84.4` typecheck and 86 focused gate/packaging/compatibility/manifest tests passed (86 pass, 0 fail, 0 skip). The current Pi `1.0.0` typecheck and all applicable runtime regressions had passed on the same unchanged production runtime. The temporary package was uninstalled, its profile entry was gone, and the complete disposable audit directory (separate Pi copies, source snapshot, native helpers, caches, synthetic workspaces and temporary logs) was deleted. Original Pi/Node hashes and sampled personal-profile metadata still matched the initial snapshot. Credentials were not read. Structured outcomes and runtime-source identities are in `docs/pi-1.0.0-results-2026-10-02.json`.

Source preparation and isolated local verification are complete. Fresh independent review, maintainer commit/push, hosted CI, npm deprecation and a corrected release remain pending; no acceptance or publication is inferred from these checks.

## User documentation refresh (2026-10-02)

The owner additionally requested a clearer user-facing README and removal of unnecessary onboarding clutter. The README now explains purpose, supported routes, exact exercised versions, installation/helper build, activation checks, practical limits, and removal. A usage guide covers an optional separate Pi profile, synthetic first-use checks, troubleshooting, and cleanup. The documentation index separates user guidance, technical contracts, contributor instructions, and historical evidence. Repeated phase histories and manual development-install instructions were removed from the README. Existing audit records and historical hash manifests remain preserved.

The security policy was shortened around the actual boundary and private reporting route. The compatibility matrix presents current evidence first and collapses the earlier dated record. Configuration documentation now describes its integrated use and optional network schema rather than incorrectly claiming no tool consumes it. Contributor guidance no longer calls the published package pre-alpha, and the development guide clarifies that containment tests use a Seatbelt profile, not the personal Pi profile. No runtime permissions or guarantees changed.

Documentation verification results are recorded below. The immutable npm `1.0.1` archive and GitHub baseline are not changed by local documentation preparation.

### Documentation verification and final cleanup

The final refresh snapshot passed an explicit native-helper build and `npm run check` with the locked Pi `0.84.4` peer: typecheck PASS; 435 tests, 434 pass, 0 fail, 1 declared skip. This includes the pack/install/remove regression, packed README/security links, distribution identity, and the current/historical manifest bindings. An additional static check validated 94 local links and heading anchors in the eight affected user/contributor documents. All six shell examples parsed successfully without execution; both configuration examples parsed as JSON. The source runtime, lockfile, and workflows remain unchanged.

The full check used an actual dependency copy in a disposable source workspace, a temporary native helper, fake home/profile, isolated caches and synthetic fixtures. No model request or ordinary-profile installation was performed. All temporary directories were removed. Two preliminary fixture-preparation issues were corrected: a broad copy exclusion omitted the native C source, then a dependency symlink was correctly excluded from the shell projection. No assertion or containment check was weakened. The final actual-copy run passed.

The current-byte manifest and distribution checks were rechecked after recording these documentation-only results. Independent review, maintainer commit/push, hosted CI, and a corrected release remain pending. The existing npm archive is unchanged.

## Independent source review and delivery authorization (2026-10-02)

A separate fresh-context reviewer returned **PASS, no blocking findings**, for baseline `4f64eb7` plus maintenance manifest SHA-256 `b30788b2b93052a3c48505033e7a5a5e95ac65bf5f26466412d3c1611b68313b`. The reviewer independently checked all 40 successor-bound files, preserved historical manifests, exact exceptions, unchanged production runtime/lockfile/scripts/workflows, 52 manifest/identity tests, 94 local links/anchors, package inclusion and user guidance. The review found no new exposed credentials or personal paths. It did not independently rerun containment/network/Keychain, actual Pi lifecycle, provider conversations, or physical approval UI; those limits remain explicit.

The owner authorized commit/push, a pull request and merge after CI, plus a separate patch release. `1.0.2` is available and selected for the release preparation. This authorization supersedes earlier not-authorized/pending-owner-decision statements for the bounded GitHub delivery and patch release, without accepting stronger platform claims. Review-result/continuation notes are the only delta after this source review and require final delta verification before commit.

## GitHub delivery result (2026-10-02)

The final continuation delta received independent VERIFY PASS for maintenance manifest SHA-256 `9914a28ade971c6289bcd574f2047c10b94c5783ece4075fe294bd3f81efdcb2`. All 41 reviewed task files (40 bound files plus their manifest) were committed as `28d5ae83bc4266cc61d8076fbc00c4adb74e51b9` and pushed. [PR #1](https://github.com/hiyotim/pi-perimeter/pull/1) merged as `16f869b654ec68c747ad00a51fcb07ca562fd39f` after both CI runs `37037094572` and `37037223800` passed: 435 tests, 381 pass, 0 fail, 54 skips on hosted Linux. The source metadata corrections are now on GitHub. npm archives remain unchanged at this checkpoint; the separately authorized `1.0.2` candidate is tracked by [its preparation record](RELEASE-1.0.2.md).
