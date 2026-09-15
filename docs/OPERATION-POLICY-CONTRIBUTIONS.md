# Operation-Scoped Policy Contribution Contract

Status: the contribution semantics in sections 1–10 are implemented and independently reviewed as an unenforced policy primitive. The concrete schema, loader, API, failure domains, and limitations are specified in [CONFIGURATION-AUTHORIZATION.md](CONFIGURATION-AUTHORIZATION.md). Owner acceptance is pending; no Pi enforcement, approval, or containment exists.

## 1. Purpose and scope

This contract defines the smallest operation-scoped, in-memory authorization contribution model for the three accepted policy operations: exactly `read`, `write`, and `edit`. It defines what a contribution is, where source identity comes from, what absence means, how contributions compose, and what fails closed. Goal `20260913-configuration-authorization` selected and implemented the concrete bounded representation described in [CONFIGURATION-AUTHORIZATION.md](CONFIGURATION-AUTHORIZATION.md).

It builds directly on the accepted authority contract in [MONOTONIC-POLICY-AUTHORITY.md](MONOTONIC-POLICY-AUTHORITY.md) and on the accepted N-ary merge primitive documented in [MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md](MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md). Familiarity with those documents is assumed; where this document repeats rules from them, the rule text there remains authoritative.

Out of scope and deliberately excluded: delete, rename, multi-resource, shell, network, and any future-tool policy (section 2); migration and executable configuration; approvals, resource/path selectors, classification substitution, workspace redefinition, and capability semantics (section 8); sandbox and network policy. Structured effective-result reasons and source summaries are implementation explanations, not policy inputs.

## 2. Operation identifiers

For this bounded contract, an operation is one of exactly three primitive string identifiers:

- `read`
- `write`
- `edit`

Rules:

- Identifiers are compared as exact primitive strings. There is no coercion, no case folding, no trimming, no alias table, and no normalization step. `"Read"`, `"read "`, and `"READ"` do not identify an operation; they are invalid (see section 6). A trusted caller must not normalize an identifier before validation: `"READ".toLowerCase()` produces the primitive string `"read"`, which a runtime API cannot distinguish from the literal `"read"`, so the exact comparison cannot detect that normalization occurred. After normalization the original form is unrecoverable; the guarantee therefore depends on the trusted caller not rewriting identifiers beforehand.
- These three identifiers are the same operation vocabulary as the accepted read, write, and edit default path decisions. This contract adds no fourth identifier.
- No operation identifier outside this set has a defined meaning here. This contract does not define policy for `delete`, `rename`, any multi-resource operation, shell execution, network access, or any future tool. A container that references an unknown operation identifier is treated as an unknown security-relevant key and is rejected (section 6); it is never silently narrowed to the supported subset.

## 3. Inputs for one operation decision

For one decision about one exact operation identifier, there are exactly three distinct inputs:

1. **Baseline (required).** The built-in/default authorization outcome for that operation. This is the already accepted default path decision outcome for the genuine resource, per section 9 of [MONOTONIC-POLICY-AUTHORITY.md](MONOTONIC-POLICY-AUTHORITY.md). The decision cannot proceed without a validated baseline; there is no mode in which contributions exist and a baseline does not.
2. **Trusted user/global contribution (optional).** A restriction contributed by trusted user/global configuration, as defined in section 2.2 of the authority contract. Its whole permissible effect remains preservation or strengthening of the baseline.
3. **Project-controlled contribution (optional).** A restriction contributed by project-controlled configuration. It is untrusted input and may only preserve or strengthen the effective restriction.

### 3.1 Source identity

The role of an input — which of the three inputs above it is — comes from the trusted call-site/API position: the trusted code that composes a decision passes the baseline, the trusted contribution, and the project contribution each at a distinct, fixed parameter position. Source identity is never taken from a label, name, key, annotation, or metadata string supplied by project data. Any string in project-controlled input that purportedly names its own source, origin, trust level, or authority is ordinary untrusted payload: it cannot elevate or demote anything, and a container carrying it is interpreted or rejected solely on its role position, never on such a label.

This is the in-memory counterpart of the authority table in section 2 of [MONOTONIC-POLICY-AUTHORITY.md](MONOTONIC-POLICY-AUTHORITY.md): "trusted" there means trust of the supplying code position, and project-controlled input is untrusted whatever it calls itself. The implemented v1 model has exactly one user/global source and one project source, assigned by fixed loader positions; additional sources and any resulting precedence model remain excluded (section 11).

### 3.2 What a contribution is

Each optional contribution, when present, is one authorization outcome value — restricted to exactly `ALLOW`, `ASK`, or `DENY`, validated like the accepted merge primitive validates its inputs (exact, non-coercing string comparison against the three primitive literals; see the verified behavior table in [MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md](MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md)). A contribution does not carry per-request semantics beyond its one joined outcome.

## 4. Absence and invalid values

- **Absence.** An absent optional contribution contributes nothing. Absence does not synthesize `ALLOW`, `ASK`, or `DENY`; it contributes no outcome value at all. The validated baseline remains the anchor of the decision: with neither optional contribution present, the effective outcome is exactly the baseline outcome, unchanged. Missing project configuration is not itself an error (section 7 of the authority contract); it is simply no contribution from that input position.
- **Invalid values differ from absence.** An optional input position may hold either no contribution or a contribution. If something is supplied, it must validate cleanly. An explicitly supplied value that is not exactly one of the three primitive outcome literals — including malformed strings, wrong types, decision-shaped objects, `SANDBOX`, and empty or padded strings — is an invalid value, not absence. It is never repaired, coerced, dropped, or reinterpreted as absence; a decision evaluated with an explicitly invalid outcome fails closed (section 6).
- Absence is therefore meaningful only for *nothing supplied*. "Supplied but unreadable", "supplied but of the wrong shape", and "supplied but invalid" are failure conditions, not forms of absence. Existence is determined by the trusted caller/API position (the trusted code knows whether it has a project contribution to supply), never by probing a runtime value for presence, which would require untrusted property lookups (see also section 10).

## 5. Monotonic composition

### 5.1 The join rule

Every present, valid optional contribution is combined with the validated baseline using the accepted monotonic merge: the strictest outcome under `ALLOW < ASK < DENY` wins. The result is identical to the accepted `mergeAuthorizationOutcomes(baseline, ...contributions)` fold over exactly the supplied valid contributions. Consequently:

- A contribution weaker than the current effective outcome has no permissive effect; the join simply does not select it.
- A contribution equal to the effective outcome changes nothing.
- A stricter contribution wins.
- Neither the trusted user/global contribution nor the project-controlled contribution may lower the result below the validated baseline. Lowering is structurally impossible through the join: the baseline is always an input to the fold.
- Source order is irrelevant. The join is idempotent, commutative, and associative, so supplying the trusted contribution before or after the project contribution produces the same outcome, and the outcome is independent of any internal arrangement of the inputs.

A well-formed contribution that is merely weaker (for example, a project `ALLOW` under a baseline `ASK`) is not a validity failure; it is a valid contribution whose effect is nil. Fail-closed applies when validity, meaning, or applicability cannot be established — not to well-formed contributions that happen to be permissive (section 7 of the authority contract).

### 5.2 Abstract in-memory representation

For one operation decision, the contract's entire abstract state is:

- a **baseline slot**: one validated authorization outcome for one exact operation identifier;
- an optional **trusted slot**: either nothing, or one validated authorization outcome for the same operation identifier, originating from the trusted input position;
- an optional **project slot**: either nothing, or one validated authorization outcome for the same operation identifier, originating from the project input position.

Three slots, per operation, nothing more. No slot stores a source label, reason code, approval state, containment flag, path selector, or provenance string. The implemented effective result reports source roles and reasons separately from these policy slots. No slot is derived from project data other than the project slot's own mapped outcome, and that mapping is performed by trusted code.

Within one decision evaluation, each slot holds at most one outcome. If a representation of any slot cannot be reduced to exactly one validated outcome — because it is ambiguous, duplicated, or conflicting — that slot's content is invalid (section 6); it is never averaged, sampled, ordered, or resolved toward either permissiveness or a guessing-based "conflict" pick.

### 5.3 Association is trusted, structural, and non-inferential

The trusted implementation associates a contribution with an operation decision structurally: it maps supplied, already-parsed restrictions onto operation slots by position and exact operation identifier, using only validated inputs. It does not infer applicability from resource content, path strings, or heuristic matching, and it does not construct an operation policy container from raw project values without explicit validation (section 6). If the trusted code cannot prove, from validated input alone, which exact operation a supplied container entry applies to, the container is not applied and the decisions evaluated with it fail closed (section 6).

This contract adds no resource/path/scoping semantics: it does not decide whether a supplied restriction "applies to" a given file, directory, class of resources, or workspace. Applicability of a container entry to a decision is a single yes/no determined strictly from the exact operation identifier. Everything richer is excluded (section 11).

## 6. Fail-closed behavior

For the requested operation, each of the following produces the effective outcome `DENY` — never absence, never a fallback, never a weaker outcome:

| Condition | Required result |
| --- | --- |
| Invalid baseline | `DENY` for the decision. No baseline exists from which a weaker result could be derived, and being unable to anchor the decision is a failure, not a permissive default. |
| Invalid operation identifier | `DENY` for the requested operation. An identifier that is not exactly `read`, `write`, or `edit` has no defined policy; unknown/unsupported operations fail closed (MONOTONIC-POLICY-AUTHORITY.md hard invariant 9). |
| Malformed or unsupported source container | `DENY` for every decision evaluated with that container. Never partially interpreted, never repaired into permissive meaning. |
| Explicitly invalid outcome value | `DENY` for the decision. An invalid supplied value is never treated as absence (section 4). |
| Ambiguous or duplicate representation | `DENY` for the decision evaluated with the ambiguous content. No tiebreaking, no strictest-among-guesses unless validity itself is provable. |
| Unknown security-relevant key | The supplied operation-policy container is invalidated: it cannot be applied. Decisions that would have consumed it return `DENY`. Unknown keys are never ignored in a permissive direction. |

Additional fail-closed rules:

- Unknown keys invalidate the whole supplied operation-policy container, not just the unknown key's own entry. The container's remaining valid entries are not salvaged, because the container's security-relevant content can no longer be trusted to be completely understood.
- A container that includes a policy statement for an identifier outside the three supported operations (for example `delete` or a future tool) contains an unknown security-relevant key and is invalidated entirely, for every decision it is evaluated with (section 7). The invalidation is not narrowed down to the unsupported identifier.
- A contribution that is fully valid but weaker than the effective outcome is **not** a failure: it has no effect, and the decision keeps the stricter outcome. Fail-closed applies to invalidity and ambiguity, never to permissive-but-valid content (section 5.1).
- `DENY` produced by failure is an ordinary outcome, not an error to be retried into a permissive direction. No configuration and no project input may suppress, catch, or convert it (AGENTS.md invariant 10; authority contract section 7).

## 7. Affected-decision domain

The blast radius rules for this model are per-container:

- A **valid entry for one exact known operation** affects only decisions for that exact operation identifier. A valid project `DENY` for `edit` has no effect on `read` or `write` decisions.
- An **absent entry** has no effect on any decision: operations without a contributed entry keep exactly their baseline outcome (or whatever other valid contributions apply to them).
- An **invalid or unknown container** cannot be proven safely scoped. Because the trusted code cannot demonstrate that the invalid content is confined to a subset of operations, the container fails closed for **every** decision evaluated with it: `read`, `write`, and `edit` decisions that consume that container all produce `DENY`, even if the invalidity appears localized. Splitting an invalid container into "probably affected" and "probably unaffected" decisions would require guessing, which is prohibited.
- A container that is wholly absent is not invalid and is not a container at all: no decision is affected by it (section 4).

The concrete loader adopts the same conservative domain for source failures: an invalid source denies every `read`, `write`, and `edit` decision consuming its issued source set, and its status is reported without payload or path data. See [CONFIGURATION-AUTHORIZATION.md](CONFIGURATION-AUTHORIZATION.md). This section's valid-entry rules remain per operation.

## 8. Excluded controls

The following are deliberately outside this contract; none may be inferred from it:

- **SANDBOX / containment.** `SANDBOX` is a containment requirement on an orthogonal axis, never an authorization outcome. It is not a valid contribution value; supplying it is an explicitly invalid outcome. Whether a project contribution may *additionally* carry a containment requirement is a separate question; nothing in this document grants, represents, or transmits containment requirements, and the read/write/edit result defined here is only an authorization outcome.
- **Approvals.** No approval is represented, created, consumed, or satisfied. Approvals are a separate layer (authority contract section 6) and remain excluded from this Goal.
- **Reason codes.** The effective outcome is only the authorization literal. No reason code, explanation, or provenance string participates.
- **Resource/path matching.** The three accepted path decision primitives keep their own identity and classification; this contract never matches candidate resources, never substitutes or weakens classification, and never mentions raw path strings.
- **Workspace redefinition.** No input may expand or redefine workspace membership or authority.
- **Capability semantics.** The effective outcome for `read`, `write`, or `edit` under this contract is only the baseline outcome joined with strictly stronger contributions. `ALLOW` is not an execution grant, not a capability token, not bypass authority, and not containment. It means only: authorization does not itself raise an interactive requirement for that result — actual execution remains subject to all other controls (containment, approvals, classification) and to the fact that no enforcement exists today.

## 9. Examples

Outcome vocabulary: `ALLOW < ASK < DENY`. "Result" is the effective authorization outcome for the single specified operation. Notation: baseline / trusted / project, with `—` meaning absent.

### 9.1 Normal composition

| # | Operation | Baseline | Trusted | Project | Result | Reading |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `edit` | `ASK` | — | — | `ASK` | Both optional contributions absent; baseline anchors. |
| 2 | `edit` | `DENY` | — | — | `DENY` | Baseline `DENY` stands alone. |
| 3 | `write` | `ASK` | `ASK` | — | `ASK` | Equal trusted contribution; no change. |
| 4 | `write` | `ASK` | `ALLOW` | — | `ASK` | Weaker trusted contribution; no permissive effect. |
| 5 | `write` | `ASK` | `DENY` | — | `DENY` | Stronger trusted contribution; strengthens. |
| 6 | `read` | `ALLOW` | `ASK` | — | `ASK` | Trusted strengthens an `ALLOW` baseline. |
| 7 | `edit` | `ASK` | — | `ASK` | `ASK` | Equal project contribution; no change. |
| 8 | `edit` | `ASK` | — | `ALLOW` | `ASK` | Weaker project contribution; no permissive effect. |
| 9 | `edit` | `ASK` | — | `DENY` | `DENY` | Stronger project contribution; strengthens. |
| 10 | `read` | `ALLOW` | `ALLOW` | `ASK` | `ASK` | Any present strictest value wins, regardless of source. |
| 11 | `edit` | `ASK` | `DENY` | `ALLOW` | `DENY` | Order-independent: the strictest supplied value wins. |
| 12 | `edit` | `DENY` | `ASK` | `ASK` | `DENY` | Nothing can weaken a `DENY` baseline. |
| 13 | `edit` | `ASK` | `ALLOW` | `DENY` | `DENY` | Same result if the positions are swapped (`DENY` trusted under `ALLOW` project): order cannot affect the outcome. |

### 9.2 Adversarial cases

| # | Attempt | Input (baseline / trusted / project) | Result | Why |
| --- | --- | --- | --- | --- |
| A1 | Project "grants" a hard-denied operation | `DENY` / — / `ALLOW` | `DENY` | The join keeps the strictest outcome; repository content cannot weaken a `DENY`. |
| A2 | Project removes an approval requirement | `ASK` / — / `ALLOW` | `ASK` | Weaker permissive project value has no effect. |
| A3 | Malformed project value | `ASK` / — / `"Deny "` (padded, wrong case) | `DENY` | Explicitly invalid outcome for the requested operation; no coercion, no case folding, not reinterpreted as absence. |
| A4 | Structured decision object as outcome | `ASK` / — / `{ decision: "ALLOW" }` | `DENY` | Only the three primitive outcome literals are valid contribution values; an object is an explicitly invalid value (and object shape must not be trusted or coerced, section 10). |
| A5 | `SANDBOX` as an authorization outcome | `ASK` / — / `SANDBOX` | `DENY` | `SANDBOX` is not an authorization outcome; supplying it is explicitly invalid (section 8). |
| A6 | Unknown operation key | project container maps `read: ALLOW, delete: DENY` | `read` decision: `DENY` | `delete` is an unknown security-relevant key; the whole container is invalidated, not narrowed (section 6, section 7). |
| A7 | Future-tool key | project container maps only `shelf: ASK` | all decisions consumed with it: `DENY` | Any identifier outside `read`/`write`/`edit` invalidates the container. |
| A8 | Source-label spoofing | project container claims its `ALLOW` is a "trusted user" entry via an embedded label | treated as project contribution at the project position; a project `ALLOW` over an `ASK` baseline stays `ASK`, over `DENY` stays `DENY` | Source identity comes from trusted API position only; a project-writable label has no authority (section 3.1). |
| A9 | Duplicate/conflicting representation | a project slot that yields both `ALLOW` and `DENY` for `edit`, e.g. two conflicting entries that cannot be reduced to one validated outcome | `DENY` | A slot with more than one outcome or an unresolvable conflict is ambiguous; fail closed (section 5.2, section 6). |
| A10 | Inherited properties | host object whose prototype chain exposes something operation-shaped (`Object.prototype.delete = ...`) | rejected; `DENY` where consumed | Validation accepts primitive source text and internally created structures; inherited/prototype-derived properties are never evidence of a valid entry (section 10). |
| A11 | Getters | project container wrapped in an object with throwing getters along later lookup paths | rejected; `DENY` where consumed; no getter is invoked during validation | Validation must not trigger attacker-controlled accessors (section 10). |
| A12 | Proxy | project container as a trapping proxy with get/has/ownKeys traps | rejected; `DENY` where consumed; no trap fires during validation | Proxy traps are attacker-controlled callbacks; raw runtime values are never trusted structurally (section 10). |
| A13 | Order/ordering attack | reordering container entries so a permissive value appears authoritative | no effect; result is the strictest valid outcome | The join is commutative and order-independent (section 5.1). |

No example above widens a baseline. Every example either preserves, strengthens, or fails closed.

## 10. Object-safety requirements

The implementation satisfies the following requirements through primitive-string parsing, private issuance registries, and frozen values. The concrete mechanism is documented in [CONFIGURATION-AUTHORIZATION.md](CONFIGURATION-AUTHORIZATION.md).

- **Raw runtime input is never trusted structurally or coerced.** Diameter of validation: a value is accepted only after it is proven to be exactly one of the three outcome literals (or exactly one of the three operation identifiers); no `==` coercion, no case folding, no truthiness shortcuts, no "looks like a decision object" acceptance, no implicit conversion of boxed or callable values.
- **Validation must not invoke getters, proxy traps, iteration, prototypes, or attacker-controlled callbacks.** This matches the accepted merge primitive's own rules (see the red-to-green evidence in [MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md](MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md)): no `for…of`, no implicit iterator resolution, no `Symbol.iterator` lookup for this purpose, no prototype-chain traversal for security-relevant evidence, no method call on untrusted values, no callback into attacker-wrapped data. Structured input should be supplied by the trusted caller in a form whose properties are plain own-data properties; any lookup into an untrusted container must first be constrained so that a trap, a getter, or a replaced prototype member cannot run or influence a decision.
- **Accepted internal values must not be mutable by project input.** Once a slot holds a validated outcome, project-controlled data must not be able to rewrite it — not through shared references, not by passing the same untrusted container object that backs the slot, not through aliasing that lets later mutations of input objects retroactively change stored decisions. The baseline slot is trusted code's own invariant, not project-writable (AGENTS.md forbidden shortcut: never grant writable repository content authority over global security policy).
- **Unclassified structure is not authority.** The mere presence of a property, key, or string that resembles an operation identifier in untrusted data is not authorization evidence; only the trusted code's validated mapping is.
- No runtime dependency is used for parsing, loading, association, or composition.

## 11. Concrete implementation and remaining exclusions

The exact v1 JSON schema, fixed locations, source issuance, validation, loading lifecycle, source-wide failure domain, effective result, and loading-time filesystem limits are now fixed by [CONFIGURATION-AUTHORIZATION.md](CONFIGURATION-AUTHORIZATION.md). The bounded model has one user/global source and one project source; there is no precedence algorithm because all valid restrictions join monotonically.

Still excluded are additional trusted sources, migrations, path/resource selectors, approvals, Pi integration, containment, shell/network policy, and unsupported/future operations. Those exclusions cannot be inferred from this implementation.

## 12. Implementation status

Operation contribution validation, fixed-source loading, exact-operation association, and composition with genuine-resource baselines are implemented and covered by isolated tests. They remain unenforced: no model-facing tool consumes them. The open [ROADMAP.md](../ROADMAP.md) item and Phase 1 release gate remain open pending owner acceptance. Nothing here is an implemented Pi protection.

## 13. Consistency

This contract is consistent with:

- [AGENTS.md](../AGENTS.md): security invariants 5, 6, 7, 9, 10, and 16, plus the fail-closed and documentation principles.
- [MONOTONIC-POLICY-AUTHORITY.md](MONOTONIC-POLICY-AUTHORITY.md): the `ALLOW < ASK < DENY` order, the monotonic join, source authority boundaries, fail-closed configuration interpretation, and the position of the accepted default path decisions as the baseline for read, write, and edit.
- [MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md](MONOTONIC-AUTHORIZATION-MERGE-AUDIT.md): the accepted N-ary merge behavior this contract adopts, including exact non-coercing validation, fail-closed handling of invalid values, `SANDBOX` rejection, and object-safety constraints.
- [ARCHITECTURE.md](../ARCHITECTURE.md): authoritative global/default policy with project-local narrowing and fail-closed configuration.
- [CONFIGURATION-AUTHORIZATION.md](CONFIGURATION-AUTHORIZATION.md): the concrete v1 representation and implemented boundaries.
- [ROADMAP.md](../ROADMAP.md): the authority item and Phase 1 gate remain open pending owner acceptance.

It describes a tested policy primitive, not enforcement or an accepted release guarantee.
