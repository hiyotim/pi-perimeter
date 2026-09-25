# Security Policy

## Current status

`pi-perimeter` (formerly `pi-warden`) is at **v1.0.0 (macOS-only)**. Goals 1–4 — bounded configuration
authorization, Pi file gates with scoped approvals, contained shell execution,
and restricted networking — are implemented, verified on the declared macOS
target, and accepted within their documented contracts and declared
limitations. Phase 7 gate is closed as macOS-only v1.0; `pi-perimeter@1.0.0`
is the controlled published distribution (see [docs/PACKAGING.md](docs/PACKAGING.md)).

Do not rely on it as a general-purpose security boundary. It is neither a
virtual machine nor a Docker wrapper and is not a general malware-containment
system, and its controls do not extend beyond the limits below. See
[README.md](README.md) for the accepted contracts and [ROADMAP.md](ROADMAP.md)
for the release gates.

## What to trust

The accepted goals apply only inside their documented platform, operation, and
threat-model limits. Within those limits the project provides:

- a monotonic configuration authority in which project-controlled
  configuration can only tighten global policy;
- one authorizer for the supported model-facing file tools (`read`, `write`,
  `edit`, `grep`, `find`, `ls`), with exact single-use scoped approvals for
  effective `ASK` outcomes and fail-closed handling of unknown tools;
- one contained shell route for model `bash` and user `!`/`!!` on macOS 27
  arm64, using a private workspace projection, a constructed environment, and a
  deny-default Seatbelt profile with closed networking; and
- destination-exact, host-pinned enforcement for narrowly allowed outbound
  connections through a per-invocation broker.

Do not trust the current code to:

- contain shell commands on any platform other than the declared macOS target
  (the shell route stays blocked there);
- reach destinations outside the pinned scope, or prevent exfiltration to an
  allowed endpoint: an allowed endpoint can receive any data the contained
  process can read;
- defend against an independent same-user host writer, including ordinary
  tampering with the projection or the loopback broker endpoint, or provide
  mount isolation (declared, unverified);
- detect secret contents beyond path classification — an `ordinary` result
  does not prove that a file contains no secret;
- export host delete or rename effects, or create files directly through the
  macOS file tools; or
- isolate the macOS Keychain.

## Three distinct controls

- **Policy enforcement** decides whether a requested operation is authorized.
- **Approval** asks the user for a narrow exception or confirmation. It does not contain execution.
- **OS containment** restricts what a running process can actually reach. It does not decide whether the user intended the action.

A mature design requires all applicable controls. None should be described as a substitute for another.

## Responsible disclosure

Report suspected vulnerabilities privately through GitHub private vulnerability reporting:

<https://github.com/hiyotim/pi-perimeter/security/advisories/new>

This is the only confidential intake route the project currently operates. The repository is public, so the route is publicly reachable; submitted reports are visible only to the repository's security managers and administrators (and to the reporter who filed the report) until maintainers publish an advisory. It is a reporting channel, not a service commitment: it promises no confidentiality beyond what GitHub private vulnerability reporting provides, and no particular acknowledgement, remediation, or disclosure timeline. Reports are handled on a best-effort basis.

Do not post exploit details, real credentials, or sensitive user data publicly. A documentation error or non-sensitive design discussion may be raised through the repository issue tracker.

## Reporting scope

What to report: a suspected bypass or failure of a documented invariant — workspace containment, secret classification, the file gates and scoped approvals, the contained shell route, or the restricted-network boundary — or an error in the security documentation itself.

What helps the investigation: the affected invariant; expected versus observed behavior; the declared platform and versions; a minimal reproduction built only from fake credentials, fake `.env`/SSH/cloud key material, and temporary files; and the likely impact.

Use synthetic data only. Never test against someone else's system, and never include real credentials, tokens, keys, or another person's data. Until an advisory is published, treat the report as confidential: do not post exploit details, reproduction steps, or affected-system specifics publicly.

Urgent or especially sensitive reports: `pi-perimeter@1.0.0` is published (macOS-only v1.0), but a fresh-install audit found the published bytes fail to load in Pi `0.84.4` (`Extension runtime not initialized` at extension load), so there is no known enforced deployment; the startup correction in this source tree is unreleased and unaccepted. If a report is urgent or especially sensitive, say so in the first line and keep every sensitive detail in the single private report rather than splitting it between a public and a private channel.

See [THREAT_MODEL.md](THREAT_MODEL.md) for implemented coverage and [ROADMAP.md](ROADMAP.md) for the gates required before stronger claims are made.
