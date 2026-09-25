# Architecture

## Status and scope

This document describes the architecture as it is implemented incrementally.
Phase 1A path handling, Phase 1B resource classification, fixed read/write/edit
decisions, pairwise/N-ary authorization composition, and bounded configuration
authorization are accepted unenforced primitives; the Goal 2 file gate is
accepted within its documented contract. Goal 3 adds the contained shell route
and is accepted within its documented target and variant-B limitations; its contract,
declared target and bounded guarantees are in [docs/SHELL-GATE.md](docs/SHELL-GATE.md)
and its evidence in [docs/SHELL-GATE-AUDIT.md](docs/SHELL-GATE-AUDIT.md). Goal 4 adds the
restricted network route under its own contract ([docs/NETWORK-GATE.md](docs/NETWORK-GATE.md)),
accepted within its declared target and limitations on 2026-09-20, with evidence in
[docs/NETWORK-GATE-AUDIT.md](docs/NETWORK-GATE-AUDIT.md). Sections below that
still say "planned" describe work that later Goals would own.

## Implementation status

Goals 1–4 are implemented and accepted within their documented contracts and
declared limitations ([STATE.md](STATE.md) binds the acceptance and exact
evidence): Goal 1 completes the configuration authority chain (unenforced
primitive); Goal 2 mediates every supported Pi file operation through central
authorization with matching approval and execution-time identity; Goal 3 runs
model and user shell only inside verified OS containment with a constructed
environment and closed networking; Goal 4 extends that route with narrow
actual-destination permissions and approvals. Unsupported operations stay
denied/unavailable. What follows describes the implemented boundaries; any
section still saying "planned" belongs to a later, unselected Goal.

## Trust zones and data flow

```text
                          Pi host process (trusted control plane)
┌───────────────────────────────────────────────────────────────────────┐
│ Pi integration                                                       │
│   model-facing request / user ! command                              │
│                    │                                                  │
│                    v                                                  │
│ Path normalization -> Resource classification -> Policy engine       │
│                                                  │                    │
│                                  ALLOW / ASK / DENY                   │
│                                  + containment requirement            │
│                                      │           │                    │
│                                      │           └-> Approval UI      │
│                                      v                                │
│                    Tool gate or sandbox adapter                       │
└──────────────────────────────────────┬────────────────────────────────┘
                                       │ sanitized operation + environment
                                       v
                         OS-contained child process
                    (untrusted execution / data plane)
                              │ filesystem
                              │ network
                              v
                       Allowed external resources
```

The Pi host process and sandboxed operations are different trust zones. Provider authentication should remain in the host process wherever practical; sandboxed children should receive only the minimum environment and credentials required for a specific operation.

## 1. Pi integration

**Implemented for the six supported file tools plus the contained shell routes; any future tool stays denied until integrated and tested.** A thin extension entry point connects Pi lifecycle and tool events to the central policy model. It covers `read`, `write`, `edit`, `grep`, `find`, `ls`, `bash`, and `user_bash`. Coverage must be re-checked whenever Pi adds or changes model-facing tools. Extension startup observes controlled-tool ownership only after Pi `0.84.4` emits `session_start` (unreleased correction, not yet accepted); until readiness plus ownership, every model-facing call is blocked fail-closed.
Pi hooks are authorization interception points, but hook execution in the host process is not OS isolation. Where interception cannot reliably cover a tool, the integration layer must replace or route that tool through controlled operations, or fail closed.

## 2. Path normalization

**Implemented as the enforced path primitive, consumed by the Goal 2 gate.** `src/policy/paths.ts` resolves model-facing relative paths against an explicitly supplied canonical workspace, canonicalizes existing targets through the filesystem, and resolves creation targets from their longest existing ancestor. Broken links and filesystem-resolution failures produce typed errors that the gate treats as denials. Decisions do not use raw string prefixes.

Normalization surfaces ambiguity and errors rather than guessing. It intentionally preserves path components until the existing prefix is resolved so traversal after a symlink follows filesystem semantics. Check-to-use races are bounded by the Goal 2 execution-time object binding and the Goal 3 descriptor-bound freeze/measure chain; declared residuals are in the gate contracts.

## 3. Workspace boundary

**Path-membership and default decisions implemented and enforced through the Goal 2 gate.** A canonical workspace root defines the default allow zone. The path layer reports membership using a path-component relationship, not a text prefix. Fixed default decisions for ordinary external read/write/edit paths return `ASK` where the operation's existence requirements hold.

Workspace membership never overrides a secret classification or a stronger global restriction.

## 4. Secret classification

**Implemented as the enforced classification input, consumed by the effective policy and the Goal 2 gate.** `src/policy/resources.ts` classifies selected high-confidence secret paths and potentially sensitive resource paths from Phase 1A's canonical target and normalized lexical path. It returns stable categories, reasons, sensitivities, and evidence without reading file contents or making an authorization decision. `sensitive` identifies security-relevant ambiguity and is not equivalent to `secret`.

Ordinary filenames can still contain secrets, and Phase 1A's filesystem limitations still apply. Environment-variable classification and macOS Keychain protection remain unimplemented. Classification is defense in depth, not proof that all secrets can be identified.

## 5. Policy engine

**Fixed path decisions, outcome composition, and bounded configuration-aware evaluation implemented and enforced through the Goal 2 gate.** The implemented engine is pure and deterministic after loading. It accepts an exact operation, genuine canonical resource, internally derived classification, and a privately issued two-source configuration snapshot. Authorization produces structured `ALLOW`, `ASK`, or `DENY` decisions with baseline and source explanations. Command risk, network intent, and containment availability arrived with Goals 3–4. `SANDBOX` represents an orthogonal containment requirement, never a fourth authorization outcome.

Global/default policy is authoritative. Both trusted user/global and project configuration may only preserve or strengthen the baseline. User decisions through the separate approval layer may satisfy a specific matching `ASK`; configuration cannot grant approval. Invalid or ambiguous security configuration fails closed where it affects protected access.

The accepted [monotonic policy authority contract](docs/MONOTONIC-POLICY-AUTHORITY.md) fixes the composition model: authorization restrictions are ordered `ALLOW < ASK < DENY`, the strictest applicable result wins, and both trusted user/global and project-controlled contributions may only preserve or strengthen the baseline. Goal 1 implements the bounded configuration chain without changing those limits: [the configuration contract](docs/CONFIGURATION-AUTHORIZATION.md) defines the strict v1 schema, fixed locations, trusted source association, whole-source failure domains, and structured result. Approval and enforcement arrived with Goals 2–4, not Goal 1. Any future mechanism that relaxes `ASK` requires an explicit contract change and separate review.

The accepted first decision primitive is the [read-path default decision contract](docs/READ-PATH-DECISIONS.md): a fixed default rule over one genuine resolver result, with internal classification and no configuration or approval inputs. Its `ALLOW` is only a default path-rule result and cannot bypass later stronger restrictions. Goal 1 composes these baseline outcomes with validated configuration; Goal 2 enforces them through the gate.

The accepted write-path and edit-path default decision contracts add the same fixed-rule approach for one write path and one edit path. For write, an ordinary missing target inside the workspace is an acceptable creation target and an ordinary external target asks. For edit, every ordinary missing target denies because an edit requires an existing target; ordinary existing inside targets allow and ordinary existing external targets ask. Secret and sensitive targets deny for both. The write-path independent verdict is recorded in [docs/WRITE-PATH-DECISIONS-AUDIT.md](docs/WRITE-PATH-DECISIONS-AUDIT.md) and the edit-path verdict in [docs/EDIT-PATH-DECISIONS-AUDIT.md](docs/EDIT-PATH-DECISIONS-AUDIT.md). Their `ALLOW` is only a default path-rule result and cannot bypass later stronger restrictions. Goal 2 enforces these primitives through the gate for all supported file tools. Per-Goal scope assignments for the four-Goal plan are retained as completed contracts in [ROADMAP.md](ROADMAP.md).

## 6. Approvals

**Implemented.** The approval layer presents the exact operation, canonical
target, reason, duration, and scope, and its grants are narrow, visible and
non-transferable. For file tools the grant covers one tool call; for shell
(shell-approvals.ts) a grant additionally binds the exact command text, the
parsed form, the workspace/cwd, the runtime instance and session epoch, the
loaded policy states, the generated containment profile, the constructed
environment, every sealed script input and every static resource outcome, with
a 60-second expiry and single use.

An approval changes authorization only. It does not weaken containment or
convert an unsandboxed process into a sandboxed one, and a shell grant never
authorizes a host write: each exported effect carries its own fresh decision.

Historical design text for the file-tool approval contract follows. The approval layer will present the exact operation, canonical target, reason, duration, and scope. Approvals must be narrow, visible, and non-transferable between materially different resources or operations. Timeout, unavailable UI, and malformed responses do not grant access.

An approval changes authorization only. It does not weaken containment or convert an unsandboxed process into a sandboxed one.

## 7. Shell command classification

**Implemented for the supported grammar.** The bounded lexer/parser
(`src/policy/shell-grammar.ts`), the plan builder (`shell-plan.ts`) and the
fixed command-risk tables (`shell-commands.ts`) classify destructive,
privilege, credential, system, publish/deploy, network and unknown behaviour,
and refuse anything they cannot represent exactly. Parsing is advisory with
teeth: it decides approval requirements and early refusals, while the Seatbelt
profile and the controlled export remain the enforcement boundary.

Historical design text follows. Shell handling will identify destructive operations, privilege escalation, credential access, nested interpreters, command substitution, filesystem escape, network access, and publish/deploy actions. A parser or AST-based approach is expected for robust classification; regexes may provide limited signals but cannot be the complete boundary.

Because shell languages are highly dynamic, classification alone is insufficient. Shell execution must also be contained by the OS adapter.

## 8. OS sandbox adapter

**Implemented (macOS 27 arm64 only).** The adapter generates a deny-default
Seatbelt profile from trusted host inputs, closes the child descriptor envelope
with a small audited native launcher, and runs the entry shell inside
`sandbox-exec`. The child sees a private projection of the workspace plus the
toolchain and read-only system roots, with `staging/`, `home/` and `tmp/` as
its only writable data roots. `/usr/bin/sandbox-exec` and the helper are
identity-pinned; the platform, architecture and kernel major are declared and
checked.

Initialization is an explicit prerequisite. Unsupported platform, missing or
mismatched helper, unverifiable `sandbox-exec`, failed profile generation, or a
failed self-test blocks every shell route. There is no unrestricted fallback,
and no outcome-dependent profile: a `DENY` blocks the invocation instead of
running it with fewer roots.

## 9. Network policy

**Implemented under the Goal 4 contract, accepted 2026-09-20.** The
contained route has no Seatbelt destination filter: on the declared target the
profile parser rejects every destination-exact network form (only `*` and
`localhost` hosts with an explicit port are expressible). Enforcement therefore
binds destination identity in the host process: a per-invocation network
broker pins the composed destination scope (trusted allowlist entries plus
invocation-approved representable destinations, with host-side resolution
frozen at preparation), opens exactly one IPv4-loopback listener, and the
generated profile grants only that endpoint. A child CONNECT request is
checked at tunnel-open time against the pinned host and port and dialed to the
pinned addresses — never a fresh resolution, redirect target, or proxy
service. Child-originated DNS does not exist (no resolver route is reachable
by a sandboxed client on this target), and UDP, listening, Unix-domain and
Mach routes stay kernel-denied. The full contract and its bounded guarantees
are in [docs/NETWORK-GATE.md](docs/NETWORK-GATE.md).

Goal 4 must not weaken the filesystem, approval, environment or export
boundaries: a network approval cannot widen filesystem policy, expose host
credentials, or replace containment, and with an empty scope the route is
byte-identical to Goal 3's closed networking. Failure to pin a destination or
to establish the broker blocks the invocation.

## 10. Environment sanitization

**Implemented for the shell route.** The child environment is constructed from
`{}`: `PATH` (toolchain bin plus system directories), `HOME` and `TMPDIR`
inside the invocation directory, a stable UTF-8 locale, and `SHELL`. Provider
credentials, `*_TOKEN`/`*_KEY`/`*_SECRET`, `SSH_AUTH_SOCK`, `DYLD_*`,
`NODE_OPTIONS`, `BASH_ENV`/`ENV` and proxy variables are absent by
construction; the entry shell runs with `--noprofile --norc`.

Historical design text follows. Child processes receive a constructed environment rather than an unfiltered copy of the host environment. Sensitive variables, provider credentials, agent state paths, proxy settings, and dynamic-loader controls must be removed unless explicitly required by a narrow operation.

## 11. Audit and status reporting

**Implemented for the shell route.** Every contained run returns a non-secret
status block: exit state, the verified platform/`sandbox-exec`/profile
identities, projection counts, exported/refused/ignored effect counts, and the
reason for each refused effect or refused export (for example a missing
quiescence proof). No secret value is included.

Historical design text follows. Decisions will produce structured, non-secret status and audit events. Reports should identify the operation, decision, reason, policy source, approval scope, and containment state without logging secret values. The UI must make degraded or unavailable protection conspicuous.

## Different enforcement strategies

Pi's file tools execute inside the host Node.js process, so an OS sandbox applied only to child processes cannot contain them. Their paths and operations require pre-execution policy gates or controlled replacement implementations. Shell and user-bash operations must be routed through the sandbox adapter because authorization before spawn cannot constrain everything a shell later does.

Both strategies must consume the same classification and policy semantics. A new model-facing tool is denied or excluded until its enforcement path is explicitly integrated and tested.

## Design constraints

- Security-critical modules stay small and free of UI concerns.
- Policy output is explainable and testable without Pi or an OS sandbox.
- Platform adapters do not decide policy.
- Approval storage cannot be written or broadened by repository-controlled configuration.
- The effective-policy merge is monotonic: lower-authority configuration can only remove capabilities.
- Documentation distinguishes implemented behavior from planned behavior.
