# Compatibility Matrix

Task ID: `20260920-compatibility-matrix`. Phase 6 checklist item: "Publish a Pi, Node,
macOS, and Linux compatibility matrix".

This matrix reports only combinations that were actually exercised, plus the
combinations the implementation refuses by design. It is not a support commitment. Historical status: `pi-perimeter@1.0.0` was published 2026-09-24 as a macOS-only v1.0 (see Distribution below and [PACKAGING.md](PACKAGING.md)); a fresh-install audit then found the published bytes fail to load in Pi `0.84.4`. The startup correction shipped in `pi-perimeter@1.0.1`, published 2026-09-25 (see Distribution below); `1.0.0` is broken and superseded. See
[ROADMAP.md](../ROADMAP.md) for the release gates and [SECURITY.md](../SECURITY.md) for
the current security status.

## How to read this

- **Verified** — the exact combination was exercised, and the evidence that demonstrates
  it is named in the same row. A verified row proves the behavior of the suites and
  artifacts recorded there, not general compatibility.
- **Unsupported or refused** — excluded from the declared range, or refused by the code
  by design. Where the exclusion is only declarative rather than enforced (for example
  an `engines` floor), the cell says so. Either way the status is intended behavior, not
  a missing feature of this matrix.
- **Untested** — no evidence exists. Untested is not a claim of failure, and it is not a
  claim of support.

## Matrix

| Dimension | Verified | Unsupported or refused | Untested |
| --- | --- | --- | --- |
| Pi (`@earendil-works/pi-coding-agent`) | `0.84.4` | — | every other version, including the locally installed `0.86.1` |
| Node | `26.8.1` (macOS target, full local suite) and `22.19.0` (hosted Linux CI, platform-independent suite) | below the declared `engines` floor `>=22.19.0` (declared only, not enforced at runtime) | every other version in `>=22.19.0` |
| OS / architecture | macOS 27.0 (build `26A428`), arm64 | any other Darwin major, any other architecture, the shell route off the declared target, and Windows in every respect | Linux file-gate runtime evidence (Class 1 question open); platform-independent policy suite on hosted Linux CI (exercised, not a support claim); Windows in every respect |
| Distribution | `pi-perimeter@1.0.1` published 2026-09-25 (current; registry evidence in [RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md](RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md)); historical `pi-perimeter@1.0.0` published 2026-09-24 (macOS-only v1.0; fails to load in Pi `0.84.4` — see Pi row) | installing `npm:pi-warden` installs another maintainer's package | anything newer than `1.0.1`; the loopback-registry dev route in [INSTALL-ONBOARDING-AUDIT.md](INSTALL-ONBOARDING-AUDIT.md) (not published-artifact proof) |

## Pi

**Verified: `0.84.4`.** The extension surface used by the integrated routes — the
`tool_call` gate, the controlled `bash` tool, and the `user_bash` handler — was installed,
re-read, and exercised against `0.84.4` for Goals 3 and 4
([docs/SHELL-GATE.md](SHELL-GATE.md), [docs/SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md),
[docs/NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md)). Goal 2's file-gate audit records
the same machine, Node version, and isolated-fixture method but does not restate the peer
version ([docs/FILE-GATE-AUDIT.md](FILE-GATE-AUDIT.md)). A fresh-install audit found that
published `pi-perimeter@1.0.0` fails to load with Pi `0.84.4`: `pi.getAllTools()` throws
`Extension runtime not initialized` at extension load. The unreleased source correction
defers ownership observation until `session_start`, after `ExtensionRunner.bindCore`.
This correction is not evidence that the published `1.0.0` works.

**Untested: everything else.** The local `pi` CLI is now `0.86.1`, which no recorded
evidence covers: no audit, test suite, or hosted run has exercised this extension
against it. `package.json` declares `peerDependencies:
{ "@earendil-works/pi-coding-agent": "*" }` — that is a declared range, not a
verification. It stays `*` deliberately while the only verified version is `0.84.4`
(owner decision, 2026-09-20; `test/package-compat.test.ts` pins this): install-time
acceptance of a wider range must not be read as support.
**Consequence:** installing or relying on this extension against a Pi version other than
`0.84.4` is outside every guarantee this repository has demonstrated. See
[docs/DEVELOPMENT.md](DEVELOPMENT.md) for the compatibility checks a change to the
integration layer must perform.

## Node

**Verified: `26.8.1`** on the declared macOS target, where the full local suite
(including containment, projection, export, and networking) was exercised for Goals 1–4
and for this matrix's own regression run ([docs/PHASE-1B-AUDIT.md](PHASE-1B-AUDIT.md),
[docs/FILE-GATE-AUDIT.md](FILE-GATE-AUDIT.md), [docs/SHELL-GATE.md](SHELL-GATE.md)).

**Verified: `22.19.0`** on the hosted Linux CI runner, where `npm run check` and the
declared count assertion pass on the platform-independent suites; the run identifiers and
counts are recorded in [docs/CI-EVIDENCE.md](CI-EVIDENCE.md). That run is a check of the
policy suites, not containment evidence, and it is not a Linux support claim.

**Below the declared floor:** `engines` states `>=22.19.0`. That declaration is
advisory, not enforced: npm warns unless the consumer enables `engine-strict`, and Node
itself does not check it at runtime. No runtime version check exists in this code, so an
older Node is unsupported by declaration rather than refused — unlike every other
refusal in this matrix, which is backed by a mechanism (`verifyPlatform`,
`scripts/build-native.mjs`, or a test's own platform condition).

**Untested:** `22.19.0 < version ≠ 26.8.1` — the declared floor is broader than what has
been exercised, and no evidence covers the versions between.

## Operating system and architecture

**Verified: macOS 27.0, build `26A428`, arm64.** This is the declared containment target:
Darwin major `27`, `arm64`, and a pinned `/usr/bin/sandbox-exec` identity
(`sha256 58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`) in
`src/sandbox/containment.ts`. The contained shell route and the restricted-network route
were exercised here ([docs/SHELL-GATE.md](SHELL-GATE.md),
[docs/NETWORK-GATE.md](NETWORK-GATE.md), and their audits).

**Unsupported (fail-closed):** every other Darwin major, every architecture other than
`arm64`, and the shell route off the declared target. `verifyPlatform` refuses a
non-matching shell platform instead of approximating the target, and the native helper build
refuses every non-darwin platform ([docs/SHELL-GATE.md](SHELL-GATE.md) §declared target).
Passing a check on one target never extends these rows.

**Linux:** the shell route is blocked there by `verifyPlatform`; the file gates
execute there (Class 1 descriptor-relative execution is the Linux path), but
Goal 2 recorded no Linux runtime execution against the accepted bytes, and the
Class 1 runtime-evidence question stays open ([docs/CI-EVIDENCE.md](CI-EVIDENCE.md)
§3). The hosted Linux runs exercise the platform-independent suites without
making any platform support claim. Linux is therefore explicitly not a support
claim, not a pending implementation commitment.

**Windows:** no evidence in any dimension. The native helper refuses non-darwin
platforms, and the darwin-only suites declare their own platform conditions rather than
approximating them.

## Distribution

### Historical status: `pi-perimeter@1.0.0`

**Published 2026-09-24** (macOS-only v1.0) from the deterministic staging artifact; the source tree on `main` stays `private: true` and unpublished. History is preserved, not rewritten: see [PACKAGING.md](PACKAGING.md), [RELEASE-AUDIT.md](RELEASE-AUDIT.md), `docs/release-hashes.json`.

### Published status: `pi-perimeter@1.0.1`

**Published 2026-09-25** (current) from the deterministic staging artifact via the guarded tag-push release workflow with provenance; the source tree on `main` stays `private: true` and unpublished. Registry: `pi-perimeter@1.0.1`, dist-tag `latest`, tarball `https://registry.npmjs.org/pi-perimeter/-/pi-perimeter-1.0.1.tgz`. The published bytes passed an isolated `pi install` / `pi list` / helper-build / startup / `pi remove` exercise against Pi `0.84.4` on the declared target; nothing was installed into a real Pi profile. Evidence: [RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md](RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md). The published `1.0.0` remains broken (fails to load in Pi `0.84.4`) and superseded; installation of `1.0.0` is not supported on any target.

**Blocked:** the unscoped npm name `pi-warden` — this project's former name — is already
published by another maintainer, so it can never be used here, and installing
`npm:pi-warden` installs that other project. See [docs/PACKAGING.md](PACKAGING.md) for the identity,
the publication safeguards and the release record.

## Not claimed

- No support commitment for any cell, and no service level of any kind.
- Hosted CI is not containment evidence: it runs the platform-independent suite on Linux
  only, and no hosted run covers the containment routes.
- No Linux or Windows support, and no macOS version or architecture other than the
  declared target.
- The Class 1 `/proc/self/fd` runtime-evidence question recorded by Goal 2 stays open; no
  Linux support follows from solving it.
- `peerDependencies: "*"` is not a verified range; `0.84.4` is the only verified Pi
  version.
- Path classification is content-blind, and an `ordinary` classification does not prove a
  file contains no secret ([SECURITY.md](../SECURITY.md)).

## Evidence index

| Row | Evidence |
| --- | --- |
| Published `1.0.0` load failure | [STARTUP-READINESS-AUDIT.md](STARTUP-READINESS-AUDIT.md) |
| Published `1.0.1` registry and install exercise | [RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md](RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md) |
| Pi `0.84.4` integration surface | [docs/SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md), [docs/NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md), [docs/SHELL-GATE.md](SHELL-GATE.md) |
| Node `26.8.1` on macOS 27.0 arm64 | [docs/PHASE-1B-AUDIT.md](PHASE-1B-AUDIT.md), [docs/FILE-GATE-AUDIT.md](FILE-GATE-AUDIT.md), [docs/SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md) |
| Node `22.19.0` on hosted Linux CI | [docs/CI-EVIDENCE.md](CI-EVIDENCE.md) (run identifiers and counts) |
| Declared containment target | [docs/SHELL-GATE.md](SHELL-GATE.md) declared-target table; `src/sandbox/containment.ts` |
| Platform refusal behavior | `src/sandbox/containment.ts` (`verifyPlatform`), `scripts/build-native.mjs` |
| Controlled published distribution | [PACKAGING.md](PACKAGING.md), [RELEASE-AUDIT.md](RELEASE-AUDIT.md), `docs/release-hashes.json` |
