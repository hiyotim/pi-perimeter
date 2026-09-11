# Architecture

## Status and scope

This document describes the architecture as it is implemented incrementally. The Phase 1A path policy primitive and Phase 1B resource classifier are implemented and tested, but no Pi tool currently enforces them. Other components below remain design boundaries, not current guarantees, unless explicitly marked as implemented.

Phase 1B is accepted as a path-only, unenforced primitive. [STATE.md](STATE.md) records accepted Goals, review evidence, and remaining gates; Phase 1 as a whole remains incomplete.

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
│                                  ALLOW / ASK / DENY / SANDBOX         │
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

**Planned.** A thin extension entry point will connect Pi lifecycle and tool events to the central policy model. It must cover `read`, `write`, `edit`, `grep`, `find`, `ls`, `bash`, and `user_bash`. Coverage must be re-checked whenever Pi adds or changes model-facing tools.

Pi hooks are authorization interception points, but hook execution in the host process is not OS isolation. Where interception cannot reliably cover a tool, the integration layer must replace or route that tool through controlled operations, or fail closed.

## 2. Path normalization

**Implemented as a policy primitive; not integrated with Pi tools.** `src/policy/paths.ts` resolves model-facing relative paths against an explicitly supplied canonical workspace, canonicalizes existing targets through the filesystem, and resolves creation targets from their longest existing ancestor. Broken links and filesystem-resolution failures produce typed errors that callers must treat as failed security checks. Decisions do not use raw string prefixes.

Normalization surfaces ambiguity and errors rather than guessing. It intentionally preserves path components until the existing prefix is resolved so traversal after a symlink follows filesystem semantics. Time-of-check/time-of-use and symlink replacement risks remain unresolved and require enforcement-time containment or descriptor-based techniques in a later phase.

## 3. Workspace boundary

**Containment primitive implemented; authorization remains planned.** A canonical workspace root defines the default allow zone. The path layer reports membership using a path-component relationship, not a text prefix. No current Pi tool consumes this result, and external read/write behavior has not yet been implemented.

Workspace membership never overrides a secret classification or a stronger global restriction.

## 4. Secret classification

**Implemented as a classification primitive; not integrated or enforced.** `src/policy/resources.ts` classifies selected high-confidence secret paths and potentially sensitive resource paths from Phase 1A's canonical target and normalized lexical path. It returns stable categories, reasons, sensitivities, and evidence without reading file contents or making an authorization decision. `sensitive` identifies security-relevant ambiguity and is not equivalent to `secret`.

Ordinary filenames can still contain secrets, and Phase 1A's filesystem limitations still apply. Environment-variable classification and macOS Keychain protection remain unimplemented. Classification is defense in depth, not proof that all secrets can be identified.

## 5. Policy engine

**Planned.** The policy engine will be pure and deterministic. Inputs will include the operation, canonical resource, workspace relation, secret classification, command risk, network intent, effective configuration, and containment availability. Its output will be a structured `ALLOW`, `ASK`, `DENY`, or `SANDBOX` decision with a stable reason code.

Global/default policy is authoritative. User-controlled overrides may grant explicitly scoped approvals. Project-local policy may only narrow permissions. Invalid or ambiguous security configuration fails closed where it affects protected access.

The accepted first decision primitive is the [read-path default decision contract](docs/READ-PATH-DECISIONS.md): a fixed default rule over one genuine resolver result, with internal classification and no configuration or approval inputs. Its `ALLOW` is only a default path-rule result and cannot bypass later stronger restrictions. It is not integrated with Pi tools. Other operations and configuration authority remain separate Phase 1 work.

The accepted write-path and edit-path default decision contracts add the same fixed-rule approach for one write path and one edit path. For write, an ordinary missing target inside the workspace is an acceptable creation target and an ordinary external target asks. For edit, every ordinary missing target denies because an edit requires an existing target; ordinary existing inside targets allow and ordinary existing external targets ask. Secret and sensitive targets deny for both. The write-path independent verdict is recorded in [docs/WRITE-PATH-DECISIONS-AUDIT.md](docs/WRITE-PATH-DECISIONS-AUDIT.md) and the edit-path verdict in [docs/EDIT-PATH-DECISIONS-AUDIT.md](docs/EDIT-PATH-DECISIONS-AUDIT.md). Their `ALLOW` is only a default path-rule result and cannot bypass later stronger restrictions. Read, write, and edit default path primitives are implemented and accepted but not integrated with Pi tools; delete, rename, multi-resource, and other operation policies remain future Phase 1 work.

## 6. Approvals

**Planned.** The approval layer will present the exact operation, canonical target, reason, duration, and scope. Approvals must be narrow, visible, and non-transferable between materially different resources or operations. Timeout, unavailable UI, and malformed responses do not grant access.

An approval changes authorization only. It does not weaken containment or convert an unsandboxed process into a sandboxed one.

## 7. Shell command classification

**Planned.** Shell handling will identify destructive operations, privilege escalation, credential access, nested interpreters, command substitution, filesystem escape, network access, and publish/deploy actions. A parser or AST-based approach is expected for robust classification; regexes may provide limited signals but cannot be the complete boundary.

Because shell languages are highly dynamic, classification alone is insufficient. Shell execution must also be contained by the OS adapter.

## 8. OS sandbox adapter

**Planned.** A platform adapter will contain shell subprocesses using an independently reviewed OS-level mechanism. Anthropic Sandbox Runtime is the current primary candidate, but suitability and current behavior must be re-evaluated in Phase 3.

Initialization is an explicit prerequisite. If the requested policy requires containment and the adapter is unsupported, unavailable, or fails to initialize, execution is blocked. There is no unrestricted fallback.

## 9. Network policy

**Planned.** Network access will be restricted by default for sandboxed processes. Known development endpoints may be allowlisted; unknown destinations require a scoped approval. The design must consider DNS, redirects, proxies, local services, alternate protocols, and common exfiltration paths.

## 10. Environment sanitization

**Planned.** Child processes receive a constructed environment rather than an unfiltered copy of the host environment. Sensitive variables, provider credentials, agent state paths, proxy settings, and dynamic-loader controls must be removed unless explicitly required by a narrow operation.

## 11. Audit and status reporting

**Planned.** Decisions will produce structured, non-secret status and audit events. Reports should identify the operation, decision, reason, policy source, approval scope, and containment state without logging secret values. The UI must make degraded or unavailable protection conspicuous.

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
