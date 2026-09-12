# Implementation Handoff

Task ID: 20260911-monotonic-policy-authority-contract
Baseline: 139fa4abdff13a1240aa6488cb23e70bd7f80d15

## Goal

Create one documentation-only contract for the monotonic configuration and authority hierarchy before any parser, schema, merge function, approval flow, or runtime integration is written. The document must state unambiguously which configuration sources have authority, how their restrictions combine, and why repository-controlled configuration can never weaken built-in or trusted user/global policy. Do not implement any configuration behavior.

## Context

Phase 1A path resolution, Phase 1B path-only classification, and the fixed read-path, write-path, and edit-path default decision primitives are accepted and committed at the baseline. Their `ALLOW` results are default path-rule outcomes only; they are not enforcement, approval, capability, configuration, or containment. Monotonic configuration authority rules remain the last open Phase 1 roadmap item. The architecture already states the intended boundary: global/default policy is authoritative, user-controlled overrides may grant explicitly scoped approvals, project-local policy may only narrow permissions, and invalid or ambiguous security configuration fails closed where it affects protected access.

The accepted read, write, and edit path decisions are one future input default outcome. The contract must describe their place in the composition without changing them, mutating genuine `ResolvedPath` results, substituting classification, or treating `ALLOW` as a capability token.

Relevant documents to keep consistent: `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `STATE.md`, `THREAT_MODEL.md`, `SECURITY.md`, `docs/DEVELOPMENT.md`, `docs/SECURITY-CHECKLIST.md`, `docs/READ-PATH-DECISIONS.md`, `docs/WRITE-PATH-DECISIONS-AUDIT.md`, and `docs/EDIT-PATH-DECISIONS-AUDIT.md`.

Known unrelated working changes on the new branch are `.gitignore`, `.opencode-permission-canary.txt`, `.qwen/`, and the two completed transition prompts. The Git index is empty. Preserve these files without inspecting local configuration; stop on any other baseline change rather than resetting or cleaning it.

## Scope

Create only `docs/MONOTONIC-POLICY-AUTHORITY.md`. Do not modify source, tests, package files, dependencies, `STATE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, or any other document. Do not implement or specify a parser, configuration schema, merge function, approval storage/UI, Pi integration, or enforcement. Do not stage, commit, push, or start the next Goal.

## Acceptance Criteria

1. Enumerate and separate built-in defaults, trusted user/global configuration, project-controlled configuration, and future scoped user approvals. For each source state its owner, trust boundary, and permissible effect.
2. Define the strictness order of baseline authorization outcomes `ALLOW < ASK < DENY` and the monotonic join operation in which the stricter outcome wins. Describe `SANDBOX` as a separate containment axis, not a way to weaken `DENY` or replace an authorization outcome.
3. Project-controlled configuration may only preserve or strengthen the effective restriction. Replacing `DENY` with `ASK` or `ALLOW`, replacing `ASK` with `ALLOW`, disabling classification, provenance, or canonicalization, or expanding trusted workspace authority is not permitted.
4. Trusted user/global configuration does not receive an unrestricted bypass. Explicitly separate future, explicitly supported owner choices from hard security invariants, and list the questions that must remain unresolved until a separate Goal.
5. A future approval can satisfy only a specific `ASK` inside explicitly defined scope, resource, operation, and time boundaries. An approval does not convert a hard `DENY` into permission and does not cancel containment.
6. Define fail-closed behavior for missing, unknown, malformed, ambiguous, or unsupported security-relevant configuration. Do not invent a file format, path, parser API, or migration semantics.
7. Provide a complete combination table for `ALLOW`/`ASK`/`DENY`, including global/default plus project restriction, with the resulting outcome and a stable explanation. Include adversarial cases: project allow over global deny, project allow over global ask, unknown values/keys, partial configuration, duplicate/conflicting rules, and attempts to disable secret, provenance, or path protections.
8. Describe how the accepted read, write, and edit path decisions enter future composition: they are one input default outcome. No configuration may mutate a genuine `ResolvedPath`, substitute classification, or use `ALLOW` as a capability token.
9. List deferred decisions explicitly: schema/API, configuration loading, precedence between multiple trusted global sources, approval storage/UI, Pi integration, sandbox/network, and delete/rename/multi-resource policy. Do not present them as implemented.
10. Keep wording consistent with `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `STATE.md`, `THREAT_MODEL.md`, `SECURITY.md`, `docs/DEVELOPMENT.md`, and `docs/SECURITY-CHECKLIST.md`, and add no guarantee beyond the current implementation.

## Verification

- Inspect only the new document diff and run `git diff --check`.
- Check references and terminology with targeted `rg` queries.
- Confirm no source, test, configuration, dependency, or other document changed, and that the Git index is empty.
- Report remaining ambiguities as review questions; do not select hidden implementation semantics.
- Stop with the document ready for independent review.

## Constraints

The document is a contract only. It must not claim implemented configuration loading, parser behavior, merge code, approval flow, Pi integration, or containment. It must not weaken any existing security invariant, must not authorize project-controlled configuration to loosen policy, and must not treat `SANDBOX` as an authorization outcome. Keep runtime dependencies and code untouched. Use no real credentials or local configuration content.

## Escalate If

Stop and report before proceeding if the Goal or acceptance criteria must change, an architectural invariant must change, scope must expand, an unapproved public/external contract is required, canonical documents conflict, the baseline differs materially, or an implementation or migration decision would be required. Do not silently choose schema, file-format, path, or precedence semantics. Preserve the accumulated work; do not reset, clean, or invent a fallback.
