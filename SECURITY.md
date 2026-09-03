# Security Policy

## Current status

`pi-warden` is in **Pre-alpha**. Phase 1A provides a tested path canonicalization and workspace-containment primitive plus a non-enforcing extension skeleton.

The path primitive is not connected to Pi tools, so it does not currently protect filesystem access. The package does not intercept Pi tools, protect credentials, show approval prompts, sanitize environments, restrict networks, or establish an OS sandbox. Do not rely on it as a security boundary.

## What to trust

At this stage, treat the repository as a design proposal. The documents define intended invariants and release gates that future implementations must satisfy. They are not evidence that those protections exist.

Do not trust the current code to:

- make untrusted repositories safe;
- prevent access outside a workspace;
- protect `.env`, SSH, cloud, GitHub, Git, Pi, or other credentials;
- contain shell commands or user `!` commands;
- prevent data exfiltration;
- isolate macOS Keychain;
- recover safely from sandbox failure.

## Three distinct controls

- **Policy enforcement** decides whether a requested operation is authorized.
- **Approval** asks the user for a narrow exception or confirmation. It does not contain execution.
- **OS containment** restricts what a running process can actually reach. It does not decide whether the user intended the action.

A mature design requires all applicable controls. None should be described as a substitute for another.

## Responsible disclosure

The private vulnerability-reporting process will be defined before public beta. No security contact email is published yet.

Until that process exists, do not include exploit details, real credentials, or sensitive user data in a public issue. A documentation error or non-sensitive design discussion may be raised publicly once the project has a public issue tracker. This guidance does not promise confidential intake at the current stage.

## Reporting scope

Useful reports should identify the affected invariant, expected and observed behavior, supported platform and versions, minimal reproduction using fake credentials and temporary files, and likely impact. Never test against someone else's system or use real secret material.

See [THREAT_MODEL.md](THREAT_MODEL.md) for planned coverage and [ROADMAP.md](ROADMAP.md) for the gates required before stronger claims are made.
