# pi-warden

`pi-warden` is an early lightweight security extension/package for [Pi](https://pi.dev/), focused on workspace-scoped authorization and OS-level containment without requiring Docker or a full virtual machine.

> **Project status: Phase 1 / Pre-alpha**

This repository contains design documents, a minimal extension skeleton, and tested unenforced policy primitives through bounded configuration authorization. It does not enforce an accepted security policy in Pi; the Goal 2 file gate is present only as an unaccepted working-tree implementation with an open corrective pass.

## Problem

Pi is a local coding agent. Its built-in tools and extensions run with the permissions of the user who started Pi. Pi's Project Trust feature controls whether project-local settings, packages, and extensions are loaded, but it is not a runtime sandbox and does not constrain later tool calls.

That behavior is appropriate for Pi's general-purpose local workflow, but it does not provide the workspace-oriented threat model intended here. A permission prompt can authorize an action; it cannot contain a process after execution begins. `pi-warden` therefore treats authorization, user approval, and OS containment as separate controls.

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

The Goal 2 working-tree implementation (NOT accepted; corrective pass open) adds central enforcement: pi-warden mediates every supported model-facing file tool (`read`, `write`, `edit`, `grep`, `find`, `ls`) through one gate (`src/gate/`), requests exact single-use scoped approvals for effective `ASK` outcomes (`src/approvals/`), protects the Pi agent directory and its policy location structurally (`src/policy/control-plane.ts`), replaces `grep`/`find`/`ls` with controlled same-name tools that classify every entry before reading and exclude denied resources from results, blocks model `bash`/`powershell` and user `!`/`!!` shell execution without spawning a shell, and fails closed for unknown or dynamically registered model-facing tools. See [docs/FILE-GATE.md](docs/FILE-GATE.md) for the exact operation mapping and limits. Important limitations remain: TOCTOU-style filesystem replacement races between authorization and execution are narrowed to the Pi tool-call boundary but not eliminated, and the owner reproduced an ancestor-directory symlink swap that writes outside the workspace between the ancestor verification and the final open; Goal 2 is therefore on an open corrective pass and is not a security control; shell execution and network access are blocked, not sandboxed; there is no OS containment, environment sanitization, or audit log.

The project still does **not** provide:

- shell execution capability (Shell enablement is deliberately blocked until Goal 3);
- process, filesystem, or network containment;
- environment sanitization;
- secret-content detection beyond path classification;
- audit logging or established security guarantees.

## Platform

- macOS on Apple Silicon is the first target.
- Linux support is under consideration for a later phase.

## Installation

**Not available yet.**

Do not install or rely on this package as a security control.

## Security notice

`pi-warden` is not a mature security boundary. The current path primitive is not integrated with Pi tools. Do not use it to process untrusted repositories, protect real credentials, or run unmonitored agent workloads. See [SECURITY.md](SECURITY.md) for the current reporting policy.

## Development

Start with [AGENTS.md](AGENTS.md), [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), and [CONTRIBUTING.md](CONTRIBUTING.md). The release-gated plan is in [ROADMAP.md](ROADMAP.md).

## License

MIT. See [LICENSE](LICENSE).
