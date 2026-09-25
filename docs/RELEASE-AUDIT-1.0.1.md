# Release audit 1.0.1 (staging preparation, unpublished)

Task ID: `20260925-release-v101-prep`. Baseline: `8365b34` (startup readiness
fix) plus the uncommitted docs-fix tree (README, docs/COMPATIBILITY,
SECURITY, THREAT_MODEL, ARCHITECTURE, package.json description). This record
describes an uncommitted preparation. It does not revise the published
`pi-perimeter@1.0.0`, its tag `v1.0.0` (annotated tag object `7eddd55`
pointing at commit `30ac49a`, immutable), any accepted
historical manifest value, or any historical audit document. No tag, no
release run, no commit, and no publication are performed or authorized by
this record.

## Trigger and boundary

The published `1.0.0` fails to load in Pi `0.84.4`: it calls `getAllTools()`
before Pi initializes the extension runtime, so its gates never become
active. The startup correction in this source tree (ownership observed only
after `session_start`) is verified locally but unreleased and unaccepted.
The next publishable version is therefore `1.0.1`, built from a tree that
contains the correction.

This Goal prepares the release machinery for a versioned follow-up without
re-proving `1.0.0`: the staging builder and verifier resolve the release
version (`argv --release-version=X` over `env RELEASE_VERSION` over the
`1.0.0` default), the release workflow guards tag against version and
refuses a dispatch without an explicit version input, and the new manifest
below binds every byte this preparation changes. Without an explicit
version, every script and step behaves exactly as for `1.0.0` against
`docs/release-hashes.json`, so the `1.0.0` reproducibility evidence stays
valid.

## Method

Exact-byte checks first (`git status` clean at build, staging built only
from tracked files of the release commit, dirty tree refused — unchanged),
then the full local gate (`npm run check`), then the resolver probes in
`test/release-safeguards.test.ts` (defaults, precedence, refusal on
non-X.Y.Z), then release-byte binding (`docs/release-hashes-1.0.1.json` +
`test/release-1.0.1-manifest.test.ts`), with the actual tag, CI publish
with provenance, and registry verification deferred to the later release
Goal. The staging build itself is deferred for the same reason: this working
tree is dirty by design (the preparation is uncommitted), and the builder
refuses a dirty tree.

## Environment facts (executor-run)

- Node `v26.8.1`; `Darwin 27.0.0`, arm64.
- Preparation base `8365b34`; no new commit by this record.
- Source `package.json` stays `private: true` at `0.0.0`; peer range
  untouched.

## Staging changes (this preparation)

- `scripts/build-release-staging.mjs`: resolves the release version
  (`argv --release-version=X` > `env RELEASE_VERSION` >
  `DEFAULT_RELEASE_VERSION = "1.0.0"`, X.Y.Z-validated); keeps the
  `RELEASE_VERSION` alias and the source preconditions (`private: true`,
  `0.0.0`); records the resolved version in the staging-local
  `release-staging/.release-version`, which is the single source the
  verifier checks.
- `scripts/verify-release-staging.mjs`: resolves the manifest path
  (`argv --manifest=` > `env RELEASE_MANIFEST_PATH` >
  `docs/release-hashes.json`) and the expected version with the same
  precedence; prints both resolutions; fails when the staging version
  record diverges, when any covered file differs, when staging carries a
  file outside the tracked tree plus the version record, or when the
  staged manifest is not exactly the expected version with `private`
  removed.
- `.github/workflows/release.yml`: `workflow_dispatch` gains a required
  `version` input; a guard step runs before the build (tag without its
  leading `v` must equal the version; dispatch without an explicit input
  refuses); both staging steps share one `RELEASE_VERSION` +
  `RELEASE_MANIFEST_PATH` env block sourced from the guard outputs
  (`1.0.0` maps to the historical manifest, anything else to
  `docs/release-hashes-<version>.json`). The `npm publish` step runs only
  on tag push (`if: github.event_name == 'push'`): a manual dispatch run
  rebuilds, verifies, and dry-run packs the candidate but never publishes,
  so an unbound input version cannot reach the registry even when the
  guard accepts it.
- `docs/PACKAGING.md`: the publication safeguard now states tag-push-only publish with the version-bound manifest, and the verify-only manual run, matching the workflow gate.

## Binding of this Goal's artifacts (executor-run)

- New record: `docs/RELEASE-AUDIT-1.0.1.md` (this file).
- New manifest: `docs/release-hashes-1.0.1.json` (covered files: the
  docs-fix bytes, the parameterized staging scripts, the guarded release
  workflow, the extended safeguard suite, the raised count budget, every
  touched manifest suite, and the new suite itself), asserted by
  `test/release-1.0.1-manifest.test.ts` (2 tests, same enforcement
  strength as the startup-readiness suite: exact key set plus per-file
  sha256, and exact historical declarations).
- `CHANGED_IN_1_0_1` (named exactly so, `Set` form) declared in every
  earlier suite whose covered bytes change. Earlier manifests keep their
  historical entries; no entry is rewritten.
- Budget: `test/ci-test-budget.json` raised 420 → 425 (the new suite's 2
  plus the 3 safeguard additions); skip/fail unchanged.

## Checks (executor-run)

- Full gate: typecheck PASS; `npm run check` 425 tests / 424 pass / 0 fail / 1 declared platform skip (linux budget 425; skip/fail unchanged).
- All manifest suites PASS (release-1.0.1 2/2 included); `git diff --check`
  clean.
- Resolver probes: defaults resolve to `1.0.0` +
  `docs/release-hashes.json`; argv beats env; non-X.Y.Z refuses.
- Historical `docs/release-hashes.json` untouched; `v1.0.0` tag untouched.

## Limits

- Binds only the preparation; authorizes no release, no new platform, no
  guarantee change, and no installation into a real Pi profile as
  evidence.
- The `1.0.1` staging bytes, tag, publish, and registry verification
  belong to the later release Goal and are explicitly out of scope here.
