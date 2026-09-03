# Test Strategy

**Status: Phase 1A path tests are implemented; later security suites remain planned.**

Future tests will provide evidence for individual security invariants. The suite will separate pure policy tests, Pi integration coverage, and platform-specific sandbox tests.

Run `npm run test:paths` for the path suite or `npm test` for all currently implemented tests. Tests run directly with the Node test runner; TypeScript remains a development-only dependency for `npm run typecheck`.

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
