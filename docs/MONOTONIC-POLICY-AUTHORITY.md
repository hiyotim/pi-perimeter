# Monotonic Policy Authority Contract

Status: documentation-only contract. No configuration loading, parsing, schema, merge function, approval flow, Pi integration, containment, or enforcement is implemented. This document constrains future work; it does not create a current guarantee.

## 1. Purpose and scope

This contract defines which configuration sources have authority in `pi-warden`, how their restrictions combine, and why repository-controlled configuration can never weaken built-in defaults or trusted user/global policy. It exists so that any future parser, schema, merge function, approval flow, or runtime integration is written against one explicit authority model instead of inventing one.

This document deliberately does not define a file format, file location, configuration schema, parser or merge API, approval storage, or migration behavior. It adds no runtime behavior and no configuration input to the accepted Phase 1 primitives. Section 10 lists the decisions deferred to separate Goals.

Current implementation status is unchanged: Phase 1A path canonicalization, Phase 1B path-only classification, and the fixed default `read`, `write`, and `edit` path decisions are accepted unenforced primitives. No Pi tool consumes them, and none of them reads configuration. See [STATE.md](../STATE.md), [ARCHITECTURE.md](../ARCHITECTURE.md), and [ROADMAP.md](../ROADMAP.md).

## 2. Configuration sources and authority

Future authorization composes contributions from four sources with asymmetric authority. The table states each source's owner, trust boundary, and permissible effect.

| Source | Owner | Trust boundary | Permissible effect |
| --- | --- | --- | --- |
| Built-in defaults | `pi-warden` maintainers; shipped with the extension | Trusted code and fixed policy; not writable by users, projects, or approvals | Define baseline authorization outcomes, hard security invariants, and required containment. May not be weakened by any other source. |
| Trusted user/global configuration | The user; stored outside repository control | Trusted, but bounded by hard security invariants | Until a separate Goal explicitly changes this contract, its contributions participate in the join only as preserving or strengthening the applicable baseline restriction. Never an unrestricted bypass. |
| Project-controlled configuration | Repository content (for example project files, repository settings, `AGENTS.md`, scripts) | Untrusted input; may be influenced by prompt injection | May only preserve or strengthen the effective restriction and containment. Cannot create authority or permissions. |
| Future scoped user approvals | The user at decision time | Trusted only for the exact displayed scope; not a policy source | Satisfy one specific `ASK` within explicit resource, operation, and time boundaries. Never override `DENY`; never cancel or replace containment. |

Notes:

- "Source" describes authority, not file layout. Nothing here states where any configuration lives or how it is represented.
- No source may weaken a hard security invariant (section 5.2); each source's permissible effect is bounded by those invariants.
- An approval is a decision event, not a fourth authorization outcome. It is listed because it participates in the authority model.
- None of these sources is active in the current code. The accepted decision primitives accept no configuration, approval, classification, or bypass input.

### 2.1 Built-in defaults

Built-in defaults are the fixed policy and invariants shipped with `pi-warden`. They are the ultimate authority: no configuration, approval, repository content, or model output may weaken them. The accepted Phase 1 default path decisions are examples of built-in defaults, but they are unenforced primitives rather than active protection.

### 2.2 Trusted user/global configuration

This source belongs to the user and is not writable by repository content. Trust means the source is intentional and outside attacker control; it does not mean every value is honored. It remains bounded by hard security invariants, cannot disable identity or classification checks, and cannot make secret access routine. Until a separate Goal explicitly changes this contract, a trusted user/global contribution may only preserve or strengthen the applicable baseline restriction; any mechanism that would relax a restriction, including lowering an `ASK`, remains an open question in section 5.4 and requires an explicit contract change.

### 2.3 Project-controlled configuration

Repository content is untrusted and may be attacker-controlled through prompt injection or malicious dependencies. Project-controlled configuration is therefore never an authority source. It may only preserve or strengthen the effective restriction and containment, and any attempt to create permissions has no effect.

### 2.4 Future scoped user approvals

An approval is a user decision at runtime, valid only for its displayed scope. It may satisfy a specific `ASK`, and nothing more. It cannot override a `DENY`, cannot cancel containment, cannot be created by repository content, and cannot be transferred to a different resource, operation, or session.

## 3. Authorization outcomes and the monotonic join

### 3.1 Strictness order

Authorization outcomes have one strictness order:

```text
ALLOW < ASK < DENY
```

where `<` means "is weaker than". `ALLOW` is the weakest authorization restriction; `DENY` is the strictest.

- `ALLOW` — authorization permits the operation without an interactive exception.
- `ASK` — require an explicit, narrowly scoped user decision; absence or timeout is not approval.
- `DENY` — block the operation without a routine approval bypass.

A hard `DENY` is a denial that no supported configuration or approval may relax. These definitions match [THREAT_MODEL.md](../THREAT_MODEL.md).

### 3.2 Monotonic join

The effective authorization outcome for an operation is the join of every applicable contributed outcome: the strictest outcome wins.

| `join` | `ALLOW` | `ASK` | `DENY` |
| --- | --- | --- | --- |
| `ALLOW` | `ALLOW` | `ASK` | `DENY` |
| `ASK` | `ASK` | `ASK` | `DENY` |
| `DENY` | `DENY` | `DENY` | `DENY` |

The join is idempotent, commutative, and associative. Consequently:

- evaluation order and grouping do not affect the result;
- adding an applicable restriction can never weaken the effective outcome;
- no contributing outcome is ever stronger than the effective outcome;
- authority and precedence are explicit and exhaustively testable with table-driven tests once implementation exists.

The accepted read, write, and edit default decisions produce one baseline contributed outcome each (section 9). No configuration contributes yet.

### 3.3 SANDBOX is a separate containment axis

`SANDBOX` means: require OS-level containment in addition to any authorization decision, and block if containment cannot be established. It is a containment requirement on an orthogonal axis, not a fourth authorization outcome, and it does not participate in the strictness order:

- it never replaces an authorization outcome;
- it never weakens `DENY`: a `DENY` with required containment is still `DENY`;
- an authorization outcome, including `ALLOW`, never satisfies or cancels a containment requirement;
- establishing containment never grants authorization;
- if any applicable source requires containment, containment is required; project-controlled configuration may add but never remove a containment requirement;
- if required containment is unsupported, unavailable, or fails to initialize, execution is blocked; there is no unrestricted fallback.

`ASK + SANDBOX` therefore means both controls are required, consistent with [THREAT_MODEL.md](../THREAT_MODEL.md). The accepted Phase 1 primitives produce no `SANDBOX` outcome; containment design and enforcement are deferred (section 10).

### 3.4 Conceptual composition

For each model-facing operation, future enforcement applies the following conceptual steps. This is a contract outline, not an implemented pipeline or API.

1. Obtain canonical identity through the accepted Phase 1A primitive. Failure is fail-closed input.
2. Determine operation semantics and classify the canonical resource through the accepted primitives. Classification is internal to the decision primitive and cannot be supplied or replaced by configuration.
3. Obtain the applicable baseline default outcome (section 9).
4. Join it with every applicable built-in, trusted user/global, and project restriction (section 4) to obtain the effective authorization outcome.
5. `DENY` blocks. No later step may convert it to `ASK` or `ALLOW`.
6. `ASK` requires a valid, matching approval (section 6). Absence, timeout, malformed, ambiguous, or out-of-scope responses block.
7. If containment is required, it must be established. Failure blocks.
8. Execute only when authorization permits and required containment is established.

A failure at any step may only preserve or strengthen the outcome; no failure path falls back to a weaker outcome.

## 4. Project-controlled configuration is monotonic

For any operation, a project-controlled contribution may only preserve or strengthen the stricter of the built-in default and every trusted user/global restriction that applies. Because the join is maximum, an equal contribution changes nothing and a stricter contribution wins.

The following are not permitted, regardless of how they are expressed:

- replacing `DENY` with `ASK` or `ALLOW`;
- replacing `ASK` with `ALLOW`;
- disabling, weakening, or substituting classification, including secret and sensitive evidence;
- disabling, weakening, or bypassing provenance or canonicalization;
- expanding the trusted workspace root or otherwise expanding trusted workspace authority;
- redefining workspace membership from raw or project-supplied strings;
- granting approvals, pre-approving operations, or writing, broadening, or persisting approval state;
- removing a containment requirement (adding one is permitted because it strengthens);
- converting a `DENY` into a "sandboxed" permission (containment is not authorization);
- suppressing fail-closed behavior for missing, unknown, malformed, ambiguous, or unsupported security-relevant configuration;
- introducing permissive defaults for new, unknown, or not-yet-integrated model-facing tools.

A well-formed project contribution that is weaker than the higher-authority outcome is not honored: it has no effect on the effective outcome, which remains the stricter result. It is never treated as granting authority.

Rationale: repository content is untrusted and may attempt prompt injection through `AGENTS.md`, scripts, and project files. Repository content can only be an object of policy, never a source of authority.

## 5. Trusted user/global configuration

### 5.1 No unrestricted bypass

"Trusted" means the source is outside repository control and its choices are intentional, not that every value it contains is honored. Trusted user/global configuration:

- cannot weaken any hard security invariant;
- cannot make secret access routine or approval-eligible;
- cannot disable identity, classification, or provenance checks;
- cannot authorize repository content to approve itself;
- cannot remove a containment requirement;
- must remain explicit, narrow, and inspectable in its effects.

Until a separate Goal explicitly changes this contract, trusted user/global contributions participate in the monotonic join only as preserving or strengthening the applicable baseline restriction. This contract grants no authority to create a scoped, standing, or session exception, and no such mechanism may be inferred from it.

### 5.2 Hard security invariants (not configurable by any source)

1. Paths are canonicalized before any security decision; no decision is made from raw path strings.
2. Classification and decisions consume only genuine Phase 1A resolver-issued results; provenance is enforced in code, not by configuration.
3. Secret and sensitive evidence cannot be suppressed or overridden by configuration, workspace membership, or approval.
4. A hard `DENY` is never converted to `ASK` or `ALLOW` by configuration or approval.
5. Project-controlled configuration may only preserve or strengthen the effective restriction; it is never an authority source.
6. Invalid or ambiguous security-relevant configuration fails closed where it affects protected access.
7. Required containment must be established before execution; missing, unsupported, or failed containment blocks, with no unrestricted fallback.
8. Approval state cannot be written or broadened by repository-controlled configuration.
9. Every model-facing tool follows the central security model; unknown or not-yet-integrated tools fail closed.
10. Documentation and status reporting state only guarantees demonstrated by implementation and tests.

These invariants derive from [AGENTS.md](../AGENTS.md) and [ARCHITECTURE.md](../ARCHITECTURE.md). Only some are currently implemented, and only for the accepted unenforced primitives (identity, classification, and default path decisions). The remaining invariants constrain future implementation; they are not current protections.

### 5.3 Future explicitly supported owner choices

This contract does not grant trusted user/global configuration any authority to relax a restriction. Until a separate Goal explicitly changes this contract, its contributions participate in the join only as preserving or strengthening the applicable baseline restriction. Whether a future Goal may introduce an explicitly scoped exception, including lowering an `ASK` for a named resource or development endpoint, is an open question (section 5.4), and any such mechanism requires an explicit contract change rather than an implicit implementation choice. Owner-selectable parameters that do not weaken a hard invariant, for example choosing a containment backend, may be decided by a separate Goal, but they are not granted here.

### 5.4 Questions deferred to a separate Goal

The following cannot be resolved by this contract and must not be decided implicitly by an implementation:

- Which concrete trusted user/global sources exist, where they live, and how they are represented?
- What precedence applies between multiple trusted global sources, and how is that precedence tested?
- May trusted user/global configuration lower an `ASK` for an explicitly scoped resource without an interactive approval, and if so, what bounds apply? Lowering an `ASK` is not part of this contract; this question records the only unresolved place where such a change may be decided, and deciding it requires an explicit contract change.
- Is the trusted workspace root supplied by the trusted caller, by trusted user/global configuration, or both, and how are multiple workspaces represented?
- Which hard invariants have owner-selectable parameters (for example, choosing a containment backend) without weakening the invariant itself?
- How is the set of decisions affected by an invalid configuration input determined, and how is the resulting degraded state reported?
- May trusted user/global configuration disable or restrict loading of project-controlled configuration entirely?
- What schema, versioning, and migration rules apply, and how are approvals scoped, stored, expired, and revoked?

Until a separate Goal answers a question, no implementation may assume an answer, and any behavior that depends on the answer must fail closed.

## 6. Approvals

A future approval can satisfy only a specific `ASK`. It is not an authorization outcome, not a policy source, and not a capability token.

- Scope: an approval must identify the exact canonical resource or resources, the operation, and explicit time or use boundaries. A materially different target, operation, or session is not approved.
- Consumption: an approval may be consumed only while the effective authorization outcome is `ASK` and the approval matches the scope.
- `DENY`: an approval never converts a `DENY` into permission. Hard-denied secrets, privilege escalation, and other hard-denied operations are not approval-eligible at all.
- Containment: an approval does not cancel, replace, or weaken a containment requirement. `ASK + SANDBOX` requires both the approval and established containment.
- Permanence: an approval is non-transferable and must not persist or widen beyond its displayed scope. Timeout, unavailable UI, malformed or ambiguous responses, and target substitution do not grant access.
- Source: approvals come only from the user through the approval layer. Repository-controlled configuration, model output, and tool output cannot create, broaden, or replay an approval.

Approval storage and UI are deferred (section 10).

## 7. Fail-closed interpretation of security-relevant configuration

Security-relevant configuration is any input that can affect canonical identity, classification, authorization outcome, approval validity, or containment requirements. Because configuration is an authority input, an uninterpretable configuration input can never strengthen confidence and must never produce a weaker outcome.

| Condition | Required behavior |
| --- | --- |
| Missing (no configuration) | Built-in defaults and accepted primitives apply. Missing configuration is not itself an error and not an excuse to widen access. If a decision requires information that only configuration was supposed to supply and that information is absent, the affected decision fails closed. |
| Unknown key, value, outcome name, structure, or version | Not applied and not guessed. Affected decisions fail closed (`DENY`); unknown content is never silently ignored in a permissive direction. |
| Malformed | Rejected rather than repaired into a permissive meaning; affected decisions fail closed (`DENY`). |
| Ambiguous or conflicting | Apply the strictest valid restriction only where the content can be applied without guessing. If resolution requires guessing, the affected decision fails closed (`DENY`). |
| Partial | Validly understood elements may apply only when their effect cannot be more permissive than the accepted baseline. Required elements that are absent cause the affected decision to fail closed. |
| Unsupported | Not honored; affected decisions fail closed (`DENY`). |

Additional rules:

- A configuration failure is a security-layer failure, not a fallback to "no restrictions".
- A contribution that is fully understood but weaker than the higher-authority outcome is not a failure: the join simply does not select it (sections 4 and 8.1). Fail-closed applies when meaning, applicability, or validity cannot be established, not to well-formed contributions that are merely permissive.
- Fail-closed means `DENY` for affected decisions, not `ASK`: an approval must never rest on policy that could not be validated.
- Operations that provably cannot be influenced by an invalid configuration input keep their normal outcome. Determining that relationship is a deferred design question (section 5.4), and any uncertainty fails closed.
- Configuration loading or interpretation failure never weakens a hard security invariant; secret and sensitive denials still apply.
- This contract defines observable authority behavior only. It does not define a file format, path, parser API, schema, or migration semantics, and no loader may infer permissive behavior from them.

## 8. Combined outcome tables

### 8.1 Global/default plus project restriction

Rows are the higher-authority outcome: built-in defaults joined with any trusted user/global restriction. Columns are the project-controlled contribution. Cells are the effective outcome.

| Higher authority \ Project | Project `ALLOW` | Project `ASK` | Project `DENY` |
| --- | --- | --- | --- |
| `ALLOW` | `ALLOW` — unchanged; project may not weaken | `ASK` — project strengthens | `DENY` — project strengthens |
| `ASK` | `ASK` — approval requirement preserved; weakening has no effect | `ASK` — unchanged | `DENY` — project strengthens |
| `DENY` | `DENY` — weakening has no effect | `DENY` — weakening has no effect | `DENY` — unchanged |

A project contribution weaker than the higher-authority outcome never produces a weaker effective outcome. Uninterpretable or unsafe configuration is handled separately and fails closed (section 7).

### 8.2 Adversarial cases

| Case | Attempted effect | Effective result | Stable explanation |
| --- | --- | --- | --- |
| Project `ALLOW` over global `DENY` | Permit a globally denied operation | `DENY` | The join keeps the strictest outcome; repository content cannot weaken a `DENY`. |
| Project `ALLOW` over global `ASK` | Remove an approval requirement | `ASK` | The approval requirement is preserved; the permissive contribution has no effect. |
| Unknown key or value, for example `allow_all: true` or outcome `MAYBE` | Inject unsupported authority | Fail closed: `DENY` for affected decisions | Unknown security-relevant content is never interpreted or partly honored. |
| Partial configuration | Omit scope, resource, or operation that a rule requires | Fail closed: `DENY` for affected decisions | Missing required elements are not assumed permissive; no guessing. |
| Duplicate or conflicting rules | Express both `ALLOW` and `DENY` for the same target | Strictest valid restriction; `DENY` if the conflict cannot be resolved without guessing | The join is order-independent; ambiguity never resolves toward permission. |
| Disable secret or sensitive classification | Mark secrets as ordinary or skip classification | Rejected; `DENY` remains | Classification is a hard security invariant and cannot be disabled by configuration. |
| Disable provenance | Claim trust for copied, forged, or structural resources | Rejected; decisions require resolver issuance | Provenance is enforced in code, not by configuration. |
| Disable canonicalization | Match raw or lexical path strings instead of canonical identity | Rejected; no security decision from raw paths | Canonical identity is a prerequisite for any decision. |
| Expand workspace authority | Declare an external path or home directory as workspace | Rejected; workspace membership is unchanged | Repository content cannot expand trusted workspace authority or redefine membership. |
| Self-approval | Pre-approve operations from project configuration | Rejected; no approval is created | Approvals come only from the user within the displayed scope; approval state is not repository-writable. |
| Add a containment requirement | Require `SANDBOX` for an additional operation | Permitted as strengthening; containment is required | Adding containment never weakens authorization; how containment requirements are expressed is deferred (section 10). |
| Convert `DENY` into a sandboxed permission | Use containment to make a denied operation allowed | Rejected; still `DENY` | Containment and authorization are separate controls; containment is not permission. |
| Reorder rules to let `ALLOW` win | Exploit evaluation order | No effect | The join is commutative; order cannot change the outcome. |

### 8.3 Approval combinations

| Joined outcome | Approval state | Result |
| --- | --- | --- |
| `ALLOW` | Absent, present, or irrelevant | Allowed to proceed, subject to any required containment; an unnecessary approval neither widens nor narrows scope. |
| `ASK` | Absent, expired, out-of-scope, mismatched, malformed, or timed out | Blocked. |
| `ASK` | Valid and matching the exact resource, operation, and time boundaries | May proceed, subject to any required containment. |
| `DENY` | Any state | Blocked; an approval never converts `DENY` into permission. |

## 9. Position of the accepted default path decisions

The accepted primitives `evaluateReadPath`, `evaluateWritePath`, and `evaluateEditPath` (see [READ-PATH-DECISIONS.md](READ-PATH-DECISIONS.md) and the independent verdicts in [WRITE-PATH-DECISIONS-AUDIT.md](WRITE-PATH-DECISIONS-AUDIT.md) and [EDIT-PATH-DECISIONS-AUDIT.md](EDIT-PATH-DECISIONS-AUDIT.md)) produce one baseline authorization outcome for one genuine `ResolvedPath`. That outcome enters future composition as one input to the monotonic join:

- It is a default path-rule result only. It is not enforcement, a final authorization or execution grant, approval, capability, configuration, or containment.
- The join may only strengthen it; no configuration may weaken it.
- `ALLOW` is not a capability token. It does not authorize execution, cannot bypass a later stricter restriction, and is not transferable.
- Configuration may never mutate a genuine `ResolvedPath`, supply or substitute classification, replace canonical identity with raw strings, or claim `ALLOW` on behalf of the model or repository.
- Classification remains internal to these primitives. No caller or configuration input for classification exists, and none is added by this contract.
- These primitives consume no configuration and no approval input, and this contract does not change them.

## 10. Deferred decisions

The following are explicitly deferred and are not implemented or specified by this contract:

- configuration schema and API;
- configuration loading, file format, file locations, versioning, and migration semantics;
- precedence between multiple trusted global sources;
- approval storage, approval UI, scope and duration representation, and revocation;
- Pi integration and tool gates;
- sandbox and network policy, and OS containment enforcement;
- delete, rename, and multi-resource operation policy;
- environment sanitization and audit/status reporting;
- determining which decisions are affected by an invalid configuration input.

Each requires a separate bounded Goal with its own contract, regression evidence, and independent review. Listing an item here is not authorization to implement it, and no item may be presented as implemented.

## 11. Consistency

This contract is consistent with:

- [AGENTS.md](../AGENTS.md): security invariants 5, 6, 7, 9, and 10, plus the fail-closed and documentation principles.
- [ARCHITECTURE.md](../ARCHITECTURE.md): authoritative global/default policy, project-local narrowing, fail-closed configuration, and the monotonic effective-policy merge; scoped user overrides remain planned and are not granted by this contract.
- [THREAT_MODEL.md](../THREAT_MODEL.md): decision vocabulary, trust boundaries, malicious project configuration, and the planned monotonic authority model.
- [SECURITY.md](../SECURITY.md): separation of policy enforcement, approval, and OS containment, and the current pre-alpha status.
- [ROADMAP.md](../ROADMAP.md): this contract addresses only the documentation portion of the open "Monotonic configuration authority rules" item; implementation and the Phase 1 release gate remain open.
- [docs/DEVELOPMENT.md](DEVELOPMENT.md) and [docs/SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md): review requirements for authority, fail-closed behavior, and project configuration.
- The accepted decision contracts and audits listed in section 9.

It adds no implemented guarantee and does not change any source, test, or existing document.
