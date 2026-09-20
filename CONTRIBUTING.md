# Contributing

`pi-perimeter` (formerly `pi-warden`) is a security-sensitive pre-alpha project. Contributions should be small, explicit, and tied to a documented invariant or roadmap item.

## Before making a change

1. Follow [AGENTS.md](AGENTS.md). Use relevant sections of [ARCHITECTURE.md](ARCHITECTURE.md) for component boundaries and [THREAT_MODEL.md](THREAT_MODEL.md) for affected threats; reuse current context.
2. Identify the single invariant or release gate affected.
3. Re-check current Pi documentation before changing integration behavior.
4. Open a design discussion before adding a runtime dependency or widening authority.

## Change expectations

- Prefer one coherent security change per pull request.
- Add regression and adversarial tests with isolated temporary fixtures.
- Do not use real home-directory files, credentials, tokens, or keys.
- Explain failure behavior and why the change cannot silently weaken policy.
- Keep project-local configuration monotonic: it may tighten, never loosen, global policy.
- Update documentation when guarantees, limitations, or upstream compatibility change.
- Include dependency purpose, maintenance status, security history, transitive surface, and rejected alternatives when proposing a dependency.

## Review checklist

Use [docs/SECURITY-CHECKLIST.md](docs/SECURITY-CHECKLIST.md) before requesting review. The expected workflow is described in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Security reports

Report suspected vulnerabilities privately through GitHub private vulnerability reporting, as described in [SECURITY.md](SECURITY.md). Do not publish sensitive exploit details, reproduction steps, or real credentials.
