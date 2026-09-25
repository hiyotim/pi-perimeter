# pi-perimeter

`pi-perimeter` (formerly `pi-warden`) is an early lightweight security extension/package for [Pi](https://pi.dev/), focused on workspace-scoped authorization and OS-level containment without requiring Docker or a full virtual machine.

> **Project status: Goals 1–4 accepted; Phase 7 gate closed as macOS-only v1.0; `pi-perimeter@1.0.0` published.**

Goals 1–4 (bounded configuration authorization, Pi file gates with scoped
approvals, contained shell execution, and restricted networking) are accepted
within their documented contracts and declared limitations; their exact evidence
is recorded in [STATE.md](STATE.md) and the per-Goal contracts and audits linked
below. Nothing here is a general security guarantee.

## Problem

Pi is a local coding agent. Its built-in tools and extensions run with the permissions of the user who started Pi. Pi's Project Trust feature controls whether project-local settings, packages, and extensions are loaded, but it is not a runtime sandbox and does not constrain later tool calls.

That behavior is appropriate for Pi's general-purpose local workflow, but it does not provide the workspace-oriented threat model intended here. A permission prompt can authorize an action; it cannot contain a process after execution begins. `pi-perimeter` therefore treats authorization, user approval, and OS containment as separate controls.

## Goal

The intended user experience — with a try-it list — is in [Quick start](#quick-start) below. The project aims to cover every model-facing built-in file and shell path: `read`, `write`, `edit`, `grep`, `find`, `ls`, `bash`, and user `!` commands.

## Architecture

The design has three independent layers:

1. a pure policy engine that classifies canonical resources and operations;
2. an approval layer that obtains explicit, scoped user decisions;
3. an OS sandbox adapter that contains shell processes and restricts filesystem and network access.

All model-facing tools must use one security model even though in-process file tools and shell subprocesses require different enforcement mechanisms. See [ARCHITECTURE.md](ARCHITECTURE.md) and [THREAT_MODEL.md](THREAT_MODEL.md).

## Implementation status

Phase 1A implements path canonicalization and component-aware workspace membership, including existing symlinks and non-existent creation targets. Phase 1B classifies a deliberately small set of secret and sensitive paths using Phase 1A's canonical and normalized lexical results. Fixed read/write/edit baselines and monotonic authorization composition are implemented. The accepted Goal 1 implements a strict v1 operation-policy parser, one fixed user/global source, one fixed project source, and explainable composition with those baselines.

The accepted Goal 2 gate mediates every supported model-facing file tool
(`read`, `write`, `edit`, `grep`, `find`, `ls`) through one authorizer
(`src/gate/`), requests exact single-use scoped approvals for effective `ASK`
outcomes (`src/approvals/`), protects the Pi agent directory and its policy
location structurally (`src/policy/control-plane.ts`), replaces
`grep`/`find`/`ls` with controlled same-name tools that classify every entry
before reading, and fails closed for unknown tools. macOS direct-file creation
and missing-parent creation stay unavailable. See
[docs/FILE-GATE.md](docs/FILE-GATE.md) for the accepted operation mapping and
limits.

The accepted Goal 3 adds one contained shell route for
model `bash` and user `!`/`!!` on macOS 27 arm64: the command is parsed by a
bounded grammar, evaluated against the same policy core, approved with a
single-use binding when required, executed against a **private projection** of
the workspace under a deny-default Seatbelt profile with closed networking and
a constructed environment, and its changes are exported back only after
per-target re-authorization. The original workspace is never visible to the
child. See [docs/SHELL-GATE.md](docs/SHELL-GATE.md).

The accepted Goal 4 adds narrowly scoped outbound
development connections to that same route: trusted-configuration destination
allowlists and per-invocation approvals for representable destinations are
enforced by a per-invocation network broker in the host process, and the
generated Seatbelt profile grants exactly one route: one TCP port on local
addresses, which the broker owns on 127.0.0.1 and refuses to serve until the
invocation is armed. Destination identity is checked at tunnel-open time against
the pinned resolution; redirects, rebinding, proxies, and every other
destination fail closed, and child-originated DNS does not exist. With an
empty scope the route is byte-identical to Goal 3. See
[docs/NETWORK-GATE.md](docs/NETWORK-GATE.md).

The project still does **not** provide:

- shell execution on any platform other than the declared macOS target
  (Linux stays blocked, not merely unsupported);
- network access beyond the pinned destination scope of the Goal 4 contract,
  and only through the per-invocation broker; permitted endpoints can receive
  any data the contained process can read (declared endpoint exfiltration);
- protection against an independent same-user host writer, including ordinary
  tampering with the disposable projection and the loopback broker endpoint,
  or mount isolation (declared, unverified);
- secret-content detection beyond path classification;
- host delete or rename effects, or direct `create` for file tools on macOS;
- audited security guarantees beyond the reviewed contracts above.

## Platform

Declared containment target: macOS 27.0 (build `26A428`), arm64 — full requirement rows above. The shell route is blocked off the declared target by `verifyPlatform`; Linux is not a support claim anywhere (the Class 1 Linux runtime-evidence question stays open). Every row, the exact version behind it, and the evidence for it: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## Requirements

- macOS 27.0 (build `26A428`) on Apple Silicon (arm64): the declared containment target. Any other macOS version or architecture, and Windows in every respect, are unsupported and fail closed. Linux file gates execute but carry no support claim. Exact rows and evidence: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).
- Pi `0.84.4`: the only verified peer. `package.json` declares `peerDependencies` `*` as a declared range, not a verification — any other Pi version is outside every demonstrated guarantee.
- Node `>=22.19.0` (`engines` floor); verified `26.8.1` on the macOS target and `22.19.0` on hosted Linux CI for the platform-independent suites.
- A platform toolchain for the native helper build below (only needed for the contained shell route).

> **Status warning.** `pi-perimeter@1.0.0` (macOS-only v1.0) is published on npm, but a fresh-install audit found that this published version fails to load in Pi `0.84.4`: it calls `getAllTools()` before Pi initializes the extension runtime (`Extension runtime not initialized`), so its gates never become active. Do not rely on `1.0.0` for enforcement. The startup correction in this source tree (ownership observed only after `session_start`) has not been released or accepted. Evidence: [docs/STARTUP-READINESS-AUDIT.md](docs/STARTUP-READINESS-AUDIT.md).

The package identity is `pi-perimeter` (formerly `pi-warden`); the unscoped npm
name `pi-warden` belongs to another maintainer, so installing `npm:pi-warden`
installs a different project. The publishable identity, publication safeguards
and release record are in [docs/PACKAGING.md](docs/PACKAGING.md).

Do not rely on this package as a security control beyond the stabilized P1–P18 boundary in [docs/V1-GUARANTEES.md](docs/V1-GUARANTEES.md).

## Installation

No `pi install` one-liner is evidenced in this repository. The confirmed path — exercised only against isolated fixtures, never installed into a real profile as evidence — is npm plus a Pi package entry:

```sh
npm install pi-perimeter@1.0.0 --prefix "$HOME/.pi/agent/npm" --legacy-peer-deps --ignore-scripts --no-audit --no-fund
```

(Registry name and version are the published identity; `--prefix`/`--legacy-peer-deps`/`--ignore-scripts` match `test/startup-readiness.test.ts`, which installs the packed tarball — not the registry — the same way. `--no-audit --no-fund` are added here for registry installs and are not part of that test.)

Then declare the package in the agent settings file (`<agentDir>/settings.json`; default user profile: `$HOME/.pi/agent/settings.json`):

```json
{ "packages": ["npm:pi-perimeter@1.0.0"] }
```

(This `packages` entry shape is the one exercised by `test/startup-readiness.test.ts`; `<agentDir>` is Pi's own agent directory.)

## Verify loading

```sh
pi list
```

Expect `npm:pi-perimeter@<installed>` and the installed root. If the entry is missing, Pi never loads the extension: re-check the `packages` entry and the npm prefix. On Pi `0.84.4` the published `1.0.0` additionally fails at factory load (see the status warning above), before any gate becomes active.

## Quick start

The intended user experience is:

```text
inside workspace       -> allow
outside workspace      -> approval
secret                 -> deny
dangerous operation    -> approval / deny
sandbox unavailable    -> block
```

Try it: read an ordinary file inside the workspace (allowed); read a path outside the workspace (a scoped, single-use approval dialog — refusal, timeout, or a missing UI blocks); read a `.env` file or an SSH key (denied, never approvable). An ordinary build or test shell command runs only inside containment — a private workspace projection under a deny-default Seatbelt profile with closed networking — and its changes return to the host only after per-target re-authorization. Internal contracts and per-Goal evidence are linked, not repeated here: [docs/FILE-GATE.md](docs/FILE-GATE.md), [docs/SHELL-GATE.md](docs/SHELL-GATE.md), [docs/NETWORK-GATE.md](docs/NETWORK-GATE.md), [STATE.md](STATE.md).

## Security notice

`pi-perimeter` is not a mature general-purpose security boundary. Its accepted
controls apply only within their documented platform, operation and threat
model limits; do not use real credentials in tests or infer protection outside
those limits. See [SECURITY.md](SECURITY.md) for the current reporting policy.

## Building the native helper

Contained shell execution needs the small native helper described in
[docs/SHELL-GATE.md](docs/SHELL-GATE.md). Build it explicitly with the
platform toolchain **in the installed package directory shown by `pi list`**.
For the default user-level Pi profile, the command is:

```sh
npm --prefix "$HOME/.pi/agent/npm/node_modules/pi-perimeter" run build:native
```

There is no implicit compilation at runtime, no download, and no privileged
step. If the helper is missing or does not match its recorded build identity,
every shell route is blocked with an actionable reason.

## Configuration

Two optional JSON sources, both restriction-only (project data can only tighten global policy, never weaken it):

- user/global: `<agentDir>/pi-warden/policy.json`, where `<agentDir>` is Pi's own agent directory (the runtime resolves it via Pi's `getAgentDir()`); the `pi-warden` directory spelling is retained from the formerly `pi-warden` name (see [docs/PACKAGING.md](docs/PACKAGING.md));
- project: `<workspace>/.pi-warden/policy.json` (same retained formerly-`pi-warden` spelling).

Strict version-1 schema — no other keys, no coercion; an invalid source denies every decision consuming it:

```json
{
  "version": 1,
  "operations": {
    "read": "ASK",
    "write": "DENY",
    "edit": "ALLOW"
  }
}

```

Values are exactly `ALLOW`, `ASK`, or `DENY` per operation (`read`, `write`, `edit`). Missing files contribute nothing. Full contract: [docs/CONFIGURATION-AUTHORIZATION.md](docs/CONFIGURATION-AUTHORIZATION.md).

## Removal and diagnostics

Removal is the inverse of installation (no real-profile install exists as evidence, so no installer does this for you):

```sh
npm uninstall pi-perimeter --prefix "$HOME/.pi/agent/npm" --no-audit --no-fund
```

Then remove the `"npm:pi-perimeter@..."` entry from `<agentDir>/settings.json`. The pack/install/uninstall cycle itself is regression-covered in isolation by `test/package-lifecycle.test.ts`.

Diagnostics:

- `pi list` must show `npm:pi-perimeter@<installed>` and the installed root. A missing entry means Pi never loads the extension.
- Before Pi emits `session_start`, every tool call is blocked fail-closed (`gate not ready`); a failed registration or a foreign/missing/duplicate tool owner degrades the runtime and blocks the affected tools.
- A missing or unverifiable native helper blocks every shell route with an actionable reason — build it with the command above; there is no implicit compilation, download, or fallback.
- Tools outside the supported set (`read`, `write`, `edit`, `grep`, `find`, `ls`, `bash`, `user_bash`) are blocked fail-closed as not integrated.

## Development

Start with [AGENTS.md](AGENTS.md), [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), and [CONTRIBUTING.md](CONTRIBUTING.md). The release-gated plan is in [ROADMAP.md](ROADMAP.md).

## License

MIT. See [LICENSE](LICENSE).
