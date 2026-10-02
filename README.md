# pi-perimeter

A small security extension for [Pi](https://pi.dev/), with workspace-first permissions, explicit approvals, and contained shell execution on macOS. The project was formerly `pi-warden`.

Pi normally runs tools with your user account's permissions. `pi-perimeter` helps limit what an agent can read, change, or execute while working on a project, without setting up Docker or a virtual machine.

## What it does

| Action | Behavior |
| --- | --- |
| Read or modify ordinary project files | Use the workspace policy; stricter configuration still applies. |
| Access ordinary files outside the project | Require a scoped, single-use approval where the operation is supported. |
| Access known secret paths, such as `.env` or SSH keys | Deny; an approval cannot override the denial. |
| Run model `bash` or your `!` / `!!` command | Execute in a private workspace copy under macOS Seatbelt; authorize changes before copying them back. |
| Connect from a contained command | Keep networking closed unless a narrow destination scope is configured or approved. |
| Use an unintegrated tool, including MCP or `codemode` | Block the tool. |
| Run a shell when containment cannot be established | Refuse execution. |

The extension loads into Pi and replaces the supported tool routes for that session. It does not patch the Pi executable. Installing it registers a package in the selected Pi profile; removing it and restarting Pi ends those restrictions. Changes already made to your project remain.

## Requirements and tested versions

- **Apple Silicon Mac.** Containment was exercised on macOS `27.0` (`26A428`) and `27.0.1` (`26A434`), arm64. Other platforms carry no support claim; shell execution is blocked on Linux and Windows.
- **Pi:** the published `pi-perimeter@1.0.1` was exercised with Pi `0.84.4` and, on 2026-10-02, Pi `1.0.0`. The newer exercise is recorded evidence pending independent review and formal support acceptance.
- **Node:** declared minimum `22.19.0`; the macOS runtime exercises used `26.8.1`.
- **Apple command line build tools** for the native helper used by shell containment.

The shell guard checks Darwin major `27`, arm64, and a pinned `sandbox-exec` identity. It does not compare the exact macOS marketing version or build number. Passing that guard alone does not prove compatibility with an untested OS update or Pi version. See the [compatibility matrix](docs/COMPATIBILITY.md) for exact evidence and limits.

**Use `pi-perimeter@1.0.1`.** The older `1.0.0` fails to load before its protections activate. Package: [npm](https://www.npmjs.com/package/pi-perimeter).

## Install and use

To try it without changing your ordinary Pi profile, follow the [separate-profile instructions](docs/USAGE.md#try-with-a-separate-pi-profile). A separate profile keeps Pi settings and package registration apart; it does not isolate the whole application from your computer.

For installation in Pi's default user profile:

```sh
pi install npm:pi-perimeter@1.0.1
pi list
npm --prefix "$HOME/.pi/agent/npm/node_modules/pi-perimeter" run build:native
```

For a custom profile, build in the package root reported by `pi list`. Compilation is explicit and needs no administrator privileges. If the helper is missing or unverifiable, shell commands are blocked.

Start a fresh Pi session from your project directory:

```sh
cd /path/to/your/project
pi
```

**Check loading before relying on protection.** `pi list` confirms registration only. In a disposable project with fake data, confirm that an ordinary file read succeeds and a `.env` read is denied. Loader errors or missing expected denials mean active protection has not been established. The [first-use guide](docs/USAGE.md#verify-before-first-use) gives the steps and common refusal reasons.

No configuration is needed for the default file policy and closed-network shell route. Optional policy files can restrict operations or define narrow network destinations; see [configuration](docs/CONFIGURATION-AUTHORIZATION.md).

## Practical limits

- This is a bounded tool security layer. The Pi host process, provider requests, and arbitrary extension code run outside shell containment. Load only extensions you trust.
- Secret detection uses paths, not file contents. An ordinary file can still contain sensitive data, and an allowed network endpoint can receive data a contained process can read.
- Shell execution uses a limited command grammar and a private workspace copy. Some commands, toolchains, and network workflows will be refused. Host deletions and renames are not copied back; direct creation through macOS file tools is unavailable.
- Protection against an independent process running as your user and mount isolation are unverified. There is no claim of macOS Keychain isolation or general malware containment.

Review the [security policy](SECURITY.md) and [documented guarantees](docs/V1-GUARANTEES.md) before choosing what work to run with it.

## Remove

Exit the Pi session, then remove the package from the same profile where you installed it:

```sh
pi remove npm:pi-perimeter
```

Start Pi again for an ordinary session. For a separate profile, use the same `PI_CODING_AGENT_DIR` when removing it. Uninstalling the extension does not revert project edits or delete your own policy files.

## Documentation and contributing

[Usage and troubleshooting](docs/USAGE.md) · [Documentation index](docs/README.md) · [Contributing](CONTRIBUTING.md)

MIT license. See [LICENSE](LICENSE).
