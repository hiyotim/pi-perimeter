# Release Audit (v1.0.0, macOS-only)

Task ID: `20260924-release-v1`. Release: controlled published distribution
`pi-perimeter@1.0.0`, published from the deterministic staging artifact.
Baseline: `d35ad09` (release preparation: P17/PACKAGING revision, staging
scripts, release workflow, adapted + new safeguards).

Target: publish exactly the release-commit tree as `pi-perimeter@1.0.0`
(dist-tag `latest`) from CI with provenance; the source tree on `main`
stays `private: true` at `0.0.0` and unpublished. No `src/`, guarantee, or
evidence change beyond the P17/PACKAGING revision recorded here; P1–P16,
P18 and R1–R11 are untouched. Old acceptances and their manifests keep
their historical bytes and are not rewritten or reinterpreted: they remain
the evidence of the pre-release snapshots. This record carries
executor-run evidence only; the release review section below is filled by
the reviewer, not the executor.

## Method

Exact-byte checks first (`git status` clean at build, staging built only
from tracked files of the release commit, dirty tree refused), then the
full local gate (`npm run check`), then pack/dry-run of the staging
artifact against `docs/PACKAGING.md`, then release-byte binding
(`docs/release-hashes.json` + `test/release-manifest.test.ts`), then tag,
then CI publish with provenance, then registry/integrity/provenance
verification, then the record in `STATE.md`/`ROADMAP.md`.

## Environment facts (executor-run)

- Node `v26.8.1`; `Darwin 27.0.0`, macOS 26A428, arm64.
- Release preparation commit `d35ad09` (10 files, +258/−66; no `src/`
  change).
- Staging built from HEAD `d35ad09`: 150 files, tree sha256 to be recorded
  at binding; publishable manifest `pi-perimeter@1.0.0`, `private` removed
  only inside staging.
- Dry-run pack of staging: `pi-perimeter-1.0.0.tgz`, 95 files
  (docs 50, src 38, scripts 4, LICENSE/README/package.json), 371.6 kB
  packed / 1.2 MB unpacked, shasum
  `c99f1e12df8f9c92623a217ca06e6e80cef51698`, no `test/`, no `native/`,
  no `.github/`, `src/index.ts` and `docs/PACKAGING.md` present.

## P17/PACKAGING revision (minimal, owner-authorized)

- `docs/V1-GUARANTEES.md` P17: "Unpublished distribution with inert
  safeguards" → "Controlled published distribution with staging
  safeguards" (`pi-perimeter@1.0.0` from the deterministic staging
  artifact; source stays `private: true`; ordinary CI never publishes;
  only the dedicated release workflow may publish, against staging).
  Evidence row now cites `test/release-manifest.test.ts` and
  `docs/release-hashes.json`. P1–P16, P18, R1–R11 untouched.
- `docs/PACKAGING.md`: status/version/safeguards/checklist/outstanding
  revised to the controlled-published model; source `private: true` is
  never removed.
- `README.md` status + Installation, `SECURITY.md` status,
  `docs/COMPATIBILITY.md` Distribution + evidence index: minimal
  agreement edits, no new claims.
- Safeguards: `test/packaging-identity.test.ts` adapted (source stays
  private; ordinary CI never publishes — same bite, staging-aware
  wording); new `test/release-safeguards.test.ts` (3 tests: source stays
  private at `0.0.0`; publish only in `release.yml`; release workflow
  targets staging). `package.json` on `main` unchanged
  (`private: true`, `0.0.0`).

## Staging determinism

- `scripts/build-release-staging.mjs`: refuses a dirty tree; copies
  tracked files of HEAD in sorted order into `release-staging/`; applies
  only the manifest transform (`version 1.0.0`, `private` removed, with
  preconditions asserting the source values); prints the file count and
  tree sha256.
- `scripts/verify-release-staging.mjs`: fails when staging is absent, when
  any covered file differs from `docs/release-hashes.json`, or when the
  staged manifest is not exactly publishable (`pi-perimeter@1.0.0`, no
  `private`). The release workflow runs it before `npm publish`.
- `release-staging/` is gitignored (build output, like `native/`); it
  never enters a commit or the tarball listing beyond its own packed
  content.

## Binding of this Goal's artifacts (executor-run)

- New record: `docs/RELEASE-AUDIT.md` (this file).
- New manifest: `docs/release-hashes.json` (covered files: this audit,
  the revised P17/PACKAGING/README/SECURITY/COMPATIBILITY bytes, the
  release workflow, the staging scripts, the adapted + new safeguard
  suites, every touched manifest suite, and the new suite itself),
  asserted by `test/release-manifest.test.ts` (3 tests, same enforcement
  strength as the earlier manifest suites).
- `CHANGED_IN_RELEASE` (named exactly so) declared in every earlier suite
  whose covered bytes change. Earlier manifests keep their historical
  entries; no entry is rewritten.
- Budget: `test/ci-test-budget.json` update if and only if the collected
  set changes (the new suites add platform-independent tests).
- Retention: `test/packaging-identity.test.ts` gains entries if and only
  if new files carry old-name mentions (none expected: no former-name
  spelling in the new files).

## Checks (executor-run)

- Affected suites (packaging-identity, release-safeguards,
  package-compat, package-lifecycle, ci-budget): 27/27 pass.
- `npm run check`, all manifest suites, `git diff --check`: to be
  recorded at binding.
- Hosted CI for the release commit + tag-triggered release run: to be
  recorded below.

## Publish record (executor-run, filled after the release workflow)

- Tag: `v1.0.0`.
- Release run id: PENDING.
- Registry: `pi-perimeter@1.0.0`, integrity PENDING, provenance
  attestation PENDING.
- `npm view pi-perimeter version` → PENDING.

## Limits

- Binds only the release item; authorizes no new platform, no guarantee
  change beyond the P17/PACKAGING revision above, and no installation
  into a real Pi profile as evidence.
- Hosted CI verifies counts, not test identities, on Linux only; darwin
  containment evidence is executor-local on the declared target.
- The Class 1 Linux runtime-evidence question stays open; macOS-only
  boundary unchanged.

## Independent release review (reviewer-run; no blocking findings)

PENDING — filled by the reviewer, not the executor.
