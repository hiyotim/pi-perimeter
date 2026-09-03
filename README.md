# pi-warden

`pi-warden` is an early lightweight security extension/package for [Pi](https://pi.dev/), focused on workspace-scoped authorization and OS-level containment without requiring Docker or a full virtual machine.

> **Project status: Phase 1 / Pre-alpha**

This repository contains design documents, a minimal extension skeleton, and the tested Phase 1A path policy primitive. It does not enforce a security policy in Pi.

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

Phase 1A implements and tests path canonicalization and component-aware workspace membership, including existing symlinks and non-existent creation targets. No Pi tool currently uses that result.

The project does **not** yet provide:

- workspace boundary enforcement in Pi;
- secret detection or credential protection;
- tool interception or approval prompts;
- shell parsing or dangerous-command classification;
- filesystem, process, or network containment;
- environment sanitization;
- audit logging or established security guarantees.

The entry point deliberately registers no hooks or tools. Its existence does not mean the extension is installed or active.

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
