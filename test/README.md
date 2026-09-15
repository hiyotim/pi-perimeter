# Test Strategy

**Status: pure path, classification, read/write/edit decision, authorization composition, and configuration-authorization tests are implemented; Pi integration suites for the file gate, scoped approvals, and controlled traversal are implemented; platform-specific containment suites remain planned (Goal 3+).**

Run `npm run test:paths` for the path suite, `npm run test:configuration` for the complete configuration chain, `npm run test:gate` for gate/controlled-execution runtime integration (including the P1 final-target symlink-swap regression), `npm run test:approvals` for the approval contract, `npm run test:controlled` for controlled traversal effects, `npm run test:package` for the real isolated npm pack/install/rollback cycle, `npm run test:manifest` for the enforced sha256 artifact manifest, or `npm test` for all implemented tests. Tests run directly with the Node test runner using built-in type stripping; TypeScript remains a development-only dependency for `npm run typecheck`.


## Fixture isolation

Every filesystem test must create a unique temporary root and construct all needed data beneath it, including:

- a fake workspace and fake external directory;
- fake `.env` and `.env.*` files;
- fake SSH, AWS, GitHub, Git, and Pi credential paths;
- fake `.pem` and `.key` material containing no real keys;
- files and directories with traversal and prefix-collision cases;
- symlinks within, into, and out of the fake workspace;
- fake environment variables with non-secret test values.

Tests must never inspect, copy, mutate, or depend on real `$HOME` credentials. Test helpers should make accidental real-home access fail immediately.

## Required classes

- canonical and relative workspace paths;
- `../` traversal and absolute external paths;
- normalization ambiguity and sibling prefix collisions;
- symlink escape, symlink-to-secret, link chains, and replacement races;
- missing destination paths and existing-ancestor resolution;
- secret precedence over workspace allowance and approval;
- external read/write/edit outcomes;
- shell indirection, nested `sh -c` and `bash -c`, command substitution, redirection, and subprocesses;
- destructive, privileged, credential, publish, and deploy operations;
- environment sanitization;
- network allowlists, unknown destinations, redirects, local endpoints, and exfiltration attempts;
- sandbox unavailable and initialization-failure behavior;
- project configuration attempts to weaken global policy;
- every supported Pi tool plus a future/unknown-tool fail-closed case.

Every fixed bypass must remain as a regression test. Sandbox tests must verify actual containment effects, not only return values or UI status.

The `test:gate` suite drives the supported Pi extension surfaces (the documented `tool_call`/`user_bash` event protocol and the genuine controlled executors that replace the builtins) rather than only measuring hook-return values; the P1 regression reproduces the owner's final-target symlink swap through the controlled surface and proves fake secret content is never read. `test:package` performs an actual `npm pack` with content inspection, an isolated install with temporary `HOME`/userconfig/npm cache, and a verified uninstall rollback — no real home, Pi profile, credentials, or repository install is touched. Full installed-Pi interactive runs and macOS evidence are not available in this environment and remain unverified, with residuals documented in [docs/FILE-GATE.md](../docs/FILE-GATE.md) and [docs/FILE-GATE-AUDIT.md](../docs/FILE-GATE-AUDIT.md).
