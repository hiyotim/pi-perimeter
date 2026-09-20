# Packaging

Task ID: `20260920-npm-packaging`. Status: **identity renamed to `pi-perimeter`;
nothing is published, no version is released, and no release gate is closed.**

This document owns the publishable identity, the packaged contents, the publication
safeguards and the release checklist. See [COMPATIBILITY.md](COMPATIBILITY.md) for the
verified platform rows and [ROADMAP.md](../ROADMAP.md) for the Phase 6 release gate.

## Identity

| Item | Value |
| --- | --- |
| Package name | `pi-perimeter` |
| Former name | `pi-warden` — already published on npm by another maintainer, so it can never be used here; installing `npm:pi-warden` installs that other project |
| Version | `0.0.0` (never released) |
| License | MIT (`LICENSE`, "pi-perimeter contributors") |
| Node floor | `engines.node` `>=22.19.0`; verified versions are in [COMPATIBILITY.md](COMPATIBILITY.md) |
| Pi peer | `peerDependencies["@earendil-works/pi-coding-agent"] = "*"` — a declared range, **not** a verified one; `0.84.4` is the only verified version |
| Pi manifest | `pi.extensions` = `./src/index.ts` (a path, unchanged by the rename) |

`package.json` carries `repository`, `homepage` and `bugs`, all pointing at
`github.com/hiyotim/pi-perimeter` — the canonical location since the repository was
transferred out of the `pi-warden` organization and renamed on 2026-09-20. The published
reporting route in [SECURITY.md](../SECURITY.md) moved with it.

### Where the former name is retained, and why

Renaming is deliberately limited to the distribution surface. These occurrences keep the
former spelling, because changing them would alter accepted, hash-bound bytes and require
re-verifying the containment and network evidence, or because they name another project:

- **Runtime identifiers:** the helper binary `native/piwarden-helper` and its build
  manifest, the `PIWARDEN_MANIFEST_VERBOSE` test-harness variable, the helper source
  `src/sandbox/native/piwarden-helper.c`, session and reason-code prefixes in `src/`, and
  the assertion prefix printed by `scripts/assert-test-outcome.mjs`.
- **Evidence-bound and accepted documents:** `docs/FILE-GATE.md`, `docs/SHELL-GATE.md`,
  `docs/NETWORK-GATE.md` and their audits, the hash manifests, and the Goal 1–4 contracts
  whose bytes the acceptance records bind.
- **Historical records:** the transition prompts, the sandbox backend proposal and the
  isolation feasibility report, and `STATE.md`/`ROADMAP.md`'s recorded history.
- **The other maintainer's package:** every mention of the published `pi-warden` npm
  entry.

`test/packaging-identity.test.ts` enforces this split: it scans the working tree, fails on
any old-name occurrence outside the declared list, and fails when a declared file no
longer contains one, so the list cannot rot silently.

## Packaged contents

`files` ships `src`, `scripts`, `docs`, `README.md`, `LICENSE` and `package.json`. A dry
run on 2026-09-20 (`npm pack --dry-run`) reported name `pi-perimeter`, version `0.0.0`,
**82 files**, 327.0 kB packed and 1.1 MB unpacked. It was a dry run: no tarball was
published, and any shasum or integrity value it printed belongs to that run, not to a
release.

Notes on the contents:

- The C source of the native helper ships (`src/sandbox/native/piwarden-helper.c`), but
  the build-output directory `native/` is deliberately **not** in `files`. A locally
  compiled helper and its build manifest therefore cannot enter the tarball even when a
  release is packed on a machine that has built them, and nothing is compiled at install
  time — the helper is built explicitly per platform with `npm run build:native`.
  `test/packaging-identity.test.ts` asserts that exclusion.
- The audits and contracts under `docs/` ship with the package, deliberately: the
  documented guarantees and their declared limitations are part of the artifact.

## Publication safeguards

- `private: true` is set. npm refuses to publish a private package, so an accidental
  `npm publish` fails by construction; removing the flag is a release-gate decision, not
  a packaging detail.
- No `pre*`/`post*` lifecycle scripts exist, so installing a published tarball would run
  no package code beyond the extension itself.
- CI never publishes: `.github/workflows/ci.yml` typechecks, runs the suite and asserts the
  declared counts, and nothing else.
- `publishConfig` declares `access: public` and `provenance: true` as the intended release
  settings. It is inert while the package is private.
- Provenance is not yet achievable here: it requires publishing from CI with
  `id-token: write` and `npm publish --provenance`, which this repository deliberately does
  not wire up before the release decision.
- Account-level controls (npm 2FA, trusted publishing, ownership of the name) are
  maintainer actions outside this repository.

## Release checklist

Run only after an explicit release decision; every step is currently unsatisfied or
unauthorized:

1. Close the Phase 6 release-gate items, including the release-candidate security and
   documentation reviews recorded in [ROADMAP.md](../ROADMAP.md).
2. Complete the repository move, then update `repository`, `homepage`, `bugs` and the
   reporting route together with it.
3. Re-check `npm pack --dry-run` against this document, and read the packaged README and
   `SECURITY.md` as a consumer would.
4. Choose the version and dist-tag (currently `0.0.0`), and only then remove `private:
   true`.
5. Publish from CI with provenance and a scoped token — never from a developer machine —
   and confirm the attested artifact identity.
6. Record the published name, version, integrity and provenance attestation in
   [STATE.md](../STATE.md), and re-bind the hash manifests to the released bytes.

## Outstanding

- The repository transfer completed on 2026-09-20: the canonical location is
  `github.com/hiyotim/pi-perimeter`, the old `github.com/pi-warden/pi-warden` URL
  redirects to it, and the reporting channel and its recorded advisory moved with the
  repository. The `pi-warden` organization still exists and is no longer used by this
  project; nothing here depends on it.
- Nothing is published, no version exists, and no compatibility or security guarantee is
  created by this document.
