# Agent Operating Manual

## Mission

Build `pi-perimeter` (formerly `pi-warden`): a small, auditable Pi extension/package that is intended to provide workspace-first authorization, explicit user approvals, and OS-level containment for model-facing operations. The target experience is convenient for normal work inside a project while treating external paths, secrets, dangerous operations, and unknown network access conservatively.

See [STATE.md](STATE.md) for the current acceptance checkpoint and implemented primitives. There is no functional enforcement. Do not represent planned protections as implemented.

## Continuity documents

- [STATE.md](STATE.md) is authoritative for factual execution state and cross-session continuation.
- [ROADMAP.md](ROADMAP.md) owns planned/completed Goals and dependencies.
- [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md), when present for an active task, owns the contract for that prepared Goal.

## Non-goals

`pi-perimeter` is not:

- a virtual machine or Docker wrapper;
- a general malware-containment system;
- a replacement for macOS security controls;
- a claim of perfect isolation from macOS Keychain;
- a substitute for reviewing untrusted code and agent output;
- permission to load real user credentials into tests;
- a complete shell-security system based on string matching.

## Security invariants

Future changes must preserve these invariants:

1. Workspace-first permissions are the default usability boundary.
2. Sensitive resources are denied by default; secrets should normally be hard-denied.
3. Paths are canonicalized before any security decision.
4. Symlinks and missing-path ancestors are evaluated as boundary-escape risks.
5. Project-controlled configuration can only tighten effective global policy; it cannot weaken it.
6. Configuration authority and precedence are explicit and testable.
7. Approval and containment are separate concepts. Approval does not imply sandboxing.
8. Extension hooks are policy gates, not automatically OS security boundaries.
9. Sandboxed execution never silently falls back to unrestricted execution.
10. Security-layer failures fail closed wherever proceeding would cross a protected boundary.
11. Every model-facing tool follows the central security model, including user `!` commands.
12. Shell security does not rely solely on regular expressions.
13. Runtime dependencies and security-critical code remain small and auditable.
14. Every implemented security invariant receives regression tests.
15. Tests use isolated temporary fixtures, never real credentials or secret files.
16. Documentation states only guarantees demonstrated by the implementation and tests.

## Development principles

- Re-check current Pi APIs and documentation before changing the integration layer.
- Make small, reviewable changes that implement one explicit invariant at a time.
- Prefer simple, explicit code and narrow interfaces over clever abstractions.
- Minimize runtime dependencies and review the transitive dependency surface.
- Add regression tests for both intended behavior and plausible bypasses.
- Consider alternate encodings, race conditions, indirection, nested execution, and future tool additions.
- Do not weaken fail-closed behavior to improve convenience.
- Never grant writable repository content authority over global security policy.
- Keep authorization decisions independent from sandbox implementation details.
- Treat documentation and status messages as part of the security model.

## Required workflow

For every substantial task:

1. Inspect only the relevant code and documentation.
2. Identify the affected security invariant and trust boundary.
3. Research the current upstream Pi API when integration behavior is involved.
4. State the smallest coherent change; continue within the authorized scope without an extra approval checkpoint.
5. Implement that change without unrelated refactoring.
6. Add or update isolated regression tests for changed behavior and security invariants.
7. Use targeted tests when useful for diagnosis.
8. Run the complete relevant checks for code, test, or dependency changes; for documentation-only edits, check affected claims, links, and the diff.
9. Perform an adversarial review for bypasses and unsafe failure modes.
10. Summarize security implications, limitations, and any changed guarantees.

Finish the selected task and its required verification, fixing failures caused by the change within scope. Respect explicit independent-review and acceptance gates, including any requirement for fresh evidence. Otherwise, repeat checks or review only after relevant changes, failures, or new evidence. Stop and report a blocker when proceeding requires new authority, a scope change, or unavailable evidence; do not start the next Goal.

## Forbidden shortcuts

Never:

- fall back from failed sandbox initialization to unrestricted execution;
- use naive `path.startsWith(workspace)` checks as a security boundary;
- describe regex-only shell classification as complete shell security;
- read or copy credentials from the real home directory in tests;
- disable or weaken tests merely to make CI pass;
- silently widen filesystem or network permissions;
- accept project configuration that weakens global policy;
- combine a small security fix with an enormous refactor;
- claim a protection without implementation and regression evidence;
- install the development checkout into a user's Pi configuration as part of routine tests.

## Repository boundaries

Keep pure authorization logic in `src/policy/`, OS containment adapters in `src/sandbox/`, and approval flow in `src/approvals/`. The Pi integration entry point should remain thin. Test fixtures must be created under temporary directories and removed without touching real user data.

Keep work within the selected Goal and the current gates in [STATE.md](STATE.md) and [ROADMAP.md](ROADMAP.md). Do not add functional enforcement or advance phases without explicit authorization and satisfying the applicable gates.
