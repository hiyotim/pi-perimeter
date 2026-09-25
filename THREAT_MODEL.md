# Threat Model

## Status

This is the incremental threat model for `pi-perimeter` (formerly `pi-warden`). Goals 1–4 are implemented and accepted within their documented contracts and declared limitations: bounded configuration authorization (Goal 1, unenforced primitive), Pi file gates with scoped approvals (Goal 2, enforced), the contained shell route on the declared macOS target (Goal 3), and restricted networking through the per-invocation broker (Goal 4). Contracts: [docs/FILE-GATE.md](docs/FILE-GATE.md), [docs/SHELL-GATE.md](docs/SHELL-GATE.md), [docs/NETWORK-GATE.md](docs/NETWORK-GATE.md); acceptance and exact evidence: [STATE.md](STATE.md). Sections below marked implemented describe those accepted bytes; anything still marked planned belongs to a later, unselected Goal.

The decision vocabulary is:

- **ALLOW** — authorization permits an operation without an interactive exception.
- **ASK** — require an explicit, narrowly scoped user decision; absence or timeout is not approval.
- **DENY** — block the operation without a routine approval bypass.
- **SANDBOX** — require OS-level containment in addition to any authorization decision. If containment cannot be established, block.

`SANDBOX` is orthogonal to authorization. Matrix cells such as `ASK + SANDBOX` therefore mean both controls are required.

## Assets

- Files and repositories inside the active workspace.
- Files and personal data outside the workspace.
- Authentication material: SSH, AWS, GitHub, Git, cloud, and Pi credentials.
- Private keys and environment-variable secrets.
- Host integrity, user account privileges, and system configuration.
- Network identity and access available to the host.
- The integrity of global security policy, approvals, and audit records.
- Provider credentials held by the Pi host process.
- User attention and the meaning of approval prompts.

## Trust boundaries

1. Model output versus the Pi host and extension control plane.
2. Repository-controlled content versus user/global security policy.
3. Canonical workspace paths versus external filesystem resources.
4. In-process Pi file operations versus OS-contained child processes.
5. Sanitized child-process environment versus the host environment.
6. Approved network destinations versus all other endpoints.
7. Displayed approval intent versus the operation actually executed.

## Trusted components

The implemented design trusts, within their documented limits (Goals 1–4 accepted):

- the Pi host process and the exact Pi APIs validated for a supported version;
- the small `pi-perimeter` (formerly `pi-warden`) policy core and enforcement adapters;
- user/global security configuration that has not been modified by the repository;
- the selected OS containment mechanism after successful initialization;
- the user making an informed decision from an accurate approval prompt;
- the operating system primitives that the sandbox adapter relies on.

Trust is not transitive. A trusted Pi host does not make model-generated shell code trusted, and an approval does not make a subprocess contained.

## Untrusted components

- model output and tool arguments;
- repository files, `AGENTS.md`, scripts, hooks, build output, and dependencies;
- project-local security configuration;
- path strings before canonicalization;
- shell text and programs launched by it;
- remote responses and downloaded content;
- environment variables inherited from an uncontrolled source;
- new or third-party Pi tools until integrated with the central policy;
- symlinks and filesystem state that can change during an operation.

## Adversary assumptions

An attacker may control a repository and everything normally writable within it. They may use prompt injection to influence the model, craft filenames and symlink graphs, provide malicious package scripts, construct nested shell expressions, and operate a remote network endpoint. They may try to confuse the user with broad or misleading approvals.

The attacker is not assumed to already have arbitrary code execution as the user's account outside a Pi-mediated operation. If they do, this extension cannot restore that lost boundary. The model is assumed capable of making mistakes even without a malicious prompt.

## In-scope attacks

- Escaping the workspace through traversal, absolute paths, normalization differences, or symlinks.
- Reading or modifying known secret locations and credential material.
- Using shell syntax, nested interpreters, subprocesses, or environment variables to bypass policy.
- Destructive filesystem, Git, privilege, credential, publish, deploy, and system operations.
- Network exfiltration from model-facing operations.
- Repository content or configuration attempting to weaken effective policy.
- Prompt injection that attempts to induce protected actions.
- Sandbox absence, initialization failure, or partial coverage.
- Newly introduced Pi tools bypassing central enforcement.
- Approval scope confusion, replay, or target substitution.

## Out-of-scope attacks

- General malware containment after arbitrary user-account code execution.
- Kernel, hypervisor, OS sandbox, or trusted Pi-host compromise.
- Physical access and attacks against the user's login session.
- Perfect identification of every possible secret format.
- Guaranteed protection of macOS Keychain (synthetic probe only; no isolation claim).
- Side channels not controllable by the selected OS boundary.
- Actions the user intentionally performs outside Pi and `pi-perimeter` (formerly `pi-warden`).

Out of scope does not mean safe; it means no guarantee is planned without expanding the design.

## Attack matrix

| Attack class | Example | Response (implemented unless noted) | Rationale / required control |
|---|---|---:|---|
| Relative traversal | `../../private.txt` | ASK or DENY | Canonicalize before workspace comparison; secret rules override approval. |
| Absolute external path | `/Users/alice/Documents/file` | ASK or DENY | External access requires explicit policy; sensitive paths are denied. |
| Normalization ambiguity | mixed separators, `.` components, Unicode ambiguity | DENY | Ambiguous canonical identity must fail closed. |
| Symlink escape | workspace link to an external directory | ASK or DENY | Evaluate the resolved target and mitigate replacement races. |
| Symlink to secret | workspace link to `~/.ssh/id_ed25519` | DENY | Secret classification applies after resolution. |
| Workspace prefix collision | `/work/project-evil` beside `/work/project` | DENY | Use path-component containment, never string prefixes. |
| `.env` access | read `.env.production` | DENY | Known secret class, including inside the workspace. |
| SSH credentials | read or copy `~/.ssh` | DENY | Hard-denied credential family. |
| AWS credentials | read `~/.aws/credentials` | DENY | Hard-denied credential family. |
| GitHub credentials | access `gh` hosts/config or tokens | DENY | Hard-denied credential material. |
| Git credential stores | read configured credential files/helpers | DENY | Prevent token/password extraction. |
| Pi credentials | access Pi auth or agent credential data | DENY | Host authentication remains outside child operations. |
| Private key material | read conventional private-key names, `*.p12`, or `*.pfx` | DENY | Selected high-confidence path indicators; classification does not inspect contents. |
| Ambiguous key filename | read generic `*.key` or `*.pem` | DENY by default | The classifier treats these as sensitive indicators, not proof of private-key contents; stronger evidence still wins. This does not authorize access. See [STATE.md](STATE.md). |
| Environment secret | print or forward `*_TOKEN`, `*_KEY`, provider keys | DENY + SANDBOX | Sanitize environment before spawn; policy blocks explicit access. |
| Shell indirection | variables, aliases, `eval`, sourced files | ASK + SANDBOX or DENY | Classification is insufficient; contain execution and deny dangerous ambiguity. |
| Nested `sh -c` | `sh -c '...'` | ASK + SANDBOX | Parse recursively where possible and require containment. |
| Nested `bash -c` | `bash -c '...'` | ASK + SANDBOX | Same as nested `sh`; quoting must not evade policy. |
| Command substitution | `$(cat secret)` or backticks | ASK + SANDBOX or DENY | Inspect the full syntax tree; secret targets remain denied. |
| Destructive delete | recursive or broad deletion | ASK + SANDBOX or DENY | Scope-aware classification; deny catastrophic targets. |
| Destructive Git | reset, clean, forced history rewrite | ASK + SANDBOX or DENY | Protect working state and repositories; target/scope determine denial. |
| Privilege escalation | `sudo`, authorization services, setuid changes | DENY | Workspace automation must not gain host privilege. |
| System modification | launch services, security settings, system paths | DENY | Outside intended workspace authority. |
| Credential operation | key export, credential-helper changes, token login | DENY | Prevent acquisition or persistence of credentials. |
| Publish or deploy | npm publish, release, production deploy | ASK + SANDBOX | External side effect requires specific approval and restricted credentials/network. |
| Unknown network access | request to an unlisted domain | ASK + SANDBOX | Destination-scoped approval plus network containment. |
| Obvious exfiltration | upload file contents or environment data | DENY + SANDBOX | Authorization denial backed by network restriction. |
| Local-service probing | access loopback or metadata-style endpoints | ASK + SANDBOX or DENY | Local endpoints can expose credentials or privileged services. |
| Malicious project config | set sandbox disabled or allow home directory | DENY | Project policy may only tighten global policy. |
| Prompt injection | repository says to reveal credentials | DENY for protected action | Content is untrusted; the requested operation still passes policy. |
| Sandbox unavailable | runtime missing, unsupported, init error | DENY | No unrestricted fallback when containment is required. |
| New Pi tool bypass | future model-facing tool lacks a gate | DENY / unavailable | Coverage is allowlisted and compatibility-gated. |
| Misleading broad approval | request hides exact path or duration | DENY | Approval requires a precise canonical target and scope. |
| Ordinary in-workspace file edit | non-secret canonical workspace file | ALLOW | Intended low-friction workflow; in-process tool gate still validates it. |
| Ordinary in-workspace shell | build/test with no elevated risk | ALLOW + SANDBOX | Authorization may be automatic, but shell still requires containment. |

## Filesystem threats

### Canonical identity

Raw input is not a resource identity. The implemented Phase 1A path primitive resolves relative paths against an explicit canonical workspace, canonicalizes existing objects, and handles non-existent destinations through the longest verified existing ancestor. Workspace membership is checked by components on canonical paths. Typed resolution failures are fail-closed inputs for policy callers; the Goal 2 gate (`src/gate/authorizer.ts`) denies on them.

The Phase 1A result describes containment of a canonical pathname, not isolation of the underlying inode or filesystem object. A hard-linked name inside the workspace can share an inode with a name outside it, and a mount point below the workspace can expose objects from another filesystem while retaining an in-workspace pathname. POSIX APIs treat a macOS Finder alias as an ordinary file rather than traversing it; any application-specific alias resolution would require separate policy at the operation that performs it. Case behavior, Unicode normalization, and mount/filesystem semantics still need platform-specific investigation.

Canonicalization does not keep a file descriptor open, so filesystem state can change between checking and use. Time-of-check/time-of-use races are bounded by the Goal 2 execution-time object binding (descriptor-relative chain on platforms with `/proc/self/fd`-style traversal, verified direct-leaf binding plus creation refusal on macOS) and the Goal 3 descriptor-bound freeze/measure chain; declared residuals remain. Failure to obtain a reliable identity denies.

### Symlinks

Every relevant path component may be a symlink. Phase 1A resolves existing symlink components, including the parent of a non-existent creation target; broken links fail with an explicit error. Operation policy evaluates every source and destination path: the Goal 2 gate captures an execution-time object binding before approval and verifies it at effect time (descriptor-relative on Linux-class platforms, verified direct-leaf plus creation refusal on macOS). A link located inside the workspace does not make its external target internal. Phase 1B classification feeds the effective decision consumed by the gates.

A symlink changing after a decision is handled by the same binding: descriptor-relative opens with `O_NOFOLLOW`, post-open identity checks, and sandbox restrictions; declared residuals are in the gate contracts ([docs/FILE-GATE.md](docs/FILE-GATE.md), [docs/SHELL-GATE.md](docs/SHELL-GATE.md)).

### Writes and destructive changes

Creation, overwrite, rename, link, permission change, and deletion have distinct effects. Policy must classify the complete operation, not only one supplied pathname. Broad deletions and writes to system or security configuration may be denied even after a generic external-access approval.

## Shell threats

- regex matching is never the security boundary: the Goal 3 bounded lexer/parser (`src/policy/shell-grammar.ts`), plan builder (`src/policy/shell-plan.ts`), and fixed command-risk tables decide approval requirements and early refusals;
- parsing preserves shell structure and recursively inspects known nested shells; command substitution and backticks are denied rather than parsed;
- redirection targets and working directories are evaluated as resources;
- an unknown or highly dynamic command requires approval or denial;
- every permitted shell command still runs in OS-level containment (Goal 3 Seatbelt route, macOS 27 arm64 only);
- sandbox initialization failure blocks execution;
- user `!` and `!!` paths require the same containment as model `bash` (Goal 3).

## Network threats

Implemented (Goal 4, accepted 2026-09-20; contract [docs/NETWORK-GATE.md](docs/NETWORK-GATE.md), evidence [docs/NETWORK-GATE-AUDIT.md](docs/NETWORK-GATE-AUDIT.md)). Network access can exfiltrate files, environment variables, prompts, source code, or credentials, and can reach loopback services, cloud metadata endpoints, Unix-socket bridges, DNS, proxies, or redirect chains. The policy starts restricted, permits narrowly allowed trusted destinations plus per-invocation approvals for representable destinations tied to the actual destination set and session scope; pre-execution command classification cannot prove eventual network behavior, so the per-invocation host-side broker is the enforcement boundary.

**Implemented (Goal 4, accepted 2026-09-20; contract
[docs/NETWORK-GATE.md](docs/NETWORK-GATE.md), evidence
[docs/NETWORK-GATE-AUDIT.md](docs/NETWORK-GATE-AUDIT.md)).** On the declared
target the OS profile language cannot express a destination-exact allowance,
so the enforcement boundary is a per-invocation host-side broker: the Seatbelt
profile grants exactly one TCP port on local addresses (the broker's endpoint),
the broker pins the composed destination scope with host-side resolution and
public-address validation, matches CONNECT targets by exact host and port at
tunnel-open time, dials only the pinned addresses (no re-resolution), refuses
to serve before the invocation is armed, and never opens a Mach or UDP route.
Child-originated DNS does not exist on this route. Threat responses actually in
force: metadata/loopback/private/link-local destinations refuse pinning;
redirects, proxy overrides, rebinding and alternate encodings fail closed;
`DENY` and protected-resource outcomes have no network-approval bypass;
project configuration can only restrict the destination scope. Declared
residuals: any permitted endpoint can receive child-readable data, the profile
rule is port-exact but local-address-scoped, and a same-user host process can
reach the broker endpoint while the invocation is armed (the accepted B3
boundary). Everything in this section not marked implemented remains planned.

## Credential threats

Known credential paths are hard-denied by the effective policy consumed by the Goal 2 file gate (Phase 1B path-based classification of a small high-confidence subset; content-blind, environment variables out of scope). The Goal 3 shell route constructs its child environment from `{}`, so provider keys and Pi state are absent by construction. Credentials must not be copied into temporary fixtures or audit logs. A narrow future capability that genuinely requires a credential needs a separate design, minimum privilege, explicit user intent, and evidence that child processes cannot reuse it beyond scope.

Secret classification cannot guarantee discovery of arbitrary secrets embedded in ordinary files. Documentation and UI must state this limitation.

## Prompt injection

Repository text, source comments, issue content, tool output, and downloaded material may instruct the model to bypass controls. Prompt injection is treated as an expected input, not as something a system prompt can reliably eliminate. The security boundary is the enforced operation decision and OS containment. Repository instructions cannot grant permissions, disable policy, approve themselves, or make a secret non-secret.

## Malicious repository scenario

A malicious repository may combine configuration, symlinks, scripts, dependencies, filenames, and prompt injection. It may change files between inspection and execution or make a normal build run a hostile lifecycle script. Project Trust prevents some unapproved resource loading in Pi, but once a project is trusted it is not a runtime sandbox.

`pi-perimeter` (formerly `pi-warden`) enforces a monotonic authority model, implemented in Goal 1 and consumed by the Goal 2 gate: built-in secure defaults and user/global policy are authoritative; project-local configuration may only make the effective policy stricter. Repository executables and package scripts run as untrusted child code and require containment.

## Approval limitations

Users can misunderstand prompts, become habituated, or approve malicious actions. Implemented: file-tool grants cover one tool call; shell grants (`src/approvals/shell-approvals.ts`) additionally bind the exact command text, parsed form, workspace/cwd, runtime instance and session epoch, policy states, containment profile, constructed environment, sealed script inputs and static resource outcomes, with 60-second expiry and single use. An approval UI must show canonical resources, operation type, side effects, duration, and whether containment remains active. It must avoid bundled unrelated requests and must not offer routine overrides for hard-denied secrets or privilege escalation.

Approval state is not a sandbox, must not be writable by repository code, and must not silently persist beyond its displayed scope. Races that substitute a target after approval require enforcement at execution time, not better wording alone.

## Sandbox limitations

An OS sandbox is only as strong as its configuration, coverage, and underlying platform. In-process Pi tools are not contained merely because shell children are. Allowed workspace writes can still destroy workspace data. Allowed network endpoints can receive sensitive workspace content. Compiler, package-manager, and child-process behavior must remain inside the same boundary.

The selected sandbox backend is the Goal 3 Seatbelt projection design (deny-default profile, private workspace projection, descriptor-envelope native launcher, `sandbox-exec`; declared target only). Unsupported platforms, initialization failures, and unverified weakening options cannot trigger unrestricted fallback. Descendant termination is not guaranteed (accepted variant-B boundary); unattributable survivors stay confined to the disposable projection but their lifetime and resource consumption are unbounded.

## macOS assumptions

The declared target is macOS 27.0 (build `26A428`) on Apple Silicon, enforced by `verifyPlatform` plus a pinned `/usr/bin/sandbox-exec` identity. Validated on that target: Seatbelt projection containment, closed networking (Goal 3) extended by the per-invocation broker (Goal 4), descriptor-bound export, constructed environment. Declared residuals and bounds: synthetic-Keychain probe only (no isolation claim), mount isolation unverified, same-user host writers outside the boundary, inode/metadata-replay substitution residual. No complete Keychain-isolation claim is made.

## Known unknowns

- Exact Pi hook/replacement coverage across future versions and dynamically added tools.
- Safe handling of filesystem races for every in-process file operation.
- The long-term suitability and maintenance state of Anthropic Sandbox Runtime.
- Complete network mediation on macOS, including DNS, proxies, sockets, and local services.
- Whether useful development workflows can operate with a fully sanitized environment.
- Robust shell parsing and classification across dialects and nested interpreters.
- Keychain and other brokered-service access from sandboxed children.
- Secure, usable persistence and revocation semantics for approvals.
- Packaging compatibility policy across Pi and Node releases.

Each unknown must become a documented experiment, test, or release blocker before a related guarantee is made.
