# Security policy

`pi-perimeter` (formerly `pi-warden`) provides bounded authorization and macOS shell containment for supported Pi tool routes. The published package is `1.0.1`; `1.0.0` is broken and must not be used for protection. See the [compatibility matrix](docs/COMPATIBILITY.md) for exercised versions and review status.

## Security boundary

The implemented controls are:

- Canonical path classification and workspace-first authorization for supported file tools, including known-secret denial and protection of Pi's control-plane files.
- Scoped, single-use approvals for approvable operations. Missing UI, refusal, timeout, or an invalid binding blocks the operation.
- Restriction-only file policy: project configuration can tighten global policy and cannot override a baseline denial.
- A contained route for model `bash` and user `!` / `!!`: a private workspace projection, constructed environment, deny-default macOS Seatbelt profile, and reauthorized export.
- Closed networking by default, with a per-invocation broker enforcing narrow pinned destination scopes where configured or approved.
- Fail-closed handling of unsupported tools and unavailable containment. A sandbox failure does not fall back to unrestricted shell execution.

Policy decides whether an operation is allowed; approval records a narrow user decision; containment limits a running process. An approval alone is not a sandbox. The accepted promises and residual risks are in [V1-GUARANTEES.md](docs/V1-GUARANTEES.md), with the [file](docs/FILE-GATE.md), [shell](docs/SHELL-GATE.md), and [network](docs/NETWORK-GATE.md) contracts providing details.

## Limitations

- The Pi host process, provider requests, arbitrary extension code, and trusted direct SDK calls are outside shell containment. Only load extensions you trust. MCP and `codemode` tools are currently blocked as unintegrated.
- Secret classification is path-based and does not scan contents. An ordinary path can contain a secret. An allowed endpoint can receive data the contained process can read.
- Other platforms carry no containment support claim. The shell guard checks Darwin major `27`, arm64, and the pinned sandbox executable; it does not validate every macOS build or Pi release.
- A private projection changes shell behavior. Host delete and rename effects are not exported; direct macOS file-tool creation is unavailable.
- Protection against an independent same-user host writer and mount isolation remain unverified. No macOS Keychain isolation or general malware-containment guarantee is made.
- A failed extension load leaves its protections inactive. Package registration in `pi list` does not prove loading or enforcement.

Read the [threat model](THREAT_MODEL.md) for attacker assumptions. Exercise only the documented boundary; test results do not establish universal safety.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/hiyotim/pi-perimeter/security/advisories/new) for suspected bypasses of a documented control. This is the project's confidential intake route, subject to GitHub's access controls. Reports are handled on a best-effort basis, without a promised response or remediation timeline.

Include the affected control, exact package/Pi/Node/macOS versions, expected and observed behavior, likely impact, and a minimal reproduction using temporary files and fake data. Mark urgent reports in the first line.

Keep exploit details and sensitive system information in the private report. Do not submit real credentials, tokens, keys, or another person's data. Non-sensitive documentation problems and ordinary bugs can be reported through [GitHub issues](https://github.com/hiyotim/pi-perimeter/issues).
