# Documentation

## For users

- [Project README](../README.md): purpose, requirements, installation, limitations, and removal.
- [Usage and troubleshooting](USAGE.md): separate-profile trial, first-use checks, common refusals, and cleanup.
- [Configuration](CONFIGURATION-AUTHORIZATION.md): optional policy sources, strict schema, and restriction-only composition.
- [Compatibility](COMPATIBILITY.md): exact tested combinations and the archived earlier matrix.
- [Security policy](../SECURITY.md): trust boundary, limitations, and private vulnerability reporting.

## Technical detail

- [File tools](FILE-GATE.md), [shell containment](SHELL-GATE.md), and [restricted networking](NETWORK-GATE.md): implemented contracts and operation limits.
- [Security guarantees](V1-GUARANTEES.md): accepted promises and residual risks; version-bound acceptance is historical.
- [Architecture](../ARCHITECTURE.md) and [threat model](../THREAT_MODEL.md): component responsibilities and attacker assumptions.

## For contributors and maintainers

- [Contributing](../CONTRIBUTING.md) and [development](DEVELOPMENT.md): change and verification workflow.
- [Packaging and release](PACKAGING.md): package identity, staging, and publication safeguards.
- [Current state](../STATE.md): authoritative continuation record; dated updates supersede earlier checkpoints.
- [Roadmap](../ROADMAP.md): completed work and remaining gates.

## Verification records

The [1.0.2 release preparation record](RELEASE-1.0.2.md) tracks the documentation/packaging patch and its artifact gates.

The newest runtime exercise is the [2026-10-02 Pi 1.0.0 audit](PI-1.0.0-AUDIT-2026-10-02.md), with [structured results](pi-1.0.0-results-2026-10-02.json). The [maintenance record](MAINTENANCE-2026-10-02.md) distinguishes prepared source changes from publication and acceptance.

Other `*-AUDIT.md`, release records, and `*-hashes*.json` files preserve the evidence for particular historical versions. Their dates, versions, and source identities matter; an old “unpublished” or “pending” statement describes that checkpoint. They are audit records rather than current installation instructions. Follow the user documents above for current guidance.
