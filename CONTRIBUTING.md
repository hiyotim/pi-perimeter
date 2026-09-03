# Contributing

`pi-warden` is a security-sensitive pre-alpha project. Contributions should be small, explicit, and tied to a documented invariant or roadmap item.

## Before making a change

1. Read [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [THREAT_MODEL.md](THREAT_MODEL.md).
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

Do not publish sensitive exploit details or real credentials. See [SECURITY.md](SECURITY.md); a private reporting channel will be defined before public beta.
