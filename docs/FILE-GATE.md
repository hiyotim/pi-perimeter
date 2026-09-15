# File Gate and Scoped Approvals

Status: implemented in the working tree for Goal 2 `20260915-pi-file-gates-scoped-approvals` (corrective pass included the descriptor-bound execution-time identity binding, the isolated pack/install/rollback evidence, and this status/provenance repair); the enforcement work is ready for the fresh independent FULL review, with owner acceptance and Phase 2 closure still separate and pending. No OS containment or network permission exists, and all Shell execution routes are blocked.

## Scope

pi-warden mediates every supported Pi model-facing file tool with one central gate and, where effective policy requests it, one exact single-use scoped user approval:

- tools: `read`, `write`, `edit`, `grep`, `find`, `ls`;
- shell routes (model `bash`/`powershell`, user `!`/`!!`) are blocked outright;
- every other model-facing tool name — including dynamically registered ones — fails closed.

Integration relies on supported Pi `0.84.4` extension interfaces only: `pi.on("tool_call")` with mutable `event.input`, `pi.registerTool()` (same-name override of built-ins), `pi.on("user_bash")` full-replacement results, `pi.on("session_shutdown")` for lifecycle invalidation, `ctx.cwd` as the trusted workspace context, `ctx.ui.confirm()` as the approval dialog, and `pi.getAllTools()` ownership observations. Verified against the installed package metadata and `dist/` tool sources for API version 0.84.4.

## Operation mapping

Mapping from tool to the fixed v1 policy operations (`src/policy/operations.ts`):

| Tool | Resource(s) touched | Policy operation |
| --- | --- | --- |
| `read` | exact target (offset/limit shape only the view) | `read` |
| `write` | exact target; creation parents under the canonical target path | `write` |
| `edit` | exact existing target | `edit` |
| `grep` | contents of descendants of the search root | `read` at the root, then per-descendant `read` classification |
| `find` | names/types of descendants of the search root | `read` at the root, then per-descendant `read` classification |
| `ls` | names/types of the search root entries | `read` at the root, then per-descendant `read` classification |

This is exactly the accepted JSON v1 operation vocabulary; nothing new was added and no tested weaker configuration behavior. `grep`/`find`/`ls` cannot bypass an applicable `read` (or stronger) restriction under a different tool name: where `read` is denied by baseline or configuration, these tools are denied by the same decision, and any secret/sensitive descendant is denied independently of a workspace allowance.

## Authorization sequence

For each file tool call the gate performs this fixed sequence; any error is a denial, never an allowance:

1. Structured input framing (`src/gate/gate-input.ts`): the tool input object, path field, and effect arguments (content, edits, and search option values) are validated with exact runtime checks. Malformed, missing, or null-byte input fails closed.
2. Canonical resolution (`resolveWorkspacePath`) issues a genuine resolver-issued identity for the requested path relative to the trusted `ctx.cwd`; resolution failures deny.
3. Protected control-plane structuring (`src/policy/control-plane.ts`): issued protected zones — the Pi agent directory from Pi's own supported `getAgentDir()` API plus the trusted user-policy root — deny every resource at or below them. Zone membership is a component-aware prefix, never a string-prefix check. This denial overrides workspace allowance, configuration outcomes, and any possible approval, and it is not approvable.
4. Effective policy evaluation: `loadOperationPolicySources` loads the user/global and project policy snapshots bound to that canonical workspace and `evaluateEffectivePath` merges the accepted baseline with all exact-operation restrictions (monotonic join). Invalid or substituted snapshots deny.
5. `ASK` outcomes request an approval (below). `DENY` blocks with the specific reason; `ALLOW` proceeds. For `read`/`write`/`edit` the descriptor-bound execution plan (below) is captured BEFORE this dialog, so approval delay cannot bind a substituted object.
6. Object-bound execution against verified directory descriptors: the gate captures an execution plan (the identity chain from the anchor — the workspace root for workspace targets, `/` for approved external targets — down to the target's construction parent, each component with its identity or an explicit "was missing at plan time" marker, plus the leaf name and the target's own identity) from trusted host code immediately after authorization and before any approval interaction, then stores it as a one-time per-call binding under the trusted `toolCallId`. The controlled executor — never the original builtin — consumes that binding exactly once, performs a runtime probe that descriptor-relative opens work on the platform, and then: (a) creates or re-opens every chain directory strictly *relative to the verified parent descriptor* (`/proc/self/fd/<dirfd>/<name>`, `O_NOFOLLOW|O_DIRECTORY`, with fstat dev/ino matching the plan for existing components), (b) refuses any component that was planned missing but now exists (e.g. a planted symlink) and any replaced directory, and (c) creates or opens the leaf strictly relative to the verified parent descriptor with `O_NOFOLLOW` (`O_CREAT|O_EXCL` for creation) and fstat-verifies it (dev/ino/size/mtime for existing plans; fresh regular file with `nlink === 1` for creation) before content is read or written. `plan.canonicalPath` is never used to resolve a creation effect, and the path-based `mkdir` fallback is not used; there is no path-based creation at all. Missing components are created relative to the verified parent fd. `event.input.path` is additionally pinned to the canonical path, but that string pinning is explicitly not claimed to be sufficient on its own; the enforced guarantee is the verified descriptor chain.

Failure paths — resolution failures, canonicalization errors, loader failures, classifier errors, forged source sets, missing `O_NOFOLLOW`/`O_DIRECTORY` support, unavailable descriptor-relative opens (probed at runtime — e.g. non-POSIX platforms), and any chain or leaf verification failure — all end in a structured block that carries the decision reason without exposing secret payloads. There is no fallback to the unprotected builtins and no path-based creation on any failure. For workspace reads/edits/writes of existing files and nested/flat creation inside authorized directories the ordinary behavior keeps working where it can be demonstrably bound; variants that cannot be bound on the platform are refused explicitly.

## Controlled search and listing tools

Pi's builtin `grep` spawns ripgrep and `find` spawns fd, both helper processes that read every matching file without per-file authorization; the builtin `ls` reveals entry names without classification. pi-warden overrides `grep`, `find`, and `ls` with controlled same-name tools (`src/gate/controlled-traversal.ts`):

- the root was authorized at the gate; its per-call authorization binding is held under the trusted `toolCallId` Pi supplies and consumed exactly once by the controlled executor;
- every candidate entry is canonicalized and classified before any read; entries classified `secret`/`sensitive`, entries resolving into a protected zone, symlink targets escaping the authorized root, and broken symlinks are withheld from results and never read (no read-then-filter). An aggregate notice (`[pi-warden: N resource(s) withheld by policy]`) is appended instead of the excluded content, and each permitted file's content is read only through a descriptor verified against the evaluated object identity (`readBoundFileContent`);
- symlinked directories are never descended into (matching rg/fd default behavior), so a directory authorization never grants arbitrary external descendants through symlink aliases;
- there is no helper process for these tools: content matching runs in the pi-warden process over approved files only;
- limits follow the builtin defaults (ls 500 entries, find 1000 results, grep 100 matches, 50 KiB output) and unsupported variants (such as grep context) fail closed rather than claim coverage.

## Scoped approvals

Effective `ASK` decisions open a `ctx.ui.confirm` dialog whose message shows the exact tool and policy operation, the requested and canonical resource, the workspace, the reason, the one-call scope and duration (single use, expires after the call, no approval state persists), and the protection status. Only a matching effective `ASK` opens this dialog; `DENY` resources are never approvable. Refusal, unavailable UI (`ctx.hasUI` is checked), thrown dialogs, timeouts surfaced as a false confirm by the host, malformed (non-boolean) responses, and changed target/operation/sessions all block the request without effects. Approval state lives only in private module memory — never in the repository, the workspace, or Pi's session and policy locations — and a grant is single-use for the exact operation/canonical pair it displayed.

For `grep`/`find`/`ls`, the approved root is bound under the trusted `toolCallId` and consumed by the controlled executor during that single call; concurrent calls consume independent bindings, and session replacement (`session_shutdown`) discards every binding and ownership observation.## Unknown tools and dynamic registration

The gate blocks every model-facing tool outside the supported set, including tools registered dynamically at runtime, so a coverage claim never depends on a startup name list. A controlled tool whose same-name registration was lost or overridden by another extension, or whose registration failed (marking the runtime degraded), is blocked at the gate. If controlled-tool registration throws during initialization, the runtime enters a degraded state in which all file tools are blocked rather than silently falling back to unprotected built-ins.

## Protected control-plane resources

The Pi agent directory (auth.json, sessions, models.json, settings, downloaded tools) and the pi-warden user policy location are protected structurally regardless of generic filename classification, above workspace allowance and any approval. These zones are created from trusted host inputs (`getAgentDir()` and the trusted caller's root), never from repository, model, or session data, and no repository-controlled file can weaken or redefine them.

## Explicit limits

- Final-target substitution is closed for the direct controlled `read`/`write`/`edit` effects via the verified descriptor chain (see the authorization sequence): the anchor and every chain directory are opened relative to the verified parent fd, so path-based re-resolution of ancestor strings cannot redirect the effect; the existing leaf must match the plan's dev/ino plus pre-captured size and timestamp (pinning inode reuse), creation must fail `O_EXCL` on any planted entry, and the newly created leaf is fstat-verified (`isFile`, `nlink === 1`) before content is written. Controlled search/list content reads go through the same `O_NOFOLLOW` descriptor but carry and verify only the pre-evaluation dev/ino and the `nlink` hard-link rule — they do NOT capture or compare size/mtime, so a substitute object that happens to reuse the evaluated inode number with equal dev/ino/nlink is a bounded residual for search. These checks are executed through supported Node/Pi APIs only; a second `realpath` was NOT used as a safety argument, and the residual windows are declared honestly:
  - for existing-target direct effects, one micro-second gap per chain step exists between an ancestor-directory fd open and its fstat verification; once the chain descriptors are opened, the leaf open resolves through the verified descriptors, so ancestor path swaps cannot redirect it;
  - creation of a fresh leaf resolves strictly through a chain of pre-verified directory descriptors (`/proc/self/fd`-relative), so a planted symlinked/missing-parent directory after authorization cannot redirect it; a component planned missing but found to exist at execution refuses (`substituted after authorization`);
  - dir-enumeration metadata for traversal (`ls`/`find`) still resolves entry names by path after a directory fd/`readdir` read; a substitution within the microseconds between the directory open and its first enumeration read is not isolatable through supported Node APIs, and the same `readBoundFileContent` dev/ino/nlink residual applies to controlled search content reads.
- Conservative hard-link rule (bounded, not an inode-isolation claim): every regular-file effect — direct `read`/`write`/`edit` and every controlled search content read — applies only when the target's link count is exactly 1 at the pre-approval plan capture (or pre-read entry evaluation for search) AND at the open that performs the effect. A pre-authorization hard-link alias of a secret is refused (plan capture refuses `nlink !== 1`; a hard-linked grep/find root refuses outright), an additional link added after the check refuses before the effect, and traversal evaluation withholds `nlink !== 1` regular-file entries from `ls`/`find`/`grep` output. Size/timestamp matching applies only to the direct descriptor-bound `read`/`write`/`edit` plans; grep/find/ls do not compare size/mtime, so an inode number reused by a substitute with equal dev/ino/nlink remains an explicitly bounded residual for controlled search.
- Hard-linked, bind-mounted, or duplicate-identity files are bound by dev/ino, which a copy (same bytes, different object) cannot fake — but an attacker who can bind-mount a fake object presenting the authorized dev/ino is outside the coverage class; there is no inode-isolation guarantee and none is claimed. Descriptor-relative opens require `/proc/self/fd`-style resolution (POSIX) and absolute `O_NOFOLLOW`/`O_DIRECTORY` constants: the runtime probes this once per process and every controlled direct-file effect refuses clearly when the mechanism is unavailable (e.g. Windows) rather than accept an unverified path.
- `read` tracks the builtin's line-window output; `edit` requires exact unique `oldText` matches (ambiguous matches refuse without effect); `write` preserves creation/overwrite behavior for ordinary workspace targets that are demonstrably bound.
- Shell execution (model and user routes) is blocked, not sandboxed. Network policy and OS containment belong to later Goals.
- No macOS-specific guarantee is claimed; on this Linux environment no hosted CI or macOS run was performed — package/install/rollback checks ran locally with isolated fixture directories and npm caches (`test/package-lifecycle.test.ts`).
- The canonical audit/provenance record lives in [docs/FILE-GATE-AUDIT.md](FILE-GATE-AUDIT.md) with exact sha256 hashes of the final artifacts (`docs/file-gate-hashes.json`), machine-check evidence, and the explicit boundary between executor evidence and the fresh independent review that is to follow. Owner acceptance of Goal 2 remains separate and has not occurred.
