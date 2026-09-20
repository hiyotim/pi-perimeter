# Compatibility Matrix

Task ID: `20260920-compatibility-matrix`. Phase 6 checklist item: "Publish a Pi, Node,
macOS, and Linux compatibility matrix".

This matrix reports only combinations that were actually exercised, plus the
combinations the implementation refuses by design. It is not a support commitment: this
project is pre-alpha, has no release, and no supported installation path. See
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
| OS / architecture | macOS 27.0 (build `26A428`), arm64 | any other Darwin major, any other architecture, and Linux for the shell and file-gate routes | Linux for the platform-independent policy suite (exercised, not a support claim); Windows in every respect |
| Distribution | none | installing `npm:pi-warden` installs another maintainer's package | publishing `pi-perimeter` |

## Pi

**Verified: `0.84.4`.** The extension surface used by the integrated routes — the
`tool_call` gate, the controlled `bash` tool, and the `user_bash` handler — was installed,
re-read, and exercised against `0.84.4` for Goals 3 and 4
([docs/SHELL-GATE.md](SHELL-GATE.md), [docs/SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md),
[docs/NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md)). Goal 2's file-gate audit records
the same machine, Node version, and isolated-fixture method but does not restate the peer
version ([docs/FILE-GATE-AUDIT.md](FILE-GATE-AUDIT.md)).

**Untested: everything else.** The local `pi` CLI is now `0.86.1`, which no recorded
evidence covers: no audit, test suite, or hosted run has exercised this extension
against it. `package.json` declares `peerDependencies:
{ "@earendil-works/pi-coding-agent": "*" }` — that is a declared range, not a
verification, and it is deliberately not being narrowed while the project is pre-alpha
and unpublished (owner decision, 2026-09-20).

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
`arm64`, and Linux for the shell and file-gate routes. `verifyPlatform` refuses a
non-matching platform instead of approximating the target, and the native helper build
refuses every non-darwin platform ([docs/SHELL-GATE.md](SHELL-GATE.md) §declared target).
Passing a check on one target never extends these rows.

**Linux:** the shell route and the file gates are blocked there; Goal 2 recorded that the
Class 1 runtime path (`/proc/self/fd` descriptor-relative execution) has no runtime
evidence, and the hosted Linux runs since then exercise the platform-independent suites
without changing that claim ([docs/CI-EVIDENCE.md](CI-EVIDENCE.md) §3). Linux is
therefore an explicit unsupported entry, not a pending implementation commitment.

**Windows:** no evidence in any dimension. The native helper refuses non-darwin
platforms, and the darwin-only suites declare their own platform conditions rather than
approximating them.

## Distribution

**Verified: none.** There is no installation path: `README.md` states installation is not
available, and nothing in this repository has been published or installed into a real Pi
profile.

**Blocked:** the unscoped npm name `pi-warden` — this project's former name — is already
published by another maintainer, so it can never be used here, and installing
`npm:pi-warden` installs that other project. The publishable identity is now
`pi-perimeter`; nothing under it has been published, no version has been released, and
there is no installation path. See [docs/PACKAGING.md](PACKAGING.md) for the identity,
the publication safeguards and the release checklist.

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
| Pi `0.84.4` integration surface | [docs/SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md), [docs/NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md), [docs/SHELL-GATE.md](SHELL-GATE.md) |
| Node `26.8.1` on macOS 27.0 arm64 | [docs/PHASE-1B-AUDIT.md](PHASE-1B-AUDIT.md), [docs/FILE-GATE-AUDIT.md](FILE-GATE-AUDIT.md), [docs/SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md) |
| Node `22.19.0` on hosted Linux CI | [docs/CI-EVIDENCE.md](CI-EVIDENCE.md) (run identifiers and counts) |
| Declared containment target | [docs/SHELL-GATE.md](SHELL-GATE.md) declared-target table; `src/sandbox/containment.ts` |
| Platform refusal behavior | `src/sandbox/containment.ts` (`verifyPlatform`), `scripts/build-native.mjs` |
| No installation path | [README.md](../README.md) "Installation" |
