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

The intended user experience is:

```text
inside workspace       -> allow
outside workspace      -> approval
secret                 -> deny
dangerous operation    -> approval / deny
sandbox unavailable    -> block
```

The project aims to cover every model-facing built-in file and shell path: `read`, `write`, `edit`, `grep`, `find`, `ls`, `bash`, and user `!` commands.

## Architecture

The planned design has three independent layers:

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

- Declared containment target: macOS 27.0 (26A428) on Apple Silicon, arm64.
- Other macOS versions and other architectures are unsupported and fail closed;
  a passing self-test does not widen this table. The shell route is blocked off
  the declared target by `verifyPlatform`. Linux is not a support claim anywhere:
  the file gates execute there (the Class 1 descriptor-relative path runs on
  Linux, the platform-independent suites run in hosted Linux CI), but Goal 2
  recorded no Linux runtime execution against the accepted bytes and the Class 1
  runtime-evidence question stays open. Windows is unsupported in every respect.
- Every row, the exact version behind it, and the evidence for it:
  [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## Installation

`pi-perimeter@1.0.0` (macOS-only v1.0) is published on npm. Supported installation is the declared containment target only (macOS 27.0 arm64, Pi `0.84.4`); every other platform or peer version is outside the demonstrated guarantees — see [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

The package identity is `pi-perimeter` (formerly `pi-warden`); the unscoped npm
name `pi-warden` belongs to another maintainer, so installing `npm:pi-warden`
installs a different project. The publishable identity, publication safeguards
and release record are in [docs/PACKAGING.md](docs/PACKAGING.md).

Do not rely on this package as a security control beyond the stabilized P1–P18 boundary.

## Security notice

`pi-perimeter` is not a mature general-purpose security boundary. Its accepted
controls apply only within their documented platform, operation and threat
model limits; do not use real credentials in tests or infer protection outside
those limits. See [SECURITY.md](SECURITY.md) for the current reporting policy.

## Building the native helper

Contained shell execution needs the small native helper described in
[docs/SHELL-GATE.md](docs/SHELL-GATE.md). Build it explicitly with the
platform toolchain:

```sh
npm run build:native     # writes native/piwarden-helper + native/build-manifest.json
```

There is no implicit compilation at runtime, no download, and no privileged
step. If the helper is missing or does not match its recorded build identity,
every shell route is blocked with an actionable reason.

## Development

Start with [AGENTS.md](AGENTS.md), [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), and [CONTRIBUTING.md](CONTRIBUTING.md). The release-gated plan is in [ROADMAP.md](ROADMAP.md).

## License

MIT. See [LICENSE](LICENSE).
