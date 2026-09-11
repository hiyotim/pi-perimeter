# Development Guide

## Repository map

| Path | Responsibility |
|---|---|
| `src/index.ts` | Thin Pi integration entry point; no policy logic. |
| `src/policy/` | Pure normalization, classification, authority, and decision logic. |
| `src/approvals/` | User interaction and narrowly scoped approval state. |
| `src/sandbox/` | OS-specific process, filesystem, environment, and network containment adapters. |
| `test/` | Isolated regression and adversarial tests. |
| `THREAT_MODEL.md` | Assets, attackers, attack classes, and planned responses. |
| `ARCHITECTURE.md` | Component boundaries and trust zones. |
| `ROADMAP.md` | Release gates and implementation order. |

## Daily workflow

1. Select one roadmap item or security invariant.
2. Inspect the smallest relevant code and test surface.
3. State the intended decision and failure behavior before coding.
4. Verify current upstream Pi behavior if the change touches integration.
5. Implement the smallest coherent change.
6. Add positive, negative, and bypass-oriented tests.
7. Run targeted tests, then the complete relevant checks.
8. Review the diff for widened authority, unsafe fallback, secrets, and unrelated edits.
9. Update documentation to match demonstrated behavior.
10. Commit only after the adversarial review is complete.

Phase 1A and Phase 1B use the Node test runner for TypeScript tests and a local TypeScript compiler for static checking. Run `npm run test:paths` for the focused path suite, `node --test test/resources.test.ts` for the focused resource-classification suite, and `npm run check` for the complete currently applicable checks.

## Code placement

- Put deterministic decisions and data types in `src/policy/`. This code should not access the UI, start processes, or depend on Pi runtime state.
- Put prompt presentation, approval scopes, expiration, and persistence decisions in `src/approvals/`.
- Put platform detection, sandbox initialization, subprocess routing, environment construction, and network enforcement in `src/sandbox/`.
- Keep `src/index.ts` as wiring between current Pi APIs and these components.
- Put shared types in the narrowest owning module. Avoid a generic utility directory until repeated use proves it necessary.

## Testing philosophy

Tests are evidence for narrowly worded guarantees. Each invariant needs:

- expected-use cases;
- denied and approval-required cases;
- malformed and ambiguous input;
- platform-relevant edge cases;
- a regression test for every discovered bypass;
- failure-path tests that demonstrate fail-closed behavior.

Filesystem tests create a new temporary root containing fake workspaces, fake home directories, fake `.env` files, fake SSH/AWS/Pi credentials, and symlink graphs. They must not inspect or depend on the real `$HOME`.

The Phase 1A path suite creates the fake workspace, external paths, files, and symlink graphs needed for path canonicalization. Phase 1B classification tests obtain genuine resolver results from isolated temporary fixtures, including fabricated existing and missing resources; the classifier itself performs no filesystem reads. Provenance-rejection tests also supply forged or malformed inputs and require rejection. Neither suite reads real credentials or the real home directory.

Policy tests should be pure and fast. Pi integration tests verify event/tool coverage separately. Sandbox tests are platform-tagged and must prove initialization and containment rather than infer them from a success message.

## Checking Pi compatibility

Use primary sources:

1. current documentation at `https://pi.dev/docs/latest/`;
2. the current `earendil-works/pi` source and examples;
3. released package metadata for the intended compatibility range.

Verify at least the package manifest, exported extension types, entry-point contract, tool and `user_bash` interception semantics, supported replacement operations, project-trust behavior, core peer-dependency convention, and Node engine. Record the upstream version or commit used by a compatibility-affecting decision.

Do not infer a stable security boundary from an example extension. Upstream examples may demonstrate capability without implementing this project's fail-closed or configuration-authority requirements.

## Policy concern or sandbox concern?

Ask two separate questions:

1. **Should this operation be authorized?** That is a policy concern. It uses canonical identity, resource class, requested effect, authority, and approval state.
2. **What can the operation reach after it starts?** That is a containment concern. It uses OS restrictions, process routing, environment sanitization, and network controls.

An ordinary in-workspace build can be policy-allowed and still require a sandbox. An approved external read can remain subject to containment. A hard-denied secret is not made accessible by a sandbox. Keep these results separate in code, tests, UI, and documentation.
