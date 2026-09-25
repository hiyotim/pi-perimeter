# Release audit 1.0.1 (final candidate, unpublished)

Task ID: `20260925-release-v101`. Baseline: `8c1e5b09bb14e4c3e9e7c6be550fb50a3ee8c41d` on `main`.
Candidate identity: the final candidate was committed locally as `d84d51e`
(full `d84d51e901bd7b643cfcf382f746f5f1ba92a7e0`) on top of baseline
`8c1e5b0`; that commit is local and unpushed. This narrow audit/binding
correction is currently UNCOMMITTED on top of `d84d51e`, so the corrected
bytes must be committed and re-reviewed before any tag is created.
This record binds the exact final 1.0.1 candidate. No tag, no release run,
no commit, no push, and no publication are performed or authorized by this
record. Version `1.0.1` is not published or downloadable; nothing below
claims otherwise.

## Position relative to earlier evidence

- `docs/RELEASE-AUDIT-1.0.1.md` and `docs/release-hashes-1.0.1.json` are
  frozen staging-preparation evidence. Both files are byte-identical to
  their recorded state (the preparation manifest recomputes to
  `4a0fad66763b64d3c40e0a5e20b25c96d7e14e19ada4aa98a235a66305966d8f`,
  and `git diff` for both paths is empty). They are explicitly superseded
  in scope by the final binding below for the purpose of selecting and
  verifying the 1.0.1 release tree. Their bytes are not rewritten and no
  accepted historical entry is altered.
- The published `1.0.0` evidence is untouched: `docs/release-hashes.json`,
  tag `v1.0.0`, and `docs/RELEASE-AUDIT.md` keep their accepted bytes
  (`git diff` empty for the manifest path), and the release workflow still
  selects the historical manifest for version `1.0.0`.
- The startup correction (`src/gate/runtime.ts`) and the isolated
  package-manager onboarding evidence keep their accepted bytes; the
  startup and onboarding manifests (`docs/startup-readiness-hashes.json`,
  `docs/user-install-onboarding-hashes.json`) are not rewritten. Earlier
  manifest suites declare the final-release changes through the additive
  `CHANGED_IN_1_0_1_RELEASE` sets asserted by the new suite; every older
  declaration set is untouched.

## Final candidate binding

`docs/release-hashes-1.0.1-final.json` (36 entries, exact key set enforced,
per-file sha256 recomputed every run, zero exception sets) covers:

- This audit and the new suite `test/release-1.0.1-final-manifest.test.ts`;
  the binding does not list itself, and this audit records no hash of the
  binding (no circularity).
- Every file this Goal creates or modifies: the new audit, the new suite,
  `.github/workflows/release.yml`, `test/release-safeguards.test.ts`,
  `docs/PACKAGING.md`, `test/ci-test-budget.json`,
  `IMPLEMENTATION_HANDOFF.md` (the active release handoff, whose replaced
  bytes the handoff itself requires to be declared in the next binding),
  and the thirteen earlier manifest suites whose declarations were
  extended.
- The release machinery: the workflow, `scripts/build-release-staging.mjs`,
  `scripts/verify-release-staging.mjs`, the count budget,
  `test/packaging-identity.test.ts`, and the safeguard suite.
- The versioned public surface: `README.md`, `SECURITY.md`,
  `docs/COMPATIBILITY.md`, `docs/PACKAGING.md`, `.gitignore`
  (all unchanged by this Goal; bound at current bytes).
- The 1.0.1 corrections and their evidence, bound but not edited:
  `src/gate/runtime.ts`, `test/startup-readiness.test.ts`,
  `docs/STARTUP-READINESS-AUDIT.md`,
  `test/user-install-onboarding.test.ts`,
  `docs/INSTALL-ONBOARDING-AUDIT.md`.
- The frozen preparation binding `docs/release-hashes-1.0.1.json` itself,
  freezing the superseded preparation revision inside the release tree.
- The manifest suites that participate in release verification:
  `release-manifest`, `release-1.0.1-manifest`, `release-review-manifest`,
  `packaging-manifest`, `post-transfer-manifest`, `v1-guarantees-manifest`,
  `ci-manifest`, `independent-audit-manifest`,
  `regression-evidence-manifest`, `unknown-bounds-manifest`,
  `compatibility-manifest`, `network-manifest`, `shell-manifest`,
  `hash-manifest`, `startup-readiness-manifest`, and
  `user-install-onboarding-manifest`.

`README.md` was re-checked and left unchanged: its broken-`1.0.0` warning,
its "awaits publication" install path, and its target/limitation claims
are accurate for a prepublication candidate. No source behavior, no
`package.json` identity, no dependency, and no historical audit byte was
changed by this Goal.

## Workflow selection

The release guard now resolves deterministically and fail closed:

- `1.0.0` selects `docs/release-hashes.json` (historical, unchanged);
- `1.0.1` selects `docs/release-hashes-1.0.1-final.json` (new final binding);
- any other `X.Y.Z` keeps the `docs/release-hashes-$VERSION.json` formula.

An absent selected manifest fails the staging verifier (it refuses a
missing manifest path). The tag==version guard, the
dispatch-requires-version refusal, the `if: github.event_name == 'push'`
publish gate, OIDC `id-token: write` with no token and no secrets, and the
staging-only publish step are unchanged. A biting safeguard test pins the
`1.0.1` and `1.0.0` selections and that the verifier step consumes the
guard-selected manifest.

## Prepublication evidence (observed in this session)

Executor-run on the declared target (macOS 27.0 build `26A428`, arm64,
Node `v26.8.1`, Pi `0.84.4` boundary):

- `npm run check`: typecheck PASS; tests 431, pass 430, fail 0, skipped 1
  (linux budget declares 431/0/54; the single local skip is the declared
  non-darwin platform skip).
- `npm run test:manifest` and every manifest suite PASS, including the new
  `release-1.0.1-final-manifest` suite (exact key set plus per-file hashes
  plus exact `CHANGED_IN_1_0_1_RELEASE` declarations, 2/2) and the extended
  safeguard suite (7/7, including the new selection test); `git diff --check`
  clean.
- Deterministic staging verification on a clean committed-candidate copy
  (working tree copied to a disposable directory excluding `.git`,
  `release-staging`, `node_modules`, `.zcode`, `.DS_Store`; committed as a
  snapshot; status empty): `RELEASE_VERSION=1.0.1
  RELEASE_MANIFEST_PATH=docs/release-hashes-1.0.1-final.json node
  scripts/build-release-staging.mjs`, the same environment with
  `scripts/verify-release-staging.mjs`, and `npm pack --dry-run` inside
  `release-staging`. Snapshot-run record (PRE-FINALIZATION — see below):
  build `release-staging: 167 files, tree sha256
  3d996c657f8910d35a1b3172d39763c0300ed1251932318a75c4748be4359b21;
  publishable manifest: pi-perimeter@1.0.1, private removed`; verify
  `staging verified: 36 files match docs/release-hashes-1.0.1-final.json;
  publishable pi-perimeter@1.0.1`; pack `pi-perimeter-1.0.1.tgz`, 105
  files, 394.4 kB packed / 1.3 MB unpacked, shasum
  `b6c77a5d6c550c94551d967a6555dab284807186`. Bite on the same snapshot:
  flipping one covered byte in the copy's staging made the verifier refuse
  (exit 1: `README.md: current
  dfdde35e65f583d06a582549812cd41f88dd7e1ca9a86e2795a7935f656dd537
  recorded 9c6392b1beb55a9b59bb552acce722eb693d6def6ba25dc3b3b646bc25e02807`);
  restoring the byte made it pass again (exit 0, 36 files verified). The
  real repository was left untouched throughout. The tree sha256 and the
  pack shasum above come from a PRE-FINALIZATION snapshot copy made before
  this audit was frozen: this audit and its binding entry have changed
  since, so the pack content differs by the audit bytes. They are retained
  here only as a snapshot-run record and must NOT be quoted as the final
  staging or tarball identity. The final staging identity is deliberately
  NOT recorded inside this audit because this audit is itself covered by
  the binding — any self-recorded value would be stale by construction —
  and it will be recorded outside the hashed tree (commit/release record)
  from the committed candidate.
- Frozen bytes: `docs/release-hashes.json`, `docs/release-hashes-1.0.1.json`,
  `docs/user-install-onboarding-hashes.json`, and
  `docs/startup-readiness-hashes.json` recompute to their pinned sha256
  values and show no diff; the historical onboarding handoff bytes at HEAD
  still hash to their pinned value.
- Adversarial review (executor, same session): the guard's `1.0.1` branch
  cannot fall through to the formula (explicit `elif` before `else`); an
  unknown version resolves to a manifest path that the verifier refuses
  when absent; dispatch without a version still refuses; publish still
  requires a tag push; the binding's key set is exact with no skips and no
  self-reference; the audit carries no binding hash; historical manifests
  keep every accepted entry. No bypass found within Goal scope. Verdict:
  PASS with no release-blocking findings from this executor pass; a fresh
  independent review of the final bytes is still required before any tag
  push (see below) and is not claimed here.

## Postpublication evidence (pending, not obtained)

- No `v1.0.1` tag exists locally or remotely; no tag push was performed.
- No hosted workflow run (including the verify-only dispatch run) has been
  requested or observed for this candidate; the push it requires is not
  authorized in this session and must be requested from the maintainer.
- No npm metadata, provenance attestation, tarball shasum, or integrity
  value exists for `1.0.1`; no isolated install of published `1.0.1`
  bytes has been performed.
- Until those observations exist, `1.0.1` must not be described as
  published, downloadable, or installable from the registry, and no
  installation wording may promise it.

## Limits

- This record authorizes no release action, no new platform, no guarantee
  change, no dependency change, and no installation into a real profile as
  evidence. Staging was verified from a snapshot copy only; the real tree
  was never built in place.
- Hosted CI verifies counts on Linux only; containment evidence remains
  executor-local on the declared macOS target.
- The `1.0.0` failure, the startup correction boundary, and the onboarding
  loopback-registry scope keep their previously recorded limits.
