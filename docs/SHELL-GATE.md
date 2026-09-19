# Shell Gate Contract (Goal 3)

Status: implementation contract for `20260915-sandboxed-shell-network-closed`.
Written before dependent code, under the 2026-09-17 architecture approval
([STATE.md](../STATE.md), [IMPLEMENTATION_HANDOFF.md](../IMPLEMENTATION_HANDOFF.md)).
It describes the behaviour the implementation must have. It is not evidence
that the behaviour exists: the effect evidence is recorded in
[SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md), and every guarantee below is
bounded exactly as stated in §12.

This contract supersedes the *proposal* wording of
[SANDBOX-BACKEND-PROPOSAL.md](SANDBOX-BACKEND-PROPOSAL.md) where it differs;
the differences are listed in §13 because that document is retained as
research evidence and its historical verdicts are not rewritten.

## 1. Outcome and boundaries

Model `bash` and user `!`/`!!` commands execute only inside verified OS
containment on the declared target, against a private projection of the
workspace, with the network closed. There is no unrestricted fallback and no
route that spawns a shell without containment.

Not in scope: host delete/rename effects, external (outside-workspace) file
effects, network access of any kind, other operating systems, other
architectures, a general sandbox for non-shell tools, and any change to the
accepted file-tool gates.

## 2. Declared target and support gate

| Item | Declared value |
| --- | --- |
| OS | macOS, `process.platform === "darwin"` |
| Kernel | Darwin major `27` (recorded run: `27.0.0`, macOS 27.0 build `26A428`) |
| Architecture | `arm64` |
| Entry shell | `/bin/bash --noprofile --norc` |
| Confinement | `/usr/bin/sandbox-exec` with a generated deny-default profile |
| Native helper | `native/piwarden-helper`, built from `src/sandbox/native/` |

Any other platform/architecture, any other kernel major, an unreadable or
identity-mismatched `sandbox-exec`, or a missing/unverifiable helper **blocks
every shell route** with an actionable reason. Passing the startup self-test
never widens this table; extending it requires new recorded evidence and owner
acceptance.

`/usr/bin/sandbox-exec` is validated by path, ownership (`root:wheel`), mode
(`0755`), link count (`1`) and SHA-256 identity. The recorded identity for the
declared target is
`58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`. A
mismatch blocks the shell route and requires re-verification: the containment
mechanism is pinned, not "whatever `sandbox-exec` is present".

## 3. Trust boundaries

```text
Pi host process (trusted: policy, approvals, projection, export, helper control)
  |  tool_call / user_bash          (untrusted input: command text, params)
  v
[ 1 authorize ]  bounded parse -> command risk -> effective read/mutation
                 contributions -> per-resource decisions -> approval (if ASK)
  |                                    no process exists yet
  v
[ 2 import ]     per-object classify+authorize on the ORIGINAL object,
                 open(O_NOFOLLOW) -> fstat identity -> read the SAME descriptor
                 -> copy into a private staging projection + manifest
  v
[ 3 contain ]    launcher closes every descriptor above stdio, then execs
                 sandbox-exec; child sees staging/home/tmp + toolchain + OS
                 read roots; no network; constructed environment
  v
[ 4 quiesce ]    entry exit + stdio EOF + process-group kill + emptiness probe
                 (observational quiescence, variant B); failure to establish
                 it refuses export
  v
[ 5 export ]     per-effect re-classification and re-authorization on the HOST
                 target, identity checks, sealed source bytes; existing files
                 through a verified descriptor, new files/dirs through the
                 native helper
  v
[ 6 clean ]      invocation-owned artifacts removed; report emitted
```

The child never holds policy, approvals, manifests, the original workspace, the
helper, or any descriptor to them. The helper is a mechanism: it resolves no
multi-component path, makes no policy decision, and offers no delete or rename
operation.

## 4. Shell routes and Pi integration surface

Re-verified against the installed Pi package
`@earendil-works/pi-coding-agent` `0.84.4` on Node `v26.8.1`.

| Route | Integration | Behaviour |
| --- | --- | --- |
| model `bash` | controlled tool registered over the builtin name (same pattern as the accepted `grep`/`find`/`ls` override) plus a `tool_call` gate binding | the `tool_call` handler authorizes and binds the exact command under `toolCallId`; the controlled tool's `execute` consumes that binding exactly once and runs the contained lifecycle |
| user `!` / `!!` | `user_bash` handler returns a full `{ result }` replacement | the handler authorizes, approves, runs the contained lifecycle, and returns Pi's `BashResult` shape; no operations object is exposed to Pi and no shell is spawned by Pi itself |
| model `powershell` | `tool_call` block | stays unsupported and blocked |
| any other/unknown tool | `tool_call` block | unchanged fail-closed behaviour from Goal 2 |

Both supported routes call one containment service
(`src/gate/shell-runtime.ts`) with the same parameters; there is no second
spawn path. Pi's `signal` (cancellation) and the model tool's `timeout` field
are honoured and are translated into a process-group kill (bounded below by 1 s
and above by the adapter's 600 s cap). Output is streamed through the route's
callback with pi-warden's own bound (8 MiB streamed, 4 MiB retained tail for
the tool result); the controlled tool replaces Pi's builtin `execute`, so Pi's
own truncation helpers do not run, and no full-output file is persisted.

Cancellation, timeout, non-zero exit, spawn failure and helper failure are
distinct, reported outcomes. No outcome silently degrades to an unrestricted
run.

## 5. Entry command, environment, stdio

The child process tree is started as:

```text
native/piwarden-helper launch --profile <controlDir>/profile.sbpl -- /bin/bash --noprofile --norc -c <command>
```

`launch` closes every descriptor above 2 (enumerating the process's own
descriptor table and re-verifying it, so high-numbered descriptors are covered,
not just 3–255; the evidence records inherited descriptors 3, 300 and 1024 with
plain-spawn controls), then
`exec`s `/usr/bin/sandbox-exec -f <profile> /bin/bash --noprofile --norc -c
<command>`. `sandbox-exec` is exec'd *after* the descriptor envelope is closed,
so the profile is parsed by a process that no longer holds any inherited
descriptor. Node's `spawn` is configured with exactly three stdio channels and
a new process group; no IPC channel, no extra descriptors, no `stdio[3]`.

Environment (constructed from `{}`, never inherited):

| Variable | Value |
| --- | --- |
| `PATH` | `<toolchainBin>:/usr/bin:/bin:/usr/sbin:/sbin` |
| `HOME` | `<invocation>/home` (mode 0700) |
| `TMPDIR` | `<invocation>/tmp` (mode 0700) |
| `LANG`, `LC_ALL` | `en_US.UTF-8` |
| `SHELL` | `/bin/bash` |

Nothing else is set. Provider credentials, `*_TOKEN`/`*_KEY`/`*_SECRET`,
`SSH_AUTH_SOCK`, `DYLD_*`, `NODE_OPTIONS`, `BASH_ENV`/`ENV`, proxy variables
and Pi session state are absent by construction. `cwd` is the projection root.
stdin is `/dev/null`; stdout/stderr are pipes.

## 6. Projection (import) contract

For one invocation the host builds a private tree under
`<runtimeBase>/<invocationId>/`:

```text
control/   manifests, profile (host-only, mode 0700, never a child root)
staging/   the projection: child cwd, writable, the only export source
home/      child HOME, writable, never exported
tmp/       child TMPDIR, writable, never exported
sealed/    mode 0500, read-only bound copies of sourced/script inputs
```

Per entry, in deterministic order:

1. The entry is classified and authorized as an original object *before* any
   byte is read or any name is emitted: the accepted resolver issues the
   canonical identity, the accepted classifier produces its reasons, and the
   accepted authorizer produces the effective `read` decision.
2. Excluded, never imported and never named in staging: `.git` components,
   project policy sources (`.pi-warden`), protected control-plane zones,
   everything the classifier marks `sensitive` or `secret` (including
   `.env.example` and every other template marker), non-regular files, and
   regular files whose `nlink !== 1`.
3. Regular files: `lstat` (type, link count, device) → `open(O_RDONLY |
   O_NOFOLLOW)` → `fstat` must equal the pre-open identity (device, inode,
   type, `nlink === 1`, device equals the workspace root's device) → read the
   **same** descriptor → post-read `fstat` must show the same identity, size
   and mtime → hash and copy into staging. A mismatch at any step refuses that
   entry and never falls back to a path re-open.
4. Directories: created in staging only after the directory itself is
   classified and authorized; traversal is depth- and count-bounded. A refused
   directory is not descended into.
5. Symlinks (second pass, after all regular files and directories):
   recreated with identical link text only when the text resolves, by lexical
   resolution inside the source root, to an entry that was imported in this
   same invocation and that verifies as a singly-linked regular file or a
   directory on the root device. External, absolute-escaping, chained,
   broken/ambiguous or hard-linked targets are refused.
6. Mount/topology: an entry whose device differs from the workspace root's
   device is refused. See §11 for what this does and does not establish.

Limits (any breach refuses the whole invocation before spawn): entry count,
total imported bytes, per-file bytes, directory depth, symlink count, and
elapsed import budget.

## 7. Containment profile

Generation is deterministic from trusted inputs only (`process.execPath`
toolchain root, the canonical workspace root, the invocation directories, the
trusted protected roots) and refuses if any path contains `"`, `\` or a
control character, or if any fixed classifier family cannot be rendered. The
profile is emitted as `(version 1)`, `(deny default)`, then:

* `(allow process*)`, `(sysctl-read (sysctl-name-prefix "hw.") …  "kern.")`;
* metadata literals for the ancestors of every allowed root, `(literal "/")`,
  and the executable search directories;
* data reads for `/System`, `/usr`, `/bin`, `/sbin`, `/private/etc`,
  `/private/var/select`, the canonical toolchain root, `staging/`, `home/`,
  `tmp/`, `sealed/`, and the device read set;
* writes for `staging/`, `home/`, `tmp/` and `(literal "/dev/null")`;
* last-match deny overrides: the protected control-plane zones, the project
  policy source, every classifier `sensitive`/`secret` family as a
  case-folded anchored regex (read and write pairs), and write denial for
  workspace control files (`.git` hooks/config). Duplicate registry
  (`sandbox-exec`), network and Mach rules are absent.

There is no `network*` rule, no `mach-lookup` rule, no broad allowance, and no
policy-dependent root: the profile is identical for every outcome that is
allowed to run. A `DENY` outcome never "runs with fewer roots"; it blocks the
invocation. This is deliberately stricter than the historical proposal's
"remove the root" wording and cannot widen any effect.

## 8. Bounded shell grammar

The entry string is parsed by a bounded lexer/parser with fixed limits. The
result is a structured form used for classification and for the approval
binding; **the profile, not the parser, is the enforcement boundary.**

Supported: simple commands; assignment prefixes `NAME=literal` and
`export NAME=literal`; pipelines `|`; lists `;`, `&&`, `||`; subshell groups
`( … )`; redirections `<`, `>`, `>>`, `2>`, `2>>`, `&>`, `2>&1`, `1>&2`;
comments at a word boundary; `cd` with a static literal path that stays inside
the projection (tracked for later operands); `source`/`.` and
`<shell> <literal-script>` with a static literal path inside the projection
(single bound read, sealed copy, token rewrite — §9); nested
`<shell> -c <static string>`; `env` with static assignments.

Denied without an approval path: command substitution, backticks, parameter
expansion, arithmetic expansion, globbing, brace/tilde expansion,
here-documents and here-strings, background `&`, `|&`, `;;`, `;&`, `!`
pipelines, `time`, `coproc`, `eval`, `exec`, `trap`, `alias`, `declare`,
`local`, arrays, functions, `if`/`for`/`while`/`until`/`case`/`select`, direct
execution of a script by its own path (`./tool.sh`), any dynamic script source
(`-s`, stdin, pipe, variable), malformed input, and any construct the bounded
tokenizer cannot represent exactly.

## 9. Content binding for sourced and literal script inputs

A `source`/`.` operand or a `<shell> <literal-script>` operand inside the
projection is resolved by the host **before** spawn and read exactly once
through the bound reader of §6 step 3. That single buffer supplies the
classification input, the SHA-256 recorded in the approval, and the bytes
written (mode 0400) into `sealed/`. The command text is rewritten so the child
reads the sealed path, and the rewritten text is what the approval displays and
binds. The profile grants read on `sealed/` with no write on it or its
ancestors, so the contained process cannot substitute the bytes it executes. A
bound-reader refusal, a sealed-write failure, or a hash mismatch at consumption
blocks the invocation. Dynamic sources are denied (§8).

Declared semantic deviations: `$0`/`BASH_SOURCE` name the sealed path, and
relative includes from a sealed script resolve against the sealed directory.
Nested `<shell> -c <string>` content is recursively classified, depth-limited
(8) and budget-limited. The *content* of a sourced or literal script file is
sealed, hashed and bound — it is **not** parsed or classified; the commands it
contains run inside the same containment as every other descendant, and the
approval binds the exact bytes that will be executed.

## 10. Policy, approvals and effect authority

**Policy inputs.** `readOutcome = merge(ALLOW, user.read?, project.read?)` and
`mutationOutcome = merge(ALLOW, user.write?, project.write?, user.edit?,
project.edit?)` over the same loaded, workspace-bound source set the file tools
use. The shell cannot distinguish an in-place edit from a write, so the edit
contribution constrains all shell mutations. No new configuration key,
selector, or schema version is introduced, and no outcome-dependent
capability exists.

**Decisions.** The invocation is `DENY` if the parse is unsupported, if any
statically visible resource is denied by the accepted authorizer, if the
command-risk class is a denied class, if configuration is invalid, or if
either effective outcome is `DENY`. It is `ASK` if any of those is `ASK` — in
particular **every** invocation under an `ASK` read or mutation outcome
requires approval, with no command-name or "looks read-only" exemption. It is
`ALLOW` only when everything is `ALLOW`.

**Command-risk classes.** `ordinary` (an explicit allowlist of local
build/read/inspect tools), `destructive` and `unknown` (both `ASK`, never
exempt), and the denied classes `privilege`, `system`, `credential`,
`network`, `publish`, and unsupported shell builtins (`DENY`). An `ALLOW`
outcome never waives a stronger command-risk outcome. Classes are generated
from fixed tables in the repository, never from workspace data.

The tables are a classification layer over the bounded grammar, not a complete
model of what a command line can do. Command runners that execute their
remaining arguments (`env`, `command`, `timeout`, `gtimeout`) are unwrapped
explicitly: for `env`/`command` an unrecognized flag is a refusal, for
`timeout` an unrecognized flag is skipped while a missing or unrecognized
*duration* is a refusal, and an exhausted unwrap budget is a refusal. Wrapper
spellings are matched by their normalized, case-folded form (`//usr/bin/env`,
`/usr//bin/env`, `/USR/bin/env` and `ENV` all unwrap, because the declared
target's filesystem is case-insensitive). A path execution of a *projection*
object (a relative spelling such as `./env`, `sub/env` or `tool.sh`) refuses,
and a wrapper reached by some other path (for example a toolchain-local `env`)
requires approval as an unclassified runner instead of passing as an ordinary
tool. An absolute path into the original workspace classifies by basename and
is not refused by the parser; the profile grants the workspace root nothing but
`file-read-metadata` on the root literal (it is an ancestor of the denied
project-policy path), so such a path cannot be listed, read or executed. Divergences from the real tools are deliberately
one-directional: forms the tools accept but the tables cannot model exactly
(compound `timeout` durations such as `1m30s`, `git -P`, `npm -- version`)
refuse or over-classify, never the reverse; forms that execute nothing beyond
the wrapper itself (`env`, `timeout` with no command) require approval. Dispatcher subcommands (`npm`, `git`, …) are resolved through a fixed
table, and a flag before the subcommand whose value is not recognized is a
refusal, because it could hide the subcommand; a subcommand that is not in the dispatcher's
table is a **refusal**, never the dispatcher's base class (the base class of
`git`/`npm` is ordinary, which would silently downgrade an unlisted
subcommand). Common subcommands and a bounded set of npm
aliases are listed explicitly; npm's abbreviation/prefix expansion is not
modeled, so an unlisted spelling refuses. Argument-triggered runners (`find -exec`,
`tar -x`) carry their own risk entries, and any other command whose purpose is
to run a further command but that has no explicit unwrap rule (`xargs`, `npx`,
`nice`, `nohup`, `watch`, `parallel`, …) is classified `unknown`, which requires
approval rather than passing as an ordinary local tool. Arguments that carry arbitrary code for
an interpreter (`node -e`, `python3 -c`, `awk '…'`) are *not* parsed: they
classify as their command's class, and the profile plus per-target export
re-authorization remain the boundary for everything they do.

**Approval.** One private, in-memory record per invocation: single-use,
`at most 60 s`, bound to the exact rewritten command text hash, the parsed
form, the canonical workspace and cwd, the runtime instance and session epoch,
the loaded policy source states, the generated profile hash, the constructed
environment hash, the sealed input hashes, and the static resource outcomes.
Any difference at consumption, expiry, replay, missing UI, malformed or
refused response, or a cancellation blocks execution. An approval never
satisfies a `DENY` and never widens containment, the profile, or the network.

**Export authority is separate.** Shell-execution approval authorizes one
contained run; it grants no host write. Every export effect is re-classified
and re-authorized against the current effective policy at export time, on the
host path, with a fresh `write` decision; `ASK` needs its own per-target
approval, `DENY` refuses that effect, and the run's approval can never
pre-authorize an effect.

## 11. Export contract and supported topology

After observational quiescence and a successful freeze, the frozen export
source is scanned within limits and compared with the import manifest:

| Situation | Outcome |
| --- | --- |
| file content hash unchanged since import | no effect |
| existing imported file modified | `replace`, applied through a descriptor verified against the import manifest (device, inode, `nlink === 1`, size, mtime) |
| new file | `create` through the native helper |
| new directory | `mkdir` through the native helper |
| new symlink, or a symlink whose text changed | refused (never exported) |
| imported entry missing after the run | **no host effect**; reported as ignored |
| rename inside staging | visible as delete + create; the create is exportable, the delete is ignored and reported |
| host entry already exists for a `create`/`mkdir` target | refused (`target-conflict`); never last-writer-wins |
| host target changed since import, `nlink !== 1`, non-regular, or a symlink | refused (`target-conflict` / object refusal) |
| target path excluded by §6 (`.git`, policy, control plane, sensitive/secret), or refused by authorization | refused, reported with the reason |
| more than one effect for the same path, or a type change | refused |

Every host effect goes through `native/piwarden-helper export`, which
receives the workspace root as an inherited descriptor, verifies each
component with `openat(O_NOFOLLOW|O_DIRECTORY)` against the manifest identity,
holds the verified parent descriptor through the effect, validates every
protocol field (no separators, no `..`, no NUL, exact integer parsing), and
performs exactly one of `create`, `mkdir`, `replace`. It has no delete/rename
operation and takes no policy decision. The bytes it writes are the sealed
buffer the host read once and authorized, not a re-read of staging.

The helper receives the whole declared payload before it touches any host
object (bounded at 64 MiB, which is also the per-file export bound), so a short
or failed transfer refuses the effect instead of truncating an existing file or
leaving a partial new one. A failure after the effect has begun (for example a
full disk) can still leave a partial object; that is reported, not hidden. A
`--pause` flag exists only as a deterministic interleaving hook for the
adversarial tests: it reports readiness after full verification and waits for
one release line before the effect. It is never set by the host client and
changes no confinement decision.

**Observational quiescence before export (owner-accepted contract variant B, 2026-09-18).**
No host effect is applied until the host has established all of the following,
and any failure refuses the export. This is *observational* quiescence: it
proves termination of everything the host can attribute, not of every
descendant (see "Accepted contract boundary").

1. the invocation's process group was killed and is provably empty (the
   launcher is the group and session leader, so a descendant that stays in the
   group dies with it);
2. every process the host attributed to the invocation is dead. Attribution is
   sampled through the audited native helper (one process-table sample per
   call): a process belongs to the invocation when it is in its process group,
   is a child of the entry process, or is a descendant of an already attributed
   process. Sampling happens while the entry process runs (so a descendant that
   leaves the group is still attributed while its lineage is observable) and
   after it exits; recorded processes are compared by pid *and* start time, so
   pid reuse cannot be mistaken for a survivor. An attributed survivor is killed
   and refuses the export;
3. the projection did not change while the invariant was measured. The
   projection is the only writable data root the contained process ever has, so
   a writer inside the invocation is observable as a change to it after the
   entry process exited. Two consecutive unchanged measurement windows are
   required, and **any** change observed after the entry process exited refuses
   the export. Every measurement first verifies the projection root itself
   against the recorded import identity, so a wholesale replacement of the
   measured tree object cannot pass as a stable measurement of two different
   trees. Every measurement walk is itself descriptor-bound through the same
   audited native helper: enumeration and every name lookup are single
   components resolved against held directory descriptors, so no swap of a
   path component can redirect a directory or file open between the identity
   measurement and the access — a directory swapped in the measure→open
   window is refused at access time by the `O_NOFOLLOW` open and the
   post-open identity check together, never followed, and a directory outside
   the projection can therefore never be enumerated into a snapshot. Symlink
   entries contribute only their current link text, read relative to the held
   descriptor; a link swapped for another link is caught by the next
   measurement window or the scan's manifest comparison. A partial
   measurement is never used.

Before that measurement, the host samples during execution only; it never
performs a host effect while a write could still be in flight, and the export
step re-verifies the measured tree immediately before applying any effect.

**Frozen export source (the captured-bytes invariant, the export guarantee of
this contract).** Once observational quiescence is established, the host copies the
projection to `<runtime>/<invocation>/frozen` — a sibling of `staging/`,
outside every path the profile grants — and every scan, per-target
authorization and effect reads that copy. The copy is **descriptor-bound**:
the host opens the projection root without following symlinks, verifies its
identity against the recorded import identity of the staging tree, and hands
both root descriptors to the audited native helper, which re-verifies them
before the walk. Every name lookup during the copy is a single component
resolved against a held directory descriptor of the projection, so no ancestor
swap and no file-object swap can redirect a read between the identity
measurement and the open: the object that is opened is the one the
directory-relative measurement named, or the whole copy refuses. Symlink
entries contribute only their link *text*, read through `readlinkat` from the
name's current target — a symlink swapped in during the copy is never followed,
and its captured text is later compared against the import manifest and refused
on any change. Directory descent opens with `O_NOFOLLOW` (a directory
swapped for a symlink is refused, never followed); regular files must be
singly linked and are re-checked (identity, link count, size, modification
time at nanosecond precision) after their bytes are read; permission bits of
files and directories are preserved, so an exported mode is the mode the child
set, and set-user-ID, set-group-ID and sticky bits are deliberately not
propagated to the host. If the source cannot be frozen — the
projection contains an object the copy refuses — the invocation produces **no**
host effect at all; the live projection is never used as a fallback and is
never walked, read or diffed after the refusal: the export ends with the
already-known refusal reason, and the scan runs only against a successfully
frozen source. (An object
swapped for a FIFO inside the measure→open window stalls the copy's `openat`
until the host timer kills it: fail-closed and bounded by the freeze timeout,
reported as an unfrozen source.) After the
capture, the contained process and any surviving descendant cannot write,
rename, unlink or read the frozen tree, because their writable roots were fixed
at spawn. The guarantee this buys is exactly the captured-bytes invariant: what
the host applies is byte-for-byte the captured, verified and re-authorized
content of the frozen copy, and no descendant influence *after* the capture can
reach the host. It is **not** an atomic snapshot of the whole tree and it makes
no claim about descendant influence *before or during* the capture. The copy
detects a racing write to an object it has already opened unless the writer
preserves the object's size and its exact nanosecond modification time; a write
that lands *before* the object's own measurement — or a full object
substitution that completes before that measurement — is not detectable by the
copy, whose captured bytes are then the writer's bytes; every captured object
is nevertheless compared against the import manifest at scan (content hash,
mode, type, link text), and what is applied is always re-authorized child
output. Deterministic regressions demonstrate the read-window residual plus
mid-copy file substitution, directory-to-file substitution and a
directory-to-external-symlink swap, all of which the descriptor-bound access
refuses at the moment of access. A survivor that is never attributable can
therefore still write only into the disposable projection, the session home
and the session temp; after capture it cannot change what is applied. An
attributed survivor is killed (best-effort — the refusal does not depend on
the kill succeeding) *and* its invocation's export is refused: the kill never
rescues the export.

**Supported topology.** One canonical workspace root; a subtree on one device;
APFS's default case-insensitive, normalization-insensitive name comparison;
no mount point below the root (refused, not traversed); the workspace root
itself, its ancestors and the invocation directories must be traversable and
must not contain `"`, `\` or control characters. Non-ASCII lookalikes of the
classified families are not covered by the classifier or the profile and are
outside the claim.

**Accepted contract boundary (owner decision 2026-09-18, variant B) — descendant
termination and resources are not guaranteed.** *Observational quiescence:*
macOS exposes no unprivileged mechanism that proves a descendant is gone once
it has called `setsid()` and been reparented (`kinfo_proc.kp_eproc.e_sess` is
zero on the declared build, and reparenting destroys the lineage), so such a
descendant cannot be attributed, killed or refused on. The owner has accepted
this boundary explicitly: no guarantee is made that every descendant terminates
with the invocation, and an unattributable survivor's lifetime and resource
consumption (CPU, memory, disk in its writable roots) are **not** bounded by
pi-warden. Such a survivor stays confined by the inherited profile — its only
writable paths are the disposable projection, the session home and the session
temp — and, after the capture, cannot touch the frozen export source or any
effect derived from it. Descendant influence *before or during* the capture is
not excluded and is not claimed absent; it remains child-controlled output
subject to per-target re-authorization, bounded by the scan's manifest
comparison and the capture residuals declared in the frozen-source paragraph
above. This is an accepted limitation of the
quiescence *proof* for a child-controlled descendant, not the same-user
host-writer boundary. Same-user host writers at any point
(B3), including ordinary staging tampering that is indistinguishable from
child output; two hard links created by a host writer *outside* the guarded
steps; permanent residence under the original pathname (binding is by held
descriptor/identity, so a renamed object is still bound); and mount isolation,
which remains UNVERIFIED because no unprivileged fixture can create a real
mount crossing. Device mismatch is refused when observed.

## 12. Guarantee wording

G1. Both supported shell routes either run inside the verified containment of
§7 or do not run at all; no fallback exists.

G2. The original workspace, the control plane and the projection's excluded
objects are not reachable by the contained process, by its descendants, or
through any descriptor it inherits.

G3. Networking is closed for the child and its descendants: no TCP, UDP,
bind/listen, DNS, proxy, loopback or Unix-domain/broker route is permitted,
and no approval can open one.

G4. Host effects exist only for individually re-authorized projections of
changed or created objects, through bound objects and the native helper; there
is no host delete, rename, or last-writer-wins overwrite.

G5. Host effects require established observational quiescence (variant B,
accepted 2026-09-18): no effect is applied while a process-group member or an
attributed invocation process is alive, or while the projection is still
changing after the entry process exited, and the source of every effect is a
frozen copy outside the containment's writable authority. The guarantee is the
captured-bytes invariant: every applied effect consists exactly of the
captured, verified, re-authorized content of that frozen copy — its payload
bytes and its captured permission bits — and no descendant influence after the
capture reaches the host. It is not a claim of proven
termination of every descendant, of an atomic tree snapshot, or of absence of
descendant influence before the capture; the accepted residuals — an
unattributable survivor with unconstrained lifetime and resources, and the
pre-capture write and substitution windows that §11 declares (a write racing
an already-opened object is detectable unless it preserves the size and exact
modification time; anything landing before the object's measurement is bounded
only by the scan's manifest comparison and per-target re-authorization) — are
declared in §11.

G6. Every guarantee above is bounded by §11 "Accepted contract boundary", by
the declared target of §2, and by the fact that only the effects listed in §11
are covered: arbitrary descendant programs are not parsed, their effects are
bounded only by the profile.

## 13. Differences from the historical proposal (recorded, not rewritten)

1. The child sees a **projection**, not the original workspace; the profile
   therefore has no workspace root at all.
2. `DENY` blocks the invocation instead of running with fewer roots (§7).
3. Existing files are replaced through the **native helper** with a verified
   per-component chain, not by a JS path open.
4. The runtime directory lives outside the workspace (system temporary
   directory), not under `<workspace>/.piwarden-runtime`.
5. The descriptor envelope is closed by the launcher to the process
   descriptor limit, not to 255.
6. `sandbox-exec` identity is pinned by SHA-256 in addition to the proposal's
   path/ownership checks.
