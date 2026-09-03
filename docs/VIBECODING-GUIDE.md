# Vibe Coding a Security Project

Coding agents can accelerate research, scaffolding, tests, documentation, and small implementations. They do not remove the need to define the security boundary or verify claims. In a security project, a plausible-looking implementation is especially dangerous when its failure cases have not been made explicit.

## Good tasks to delegate

- Locate the current upstream API and summarize exact extension hooks.
- Implement one already-defined pure decision rule.
- Generate table-driven cases from an accepted invariant.
- Add temporary-fixture helpers that cannot access the real home directory.
- Search for call sites that must pass through a central gate.
- Review a focused diff for traversal, symlink, fallback, or authority bypasses.
- Compare a proposed dependency against a short acceptance checklist.
- Keep documentation synchronized with demonstrated behavior.

Provide the agent with the exact invariant, files in scope, expected decisions, forbidden changes, and verification command. Require it to report limitations and unresolved ambiguity.

## Decisions that require separate human review

- What is hard-denied and whether any override exists.
- Which configuration source has authority.
- Whether an approval may persist and how broadly.
- What happens when path identity or sandbox state is ambiguous.
- Which credentials or environment variables enter a child process.
- What the sandbox actually guarantees on each OS version.
- Whether a new dependency is acceptable in the trusted computing base.
- The wording of public security guarantees.

An agent can research and propose these decisions, but maintainers should approve them explicitly and review independent evidence.

## Do not ask for “implement everything”

A broad prompt hides interactions among path resolution, approvals, shell semantics, process containment, networking, and upstream APIs. It encourages large diffs, implicit assumptions, duplicated policy, and tests that merely mirror the implementation. Review quality falls as the change surface grows.

Instead, define one observable invariant. Examples:

- “A canonical target outside the workspace never receives `ALLOW`."
- “A symlink inside the workspace that resolves to a fake SSH key receives `DENY`."
- “Sandbox initialization failure prevents model and user shell execution."
- “Project policy cannot remove a global deny rule."

Specify the decision table and failure mode first, then implement only enough code to satisfy it.

## Use adversarial tests

For each expected path, ask how the same effect could be expressed differently. Test `..`, absolute paths, sibling prefix collisions, symlink chains, missing destination components, renames, case behavior, nested `sh -c` and `bash -c`, substitutions, redirections, sourced scripts, environment expansion, subprocesses, redirects, and local endpoints where relevant.

Keep adversarial cases independent of implementation details. A test should state the protected outcome, not reproduce the same parsing logic as production code. Every discovered bypass becomes a permanent regression test.

## Review new dependencies

Before adding a dependency, document:

- the exact security-critical capability it provides;
- why a small local implementation is less safe or maintainable;
- maintainer activity, release practices, and security history;
- transitive dependencies and install scripts;
- runtime privileges and data exposure;
- pinning, update, removal, and failure behavior;
- licensing and platform support.

Inspect the source path that enforces the required property. A popular package or upstream example is not, by itself, evidence of a suitable security boundary.

## Independent audit timing

Use a second agent or reviewer after a coherent invariant is implemented and locally tested, not while the design is still undefined. Give the reviewer the threat, stated guarantee, focused diff, and tests, but ask it to derive bypasses independently. Independent review is particularly valuable for path boundaries, configuration precedence, parser changes, sandbox failure behavior, environment filtering, and release claims.

Before public beta and v1.0, use broader independent review across the complete enforcement path and its platform assumptions.

## Recommended session pattern

```text
Research
→ Plan
→ Implement one invariant
→ Test
→ Adversarial review
→ Review diff
→ Commit
```

End every session with a factual statement of what is implemented, what remains planned, which checks ran, and which security claims are still unsupported.
