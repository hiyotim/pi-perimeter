# Monotonic policy authority contract independent audit

Date: 2026-09-12

Goal: `20260911-monotonic-policy-authority-contract`

Baseline: `139fa4abdff13a1240aa6488cb23e70bd7f80d15` on `codex/monotonic-policy-authority-contract`

Artifact: `docs/MONOTONIC-POLICY-AUTHORITY.md`

## Verdict

**PASS.** The independent security/architecture review found no defect. The documentation-only artifact satisfies the handoff, does not claim an implemented runtime guarantee, and states a consistent monotonic and fail-closed authority model.

The supplied review identified its environment as OpenCode Go with DeepSeek V4.1 Flash. It operated in `AUDIT ONLY` mode and reported no file modification, staging, commit, push, checkout, merge, reset, restore, clean, or stash. It did not inspect `.qwen/` or use real credentials.

## Verified contract

- Built-in defaults, trusted user/global configuration, project-controlled configuration, and future scoped user approvals have separate owners, trust boundaries, and permissible effects.
- Authorization restrictions are ordered `ALLOW < ASK < DENY`; the complete nine-cell join is associative, commutative, idempotent, and selects the strictest applicable outcome.
- Until a separate reviewed contract change, trusted user/global and project-controlled contributions may only preserve or strengthen the baseline. Project content cannot grant authority, lower `ASK` or `DENY`, change the trusted workspace, or disable canonicalization, provenance, or classification.
- `SANDBOX` is an orthogonal containment requirement. It cannot grant authorization, weaken `DENY`, or be removed by a weaker source.
- A future approval may satisfy only a matching `ASK`; it cannot override `DENY` or containment.
- Missing optional configuration retains built-in defaults. Missing required information and unknown, malformed, ambiguous, or unsupported security-relevant configuration fail closed for affected decisions.
- Accepted read/write/edit decisions enter future composition as baseline path-rule outcomes, not final authorization, execution grants, approvals, or capabilities.
- Parser/schema/loading, trusted-source precedence, possible future `ASK` relaxation, approval storage/UI, Pi integration, containment/network enforcement, and multi-resource operations remain explicitly deferred.

## Acceptance criteria and adversarial evidence

The reviewer marked all handoff criteria 1–10 satisfied. It independently checked:

- all nine `ALLOW`/`ASK`/`DENY` combinations;
- project `ALLOW` over global `ASK` and `DENY`;
- trusted/global attempts to lower the baseline;
- unknown keys, values, and outcomes;
- partial, duplicate, and conflicting rules;
- attempts to disable classification, provenance, or canonicalization;
- workspace-authority expansion;
- conversion of `DENY` into a sandboxed permission;
- project self-approval and rule reordering;
- invalid configuration with an uncertain affected set;
- missing optional configuration and missing required data.

No hidden answer was found for a deferred design question.

## Verification

| Check | Result |
| --- | --- |
| Artifact SHA-256 | `6b3333dbb9415e0b58aa14eaaccd90020820b825103e47c3597c7281e676c87d` |
| Baseline / HEAD during review | `139fa4abdff13a1240aa6488cb23e70bd7f80d15` |
| Scope | only new Goal artifact `docs/MONOTONIC-POLICY-AUTHORITY.md`; no source/test change |
| `git diff --check` | PASS |
| Index | empty |
| Markdown targets | all 11 unique targets resolved |
| Artifact text checks | no CR, trailing whitespace, tabs, BOM, or placeholders |
| Source/test anchors | matched the accepted edit-path audit |

Code tests were not rerun because the Goal is documentation-only and source/tests were unchanged. The reviewer noted that `git diff --check` does not cover an untracked file and compensated with direct artifact whitespace checks.

## Informational observations

The review recorded three non-defects:

1. The consistency section's AGENTS cross-reference is not exhaustive, although the model-facing-tool invariant is present in the contract itself.
2. Pre-acceptance `STATE.md` and transition-prompt wording was intentionally stale and outside the Goal scope pending this acceptance update.
3. File authorship cannot be inferred from modification time; the actual diff scope matched the declared scope.

## Limits

This audit accepts a documentation contract only. No configuration loader, schema, parser, merge primitive, approval flow, Pi gate, enforcement, sandbox, or network control exists. The contract constrains future work but does not itself protect a runtime operation. The Phase 1 monotonic-authority roadmap item remains open until implementation and regression evidence are independently accepted.
