# Usage and troubleshooting

Start with the [README](../README.md) for purpose, requirements, and installation in the default Pi profile. Use the steps below for a first trial, checks, and removal.

## Try with a separate Pi profile

A separate agent directory has its own settings, authentication files, and installed packages. These commands use the existing Pi executable and register the extension only in the trial profile. They do not patch Pi or install it into your ordinary profile. The separate profile is a configuration boundary; the Pi host process still runs as your user.

First, choose a fresh, empty trial directory. If the example path already contains files, choose another path. Run:

```sh
(
  set -e
  export PI_CODING_AGENT_DIR="$HOME/.pi/perimeter-trial"
  pi install npm:pi-perimeter@1.0.2
  pi list
  npm --prefix "$PI_CODING_AGENT_DIR/npm/node_modules/pi-perimeter" run build:native
)
```

The parentheses keep the environment setting local to that command group. Your next ordinary `pi` command uses its usual profile. The helper build path assumes this user-level install; use the actual root shown by `pi list` if it differs.

Start the trial session with the same profile from a disposable project:

```sh
perimeter_workspace="$(mktemp -d /private/tmp/pi-perimeter-try-XXXXXX)"
printf 'Hello from a disposable project.\n' > "$perimeter_workspace/hello.txt"
printf 'FAKE_TOKEN=not-a-real-secret\n' > "$perimeter_workspace/.env"
cd "$perimeter_workspace"
PI_CODING_AGENT_DIR="$HOME/.pi/perimeter-trial" pi
```

The trial profile does not copy saved credentials from your ordinary profile. If you choose to make model requests, configure authentication in that profile yourself. The local compatibility audit used the SDK with synthetic fixtures and made no model requests; it did not verify a provider-backed conversation or physical approval dialog.

## Verify before first use

Use fake data in a disposable workspace. Avoid reading real credentials to test a denial.

1. Check that Pi reports no extension-loading error. `pi list` alone is insufficient.
2. Ask Pi to read `hello.txt`. An ordinary workspace read should succeed unless you configured stricter policy.
3. Ask Pi to read the fake `.env`. It should be refused as a secret path.
4. Ask Pi to run `pwd` through `bash`. With the verified native helper and platform, it should run through containment in the private workspace projection. Before building the helper, shell execution should be refused.
5. If testing an external-file approval, use a temporary ordinary file outside the workspace. An approvable operation should request a scoped, single-use decision. Declining, timing out, or having no approval UI blocks it.

A tool result or refusal is useful evidence of routing, not proof of every sandbox guarantee. If loading fails or the expected `.env` denial is absent, stop the session and diagnose it before relying on the extension.

## Working with it

The project directory you start Pi in is the workspace. The supported model-facing tools are `read`, `write`, `edit`, `grep`, `find`, `ls`, and `bash`; user `!` and `!!` commands use the contained shell route too. Unknown tools, including MCP and `codemode`, are blocked.

Approvals apply to the exact operation or invocation; they do not permanently grant unrestricted access. Some operations remain denied even with approval. On macOS, direct file-tool creation is unavailable; contained shell changes may create authorized files on export. Host deletion and rename effects are not exported.

A contained command works in a private projection of the project with a constructed environment. It may lack your usual environment variables, credentials, tools, or network connectivity. A familiar command is not guaranteed to work unchanged. Only changes that pass export authorization are copied back.

Optional [configuration](CONFIGURATION-AUTHORIZATION.md) can make file-operation policy stricter. For online workflows, read the [network contract](NETWORK-GATE.md#5-policy-sources-and-monotonicity) before adding destination rules. A destination rule grants access to that endpoint; it does not certify what data will be sent or guarantee that a package manager needs only one endpoint.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| No package in `pi list` | Use the same profile used during installation; confirm the install succeeded. |
| Extension fails to load | Use package `1.0.2`, restart Pi, and compare your versions with the [matrix](COMPATIBILITY.md). A failed load leaves no active protection from this extension. |
| `gate not ready` or tool-owner refusal | Start a fresh session; inspect loading errors and competing tool registrations. Do not assume a blocked or degraded gate is ready. |
| Missing or unverified helper | Run `build:native` in the installed package root. Keep the build manifest with the helper. |
| Unsupported platform or changed sandbox identity | Check the matrix. An OS update may need new qualification; do not bypass the guard. |
| Ordinary operations denied after editing policy | Check strict JSON syntax and schema. Invalid policy fails closed. |
| Shell command refused | Check the command grammar, configured restrictions, approval availability, toolchain, and helper/platform refusal reason. There is no unrestricted fallback. |
| Network request fails | Networking is closed without a scoped route; additional endpoints or unsupported client behavior can still be refused. |
| MCP or `codemode` refused | These tools are not integrated into the current security model. |

For a non-sensitive bug report, include package/Pi/Node/macOS versions, the refusal reason, and a minimal reproduction with fake data in a [GitHub issue](https://github.com/hiyotim/pi-perimeter/issues). Report suspected security bypasses [privately](../SECURITY.md#report-a-vulnerability).

## Remove after a trial

Exit the trial session. Remove the package with the same profile setting:

```sh
PI_CODING_AGENT_DIR="$HOME/.pi/perimeter-trial" pi remove npm:pi-perimeter
PI_CODING_AGENT_DIR="$HOME/.pi/perimeter-trial" pi list
```

The package should be absent. A running session can retain its loaded extension until it exits. Your next ordinary `pi` session uses its usual profile, provided you have not exported a different `PI_CODING_AGENT_DIR` in your own shell.

Removal does not undo project changes or delete the trial profile and workspace. Once you no longer need them, remove the specific trial directories you created. Do not remove your ordinary Pi agent directory.
