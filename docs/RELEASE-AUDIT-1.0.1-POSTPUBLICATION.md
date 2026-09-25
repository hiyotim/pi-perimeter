# Release audit 1.0.1 (postpublication record)

Task ID: `20260925-release-v101`, Criterion 4. This record owns the
postpublication evidence state for `pi-perimeter@1.0.1`. It performs and
authorizes no release action: the tag push, hosted runs, registry
publication, and isolated published-package exercise it records were
already executed by the maintainer route; this session only updates the
public wording to those observations and binds the wording bytes. No
commit, push, tag, or publication is performed or authorized here.

## Frozen prepublication evidence (unchanged)

The candidate, preparation, and final-release evidence is frozen and
unchanged by this update:

- Commit `041b4e89b4bb5cc5988fda5ce5a51f85488c6a52` on `main` (pushed to
  `origin/main`); tag `v1.0.1` (annotated object
  `29e76abf7b7a2632427cf335333f591bbc8b3dd9`) on that commit (pushed).
- `docs/release-hashes-1.0.1-final.json` and
  `docs/RELEASE-AUDIT-1.0.1-FINAL.md` keep their accepted bytes; both are
  included in the new postpublication binding below as frozen references
  and are not edited here. The staging-preparation evidence
  (`docs/RELEASE-AUDIT-1.0.1.md`, `docs/release-hashes-1.0.1.json`), the
  published-`1.0.0` evidence, and `IMPLEMENTATION_HANDOFF.md` are likewise
  untouched.

## Precondition: verify-only hosted run

Run `36173700726` (`workflow_dispatch` on `main`, success) ran before any
publishing tag was pushed: the guard resolved `1.0.1` to
`docs/release-hashes-1.0.1-final.json`; the hosted Linux check reported
`tests 431, fail 0, skipped 54`; the staging artifact held 167 files at
tree sha256 `327824cec0815802648abd877de61de6e08a8ed5c3f65df358dab7d3a6dd5bb7`
with 36/36 bytes verified against the final binding; dry-run pack listed
105 files. No publication occurred on this run by construction (the publish
step is gated to tag push).

## Publish run and registry evidence (observed)

- Run `36173840730` (`v1.0.1` tag push, success): the publish step ran with
  provenance and reported `+ pi-perimeter@1.0.1`.
- Tarball shasum `8387c82ddb3f730512b6d43d577954981e3f24fd`; integrity
  `sha512-2yQU3dTIdYh61JPyIbgHKMQwYeb/LPlGUg4OXZmeUYV4Y8dX1svaUSkfjgum5lIw0Iaqhg3DxcUPAPGlyzMy5w==`;
  provenance `provenance/v1`, transparency log `2960126766` (publish
  notice) and attestation bundle tlog logIndex `2960155223`.
- Registry (observed): `pi-perimeter@1.0.1`, dist-tag `latest` = `1.0.1`,
  tarball `https://registry.npmjs.org/pi-perimeter/-/pi-perimeter-1.0.1.tgz`
  with the shasum/integrity above matching the reviewed bytes, fileCount
  105, unpackedSize 1288031, attestations predicateType
  `https://slsa.dev/provenance/v1`.

## Isolated published-package exercise (observed, executor-run)

Real npm registry, isolated `HOME`/`TMPDIR`/`PI_CODING_AGENT_DIR`/npm
caches, synthetic fixtures, fixture removed afterwards; 11/11 checks PASS
on the declared target (macOS 27.0 build `26A428`, arm64, Node `v26.8.1`,
Pi `0.84.4`):

1. `pi install npm:pi-perimeter@1.0.1` exit 0.
2. Agent settings contain `["npm:pi-perimeter@1.0.1"]`.
3. Installed `package.json` version reads `1.0.1`.
4. Installed tree equals the registry tarball bytes (105 files, 0 hash
   mismatches).
5. `pi list` reported the source and the installed root
   `<agentDir>/npm/node_modules/pi-perimeter`.
6. Pre-helper probe: no loader errors; 7 tool owners equal the installed
   `src/index.ts`; a synthetic `.env` read denied (`SECRET_RESOURCE`);
   an ordinary file read allowed; shell refused fail-closed
   (`HELPER_MISSING`).
7. `npm --prefix <reported root> run build:native` exit 0 with
   `native/build-manifest.json` present under the reported root.
8. With-helper probe executed a contained shell command (`STARTUP_SMOKE`;
   output contained `pi-warden: contained run finished (exit 0) on
   darwin/arm64, sandbox-exec 58839ef01b4e, profile 46f3649475b2` and
   `network closed (no destination scope)`).
9. `pi remove npm:pi-perimeter` exit 0 with the settings entry and the
   installed directory gone (isolated profile cleaned).
10. Peer guard: the exercise's Pi CLI and SDK come from the repository's
    installed peer `@earendil-works/pi-coding-agent@0.84.4` (its
    `package.json` version reads `0.84.4`); no independent peer check
    beyond that was performed.
11. The install used an isolated, initially empty npm cache and the default
    registry (no `npm_config_registry` override); the installed tree equals
    the registry tarball bytes fetched directly from `registry.npmjs.org`
    (item 4), so the result is not a cache replay or loopback-substitute.

Nothing was installed into the real Pi profile at any point.

## Public wording updated to these observations

- [README.md](../README.md): the direct copyable path is now
  `pi install npm:pi-perimeter@1.0.1`, verified against the published
  artifact in isolation; no "awaits publication" / "not published or
  downloadable" wording remains; `1.0.0` is marked broken and superseded;
  the exact supported target, limitations, and evidence links are kept,
  and the loopback-registry dev route is distinguished from the published
  install.
- [COMPATIBILITY.md](COMPATIBILITY.md): the Distribution section records
  `1.0.1` published with the registry evidence pointer; `1.0.0` stays
  historical (broken, superseded).
- [SECURITY.md](../SECURITY.md): status is `v1.0.1` published (`1.0.0`
  broken/superseded).
- [PACKAGING.md](PACKAGING.md): status, identity, and checklist reflect the
  executed `1.0.1` release without rewriting the historical `1.0.0`
  records; the `1.0.0` → `docs/release-hashes.json` /
  `1.0.1` → `docs/release-hashes-1.0.1-final.json` mapping and the
  staging-only/OIDC safeguards are unchanged.
- [STATE.md](../STATE.md) and [ROADMAP.md](../ROADMAP.md) carry the release
  result as new dated entries; earlier records are not rewritten.

## Declared limits

- macOS-only boundary: the published artifact is supported only on the
  declared target (macOS 27.0 `26A428` arm64, Pi `0.84.4`, Node
  `>=22.19.0` with `26.8.1` verified); Linux and Windows are unsupported,
  and the Class 1 Linux runtime-evidence question stays open.
- The immutable published tarball carries the prepublication README/audit
  wording; the repository docs are the current source of truth for install
  and status wording.
- The Pi peer range stays declared-not-verified: `peerDependencies "*"`
  with `0.84.4` the only verified version.
- Hosted CI covers test counts only, on Linux; it is not containment
  evidence.
- No real-profile install was performed or is claimed as evidence; every
  install observation above used a disposable isolated profile.
