# Sandbox Backend and Guarantee Proposal (Goal 3)

Status: **proposal revision 3 only; not approved, not implemented.** Prepared under
task ID `20260915-sandboxed-shell-network-closed` as the mandatory
backend/guarantee checkpoint of [IMPLEMENTATION_HANDOFF.md](../IMPLEMENTATION_HANDOFF.md).
Goal 2 is accepted and Goal 3 is selected for proposal preparation only
([STATE.md](../STATE.md)). Revision 2 responded to the first architectural
review verdict **REVISE** (response mapping in section 13.1). Revision 3
responds to the second architectural review verdict **REVISE**, focused on B4,
classifier coverage, `mutationOutcome=ASK`, decision-input content binding, and
B5; the response mapping is in section 13.5, and the blocker split is in 13.6.
All revision-2 evidence is preserved unchanged.

This revision changed only this document. No accepted implementation, test,
configuration, STATE, ROADMAP, or handoff byte was modified; no runtime
dependency, code, commit, or push was produced. The revision-3 probe (E10) used
transient scripts and synthetic fixtures under one workspace-local directory,
removed afterward; the accepted pure policy modules were called read-only and no
real credential, keychain, Pi profile, or host setting was read, copied, mounted,
or changed.

Every item below is labeled as **verified evidence** (observed during
preparation with primary sources or bounded synthetic probes), **proposed**
(requires maintainer approval and implementation), or **UNVERIFIED** (no
target-platform evidence exists; the related guarantee must not be claimed).
Section 4 separates the profiles that were actually exercised from the
production profile that is only proposed.

## 1. Authority, environment, and method

Authority: the Goal 3 scope and acceptance criteria in [ROADMAP.md](../ROADMAP.md)
and [IMPLEMENTATION_HANDOFF.md](../IMPLEMENTATION_HANDOFF.md); trust zones in
[ARCHITECTURE.md](../ARCHITECTURE.md) sections 7-10; shell, network, credential,
sandbox, and macOS assumptions in [THREAT_MODEL.md](../THREAT_MODEL.md); the
security invariants in [AGENTS.md](../AGENTS.md).

Method: inspect the installed upstream Pi package and the pinned candidate
package source; read the accepted policy, gate, configuration, and approval
code; then run bounded synthetic probes with `sandbox-exec` in one temporary
probe directory. No accepted code was imported at runtime except the existing
pure policy modules, which were called read-only from a transient script.

Verified preparation environment:

| Item | Value |
| --- | --- |
| macOS | 27.0, build 26A428, arm64 (Apple Silicon) |
| Node.js | v26.8.1 (`/Users/2am./.hermes/node/bin/node`) |
| npm | 11.19.0 |
| Pi coding agent | `@earendil-works/pi-coding-agent` 0.84.4 (installed peer) |
| Candidate inspected | `@anthropic-ai/sandbox-runtime` 0.0.76, npm pack, source read |
| `sandbox-exec` | `/usr/bin/sandbox-exec`, 135136 bytes, mtime 2026-09-03 13:34, DEPRECATED in `man sandbox-exec` |
| Snapshot check | HEAD `664871d`; STATE `fe799443acce89fba306187ec762f44cb623d1aa292abe064ee1f5dc1424f96a`, ROADMAP `27cbb4d3092f82cfec78e56248798089a163f887ee3f925a3ed86bc91493969c`, manifest `7aa0e786815118eb45b99d4ce20770aedaaee70470cf88d1970842924a9b0e96`, manifest test `83d89f7a5ef5a2775fe3357a2fdfdcf9d2d8726c2423289a4502418535f12a03` all matched; `npm run test:manifest` PASS |
| Probe hygiene | transient scripts and synthetic fixtures under one workspace-local directory, removed afterward; accepted implementation bytes unchanged; sandboxed probes had no network access (host-side controls used loopback and one external DNS lookup only to prove the probes work) |

## 2. Verified Pi integration surface (0.84.4)

Verified against the installed package (metadata, `dist/index.d.ts`,
`dist/core/tools/bash.d.ts`, `docs/extensions.md`, `docs/security.md`,
`docs/containerization.md`, and shipped examples).

- **Pi has no built-in sandbox.** `docs/security.md` states extensions and
  tools run with the permissions of the `pi` process. Extension hooks are
  authorization interception points, not OS isolation.
- **Model `bash`**: overridable through `pi.registerTool()` with a same-name
  definition, the same pattern already used for `read`/`write`/`edit`/`grep`/
  `find`/`ls` in `src/gate/runtime.ts`. `createBashToolDefinition(cwd, options)`
  accepts `operations`, a `BashOperations` object whose `exec(command, cwd,
  { onData, signal, timeout, env })` returns `{ exitCode }`
  (`dist/core/tools/bash.d.ts:23-39,57-85`). `exposeSessionEnvironment` and
  `spawnHook` are available; `PI_*` session metadata is exposed by default and
  must be disabled for our constructed environment.
- **User `!` / `!!`**: `pi.on("user_bash")` may return `{ operations }` to
  route the command through a custom backend, or `{ result }` to replace it
  (`docs/extensions.md` "user_bash"). `event.excludeFromContext` distinguishes
  `!!`. `createLocalBashOperations()` provides Pi's local backend and would be
  an unrestricted fallback, so it must not be used.
- **`tool_call`**: fires before execution, mutable `event.input`, can block.
  Pi does not re-validate mutations; the mutation guarantee is what Goal 2
  already relies on. `pi.getAllTools()` supplies ownership observations.
- **Current blocked state**: `src/gate/runtime.ts:177-184` replaces user shell
  execution with a blocked result and `src/gate/runtime.ts:207-209` blocks
  model `bash`/`powershell` through `src/policy/operations.ts:35,63-65`.
  `docs/FILE-GATE.md` records the same integration facts and blocks all shell
  routes until Goal 3.
- **Caution from the shipped example**: Pi's `examples/extensions/sandbox/`
  (which uses Anthropic Sandbox Runtime) falls back to unsandboxed execution
  when its sandbox is disabled or uninitialized (lines 218-220, 229-232). That
  behavior directly violates our invariant 9 and must not be copied.

**Proposed Goal 3 routes:**

| Entry point | Proposed handling |
| --- | --- |
| model `bash` | same-name controlled tool; policy classification, optional scoped approval, contained `BashOperations`; ownership verified like existing controlled tools |
| user `!` / `!!` | `user_bash` returns contained `operations` when the sandbox self-test passed; returns a blocked `result` otherwise; never `undefined` |
| `powershell`, other shell dialects | remain blocked; not integrated in this Goal |
| unknown/foreign tool owning `bash` | fail closed, as for the existing controlled tools |

## 3. Candidate comparison

### 3.1 Option A — Anthropic Sandbox Runtime (`@anthropic-ai/sandbox-runtime` 0.0.76)

Verified mechanism: `sandbox-exec` with a generated Seatbelt profile on macOS,
`bubblewrap` on Linux, proxies plus MITM CA for network allowlisting, and a
Windows alpha helper. The profile applies to the whole process tree.

Verified findings relevant to this Goal (source references are to the packed
`dist/` of 0.0.76):

1. **No strict closed-network mode.** With no `network` key the generated
   profile emits `(allow network*)` (`dist/sandbox/macos-sandbox-utils.js:768-770`).
   With `allowedDomains: []` it still starts host HTTP/SOCKS proxies and allows
   the child to reach those loopback ports (`:820-834`), because the proxy is
   designed to allow later `updateConfig()` changes. A separate "deny all
   network with no proxy" configuration does not exist; on macOS the closed
   state is "no permitted destinations through an always-on proxy channel".
2. **Default profile always allows security-related Mach services**, including
   `com.apple.securityd.xpc` and `com.apple.SecurityServer`
   (`dist/sandbox/macos-sandbox-utils.js:626,748`). Those are the brokered
   Keychain route; they cannot be removed through configuration. The package's
   own weaker-isolation flag additionally re-opens `com.apple.trustd.agent`.
3. **Default write paths are always unioned in**, including `~/.npm/_logs` and
   `/tmp/claude` (`dist/sandbox/sandbox-utils.js:380-395` with
   `dist/sandbox/sandbox-manager.js:985,1225`). A home-directory write
   allowance cannot be removed by configuration.
4. **Default read model is allow-all** unless `denyRead` is configured;
   restrictions are deny-overrides over `(allow file-read*)`
   (`dist/sandbox/macos-sandbox-utils.js:488-510`).
5. **Empty-config short circuit**: when no restriction category is populated,
   `wrapWithSandbox()` returns the command unwrapped rather than failing closed
   (`dist/sandbox/macos-sandbox-utils.js:914-919`). Our adapter would always
   populate restrictions, but the library default is not fail-closed.
6. **Dependency surface**: 4 direct dependencies (`zod`, `commander`,
   `node-forge`, `@pondwader/socks5-server`), ~8.6 MB unpacked (includes the
   Windows helper), credential-masking, MITM, proxy, and violation-log code.
   macOS also needs `ripgrep` on `PATH` for deny-path search. Version churn:
   Pi's shipped example pins 0.0.26; current is 0.0.76 (published 2026-09-10),
   under the `anthropic-experimental` organization.
7. **Strengths**: maintained by Anthropic, used by Claude Code; mandatory
   write protections for dangerous paths such as `.git/hooks`, shell rc files
   and `.mcp.json` (`dist/sandbox/sandbox-config.js` schema text); Seatbelt
   violation monitoring; one backend for macOS and Linux later.

Assessment: a capable general sandbox, but not suitable as the Goal 3 backend
under the closed-network and secret-hard-denial constraints above without
accepting a host proxy channel, a Keychain-capable Mach allowlist, and a home
write path. It remains a candidate for Goal 4 allowlisting if the owner prefers
third-party mediation. It shares the section 10.5 limitation: it emits path
rules on the same primitive, so it cannot enforce inode/link-count identity
either.

### 3.2 Option B — In-repo minimal Seatbelt adapter (`sandbox-exec`)

Proposed mechanism: the adapter generates a small Seatbelt profile per
workspace/session from trusted inputs and runs
`/usr/bin/sandbox-exec -f <profile> /bin/bash --noprofile --norc -c <command>`
with a constructed environment. Seatbelt confinement is inherited by all
descendants and cannot be expanded by nested sandboxing. No runtime dependency
and no host proxy are added; `sandbox-exec` is part of macOS.

The specific profiles that were actually exercised, their exact text, and the
scope of each result are in section 4. The production profile is **proposed**
in section 6 and is not claimed to be verified.

Residual risks: `sandbox-exec` is marked DEPRECATED in its man page (still
present and functional on macOS 27.0); SBPL is not a formally documented public
interface; profile calibration is our responsibility. These risks are
identical in kind to Option A, which uses the same primitive. In addition, path
rules cannot express inode identity: B4 (10.5) is a backend-selection blocker,
not a residual that this option can bound.

### 3.3 Rejected or out-of-scope options

| Option | Assessment |
| --- | --- |
| Gondolin micro-VM (Pi example) | Linux micro-VM requiring QEMU; not the macOS host boundary; violates the no-VM-wrapper non-goal; rejected |
| Docker / OpenShell / whole-process VM | Non-goals; credential and lifecycle implications outside this Goal; rejected |
| macOS App Sandbox / Endpoint Security / `sandbox_init(3)` | Requires code signing/entitlements, app-container model, or special privileges; not viable for an extension host process; rejected |
| Linux `bubblewrap` | Only relevant if Linux support is added later; Goal 3 declares macOS; non-darwin remains blocked |
| Regex-only command filtering | Explicitly insufficient per [THREAT_MODEL.md](../THREAT_MODEL.md); never a security boundary |

## 4. Verified probe record

### 4.0 Probe hygiene, fixture recipe, and evidence index

All probes ran on macOS 27.0 (26A428), arm64, with `/usr/bin/sandbox-exec`
invoked as the outer program, under the workspace-local probe root

```
/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915
```

No probe read or wrote anything outside that root except: reads of system
files needed to establish the profile (for example `/etc/hosts`), reads of the
Node toolchain `/Users/2am./.hermes/node`, reads of the repository for the
workflow probe, and one synthetic Keychain created and deleted under the probe
root with the `security` CLI. Probe fixtures and scripts were removed after the
probes. The `security` probe used only fake values and an explicit temporary
keychain path; no real keychain or search list was touched.

Evidence index used throughout this document:

| ID | Probe | Supports |
| --- | --- | --- |
| E1 | verified workflow profile P-W, `npm run check` | execution, toolchain reads, no mach, no network, session-only writes |
| E2 | filesystem semantics profile P-FS and variants | write/read allow/deny, deny-override order, canonical paths, symlink, rename, hard link, `/dev/null` |
| E3 | network probes with host controls | TCP connect/bind, AF_UNIX connect/listen, external DNS |
| E4 | Mach bootstrap probe with broad/narrow/none controls | per-service mach lookup denial |
| E5 | synthetic Keychain end-to-end | brokered Keychain access denial with zero mach |
| E6 | policy-layer decision probe | current ASK/DENY/config-error semantics |
| E7 | path-character and SBPL-generation probes, regex deny | special-character hazard and deny mechanisms |
| E8 | permission-group removal and narrowing matrix | which groups the workflow actually needs |
| E9 | mount probe | non-attributable negative; no mount guarantee |
| E10 | B5 case/Unicode alias and rule-representability probes (section 4.11) | alias resolution, classifier/profile comparison, regex feature and predicate limits, hard-link gap |

### 4.1 E1 — verified workflow profile P-W (exact)

P-W is the profile that was actually run. It has **no `mach-lookup` rule at
all**, no `network*` rule, no home read root, and a write set limited to the
session directories plus `/dev/null` and `/dev/zero`. Toolchain reads are
limited to `/Users/2am./.hermes/node`; the parent `/Users/2am./.hermes` is not
readable.

Exact profile text (51 lines, reproduced from the probe file):

```text
(version 1)
(deny default)
(allow process*)
(allow sysctl-read (sysctl-name-prefix "hw.") (sysctl-name-prefix "kern."))
(allow file-read-metadata
  (literal "/")
  (literal "/System")
  (literal "/Users")
  (literal "/Users/2am.")
  (literal "/Users/2am./.hermes")
  (literal "/Users/2am./.hermes/node")
  (literal "/Users/2am./Projects")
  (literal "/Users/2am./Projects/Personal")
  (literal "/Users/2am./Projects/Personal/pi-warden")
  (literal "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915")
  (literal "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-home")
  (literal "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-tmp")
  (literal "/bin")
  (literal "/private")
  (literal "/private/var")
  (literal "/private/var/select")
  (literal "/sbin")
  (literal "/usr")
  (subpath "/System")
  (subpath "/Users/2am./.hermes/node")
  (subpath "/Users/2am./Projects/Personal/pi-warden")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-home")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-tmp")
  (subpath "/bin")
  (subpath "/private/var/select")
  (subpath "/sbin")
  (subpath "/usr")
)
(allow file-read*
  (literal "/")
  (subpath "/System")
  (subpath "/Users/2am./.hermes/node")
  (subpath "/Users/2am./Projects/Personal/pi-warden")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-home")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-tmp")
)
(allow file-write*
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-home")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-tmp")
  (literal "/dev/null")
  (literal "/dev/zero"))
(allow file-ioctl
  (literal "/dev/null")
  (literal "/dev/zero")
  (literal "/dev/random")
  (literal "/dev/urandom"))
```

Note on the paths above: the read root `/Users/2am./Projects/Personal/pi-warden`
is the probe workspace (the repository was used read-only). The session paths
are the probe's session home and temp. The metadata entries for `/bin`,
`/sbin`, `/usr`, and `/private/var/select` exist so executable lookup and
`/bin/sh` resolution work; they grant metadata only, not data reads.

Exact command (run from the repository root):

```text
/usr/bin/sandbox-exec -f \
  /Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/p0h-ancestor-metadata.sb \
  /usr/bin/env -i \
    PATH=/Users/2am./.hermes/node/bin:/usr/bin:/bin \
    HOME=/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-home \
    TMPDIR=/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-tmp \
    /Users/2am./.hermes/node/bin/npm run check
```

Exact observed result: exit 0, typecheck PASS;

```text
ℹ tests 213
ℹ pass 213
ℹ fail 0
```

The run included the `typecheck` script, all 213 registered test scenarios,
and the package-lifecycle test that performs a real `npm pack`, isolated
`npm install`, `tar` listing, and `uninstall` cycle with fixture directories,
while the repository was only readable. Result: **PASS 213/213**.

Negative controls on the same profile:

| Input | Result |
| --- | --- |
| `cat /Users/2am./.hermes/.env > /dev/null` | exit 1, `Operation not permitted` (content suppressed; parent of the toolchain is not readable) |
| `cat /Users/2am./.hermes/auth.json > /dev/null` | exit 1, `Operation not permitted` |
| `bash -c 'cat /Users/2am./.hermes/node/LICENSE > <session-tmp>/license-copy.txt'` | exit 0; 157609 bytes copied (toolchain read control, performed entirely inside the profile) |
| `bash --noprofile --norc -c 'echo x > /dev/null'` | exit 0 (`/dev/null` write allowance required; see E2) |

Note: a host-side redirection applied by the invoking shell before
`sandbox-exec` starts (for example `cat file > /dev/null` at the command
prompt) passes an inherited descriptor into the profile and behaved
differently in the probes; production always spawns the contained shell first
and lets the child open its own redirections, which is the behavior the
`/dev/null` allowance is for.

**Scope of E1.** E1 proves that the tested offline workflow passes with zero
mach allowances, zero network allowances, a read-only workspace, session-only
writes, and a toolchain read root that excludes the parent home directory. It
does not prove sufficiency for other commands, other toolchains, Keychain
denial, the user `!` route, or any other macOS version.

### 4.2 E2 — verified filesystem semantics profile P-FS (exact)

P-FS is the filesystem-semantics probe profile. It differs from production and
from P-W; it is used only to establish rule mechanics.

Exact profile text (24 lines):

```text
(version 1)
(deny default)
(allow process*)
(allow sysctl-read)
(allow file-read-metadata)
(allow file-read*
  (literal "/")
  (subpath "/System")
  (subpath "/private/etc")
  (subpath "/Users/2am./.hermes/node")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/bin")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/session-home")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/session-tmp"))
(allow file-write*
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/session-home")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/session-tmp"))
(deny file-read* (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws/denied"))
(allow file-ioctl
  (literal "/dev/null")
  (literal "/dev/zero")
  (literal "/dev/random")
  (literal "/dev/urandom"))
```

Fixtures: `fs/ws/open.txt`, `fs/ws/denied/secret.txt`, `fs/ws/.env`
(`FAKE_TOKEN=probe`), `fs/protected/secret.txt`, all created by the
unsandboxed host (working control that the paths are writable outside the
sandbox).

Exact result table (run through a transient Node helper in
`fs/bin/sandboxed-fs-ops.mjs`; the helper performed the stated Node fs
operations and printed one `RESULT` line each):

| Operation under P-FS | Observed |
| --- | --- |
| read `fs/ws/open.txt` | `OK open-data` |
| read `fs/ws/denied/secret.txt` (deny-override after allow) | `DENIED EPERM` |
| read `fs/protected/secret.txt` (outside roots) | `DENIED EPERM` |
| write `fs/ws/newfile.txt` (allowed root) | `OK wrote` |
| write `fs/protected/evil.txt` (outside roots) | `DENIED EPERM` |
| write `fs/session-tmp/ok.txt` | `OK wrote` |
| symlink `fs/ws/alias.txt -> fs/protected/secret.txt`, then read alias | `DENIED EPERM` |
| read `/private/etc/hosts` | `OK ##` |
| read `/etc/hosts` (`/etc` is a symlink to `/private/etc`) | `OK ##` |
| rename inside allowed root | `OK renamed` |
| rename `fs/protected/secret.txt` into `fs/ws` | `DENIED EPERM` |
| hard link `fs/protected/secret.txt` into `fs/ws` | `DENIED EPERM` |
| `mkdir` under `fs/protected` | `DENIED EPERM` |
| `bash -c 'echo x > fs/ws/bash-write.txt'` | inside write `OK` |
| `bash -c 'echo y > fs/protected/bash-evil.txt'` | `Operation not permitted` |
| nested `bash -c "bash -c 'echo z > fs/protected/nested-evil.txt'"` | nested write denied |
| nested `sandbox-exec -p '(version 1)(allow default)' /bin/echo` | `sandbox-exec: sandbox_apply: Operation not permitted`, exit 71 |
| `env -i FOO=bar PATH=/usr/bin:/bin HOME=fs/session-home` under profile | child saw exactly `FOO=bar`, `PATH`, `HOME` |

Rule-order control (same run, profile `pfs-order2.sb` = P-FS with the
`deny file-read*` line moved **before** the `allow file-read*` block): reading
`fs/ws/denied/secret.txt` returned `OK denied-data`, and the hard link from
`fs/ws/denied/secret.txt` into the allowed workspace returned `OK linked` plus
`read-hardlink-alias OK denied-data`. Therefore the last matching rule wins;
every deny-override must be emitted after the allow it restricts. This is the
opposite of a deny-always-wins model and is a required SBPL-generation rule.

Canonical-path control (profile `pfs-etcalias.sb` = P-FS with the read root
`/private/etc` replaced by the non-canonical `/etc`): both
`/bin/cat /etc/hosts` and `/bin/cat /private/etc/hosts` returned
`Operation not permitted` (exit 1). Rules written with non-canonical or
symlinked spellings do not match the real vnode path. **Profiles must use
`realpath()` output.**

Sensitive-name rename/alias controls:

| Profile | `read .env` | `rename .env -> notes.txt` | `read notes.txt` |
| --- | --- | --- | --- |
| P-FS with `(deny file-read* (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws/.env"))` only (`pfs-envread.sb`) | `DENIED EPERM` | `OK renamed` | `OK FAKE_TOKEN=probe` |
| P-FS with the same read deny plus `(deny file-write* (literal "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws/.env"))` (`pfs-envreadwrite.sb`) | `DENIED EPERM` | `DENIED EPERM` | `DENIED ENOENT` |
| P-FS `(allow file-write* (subpath fs/ws))` + `(deny file-write* (subpath fs/denied))`; hard link source `fs/ws/denied/secret.txt` into `fs/ws` | — | hard link `DENIED EPERM` | — |
| P-FS with `(deny file-read* (regex #"^\/Users\/2am.\/Projects\/Personal\/pi-warden\/.piwarden-probe-20260915\/fs\/ws/.*\.env$"))` and the same regex under `(deny file-write*)`; write `.env`, rename `.env`, write `notes3.txt` | — | write `DENIED EPERM`; rename `DENIED EPERM`; control write `OK` | — |

Pre-existing hard-link residual (fixture created by the unsandboxed host:
`fs/protected/preexisting-src.txt` hard-linked to
`fs/ws/preexisting-hardlink.txt`), read under P-FS: `OK
preexisting-protected-data`. A name inside an allowed root that already shares
an inode with a protected name outside is governed only by the path used;
Seatbelt cannot retroactively distinguish the inode.

`/dev/null` controls: without a `file-write*` allowance on `/dev/null`,
`bash -c 'echo x > /dev/null'` failed with `Operation not permitted`; with
`(allow file-write* (literal "/dev/null") (literal "/dev/zero"))` it succeeded
and `2>/dev/null` redirects worked. `file-ioctl` alone was not sufficient for
the open-for-write; E8 shows the workflow does not need the `file-ioctl` group.

**Scope of E2.** E2 proves rule mechanics under P-FS and its listed variants.
P-FS is more permissive than the production proposal in some dimensions
(read of `/private/etc`, a `file-ioctl` group, a whole-workspace write root,
and `(allow sysctl-read)` without narrowing). Every claim in section 10 that
cites E2 is limited to the exact rules and fixtures above. Rule order and
canonical spellings are general SBPL semantics observed under these profiles;
they are not attributed to the narrow production profile.

### 4.3 E3 — network probes with working controls

Profile: P-FS. A transient orchestrator started host-side controls, then
spawned the sandboxed client for each operation. Exact operations:
`net.connect({host:"127.0.0.1",port})`, `net.createServer().listen(0)`,
`dns.lookup(name)`, `net.connect(unixPath)`, `server.listen(unixPath)`; host
controls used the same APIs unsandboxed.

| Probe | Sandboxed | Host control |
| --- | --- | --- |
| TCP connect to host listener on `127.0.0.1:<port>` | `DENIED EPERM` | `OK` |
| TCP bind `127.0.0.1:0` | `DENIED EPERM` | not needed (client control above proves loopback works) |
| `dns.lookup("localhost")` (resolved via readable `/private/etc/hosts`) | `OK ::1` | `OK ::1` |
| `dns.lookup("example.com")` (no hosts entry) | `DENIED ENOTFOUND` | `OK 198.20.2.177` |
| AF_UNIX connect to host listener | `DENIED EPERM` | `OK` |
| AF_UNIX listen | `DENIED EPERM` | not separately controlled |
| UDP datagram to host listener (`dgram.send`) | `DENIED EPERM` at the implicit local bind (the send path never starts) | `host_udp_received probe` |

The intended production profile does **not** include `/private/etc`, so even
the `localhost`/`/etc/hosts` path is not available there; the network claim is
about egress, not about name parsing: external DNS and every socket operation
above are denied with working controls. A `dns.lookup` that is answered from a
local hosts file is not network access and must not be described as such.

**Scope of E3.** E3 covers the listed APIs in one Node process tree. It does
not cover raw sockets opened through native addons, proxies, or brokered
network services; those are covered only as far as the deny-default profile
and the Mach results in E4 extend.

### 4.4 E4 — Mach/bootstrap probes (broad, narrow, and none)

A 20-line C program (`machprobe.c`, exact source below) called
`bootstrap_look_up(bootstrap_port, name, &port)` for each service and printed
the `kern_return_t`.

```c
#include <mach/mach.h>
#include <servers/bootstrap.h>
#include <stdio.h>

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: machprobe SERVICE...\n");
    return 2;
  }
  int failures = 0;
  for (int i = 1; i < argc; i++) {
    mach_port_t sp = MACH_PORT_NULL;
    kern_return_t kr = bootstrap_look_up(bootstrap_port, argv[i], &sp);
    printf("%s kr=%d (0x%x) port=%u\n", argv[i], kr, (unsigned)kr, (unsigned)sp);
    if (kr == KERN_SUCCESS) {
      mach_port_deallocate(mach_task_self(), sp);
    } else {
      failures++;
    }
  }
  return failures == 0 ? 0 : 1;
}
```

Compiled with `clang -o machprobe machprobe.c` (Apple clang 21.0.0). The three
profiles are based on P-MACH, which is exactly the P-MX probe profile defined
in section 4.8, so the mach result is measured on the same file-access
baseline with and without the mach rule:

- **P-MACH-NONE** = P-MACH, unchanged (no `mach-lookup` rule).
- **P-MACH-BROAD** = P-MACH plus `(allow mach-lookup)` (control only).
- **P-MACH-NARROW** = P-MACH plus
  `(allow mach-lookup (global-name "com.apple.securityd.xpc") (global-name "com.apple.SecurityServer"))`.

The exact command was
`/usr/bin/sandbox-exec -f <profile> /Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/machprobe com.apple.securityd.xpc com.apple.SecurityServer com.apple.trustd.agent com.apple.DiskArbitration.diskarbitrationd com.apple.system.opendirectoryd.libinfo com.apple.cfprefsd.agent com.apple.system.libinfo.muser com.apple.distributed_notifications@1v3 com.apple.system.logger com.apple.windowserver.active`.

Service list and exact results (`kr` is the decimal `kern_return_t`;
`1100` = `BOOTSTRAP_NOT_PRIVILEGED` from
`servers/bootstrap_defs.h`; `1102` = `BOOTSTRAP_UNKNOWN_SERVICE`):

| Service | P-MACH-NONE | P-MACH-BROAD (control) | P-MACH-NARROW |
| --- | --- | --- | --- |
| `com.apple.securityd.xpc` | `1100` | `0` | `0` |
| `com.apple.SecurityServer` | `1100` | `0` | `0` |
| `com.apple.trustd.agent` | `1100` | `0` | `1100` |
| `com.apple.DiskArbitration.diskarbitrationd` | `1100` | `0` | `1100` |
| `com.apple.system.opendirectoryd.libinfo` | `1100` | `0` | `1100` |
| `com.apple.cfprefsd.agent` | `1100` | `0` | `1100` |
| `com.apple.system.libinfo.muser` | `1100` | `0` | `1100` |
| `com.apple.distributed_notifications@1v3` | `1100` | `0` | `1100` |
| `com.apple.system.logger` | `1100` | `0` | `1100` |
| `com.apple.windowserver.active` | `1100` | `0` | `1100` |

The broad profile is a **control only**: it establishes that each service
exists and that the `1100` result in P-MACH-NONE is caused by the missing
`mach-lookup` rule, not by a missing service. No result from P-MACH-BROAD is
attributed to P-MACH-NONE or to the production profile. P-MACH-NARROW shows
that per-service granularity works: with only the two security services
allowed, exactly those two succeeded and every other service still returned
`1100`. P-W itself (E1) contains no `mach-lookup` rule and passed the workflow
213/213; that does not by itself prove broker denial — E5 does.

**Scope of E4.** E4 covers bootstrap lookups for the listed names by a
non-privileged process in this OS build. It does not cover XPC endpoints that
are resolved by other mechanisms, anonymous listeners, or future service
renames.

### 4.5 E5 — synthetic Keychain end-to-end

A temporary keychain was created under the probe root with fake values and
explicit paths only, then deleted:

```text
/usr/bin/security create-keychain -p fakepass /Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/kc-synthetic/test.keychain
/usr/bin/security add-generic-password -a fakeuser -s fakeservice -w fakepassword -T /usr/bin/security /Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/kc-synthetic/test.keychain
/usr/bin/security find-generic-password -a fakeuser -s fakeservice -w /Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/kc-synthetic/test.keychain
```

(Each invocation was wrapped in
`sandbox-exec -p '(version 1)(allow default)'` to satisfy the local command
policy; the wrapper adds no restriction and does not affect the results.)

| Profile for the read | Observed |
| --- | --- |
| no-mach P-MACH-NONE | `security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.`, exit 44 |
| P-MACH-BROAD control | `fakepassword`, exit 0 |
| P-MACH-NARROW (`securityd.xpc` + `SecurityServer` only) | `fakepassword`, exit 0 |

The keychain file itself was inside a readable root in all three runs. The
difference is the broker route: with zero mach allowances, `security(1)` cannot
retrieve a fake item even though the file is readable; with the broad control
or with only the two security services, it can. `trustd.agent` was not needed
for this path.

**Verified:** bootstrap lookup denial for the enumerated services (E4) and
end-to-end `security(1)` fake-item denial when no mach-lookup rule is present
(E5).

**UNVERIFIED:** bootstrap lookup was measured only for the services in E4;
end-to-end behavior is measured only for Keychain via `security(1)` in E5.
Data-Protection Keychain APIs, authorization prompts, credential ACLs, other
brokers (`opendirectoryd`, `cfprefsd`, pasteboard, window server), and any
macOS version other than 27.0 (26A428) remain UNVERIFIED. If a supported
workflow requires any broker service, adding it is a maintainer decision with
a new probe; this proposal adds none.

### 4.6 E6 — policy-layer decisions (current implementation)

A transient script called the accepted modules directly (read-only):
`authorizeResource` from `src/gate/authorizer.ts` with
`GateServices { trustedUserConfigRoot, protectedZones }`, over a synthetic
workspace `/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/policy-probe/ws` with a project source
at `ws/.pi-warden/policy.json`, a trusted user root at `policy-probe/user`
(with `user/pi-warden/policy.json` absent), an existing workspace file, a
synthetic `.env`, and an existing external file. Exact results:

| Scenario | `decision` | `reason` |
| --- | --- | --- |
| baseline read workspace file | `ALLOW` | `WORKSPACE_READ` |
| baseline read external file | `ASK` | `EXTERNAL_READ` |
| baseline write external (missing) file | `ASK` | `EXTERNAL_WRITE` |
| baseline read `ws/.env` | `DENY` | `SECRET_RESOURCE` |
| baseline edit missing workspace file | `DENY` | `EDIT_TARGET_MISSING` |
| project `{"version":1,"operations":{"read":"DENY"}}`, read external | `DENY` | `CONFIGURATION_RESTRICTION` |
| project `read: DENY`, read workspace | `DENY` | `CONFIGURATION_RESTRICTION` |
| project `write: DENY`, write workspace | `DENY` | `CONFIGURATION_RESTRICTION` |
| project `read: ASK`, read workspace | `ASK` | `CONFIGURATION_RESTRICTION` |
| project `write: ALLOW`, write external | `ASK` | `EXTERNAL_WRITE` (an `ALLOW` contribution cannot widen the baseline) |
| project JSON `{ not json` | `DENY` | `CONFIGURATION_INVALID` |
| project `{"version":2,"operations":{"write":"ALLOW"}}` | `DENY` | `CONFIGURATION_INVALID` |
| project `{"operations":{"write":"ALLOW","delete":"ALLOW"}}` | `DENY` | `CONFIGURATION_INVALID` |
| project with an extra top-level `paths` key (path-selector attempt) | `DENY` | `CONFIGURATION_INVALID` |
| invalid user config root (`relative/root`) | `DENY` | `CONFIGURATION_INVALID` |
| missing user config root | `DENY` | `CONFIGURATION_INVALID` |
| read `../external/outside.txt` (relative traversal) | `ASK` | `EXTERNAL_READ` |
| write `../external/new-relative.txt` | `ASK` | `EXTERNAL_WRITE` |
| read `ws/alias-outside.txt` (symlink to external) | `ASK` | `EXTERNAL_READ` (canonical target decides) |
| read `ws/alias-secret.txt` (symlink to `.env`) | `DENY` | `SECRET_RESOURCE` (canonical target decides) |
| write inside a `pi-warden-agent-dir` protected zone | `DENY` | `PROTECTED_RESOURCE` |

**Scope of E6.** E6 shows the current authorization semantics only. It does
not show any OS effect, and it does not show that the shell route consumes
these decisions; that consumption is proposed in section 7 and must be
implemented and tested.

### 4.7 E7 — path characters and SBPL generation

The adapter inserts canonical paths into SBPL strings. Three hazards were
exercised with exact profiles built by a transient generator:

| Path shape | Exact rule | Observed |
| --- | --- | --- |
| space: `fs/ws/space dir` | `(subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws/space dir")` | read `OK path-char-data`; write `OK` |
| non-ASCII: `fs/ws/кириллица-ß` | `(subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws/кириллица-ß")` | read `OK path-char-data` |
| double quote: `fs/ws/bad"quote` | naive `(subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws/bad"quote")` | `sandbox-exec: unbound variable: quote" at /Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/pfs-naive-quote.sb, line 5, column 138`, exit 65 — profile generation fails |
| backslash: `fs/ws/bad\slash` | naive `(subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/ws/bad\slash")` | profile parses but the rule silently does not match the real path: read `Operation not permitted` |
| newline: `fs/ws/bad\nnewline` | naive quoted rule containing a literal newline | `sandbox-exec` accepted a multi-line string and the rule matched; no round-trip guarantee |

Consequences that must be implemented and tested:

1. Canonical paths are validated before profile generation. Paths containing
   `"`, `\`, or any C0/C1 control character (including newline, CR, tab) are
   **refused**, and refusal blocks the shell route (fail closed). No escaping
   scheme is assumed until it has its own effect tests.
2. Space and non-ASCII characters are accepted (both verified above).
3. Regex filters are usable for deny-overrides. The exact probe rules were
   `(deny file-read* (regex #"^\/Users\/2am.\/Projects\/Personal\/pi-warden\/.piwarden-probe-20260915\/fs\/ws/.*\.env$"))`
   and the same rule under `(deny file-write*)`; they blocked read, write, and
   rename of `.env` while a control write to another name succeeded. The probe
   rule escaped `/` but left `.` unescaped in the prefix (it still matched).
   Production generation must escape every regex metacharacter in the fixed
   path prefix systematically; filename patterns come from the fixed policy
   list, never from repository data.

### 4.8 E8 — permission-group removal and narrowing matrix

The matrix base profile P-MX is an intentionally broad probe profile, not the
production proposal. Its complete rule set is:

```text
(version 1)
(deny default)
(allow process*)
(allow sysctl-read)
(allow file-read-metadata)
(allow file-read* (literal "/") (subpath "/usr") (subpath "/bin") (subpath "/sbin") (subpath "/System") (subpath "/Library") (subpath "/private/etc") (subpath "/private/var/db") (subpath "/private/var/run") (subpath "/Users/2am./.hermes/node") (subpath "/Users/2am./Projects/Personal/pi-warden"))
(allow file-write* (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-home") (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/session-tmp"))
(allow file-ioctl (literal "/dev/null") (literal "/dev/zero") (literal "/dev/random") (literal "/dev/urandom"))
```

Row 1 is the P-MX baseline; rows 2-15 remove or replace exactly one group of
P-MX. Rows 16-21 were run as separate profiles because they replace a group
with a different form or add a control allowance rather than removing one;
P-W (E1) is the combination of every narrowing that passed in the rows below.

| Variant | Result |
| --- | --- |
| baseline P-MX | exit 0, 213/213 PASS |
| remove `(subpath "/Library")` | exit 0, PASS |
| remove `(subpath "/private/etc")` | exit 0, PASS |
| remove `(subpath "/private/var/db")` | exit 0, PASS |
| remove `(subpath "/private/var/run")` | exit 0, PASS |
| remove `(subpath "/sbin")` (read data) | exit 0, PASS |
| remove `(subpath "/bin")` (read data) | exit 0, PASS |
| remove `(subpath "/usr")` (read data) | exit 0, PASS |
| remove `(subpath "/System")` (read data) | exit 1: `node: OpenSSL configuration error` (`BIO_new_file:Operation not permitted`) |
| remove `(literal "/")` (read data) | signal `SIGABRT` (status null) |
| remove `(allow file-read-metadata)` | exit 1: `EPERM: operation not permitted, lstat '/Users'` |
| remove `(allow sysctl-read)` | signal `SIGABRT`; first stderr line: `[low_level_alloc.cc : 466] RAW: Check sum >= a failed: LowLevelAlloc arithmetic overflow` |
| remove `(allow process*)` | `sandbox-exec: execvp() of '/usr/bin/env' failed: Operation not permitted`, exit 71 |
| remove `(allow file-ioctl (literal "/dev/null") (literal "/dev/zero") (literal "/dev/random") (literal "/dev/urandom"))` | exit 0, PASS |
| remove toolchain read root `(subpath "/Users/2am./.hermes/node")` | exit 1: `Cannot read package config /Users/2am./.hermes/node/lib/node_modules/npm/package.json: operation not permitted` |
| P-MX plus `(allow mach-lookup)` | exit 0, PASS |
| P-MX plus narrow `securityd.xpc` + `SecurityServer` mach | exit 0, PASS |
| `sysctl-read` narrowed to `hw.` + `kern.` prefixes (P-MX with the global rule replaced) | exit 0, PASS |
| `sysctl-read` narrowed to `kern.` only | signal `SIGABRT` (Node `GetOSInformation` assertion) |
| `sysctl-read` narrowed to a 28-name exact list | signal `SIGABRT` (`LowLevelAlloc arithmetic overflow`) |
| metadata replaced by allowed-root ancestors plus exec directories (`/bin`, `/sbin`, `/usr`, `/private/var/select`), no global metadata (this is the metadata rule used by P-W) | exit 0, PASS |

The removals show which groups the tested workflow actually needs. Absence of
a failure for `/Library`, `/private/etc`, `/private/var/db`,
`/private/var/run`, `/bin` data, `/usr` data, and `file-ioctl` means this
workflow did not need them, not that no workflow needs them. The production
proposal (section 6) therefore omits them by default and requires a failing
effect test before any addition. The two mach rows confirm that adding mach
allowances is unnecessary for the workflow; they are not evidence for any
Keychain claim (E4/E5 are).

### 4.9 E9 — mount probe (negative, not attributable)

`/sbin/mount -t tmpfs tmpfs /Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915/fs/mnt` failed with `Operation not
permitted` both inside P-FS and unsandboxed, because the process is not root.
The failure cannot be attributed to Seatbelt, and no positive control (a
successful mount) can be produced without host privilege. **No mount guarantee
is claimed.** `com.apple.DiskArbitration.diskarbitrationd` lookup is denied by
P-MACH-NONE (E4); end-to-end `hdiutil attach` is UNVERIFIED.

### 4.10 Scope summary

| Conclusion | Status | Evidence |
| --- | --- | --- |
| Offline `npm run check` works with no mach, no network, read-only workspace, session-only writes | verified for this workflow | E1 |
| Deny-overrides must follow the allow they restrict (last match wins); canonical paths required | verified | E2 |
| Symlink alias to an unreadable path denied; rename/hard-link laundering blocked when read+write denied | verified with controls | E2 |
| Pre-existing hard links inside allowed roots remain readable; no evaluated option can enforce Goal 2's `nlink === 1` rule on the shell route | verified; backend-selection blocker (10.5) | E2, E10 |
| TCP egress and UDP send (denied at the implicit local bind), TCP bind, AF_UNIX denied; external DNS denied with host control | verified for the tested APIs | E3 |
| Per-service mach lookup denial; securityd/SecurityServer/trustd/diskarbitrationd etc. denied with broad control | verified | E4 |
| Synthetic Keychain via `security(1)` fails with zero mach and succeeds with a narrow securityd allowance | verified | E5 |
| Current policy semantics for ASK/DENY/config-error/secret/protected zones | verified (policy layer only) | E6 |
| SBPL special-character hazards and refusal rule | verified | E7 |
| Minimal permission groups for the tested workflow | verified | E8 |
| Mount denial by Seatbelt | UNVERIFIED | E9 |
| Case/Unicode alias resolution and classifier/profile agreement on this volume class | verified for the tested spellings | E10 |
| Regex feature limits (`(?i)` unsupported; classes/alternation/optional groups supported) | verified | E10 |
| No link-count predicate in SBPL (`nlink`, `file-link-count` unbound) | verified | E10 |
| Production profile as a whole | proposed, not verified | section 6 |
| Keychain beyond E4/E5 | UNVERIFIED | section 10.3 |

### 4.11 E10 — B5 case/Unicode aliases and rule-representability probes (revision 3)

Purpose: close B5, supply representation evidence for the classifier-coverage
matrix (6.6), and establish the hard-link finding (10.5). All probes ran on the
revision-2 environment (macOS 27.0, 26A428, arm64) under the transient root
`P=/Users/2am./Projects/Personal/pi-warden/.piwarden-probe-20260915b`, removed
after the run; every fixture used fake content only. In the rule lines below,
`P` substitutes the full probe root mechanically; no other text is elided.

Verified volume behavior (the workspace's data volume on this machine):

| Probe | Observed |
| --- | --- |
| `stat("<P>/ws/caseprobe.txt")` with fixture `CaseProbe.txt` | opens: case-insensitive lookup |
| NFD open of the NFC-created directory `café` (`cafe` + U+0301) | opens: normalization-insensitive lookup |
| Host control opening every alias spelling through `/bin/bash` | all exit 0 (fixtures reachable) |
| `ws/.env` and hard link `ws/notes.txt` | same inode, `nlink=2` on both names |

The declared target is this volume class. Case-sensitive APFS, exFAT, network
mounts, and non-APFS normalization semantics remain UNVERIFIED (B5 remainder).

Classifier call (accepted `resolveWorkspacePath` + `classifyPathResource` +
`createProtectedZone`/`protectedDenialFor`, imported read-only in one transient
process; canonical paths shown relative to `$R=<P>`):

| Spelling | Canonical result | Classification |
| --- | --- | --- |
| `.env` | `$R/ws/.env` | `secret` `env-file` |
| `.ENV` | `$R/ws/.env` | `secret` `env-file` |
| `.SSH/config` | `$R/ws/.SSH/config` | `sensitive` `ssh-directory` |
| `.ssh/config` | `$R/ws/.SSH/config` | `sensitive` `ssh-directory` |
| `ID_RSA` | `$R/ws/ID_RSA` | `secret` `ssh-private-key-name` |
| `id_rsa` | `$R/ws/ID_RSA` | `secret` `ssh-private-key-name` |
| `x.key` | `$R/ws/x.key` | `sensitive` `private-key-extension` |
| `кириллица/.env` | `$R/ws/кириллица/.env` | `secret` `env-file` |
| `café/.env` (NFC) | `$R/ws/café/.env` | `secret` `env-file` |
| `cafe` + U+0301 `/.env` (NFD) | `$R/ws/café/.env` | `secret` `env-file` |
| `notes.txt` (hard link to `.env`, `nlink=2`) | `$R/ws/notes.txt` | **`ordinary`** (path-only classifier) |
| `plain.txt` | `$R/ws/plain.txt` | `ordinary` |
| Zone aliases `zones/agent/…`, `zones/AGENT/…`, `zones/Agent/…` (rechecked after the matrix run) | all resolve to `$R/zones/Agent/secret.txt` | `DENY/PROTECTED_RESOURCE` for each resolved canonical path |

Sandboxed name-rule probes (`sandbox-exec -f <profile> /bin/bash --noprofile
--norc <probe.sh>`; base profile: deny default, `process*`, `sysctl-read`,
metadata, read roots `/System`, `/bin`, `/sbin`, `/usr`, `P`, plus `/dev/null`
write/ioctl and a write root for the write cases; all deny rules emitted after
the allows, matching E2's last-match ordering):

| Rule set (exact deny rules) | Result |
| --- | --- |
| pA, root-prefixed case-sensitive spellings: read denies `^P/ws/(.*/)?\.env$` and `^P/ws/(.*/)?\.ssh(/.*)?$`; write deny for `\.env`; zone `(subpath "P/zones/Agent")` | `.env` DENIED; `.ENV` DENIED (read and write); `.SSH/config` and `.ssh/config` DENIED; zone via all three case spellings DENIED; `ID_RSA`/`id_rsa` and `x.key` ALLOWED (no rule in pA — control); `notes.txt` ALLOWED |
| pB, global patterns with explicit ASCII classes and alternation: `^(.*/)?\.[eE][nN][vV](\..*)?$`; `^(.*/)?\.[sS][sS][hH](/.*)?$`; `^(.*/)?[iI][dD]_[rR][sS][aA](\.[bB][aA][kK]\|\.[bB][aA][cC][kK][uU][pP]\|\.[oO][lL][dD]\|~)?$`; `^(.*/)?[^/]*\.([kK][eE][yY]\|[pP]12\|[pP][fF][xX])$`; same `\.env` rule under write deny; zone subpath | every classified spelling DENIED for read (`.env`/`.ENV` also for write); `notes.txt` ALLOWED; `plain.txt` and writes to non-read-deny families allowed as controls — pB deliberately carried only read denies for `.ssh`/`id_rsa`/key extensions and the write deny for `.env`, so those write successes are partial-rule controls, not the proposed profile (6.6 emits read+write for every family) |
| pF, engine case control: deny `^.*/MIXEDCASE\.txt$` and `^.*/\.ssh(/.*)?$`; pG, control with only `^.*/\.xssh(/.*)?$` | `MixedCase.txt` DENIED under the all-uppercase pattern; `.SSH/config` DENIED via the lowercase `.ssh` rule; `.SSH/config` ALLOWED under `.xssh` (wrong letter proves the pF denial came from the `.ssh` rule) |
| pC, inline flag: `(regex #"(?i)^P/ws/(.*/)?\.env$")` | profile rejected: `sandbox-exec: unexpected ^ operator in middle of expression`, exit 65 |
| pD/pE, link-count predicate attempts: `(require-all (subpath "P/ws/notes.txt") (nlink 2))` and `(file-link-count 2)` | profile rejected: `unbound variable: nlink` / `unbound variable: file-link-count`, exit 65 |
| in-sandbox hard-link creation under pB | `ln ws/.env ws/alias-env.txt` → `Operation not permitted` (write deny on the source name); `ln ws/plain.txt ws/alias-plain.txt` → OK (control) |

**Confirmed behavior.** On this volume class, case and NFC/NFD alias spellings
resolve to the on-disk canonical path; the accepted classifier reports the
target's evidence for every tested spelling, including aliases of an on-disk
uppercase name; protected zones deny all tested case spellings after resolver
canonicalization; explicit ASCII case-class rules with alternation and optional
groups deny every tested alias spelling for read (the `.env` family also for
write); a non-matching control pattern confirms the denials are rule-caused;
the regex engine also matched `MixedCase` under an all-uppercase pattern
(observed ASCII case-insensitive matching), and the generation in 6.6
therefore uses explicit classes and does not rely on that observation;
in-sandbox hard-link creation from a denied source is refused.

**Unsupported / UNVERIFIED.** Inline `(?i)` is not expressible (parse error);
SBPL has no link-count identity predicate (both plausible spellings unbound);
filesystems other than this volume class; Unicode case folding beyond ASCII
(for example dotted-I) and normalization behavior on non-APFS; and the
pre-existing-hard-link identity class, which no name rule can address (10.5).

## 5. Recommendation

**Proposed: Option B, the in-repo minimal Seatbelt adapter**, with the
following rationale:

1. It can express the actual Goal 3 requirement: no network syscalls at all,
   no host proxy, no brokered Keychain get-out, no home write path.
2. It adds zero runtime dependencies, keeping the audited surface minimal
   (invariant 13).
3. Authorization/approval stays in `src/policy/` and `src/approvals/`; the
   adapter only contains execution, matching the repository boundaries.
4. The OS primitive and its deprecation risk are the same as Option A's; the
   difference is only who authors the profile, and a minimal reviewed profile
   is smaller than the candidate's transitive surface.

Option B is **recommended but not approved**. Revisit conditions: if the owner
prefers third-party trusted containment; if a future macOS removes
`sandbox-exec`; or if Goal 4 network allowlisting makes the candidate's
proxies attractive. If Option A is chosen instead, the proposal requires
explicit compensating decisions for findings 3.1.1-3.1.5 (declared proxy
boundary, Keychain allowlist, home write path, read model, fail-closed
wrapping) and a pinned exact version.

**Backend-selection blocker (revision 3).** Option B is not approvable under
the current Goal 3 guarantee wording until B4 is resolved (10.5): neither
Option B nor Option A can enforce the accepted Goal 2 `nlink === 1`
object-identity rule on the shell route, because both emit path rules on the
same Seatbelt primitive and that language has no inode/link-count predicate
(E10). The maintainer must either explicitly narrow the claimed shell guarantee
for pre-existing hard links in writing, or authorize a mechanism class outside
the current boundaries. This is not proposed or accepted as a residual.

## 6. Proposed production profile

### 6.1 Generation rules (proposed)

1. **Base:** `(version 1)`, `(deny default)`, then `(allow process*)`.
2. **Sysctl:** `(sysctl-read (sysctl-name-prefix "hw.") (sysctl-name-prefix "kern."))`;
   every other sysctl stays denied. Evidence: E8 shows this is sufficient for
   the workflow and that a `kern.`-only or exact-name list is not.
3. **Metadata:** no global `file-read-metadata`. For every allowed read/write
   root, emit `(subpath root)` plus `(literal ancestor)` for every ancestor
   component; additionally emit metadata for executable directories used by
   `PATH` search (`/bin`, `/sbin`, `/usr`) and for the `/bin/sh` resolution
   target `/private/var/select`. Evidence: E8 (ancestor-scoped metadata passes
   213/213; the global allowance is therefore not required by this workflow).
4. **Data reads:** `(literal "/")` plus `(subpath <root>)` for `/System`, the
   canonical toolchain installation root, the canonical workspace, and the
   per-session home/temp directories. No other data reads. The exact rendered
   form is in 6.4.
5. **Writes:** `(subpath <root>)` for the canonical workspace and the
   per-session home/temp directories, plus `(literal "/dev/null")`. Evidence:
   E2 for the device write; E1 for the session set; E2 for the workspace write
   mechanics. `/dev/zero` was present in the probe profile P-W but the probes
   did not demonstrate a need for it; it is omitted from production until an
   effect test requires it.
6. **Deny-overrides:** emitted **after** all allows (last match wins, E2):
   protected control-plane zones; credential filename patterns; control files
   inside allowed roots. Every credential/secret override denies both
   `file-read*` and `file-write*` (E2: read-only denial can be bypassed by
   rename; read+write denial blocks rename and hard-link laundering).
7. **Mach and network:** no `mach-lookup` rule and no `network*` rule in
   Goal 3. Evidence: E1 (workflow passes without them), E4/E5 (broker denial
   with working controls).
8. **Canonicalization:** every path in the profile is the output of
   `realpath()` (or is a fixed OS path already canonical). Evidence: E2
   `/etc` vs `/private/etc`.
9. **Path-character refusal:** refuse and block if any canonical path contains
   `"`, `\`, or a C0/C1 control character. Evidence: E7.
10. **Profile transport:** write the profile to a mode-0600 file in a private
    directory and pass it with `sandbox-exec -f`; do not embed paths in argv.

### 6.2 Allowed groups and justification

| Group | Minimal form | Why it is needed | Provenance | Evidence |
| --- | --- | --- | --- | --- |
| process | `(allow process*)` | fork/exec of the shell and descendants; without it even the entry exec fails | adapter constant | E8 |
| sysctl | `(sysctl-read (sysctl-name-prefix "hw.") (sysctl-name-prefix "kern."))` | Node/OpenSSL abort without sysctl reads; user/system info only; `vm.*`, `net.*`, `security.*` remain denied | adapter constant | E8 |
| metadata | generated ancestor literals + allowed-root subpaths + exec-dir subpaths | path traversal, lstat, exec resolution; no global metadata | generated from allowed roots and PATH | E8 |
| root search | `(literal "/")` | root-directory search for absolute path resolution; without it the process aborts | fixed OS path | E8 |
| OS runtime read | `(subpath "/System")` | dyld shared cache and system configuration (for example OpenSSL config); without it Node aborts | fixed OS path | E8 |
| toolchain read | canonical installation root derived from `realpath(process.execPath)` | Node itself and its global `npm` package; **not** the parent home directory | trusted host process (`process.execPath`), never config/repository data | E1, E8 |
| workspace read/write | canonical workspace | the ordinary build/test workflow | trusted resolver over the Pi cwd | E1, E2 |
| session read/write | per-session private home/temp (mode 0700) | `HOME`/`TMPDIR` for tools; keeps host dotfiles out | adapter-created | E1, E2 |
| sealed script reads | per-session host-private sealed directory (mode 0700), read-only, no write on it or its ancestors | bound `source`/literal-script bytes (8.5) | adapter-created | to implement |
| device writes | `(literal "/dev/null")` | ordinary `>/dev/null` redirects fail without it | fixed OS path | E2 |
| mach | **none** | workflow does not need any broker; brokers are attack surface | — | E1, E4, E5 |
| network | **none** | Goal 3 requires closed network | — | E2, E3 |

Toolchain-root derivation (proposed): let `exe = realpath(process.execPath)`.
If `basename(dirname(exe)) === "bin"`, the candidate root is
`dirname(dirname(exe))`; the adapter grants read to that root **only if** it
contains a `lib` directory and does not equal the user home directory. If the
derivation fails, only `dirname(exe)` is granted and npm may be unavailable;
the adapter never walks upward to a home directory. For the probe machine this
yields `/Users/2am./.hermes/node` and never `/Users/2am./.hermes`. Verified:
E1 passes with the narrower root and the parent reads are denied.

### 6.3 Deny-overrides (proposed)

Emitted after all allows; membership is component-aware and canonical. The
complete classifier mapping is in 6.6; this table states the rule classes:

| Override | Read | Write | Rationale |
| --- | --- | --- | --- |
| protected control-plane zones: `pi-warden-agent-dir` (trusted `getAgentDir()`) and `pi-warden-user-config` (trusted caller root) | deny | deny | authorization state and credentials must not be reachable by the contained process (Goal 2 contract); one `(subpath <canonical root>)` pair per zone |
| every classifier `secret`/`sensitive` name family: `.env` and `.env.*` **including template names**, `.ssh` component, `id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519` with their backup suffixes, `*.pem`, `*.key`/`*.p12`/`*.pfx`, `.aws/credentials`, `.aws/sso/cache`, `.config/gcloud/*`, `.config/gh/hosts.yml`, `.kube/config`, `.docker/config.json`, `.netrc`, `.npmrc`/`.pypirc`/`.yarnrc.yml`, `.git-credentials` | deny | deny | same classification as the file gate; write denial is required to block rename laundering (E2). The template markers change the category (`env-template`) but not the outcome: the accepted classifier rates `.env.example` `sensitive`, and `sensitive` denies read/write/edit (E6). Revision 2's "non-template" exception is corrected: no `.env*` exception exists |
| control files inside the workspace (`.git/hooks/*`, `.git/config`, package-manager hook directories) | allow (read is not secret) | deny | prevents persistence through hooks |
| user configuration source `<canonical-user-config-root>/pi-warden/policy.json` | deny | deny | configuration authority is not model-writable |

Regex generation (proposed): each classifier rule is rendered from its fixed
pattern as a full-path, globally anchored regex (not prefixed by the workspace,
so ancestor and external spellings that the classifier inspects are covered),
with every ASCII letter expanded to an explicit two-character class (`[aA]`)
because the classifier folds ASCII case and on-disk names may carry any case
(E10); fixed punctuation is regex-escaped; filename and component sequences
come from the fixed policy list, never from repository data. Component families
use a trailing `(/.*)?`; basename families may use the same trailing span,
which can deny a directory's descendants more strictly than the basename-only
classifier. The required direction is that no classified resource is allowed;
stricter denial is accepted and declared (6.6). The profile is refused (fail
closed, shell route blocked) if any rule cannot be rendered exactly or if a
path fails rule 9. Evidence: E7 and E10 (deny-override order, `.env`
read/write/rename denial, case-alias denial with classes); `(?i)` is rejected by
this build and is not used (E10).

### 6.4 Rendered example (proposed, not verified)

For workspace `WS=/Users/2am./Projects/Personal/pi-warden`, session directories
`SH=$WS/.piwarden-runtime/session-demo/home`, `ST=$WS/.piwarden-runtime/session-demo/tmp`,
toolchain `TOOL=/Users/2am./.hermes/node`, the proposed production profile
renders as (deny-overrides shown with a synthetic protected zone
`ZONE=/Users/2am./.pi` and the credential patterns as an illustrative regex):

```text
(version 1)
(deny default)
(allow process*)
(allow sysctl-read (sysctl-name-prefix "hw.") (sysctl-name-prefix "kern."))
(allow file-read-metadata
  (literal "/")
  (literal "/Users")
  (literal "/Users/2am.")
  (literal "/Users/2am./.hermes")
  (literal "/Users/2am./.hermes/node")
  (literal "/Users/2am./.pi")
  (literal "/Users/2am./Projects")
  (literal "/Users/2am./Projects/Personal")
  (literal "/Users/2am./Projects/Personal/pi-warden")
  (literal "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime")
  (literal "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo")
  (literal "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo/home")
  (literal "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo/tmp")
  (literal "/bin")
  (literal "/private")
  (literal "/private/var")
  (literal "/private/var/select")
  (literal "/sbin")
  (literal "/usr")
  (subpath "/System")
  (subpath "/Users/2am./.hermes/node")
  (subpath "/Users/2am./.pi")
  (subpath "/Users/2am./Projects/Personal/pi-warden")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo/home")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo/tmp")
  (subpath "/bin")
  (subpath "/private/var/select")
  (subpath "/sbin")
  (subpath "/usr")
)
(allow file-read*
  (literal "/")
  (subpath "/System")
  (subpath "/Users/2am./.hermes/node")
  (subpath "/Users/2am./Projects/Personal/pi-warden")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo/home")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo/tmp")
)
(allow file-write*
  (subpath "/Users/2am./Projects/Personal/pi-warden")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo/home")
  (subpath "/Users/2am./Projects/Personal/pi-warden/.piwarden-runtime/session-demo/tmp")
  (literal "/dev/null"))
(deny file-read* (subpath "/Users/2am./.pi"))
(deny file-write* (subpath "/Users/2am./.pi"))
(deny file-read* (literal "/Users/2am./Projects/Personal/pi-warden/.pi-warden/policy.json"))
(deny file-write* (literal "/Users/2am./Projects/Personal/pi-warden/.pi-warden/policy.json"))
(deny file-read* (regex #"^(.*/)?\.[eE][nN][vV](\..*)?$"))
(deny file-write* (regex #"^(.*/)?\.[eE][nN][vV](\..*)?$"))
(deny file-read* (regex #"^(.*/)?[^/]*\.[pP][eE][mM](/.*)?$"))
(deny file-write* (regex #"^(.*/)?[^/]*\.[pP][eE][mM](/.*)?$"))
(deny file-write* (subpath "/Users/2am./Projects/Personal/pi-warden/.git/hooks"))
```

In the deny regex lines fixed punctuation is regex-escaped and every ASCII
letter is an explicit case class (E10); this example shows only the `.env*` and
`.pem` families and the complete generated set is defined by 6.6. The leading
`(.*/)?` lets the rule match a name at any depth including the filesystem root;
`[^/]*` is the basename span; the trailing `(/.*)?` covers descendants so that
directory entries carrying the evidence cannot expose children. The rules are
globally anchored (not workspace-prefixed) so the classifier's inspection of
full paths, including components above the workspace, is covered; resources
outside the allowed roots are denied by `(deny default)` regardless. The
literal lines use SBPL string quoting only, and a path containing `"`, `\`, or
a control character is refused before generation (rule 9).

This example is **proposed and unverified as a whole**. The parts supported by
E1/E2 are the base rules, metadata generation shape, toolchain/workspace/
session roots, `/dev/null` write, deny-override order, and regex mechanics.
E10 supports the case-class and alias behavior of the credential lines. The
protected-zone and credential patterns are illustrative of the generated set;
each row of 6.6 is subject to the approvals in section 13.2 and to
implementation effect tests.

### 6.5 Explicit exclusions

Not present in the production profile and not added silently:

- `/Users/2am./.hermes` (the parent of the Node installation) and its
  credential files (`.env`, `auth.json`, `google_client_secret.json`,
  `config.yaml`, `state.db`); only `/Users/2am./.hermes/node` is readable.
- any other home directory, `~/Library`, `~/.npm`, `~/.local`;
- `/private/etc` data reads (the workflow passed without them; even
  `/etc/hosts` is unreadable in the proposed profile);
- `/Library`, `/private/var/db`, `/private/var/run`, `/sbin` data, `/usr`
  data;
- any `mach-lookup` allowance;
- any `network*` allowance;
- write access to `/private/tmp`, `/tmp`, or system locations;
- `file-ioctl` (E8 passed without it; added only with an effect test).

### 6.6 Classifier-to-profile coverage matrix (proposed)

Every resource the accepted classifier marks `sensitive` or `secret` and every
protected zone must be denied by the profile; nothing may be silently dropped.
Match semantics are from `src/policy/resources.ts` (ASCII-only case folding;
canonical and lexical identity evaluated independently; maximum sensitivity
wins) and `src/policy/control-plane.ts` (component-prefix zone membership).
Notation: each credential-family row is emitted once under
`(deny file-read* (regex #"…"))` and once under
`(deny file-write* (regex #"…"))` (exceptions are noted in the row); every
ASCII letter is an explicit class (E10); patterns are globally anchored so
full-path evidence, including components above the workspace, is covered. "Exact" means this rule was probed
with a denial and a control (E10/E7); "construct" means the regex feature set
used by the rule was probed and the specific rule still needs its own effect
test at implementation.

| Classifier family (reason, sensitivity) | Match semantics | Rendered deny pattern | Status |
| --- | --- | --- | --- |
| environment (`env-template` sensitive, `env-file` secret) | basename `.env` or `.env.*`; ASCII fold | `^(.*/)?\.[eE][nN][vV](\..*)?$` | exact (E10 read+write; E6 policy DENY) |
| ssh-credentials (`ssh-directory` sensitive) | any path component `.ssh` | `^(.*/)?\.[sS][sS][hH](/.*)?$` | exact (E10; uppercase on-disk name and case aliases) |
| ssh-credentials (`ssh-private-key-name` secret) | basename in {id_rsa, id_dsa, id_ecdsa, id_ed25519} plus one of {.bak, .backup, .old, ~}; no chained suffixes | `^(.*/)?([iI][dD]_[rR][sS][aA]\|[iI][dD]_[dD][sS][aA]\|[iI][dD]_[eE][cC][dD][sS][aA]\|[iI][dD]_[eE][dD]25519)(\.[bB][aA][kK]\|\.[bB][aA][cC][kK][uU][pP]\|\.[oO][lL][dD]\|~)?$` | base name exact (E10); suffix alternatives construct (E10 `x.key`); per-rule test pending |
| private-key (`pem-file` sensitive) | `path.extname(basename) === ".pem"` | `^(.*/)?[^/]*\.[pP][eE][mM](/.*)?$` | construct; per-rule test pending |
| private-key (`private-key-extension`: `.key` sensitive, `.p12`/`.pfx` secret) | basename extension | `^(.*/)?[^/]*\.([kK][eE][yY]\|[pP]12\|[pP][fF][xX])(/.*)?$` | exact (E10 `x.key`; alternation and classes) |
| cloud-credentials (`aws-credentials` secret) | path ends `.aws/credentials` | `^(.*/)?\.[aA][wW][sS]/[cC][rR][eE][dD][eE][nN][tT][iI][aA][lL][sS](/.*)?$` | construct; per-rule test pending |
| cloud-credentials (`aws-sso-cache` secret) | component sequence `.aws/sso/cache` | `^(.*/)?\.[aA][wW][sS]/[sS][sS][oO]/[cC][aA][cC][hH][eE](/.*)?$` | construct; per-rule test pending |
| cloud-credentials (`gcloud-credentials` secret) | ends `.config/gcloud/` plus one of three fixed names | `^(.*/)?\.[cC][oO][nN][fF][iI][gG]/[gG][cC][lL][oO][uU][dD]/([cC][rR][eE][dD][eE][nN][tT][iI][aA][lL][sS]\.db\|[aA][cC][cC][eE][sS][sS]_[tT][oO][kK][eE][nN][sS]\.db\|[aA][pP][pP][lL][iI][cC][aA][tT][iI][oO][nN]_[dD][eE][fF][aA][uU][lL][tT]_[cC][rR][eE][dD][eE][nN][tT][iI][aA][lL][sS]\.json)(/.*)?$` | construct; per-rule test pending |
| service-credentials (`github-cli-credentials` secret) | ends `.config/gh/hosts.yml` | `^(.*/)?\.[cC][oO][nN][fF][iI][gG]/[gG][hH]/[hH][oO][sS][tT][sS]\.[yY][mM][lL](/.*)?$` | construct; per-rule test pending |
| cloud-credentials (`kubeconfig` secret) | ends `.kube/config` | `^(.*/)?\.[kK][uU][bB][eE]/[cC][oO][nN][fF][iI][gG](/.*)?$` | construct; per-rule test pending |
| service-credentials (`docker-auth` secret) | ends `.docker/config.json` | `^(.*/)?\.[dD][oO][cC][kK][eE][rR]/[cC][oO][nN][fF][iI][gG]\.[jJ][sS][oO][nN](/.*)?$` | construct; per-rule test pending |
| service-credentials (`netrc` secret) | basename `.netrc` | `^(.*/)?\.[nN][eE][tT][rR][cC](/.*)?$` | construct; per-rule test pending |
| package-auth (`package-auth-file` sensitive) | basename in {.npmrc, .pypirc, .yarnrc.yml} | `^(.*/)?\.([nN][pP][mM][rR][cC]\|[pP][yY][pP][iI][rR][cC]\|[yY][aA][rR][nN][rR][cC]\.[yY][mM][lL])(/.*)?$` | construct; per-rule test pending |
| git-credentials (`git-credential-store` secret) | basename `.git-credentials` | `^(.*/)?\.[gG][iI][tT]\-[cC][rR][eE][dD][eE][nN][tT][iI][aA][lL][sS](/.*)?$` | construct; per-rule test pending |
| protected zone `pi-warden-agent-dir` (trusted `getAgentDir()`) | at or below canonical root | `(deny file-read* (subpath "<canonical root>"))` + write pair | subpath mechanics exact (E2); alias denial (E10) |
| protected zone `pi-warden-user-config` (trusted caller root) | same | same | same |
| project policy source `<ws>/.pi-warden/policy.json` | literal canonical path | read+write `(literal …)` deny pair | config authority; E6 path; per-rule test pending |
| workspace control files `.git/hooks`, `.git/config`, package-manager hook directories | at or below canonical paths | write-only `(deny file-write* (subpath …))` | E2 order; per-rule test pending |

Generation guarantees:

- **No silent omission.** If any classifier rule (including a future added
  rule) cannot be rendered with the probed construct set, generation fails and
  the shell route stays blocked; generation never drops a rule.
- **Unrepresentable evidence is a blocker, not a residual.** Inode/link-count
  identity (B4 → 10.5) and mount/device identity (B2) have no SBPL rendering
  and are recorded as blockers, not as omissions.
- **Root classification.** If the workspace root itself classifies
  `sensitive`/`secret` (for example an ancestor component matches a component
  family), generation additionally emits a workspace `(subpath)` deny pair,
  because the classifier marks every resource below such a root.
- **Direction of coverage.** The denied set is a superset of classifier
  denials for the accepted operations; stricter denial (descendant spans,
  duplicate families) is accepted and declared; a rendering that denies less
  is a generation bug and fails closed.
- **Effect tests before acceptance.** Every row needs a positive control plus
  a denial, including one directory case per basename family, one
  ancestor/nested case per component family, and the alias corpus of E10.

## 7. How current read/write/edit restrictions constrain shell and descendants

### 7.1 Restriction sources in the accepted implementation

1. **Baseline path decisions** (`src/policy/decisions.ts`): secret and
   sensitive targets deny for read/write/edit; missing read/edit targets deny;
   ordinary workspace targets allow; ordinary external targets ask. Evidence
   E6.
2. **Configuration contributions** (`src/policy/configuration.ts`,
   `src/policy/effective.ts`): the v1 schema has exactly `version` and
   `operations` with `read`/`write`/`edit` outcomes; the strictest applicable
   outcome wins; `ALLOW` contributions cannot widen a baseline `ASK` or
   `DENY`. Evidence E6 (`write: ALLOW` external stayed `ASK`).
3. **Failure domain** (`src/policy/config-loader.ts`,
   `src/policy/effective.ts`, `src/gate/authorizer.ts`): an absent optional
   source keeps defaults, but a malformed, unknown, ambiguous, or unreadable
   source makes every decision consuming it deny
   (`CONFIGURATION_INVALID`), and an invalid loading context denies
   (`INVALID_POLICY_SOURCES`). Evidence E6.
4. **Protected control-plane zones** (`src/policy/control-plane.ts`): deny
   every read/write at or below the zone root, overriding configuration and
   workspace allowances. Evidence E6.
5. **Approvals** (`src/approvals/approvals.ts`): satisfy only a matching
   effective `ASK`; never a `DENY`; never containment. Accepted Goal 2
   contract.
6. **No path selectors in v1.** A configuration that adds a `paths` (or any
   other) key is invalid and denies; the format is not extended by this Goal.
   Evidence E6.

### 7.2 Proposed mapping contract for shell effects

For every shell invocation the adapter computes, before spawn:

1. `readOutcome = merge(ALLOW, user.read?, project.read?)`.
2. `mutationOutcome = merge(ALLOW, user.write?, project.write?, user.edit?, project.edit?)`.
   The shell cannot reliably distinguish an in-place edit from an ordinary
   write, so the edit operation's configuration contribution constrains all
   shell mutations. The edit baseline `EDIT_TARGET_MISSING` is not carried
   over: creating a new file is a write, and the write baseline already
   governs it.
3. If policy loading or any source is invalid → block every shell route with
   `CONFIGURATION_INVALID`; no approval is offered.
4. Profile capability and approval rule. The entry string can spawn arbitrary
   descendants, so neither the command name nor the bounded parse can establish
   that a given effect is absent. The rules are therefore stated per outcome
   and never per command:
   - `readOutcome === DENY` → no workspace/session data-read roots. The
     execution toolchain and OS runtime reads remain (adapter requisites, not
     policy-granted user data). No approval.
   - `readOutcome === ASK` → roots remain; **every** invocation requires a
     single-use approval; no command or parsed shape exempts it. Without
     approval the invocation does not run.
   - `readOutcome === ALLOW` → roots remain. No approval.
   - `mutationOutcome === DENY` → no workspace/session write roots; device
     writes remain. No approval.
   - `mutationOutcome === ASK` → write roots remain; **every** invocation
     requires a single-use approval. Absence of statically visible write
     operands, a known command name, or a "read-only-looking" shape never
     exempts an invocation, because descendants can write through constructs
     the bounded parser does not represent. Without approval the only
     admissible alternative would be a profile that actually excludes the
     mutation effects; this Goal does not silently substitute that different
     effect set and blocks instead. A read-only no-approval mode, if wanted, is
     a separate reviewed UX with its own tests and must be displayed as such.
   - `mutationOutcome === ALLOW` → write roots remain; no approval, because
     the effective policy already grants those exact workspace/session write
     effects and the profile excludes every other effect.
   Approval gates execution only: it never adds a root, a rule, or a path, and
   it can never widen the profile (section 9).
5. Statically visible resources in the entry command are evaluated with the
   same `authorizeResource` path used by file tools:
   - read-like operands → `read` decision;
   - mutation targets → `write` decision joined with the edit configuration
     contribution per step 2.
   A `DENY` blocks the command with its reason; approval cannot satisfy it.
   An `ASK` is covered by the invocation-level approvals of step 4 and does not
   create a second, per-resource approval path for shell. When a requested
   effect is outside the declared containment (for example an external path),
   the command is blocked as unsupported in Goal 3 because **approval never
   widens containment**. Static classification here is defense in depth: it
   never substitutes for the profile and never exempts an invocation from
   step 4.
6. Regardless of policy outcomes, the OS profile bounds the actual effects of
   the command and every descendant. Classification and approvals are gates;
   the Seatbelt profile is the enforcement boundary.

Consequences for descendants: children inherit exactly the parent's
confinement and the constructed environment; they are never re-classified, so
the profile must already bound every effect a child could attempt. A nested
shell invoked with a statically visible `-c` string is recursively classified
per section 8; a nested shell or interpreter with dynamic input is not parsed
and relies on containment. Decision inputs that are content-bound (sourced and
literal script files) follow section 8.5.

### 7.3 Denial scenarios through shell

Exact shell-level scenarios, their current policy result, and the proposed
route outcome. "OS" is the proposed containment effect; the policy results are
verified by E6, the OS effects by E1/E2/E3.

| Command (entry string) | Policy result | Proposed route outcome | OS effect |
| --- | --- | --- | --- |
| `cat .env` in the workspace | read `DENY SECRET_RESOURCE` | blocked; approval cannot satisfy | additionally denied by the credential-pattern override (E2) |
| `cat ../external/outside.txt` | read `ASK EXTERNAL_READ` | blocked as unsupported (no external read capability in Goal 3) | external read has no root; would be EPERM |
| `echo x > ../external/new.txt` | write `ASK EXTERNAL_WRITE` | blocked as unsupported | external write has no root; would be EPERM |
| `echo x > workspace/file.txt` with project `write: DENY` | `DENY CONFIGURATION_RESTRICTION` | blocked; approval cannot satisfy | write root removed anyway |
| `cat workspace/file.txt` with project `read: DENY` | `DENY CONFIGURATION_RESTRICTION` | blocked | read root removed anyway |
| `cat workspace/file.txt` with project `read: ASK` | `ASK CONFIGURATION_RESTRICTION` | single-use approval (TTL 60 s) | workspace read root present; succeeds after approval |
| `echo x > workspace/file.txt` with project `write: ALLOW` (no other config) | write baseline `ALLOW WORKSPACE_WRITE` (an `ALLOW` config cannot widen external `ASK`) | allowed | workspace write root present |
| any command with a malformed or unknown-format project config | every decision `DENY CONFIGURATION_INVALID` | all shell routes blocked before spawn | no process starts |
| `cat ~/.hermes/auth.json` | classification may be ordinary; containment does not include the home root | blocked by containment; if a classification matched, also policy-denied | EPERM (verified parent read denial in E1) |
| `cat /private/etc/hosts` | read `ASK EXTERNAL_READ` (system path is outside the workspace) | blocked as unsupported | `/private/etc` not in the proposed read set |
| `echo x > /dev/null` | write to a device path | allowed adapter requisite | succeeds only with the device write allowance (E2) |

The table shows both layers: policy blocks known-bad resources before spawn,
and the profile denies anything the classifier failed to enumerate or that a
descendant attempts later.

### 7.4 What this does not change

- No new configuration key, source, or schema version is introduced. Shell
  consumes the existing `read`/`write`/`edit` outcomes only. A future
  path-selector schema is a separate contract with its own review.
- `SANDBOX` remains an orthogonal containment requirement, not an outcome.
- Existing file-tool semantics, approvals, and regressions are preserved;
  shell is an additional consumer of the same policy core.

## 8. Shell grammar contract

### 8.1 Supported entry grammar (proposed; initial implementation)

The entry command is a single string executed as
`/bin/bash --noprofile --norc -c <string>`. The classifier supports exactly:

1. **Words:** unquoted literal words; single-quoted strings; double-quoted
   strings containing no `$` or backtick; backslash escapes outside quotes.
2. **Structure:** simple commands; pipelines `|`; sequences `;`, `&&`, `||`;
   comments beginning with `#` at a word boundary.
3. **Redirections with literal targets:** `<`, `>`, `>>`, `2>`, `2>>`, `&>`,
   and descriptor duplication `2>&1` / `1>&2`. Targets must be static literal
   words.
4. **Groups:** subshell groups `( command ; command )`, recursively classified.
5. **Assignments:** `NAME=literal` prefixes and `export NAME=literal` with
   static values.
6. **`cd`:** only with a static literal path that canonicalizes inside the
   workspace; later components are classified relative to the tracked
   directory. `cd` elsewhere or with any dynamic target is unsupported.
7. **`source` / `.`:** only with a static literal path that canonicalizes
   inside the workspace; the file is a read resource whose content is read
   once through the bound reader, classified, hashed, and sealed per 8.5, and
   recursively classified with a depth limit of 8. The token is rewritten to
   the sealed copy. A static external path or any dynamic argument is
   unsupported.
8. **Nested interpreters:** only `<shell> -c <static-string>` or
   `<shell> <literal-script> [static args]` where `<shell>` is `bash` or `sh`
   and the string or sealed script content is fully classified under this
   grammar, with the same depth limit. `env` with static assignments followed
   by a simple command is unwrapped and classified.

### 8.2 Unsupported syntax (proposed: `DENY`, initially without approval)

Any of the following makes the entry command unsupported and it is **denied**;
there is no approval path for unsupported syntax in the initial contract:

- command substitution `$(command)` and backticks;
- process substitution `<(command)`, `>(command)`;
- parameter expansion `$NAME`, `${NAME}` in any position;
- arithmetic expansion `$((expression))`;
- globbing `*`, `?`, `[pattern]`, brace expansion `{a,b}`, tilde expansion `~`;
- here-documents `<<`, here-strings `<<<`;
- `eval`, `exec`, `trap`, `alias`, `unalias`, `declare`, `local`, arrays;
- shell functions, `for`, `while`, `until`, `if`, `case`, `select`;
- background execution `&`, `coproc`, `time`, `!` pipelines;
- direct execution of a workspace script through its own path
  (`./tool.sh`, `scripts/build.sh`) or any shebang-resolved script file:
  there is no demonstrated way to bind the executed bytes without changing
  execution semantics, so this form is denied until an effect-tested design
  exists (8.5);
- any other construct the bounded tokenizer cannot represent exactly.

Widening this list later requires new effect tests and, for anything that can
invoke arbitrary code, a new approval class. Parsing is always advisory; the
OS profile remains the enforcement boundary.

### 8.3 Entry shell versus descendant programs and interpreters

- **Entry shell:** exactly the adapter-spawned
  `/bin/bash --noprofile --norc -c <string>`. `sh` and `zsh` are not entry
  shells; `powershell` and other dialects stay blocked as entries.
- **Descendants:** arbitrary executables may be spawned by the entry command.
  They are **not parsed**; their filesystem/network effects are bounded by the
  inherited profile. Statically visible path arguments of descendants are
  still classified as read resources so that known secret operands are denied
  early; this is defense in depth, not the boundary.
- **Nested shells:** `bash -c 'command'` / `sh -c 'command'` with a static
  string, and `bash <literal-script>` / `sh <literal-script>` with a sealed
  copy (8.5), are recursively classified as entry-like commands; a nested
  shell whose command comes from a pipe, a variable, `-s`, stdin, or any
  dynamic source is not parsed and is bounded only by containment.
- **Other interpreters:** `node -e`, `python -c`, and similar are treated as
  ordinary descendants (not parsed), because their languages are out of scope
  for this Goal. Their file arguments follow the preceding rule.
- **Environment:** descendants inherit only the constructed environment of
  the entry process; no repository-controlled startup file is read because
  `--noprofile --norc` is used and `BASH_ENV`/`ENV` are never set.

### 8.4 Bounded recursion

Recursive classification of nested shells and sourced scripts has a fixed
depth limit (proposed 8) and a fixed expansion budget; exceeding either limit
is unsupported and denies. No recursion is performed for non-shell
interpreters or for dynamic content.

### 8.5 Content binding for sourced scripts and decision inputs (proposed)

The decision and the approval depend on inputs beyond the entry string. If an
input can change between verification/approval and the moment the contained
process consumes it, the earlier permission must not survive. Re-checking a
path immediately before spawn is **not** accepted as a mechanism: the process
still opens the path afterwards.

| Input | Binding mechanism | Boundary of the guarantee |
| --- | --- | --- |
| entry command string | SHA-256 in the approval record plus exact argv; the entry shell is adapter-spawned | the string cannot change after spawn |
| `source` / `.` script and `<shell> <literal-script>` | one read through the bound reader (Goal 2 semantics: `O_NOFOLLOW`, dev/ino identity, `nlink === 1`, pre-approval size/timestamp), captured **before the approval dialog**; the **same buffer** is classified, hashed, and written as a sealed copy (mode 0400) in a host-private directory outside every writable root and outside protected zones; the token is rewritten to the sealed path; the approval binds the buffer hash | the contained process cannot replace the sealed file: the profile grants read on the sealed root and no write on it or any ancestor; same-user host writers remain the B3 class |
| nested `-c` strings | part of the entry string; recursively classified and hashed | as the entry string |
| policy sources (user, project) | the approval binds both loaded source states/bytes and the effective outcomes; any reload invalidates | loading is trusted host code; project data cannot mint authority (Goal 1) |
| profile | the approval binds the exact SBPL text and the self-test epoch | generation is deterministic from trusted inputs (section 6) |
| environment | the exact constructed map is hashed; the child receives that exact map | no ambient inheritance (section 11) |
| cwd / workspace | canonical roots are hashed; any change invalidates | resolution uses the trusted Pi context |
| statically extracted resource decisions | canonical paths plus `authorizeResource` outcomes are hashed | defense in depth, never the boundary (7.2 step 5) |

Rules:

1. One read, one buffer: classification, hashing, and sealing consume the same
   buffer; the original path is never re-read for the decision.
2. Sealed names are generated by trusted host code and never appear in
   user-provided text; the sealed root is created by the host with mode 0700
   outside every allowed write root, and the profile grants read on it and no
   write on it or on any ancestor.
3. The rewritten command text is what the approval displays and binds.
4. A bound-reader refusal (`nlink !== 1`, identity change, symlink, size or
   timestamp mismatch) denies the invocation; there is no fallback to the path.
5. A sealed-copy or hash mismatch at consumption blocks the invocation before
   any process starts.
6. `$0`/`BASH_SOURCE` refer to the sealed path instead of the original path;
   this semantic deviation is displayed in the approval and documented. A
   workflow that requires script-visible original paths is a new design item,
   not a reason to weaken the binding.
7. Dynamic script sources (variables, pipes, stdin, `-s`) remain unsupported
   (8.2) because their bytes cannot be captured before execution.

Limit of the guarantee: the sealed root excludes replacement by the contained
process. A same-user host process outside the sandbox can still modify files;
that is the B3 host-side class and is not claimed closed here. No path
re-check is used as a race argument. Inputs that were never content-verified
(for example `node script.js`, `python script.py`, or any executable invoked by
path) never carried a content-based permission: the approval is for the
invocation under the profile, and replacing those files does not bypass a
content check because none was made; their bytes are outside the decision and
their effects remain bounded by containment.

## 9. Approval contract (proposed)

Reuse `src/approvals/approvals.ts` with one additional shell operation record.
A shell approval is a single-use, non-transferable grant for one exact
contained invocation.

| Property | Proposed contract |
| --- | --- |
| TTL | 60 seconds from the user's confirmation; expired grants are invalid |
| Use | exactly one consumption, immediately before spawn; replay denies |
| Command binding | SHA-256 of the exact UTF-8 entry command string, plus the exact argv form `/bin/bash --noprofile --norc -c <string>` |
| Context binding | canonical cwd/workspace root; Pi session identity (session id / runtime instance) |
| Policy binding | SHA-256 of both loaded source states (user and project) and their bytes, plus the effective outcomes used |
| Profile binding | SHA-256 of the exact generated SBPL profile text and the self-test epoch |
| Significant inputs | canonical paths and decisions of every statically extracted resource; SHA-256 of every sealed source-script buffer (8.5); the constructed environment map (exact keys/values, hashed); command fingerprint |
| Invalidation | any difference in the above at consumption, a sealed-buffer or sealed-copy hash mismatch, TTL expiry, a new sandbox self-test epoch, a policy reload, a workspace/cwd change, an environment change, or a resource decision change |
| UI | show the command (with sealed paths), canonical cwd, requested resources and their policy outcomes, sealed source inputs and their hashes, profile id, TTL, and the statement that the command runs inside containment without network or external access |
| Failure modes | unavailable UI, cancelled dialog, host timeout, malformed response, refused grant, expired grant, or any replay attempt → block; no partial execution |
| Cannot do | satisfy a `DENY`; widen the filesystem profile; add a network rule; disable or weaken containment; reuse a grant after any bound input changes; substitute a read-only profile for an approval that was not given; persist across sessions or processes |
| Storage | private in-memory state only; never written to the repository, workspace, Pi session files, or any policy location |

Rationale for immutable containment: the shell effect set is not enumerable,
so an approval cannot be safely translated into additional profile rules in
this Goal. An approved command therefore runs in exactly the same profile as
an unapproved one. This is the conservative reading of "approval does not
imply sandboxing" (invariant 7) and of the Goal 2 rule that approval never
weakens containment.

## 10. Containment guarantees, residuals, and blockers

### 10.1 Proposed guarantees

Each row requires implemented code, effect tests, independent review, and
owner acceptance before it becomes a guarantee. "Probe" rows refer to section 4.

| # | Guarantee (proposed) | Mechanism | Current evidence |
| --- | --- | --- | --- |
| G1 | Model `bash`, user `!`/`!!`, and every descendant run inside verified Seatbelt confinement, or do not run | `sandbox-exec -f` per invocation; inherited confinement; nested application refused | E1 (workflow), E2 (descendant/nested) |
| G2 | Containment failure never falls back to an unrestricted process | initialization self-test; process-local ready flag; blocked result otherwise | to implement and test; current runtime already blocks all shell |
| G3 | Filesystem effects are limited to the declared workspace/session sets, with protected subpaths denied | deny-default profile; canonical-path allowlists; deny-overrides emitted last | E1, E2, E8 |
| G4 | Network is closed: no egress, binding, or AF_UNIX; broker-mediated routes are denied by the zero-mach profile | `(deny default)` with no network/mach rule; no proxy | E1, E3; E4/E5 for the enumerated brokers; other brokers UNVERIFIED (10.3) |
| G5 | Child environment is constructed, not inherited | explicit allowlist built by pi-warden | E2 (child saw exactly the constructed env) |
| G6 | Children cannot re-enter or widen confinement | Seatbelt cannot expand; nested `sandbox-exec` denied | E2 |
| G7 | Keychain/brokered services are unreachable as far as the declared boundary claims | zero mach allowances; synthetic-keychain effect test | E4, E5; scope limited per 10.3 |
| G8 | Shell classification is bounded and conservative, never the security boundary | bounded classifier plus mandatory containment | to implement; grammar in section 8 |
| G9 | An approved command cannot widen containment or satisfy a deny | immutable profile per session; single-use grants | to implement; contract in section 9 |

Explicit non-guarantees and residuals (must appear in the implementation
contract and status text):

- Not a VM/kernel boundary; a Seatbelt or kernel compromise is out of scope.
- **No object-identity guarantee.** Goal 2's `nlink === 1` rule is not
  enforceable on the shell route (10.5, B4); until the maintainer's B4 decision,
  G3 and any "file policy cannot be bypassed through shell" wording must not be
  claimed to cover pre-existing hard-link aliases. This is a backend-selection
  blocker, not an accepted residual.
- No TOCTOU-elimination claim. Seatbelt evaluates path rules at syscall time,
  but the rules are path-based. See 10.2 for the exact residual statements.
- Allowed workspace writes can still destroy workspace data; allowed reads can
  still expose readable content to a process that may compute on it.
- `sandbox-exec` deprecation: unsupported/failed initialization blocks shell
  execution rather than weakening it.
- No Linux support claim; macOS evidence cannot be supplied by the Linux CI
  job.

### 10.2 Hard link, alias, rename, ancestor swap, and mount

| Mechanism | Verified behavior | Contract/residual |
| --- | --- | --- |
| symlink alias | reading through a workspace symlink to a non-readable path is denied (`EPERM`); canonical target decides policy (`SECRET_RESOURCE` through a benign alias name) | aliases are evaluated by canonical target; symlink rules use `realpath` |
| hard-link creation | creating a hard link from a read-denied source or a write-denied source into an allowed root is denied (`EPERM`); with no deny the same link succeeds (control) | credential-path overrides must deny read **and** write; then link laundering is blocked |
| pre-existing hard link | a hard link that already exists inside an allowed root to an inode also named outside is readable (`OK`; E2, reconfirmed under the full credential deny set by E10, where the classifier also reports the alias `ordinary`) | **not a residual: backend-selection incompatibility.** Seatbelt cannot express link-count/inode identity (E10: `nlink` and `file-link-count` are unbound), and a pre-scan is not race protection; Goal 2's `nlink === 1` rule lives in the executor, which the shell route does not have. See 10.5 |
| rename inside allowed root | renaming a `file-read*`-denied file to a new name and reading it succeeds; adding `file-write*` denial blocks the rename (`EPERM`) | credential-path overrides must deny read **and** write (E2); otherwise rename launders the name |
| rename of protected into allowed | denied (`EPERM`, source-directory write is not granted) | no claim beyond the profile |
| ancestor swap / TOCTOU | not directly testable in-process; path rules bind to whatever the path names at syscall time; an out-of-sandbox process with write access to an allowed root can place a different object there | **residual**: no general TOCTOU-elimination claim. Within the sandboxed tree, the child has no write access outside its allowed roots and cannot rename/link protected names when both read and write denies are present. Host-side changes between classification and syscall are outside shell containment and remain a policy-gate residual |
| mount | `mount(2)` requires root; both sandboxed and unsandboxed probes failed `EPERM` (not attributable); no mount allowance; `diskarbitrationd` lookup denied | **UNVERIFIED / no guarantee**. No mount points are declared supported; objects reached through a mount below the workspace are classified by path only (THREAT_MODEL residual). If the maintainer requires mount protection, that is an open blocker needing a separate mechanism |
| case/Unicode aliases | classifier resolves case and NFC/NFD aliases to the on-disk path and reports the target's evidence; explicit ASCII case-class rules deny every tested alias spelling for read (the `.env` family also for write); protected-zone aliases deny; engine also matched ASCII case-insensitively (observation only) | verified for this volume class and the tested spellings (E10); explicit classes are used regardless; case-sensitive/non-APFS filesystems and Unicode case folding beyond ASCII remain UNVERIFIED (B5 remainder) |

### 10.3 Keychain and brokered services: verified versus UNVERIFIED

**Verified (E4, E5):** with zero `mach-lookup` allowances, bootstrap lookups
for `securityd.xpc`, `SecurityServer`, `trustd.agent`, `diskarbitrationd`,
`opendirectoryd.libinfo`, `cfprefsd.agent`, `system.libinfo.muser`,
`distributed_notifications@1v3`, `system.logger`, and `windowserver.active`
returned `BOOTSTRAP_NOT_PRIVILEGED`, with a broad-allowance control showing
each service exists; a synthetic Keychain item accessed through `security(1)`
was not retrievable with zero mach and was retrievable with only
`securityd.xpc` + `SecurityServer`.

**UNVERIFIED:** Data-Protection Keychain APIs; ACL/authorization prompts;
other brokers end-to-end; any macOS version other than 27.0 (26A428);
behavior after an OS update that renames services.

**Rule:** if implementation or a supported workflow requires a broker service,
the service is not added silently. The change stops for maintainer decision
with a new bounded probe and regression evidence. Startup self-test success
does not broaden this list.

### 10.4 Sandbox self-test: contract, invalidation, and platform scope

Proposed self-test at runtime initialization, before either shell route is
enabled:

1. Verify the platform allowlist, the `sandbox-exec` binary path, and that
   profile generation succeeded for the current workspace/session with
   canonical, character-validated paths.
2. Execute, in fresh unique synthetic fixtures, the production profile's
   positive and negative controls: exec works; write inside the session temp
   succeeds; write to a sibling path outside fails; read of a synthetic
   protected file fails while read of a synthetic allowed file succeeds; a
   host-side loopback listener control succeeds while the contained connect
   and bind fail; external DNS fails when the host-side control resolves;
   nested `sandbox-exec` fails.
3. Treat any failed positive control, any unexpected success, any spawn or
   `sandbox_apply` failure, and any timeout as self-test failure.

Invalidation (clear the ready flag; block both routes until a fresh self-test
passes; never fall back):

- any failed spawn of `sandbox-exec` or failed profile application at
  invocation time;
- any self-test control anomaly or a control that cannot be established;
- profile generation refusal (for example a path with a refused character) or
  a change of workspace/session roots;
- policy reload or any change to the loaded source states or their bytes;
- a new cwd/workspace for an invocation that fails generation;
- runtime restart, session shutdown, or process replacement.

Platform scope: the declared target is macOS on Apple Silicon, verified on
27.0 (26A428). Other macOS versions are outside the declared list; a passing
self-test on an undeclared version must **not** be treated as widening the
supported list. Extending the list requires maintainer approval and recorded
platform evidence (Goal 3 acceptance criterion 9).

### 10.5 Pre-existing hard-link identity: Option B/A incompatibility (B4)

The accepted Goal 2 contract refuses every regular-file effect whose link count
is not exactly 1 at plan capture and at the performing open, refuses a
hard-linked search root, and withholds `nlink !== 1` entries from traversal
([FILE-GATE.md](FILE-GATE.md)). That guarantee comes from the **executor's
object binding**, not from path classification: the classifier is path-only and
reports a hard-link alias as `ordinary` (E10).

For the shell route neither layer exists in a bindable form:

1. **No executor object binding.** The shell spawns arbitrary programs that
   open paths themselves; there is no single authorized descriptor whose
   identity the adapter can pin. The profile, not the executor, is the boundary.
2. **No predicate to express the rule.** SBPL path rules evaluate names and
   paths, not inode link counts. The attempted predicates fail to parse
   (`unbound variable: nlink`, `unbound variable: file-link-count`, E10), and
   no documented predicate exists. There is no configuration that makes a
   name's readability depend on the inode's other names.
3. **A pre-scan is not race protection.** Scanning the readable roots for
   `nlink > 1` entries before enabling or spawning a command only observes the
   tree at scan time. A host-side process (or any writer with access to the
   roots that the scan does not block) can create or remove a link after the
   scan and before or during execution, and the contained process can open the
   alias at any syscall after that. The scan therefore reduces exposure but
   cannot support a guarantee, and is not proposed as one. In-sandbox link
   creation is a different case and stays blocked: `ln` from a denied source is
   refused by the write deny (E2; reconfirmed E10).
4. **Considered and rejected in-boundary alternatives.** A copy-in workspace
   mirror could guarantee link-free reads, but write-back of files created
   inside the mirror is impossible on macOS under the accepted Goal 2
   fail-closed creation rule, and the mirror changes the accepted workflow
   semantics; it is a scope change, not a fix. Pre-open verification by the
   shell is impossible for arbitrary descendants. No other in-boundary
   mechanism was found.

Consequences:

- **Backend-selection blocker.** No option in this proposal (Option B or
  Option A, which emits path rules on the same primitive) can enforce the
  Goal 2 `nlink === 1` identity rule for the shell route. Option B must not be
  approved with a guarantee that includes it, and the bypass is **not** offered
  as an accepted residual.
- **Required maintainer decision.** Either (a) explicitly narrow the claimed
  Goal 3 shell guarantee in writing (pre-existing hard-link aliases inside the
  allowed roots are outside the claimed boundary; the file-tool guarantee is
  unchanged), or (b) authorize a mechanism class outside the current
  boundaries (for example object/inode-mediated whole-process I/O, a mount
  namespace, or a VM), each of which is currently a non-goal and requires its
  own review. Until then the shell route cannot claim "file policy cannot be
  bypassed through shell" for this class.
- **No silent wording.** Status text and the implementation contract must state
  the chosen resolution verbatim; a passing effect test for the rest of the
  profile does not convert this into a verified guarantee.

## 11. Proposed environment construction

Verified probe: a constructed environment reaches the child exactly as built
(E2); the sandbox itself does not filter or add variables.

**Proposed construction** (start from `{}`, not from `process.env`):

| Variable | Proposed value |
| --- | --- |
| `PATH` | canonical toolchain bin directory + `/usr/bin:/bin:/usr/sbin:/sbin` |
| `HOME`, `TMPDIR` | per-session private directories (mode 0700) |
| `LANG`, `LC_ALL` | stable UTF-8 locale |
| `SHELL` | `/bin/bash` |
| `TERM` | omitted for non-interactive route unless a tool requires it |
| Everything else | omitted by default; a specific operation may add a named variable only through an explicit, reviewed allowance |

Explicitly never inherited (absent by construction): provider API keys,
`*_TOKEN`/`*_KEY`/`*_SECRET` variables, `SSH_AUTH_SOCK`, `DYLD_*`,
`NODE_OPTIONS`, `BASH_ENV`/`ENV`, proxy variables, Pi session/agent state,
approval state, cloud credential configuration. Test credentials are
synthetic. Spawn uses `stdio: ["ignore", "pipe", "pipe"]`, no inherited
descriptors, no IPC channel, and a new process group for timeout/abort
termination. Provider authentication stays in the host process: the child
never receives it.

## 12. Effect-test matrix and impact

Each row requires positive and negative effects, not initialization messages.
Platform-tagged `darwin` tests run locally on macOS; the Linux CI job cannot
establish macOS guarantees.

| Acceptance criterion | Required tests (proposed) |
| --- | --- |
| 1. Offline workflow in containment | contained `npm run check` and `npm run test:manifest`; model `bash`, `!`, `!!` routes; unsupported dialects blocked; E1 serves as the preparation baseline |
| 2. Fail closed, no fallback | inject missing `sandbox-exec`, profile syntax error, refused path character, self-test negative-control failure, stale session/workspace state, malformed requests, cancellation; assert no process is spawned |
| 3. Descendants and protected targets | nested shells/subprocesses cannot write/read outside policy; fake credential files; protected Pi/approval state; symlink, rename, hard-link, ancestor-replacement attacks; per-rule profile coverage tests (6.6); case and NFC/NFD alias corpus (E10); each row of 10.2 has a regression; the pre-existing hard-link row is asserted against the maintainer's B4 decision (blocked or explicitly narrowed), never as a solved guarantee |
| 4. Environment | constructed environment asserted exactly; provider/agent/proxy/dynamic-loader variables absent; startup files and descriptors cannot bypass; synthetic credentials only |
| 5. Network closed | TCP/UDP egress, bind, DNS, loopback, AF_UNIX, proxy env absent; controls prove probes work; mach broker probe for the enumerated services with broad-allowance control in the test suite; no network approval exists in this Goal |
| 6. Classification and content binding | adversarial grammar corpus: quoting, substitutions, redirection, sourced scripts, nested interpreters, unknown forms; unsupported forms deny; parser never treated as containment; content binding (8.5): sealed-copy immutability against the contained process, one-read buffer equality, replacement-after-approval and approval-binding mismatch tests, and the documented `$0` deviation |
| 7. Separations | shell approvals bounded and non-transferable; deny cannot be approved; approvals cannot enable network or alter the profile; every invocation under an `ASK` outcome requires approval with no command-name or parse exemption; no read-only substitution for an absent approval (7.2 step 4); existing file-operation regressions preserved; TTL/expiry/replay/binding-mismatch tests |
| 8. macOS Keychain boundary | synthetic keychain with fake items and a mach-connect probe; declared boundary recorded; unavailable evidence blocks the claim (10.3) |
| 9. Review and provenance | exact artifact hashes, commands, outcomes, unsupported cases; independent review of final bytes; owner acceptance separately |

Dependency/packaging impact (proposed, Option B): no runtime dependency;
`package.json` and lockfile remain unchanged except new test scripts if
needed; new tests are tagged `darwin` and skip explicitly (never silently
pass) on other platforms; CI remains Linux-only, with macOS evidence produced
locally and recorded in the Goal audit. Compatibility assertions already
recorded for Pi 0.84.4 and Node >= 22.19.0 apply; sandbox tests must not run
on unsupported platforms and must not claim Linux support.

**If Option A is approved instead:** pin one exact
`@anthropic-ai/sandbox-runtime` version, update the lockfile, audit transitive
dependencies and the required `ripgrep` binary, document every enabled
capability, and add compatibility assertions for the exact version. The Pi
example's fallback behavior must not be copied.

## 13. Response to the architectural review, open approvals, and authorization boundary

### 13.1 Review response table

The first architectural review returned **REVISE** with six groups of remarks.
Revision 2 implemented each change in this document; the table maps remarks to
changes and evidence, and records open blockers instead of weakening a
requirement.

| Review remark | Change in this revision | Evidence or open blocker |
| --- | --- | --- |
| 1. Define how current read/write/edit restrictions (including `ASK`, `DENY`, and configuration load error) constrain shell and descendants; show read/write denial scenarios through shell; do not silently extend configuration format v1 | New section 7: restriction sources (7.1), shell effect mapping with `readOutcome`/`mutationOutcome`, invalid-configuration blocking, capability removal, and approval semantics (7.2), explicit shell denial scenarios (7.3), and the no-v1-extension statement (7.4) | E6 records every policy outcome used; E1/E2 record the OS-side block scenarios; the path-selector attempt is rejected as `CONFIGURATION_INVALID` (E6) |
| 2. Separate actually exercised profiles from the proposed profile; give reproducible profiles/commands without ellipses, control results, and the exact scope of each conclusion; do not attribute broad-mach-lookup probes to a narrow profile | New section 4 with E1-E9: exact profile texts, exact commands, exact observed results, per-probe scope statements; P-MACH-BROAD is explicitly a control only; section 6 presents the production profile as proposed with a rendered example | E1-E9; section 4.10 scope table |
| 3. Justify every read/process/Mach/metadata permission group; do not allow `~/.hermes` or other parent directories wholesale for Node; list minimal required paths, their provenance, and protection of SBPL generation from special characters | Section 6.2 justification and provenance table with the toolchain derivation rule; section 6.5 explicit exclusions; section 4.7 character hazards and refusal rule; section 6.1 generation rules | E1/E8 show the narrow toolchain root suffices and the parent reads are denied; E7 shows quote/backslash/newline hazards and space/non-ASCII support |
| 4. Align hard-link, alias, rename/ancestor-swap, and mount limitations with current guarantees; remove the general TOCTOU-elimination claim; present a concrete blocker instead of weakening a guarantee | Section 10.2 replaces the former TOCTOU wording with exact residual statements; rename and hard-link laundering requirements (read+write deny); mount is UNVERIFIED with no guarantee | E2 (symlink, rename, hard link, pre-existing hard link), E7 (regex deny), E9 (non-attributable mount negative); revision 3 upgraded the pre-existing hard-link row from residual to backend blocker (10.5) |
| 5. Propose a complete conservative contract: exact supported grammar with unsupported syntax initially denied; entry shell separated from descendant programs/interpreters; single-use approval with a proposed 60-second TTL; binding to exact executable request, cwd, session, policy/profile, and significant inputs with invalidation on change; self-test invalidation conditions | New section 8 (grammar, unsupported forms, entry versus descendants, depth limit), section 9 (single-use approval, 60 s TTL, binding list, invalidation, non-widening containment), section 10.4 (self-test contract and invalidation) | No probe can substitute for these implementation contracts; they become required tests in section 12 rows 2, 6, 7, and the self-test items |
| 6. Separate verified from UNVERIFIED for Keychain/brokered services; if the required boundary cannot be provided, stop and report instead of weakening it; a startup self-test alone does not widen the supported OS list | Section 10.3 verified/UNVERIFIED split with the rule that adding a broker service stops for maintainer decision; section 10.4 states the platform allowlist and that self-test success is a gate, not a support extension | E4 (per-service lookups with broad control), E5 (synthetic keychain end-to-end); UNVERIFIED items are listed as blockers, not as claims |

Open blockers (B1-B6 recorded by revision 2; B4 and B5 updated and B7-B8 added
by revision 3; none resolved by weakening claims):

- **B1 — Keychain beyond E4/E5 is UNVERIFIED.** Data-Protection Keychain
  APIs, prompts/ACLs, other brokers, and other OS builds have no evidence.
  Goal 3 acceptance criterion 8 cannot be claimed until the implementation
  regression suite supplies it. If a supported workflow needs a broker
  service, work stops for a maintainer decision.
- **B2 — Mount protection is UNVERIFIED.** No mount guarantee is claimed; a
  mount point below the workspace remains a path-identity residual. If the
  maintainer requires a mount guarantee, a separate mechanism and probe are
  required.
- **B3 — Host-side path changes between classification and syscall are not
  prevented by path-based rules.** This is a declared residual for the policy
  gate; no general TOCTOU-elimination claim is made. Protecting against an
  out-of-sandbox process that moves objects into an allowed root requires a
  descriptor/inode-based mechanism that this Goal does not select.
- **B4 — Pre-existing hard links are readable and writable through an allowed
  name; no option in this proposal can enforce Goal 2's `nlink === 1` identity
  rule on the shell route (10.5; E2/E10).** Upgraded from residual to
  **backend-selection blocker** by the second review; a pre-scan is not race
  protection and this is not offered as an accepted residual. Requires a
  maintainer decision: explicitly narrow the claimed guarantee, or authorize a
  mechanism class outside the current boundaries.
- **B5 — Case/Unicode aliases: partially resolved by E10.** On the declared
  APFS volume class, alias spellings resolve to the on-disk path; the
  classifier reports the target's evidence; explicit ASCII case-class rules
  with alternation/optional groups deny the tested read spellings (the `.env`
  family also for write); protected-zone aliases deny; `(?i)` is unsupported,
  and generation uses explicit classes. Remaining UNVERIFIED: case-sensitive
  and non-APFS filesystems, Unicode case folding beyond ASCII, and OS builds
  whose regex engine differs. Per-rule and alias-corpus effect tests (6.6,
  section 12 rows 3 and 6) are required before acceptance.
- **B6 — The self-test cannot prove broker denial without a helper.** The
  implementation must include a synthetic broker regression (as in E4/E5) in
  the test suite; if it cannot run hermetically, criterion 5/8 evidence is
  incomplete and acceptance is blocked.
- **B7 — Decision-input content binding must be implemented and tested
  (8.5).** Without it, replacing a sourced script's bytes after
  verification/approval would retain the old permission. Required evidence:
  one-read buffer equality, sealed-copy immutability against the contained
  process, hash-mismatch refusal at consumption, and the documented `$0`
  deviation. A path re-check is not accepted as the mechanism.
- **B8 — Per-rule profile coverage must be effect-tested.** Every row of 6.6
  needs a positive control and a denial, including directory basename cases,
  nested/ancestor component cases, and the E10 alias corpus; generation must
  fail closed (shell blocked) for any rule it cannot render. Until then the
  matrix is proposed, not verified.

### 13.2 Open questions and decisions requiring approval

1. **Backend**: approve Option B (in-repo Seatbelt adapter, recommended) or
   Option A (srt, with the compensating decisions listed in section 5).
   Approval is conditional on the B4 decision (item 11); under the current
   guarantee wording neither option is approvable.
2. **Declared macOS target**: propose current macOS on Apple Silicon, verified
   on 27.0 (26A428), with older versions unsupported unless separately tested
   and approved. Self-test success does not extend this list.
3. **Toolchain read root derivation**: approve deriving a single canonical
   installation root from `realpath(process.execPath)`, with the rule that
   parent directories (including `~/.hermes`) are never granted.
4. **Writable set**: workspace plus one private session home/temp directory
   only; general `/tmp` and `/private/tmp` writes remain denied.
5. **Sensitive-path overrides**: approve the read+write deny set generated
   from every classifier family in 6.6 (`.env` and `.env.*` including template
   names — the classifier rates them `sensitive`, which denies — plus the other
   listed families) and the write-only deny list for control files
   (`.git/hooks`, `.git/config`, package-manager hooks). Adding a pattern
   requires an effect test; removing one requires explicit approval.
6. **Shell grammar**: approve the section 8 supported subset and the
   unsupported-syntax `DENY` list, including the depth limit of 8.
7. **Shell approvals**: approve single-use grants with a 60-second TTL and the
   section 9 binding set (including sealed-script content hashes); approve that
   an `ASK` outcome requires approval for **every** invocation with no
   command-name or static-parse exemption, and that no read-only profile is
   substituted for an absent approval (7.2 step 4). `DENY` remains
   unapprovable.
8. **Keychain boundary**: approve the section 10.3 claim boundary
   (zero-mach profile, enumerated services, synthetic keychain evidence) with
   B1 tracked until implementation tests land.
9. **Shell dialect and entry**: support exactly `/bin/bash --noprofile --norc`
   as the entry, with `sh`/`zsh` recursively classified only as nested
   `-c` interpreters and `powershell` blocked.
10. **CI/evidence**: keep Linux-only CI with recorded local macOS evidence for
    Goal 3, or add a macOS runner (Phase 6 packaging decision).
11. **B4 resolution (blocking)**: choose between (a) explicitly narrowing the
    claimed shell guarantee for pre-existing hard links inside allowed roots,
    recorded in status/contract text under the maintainer's name, or
    (b) authorizing a mechanism class outside the current boundaries
    (object/inode-mediated whole-process I/O, mount namespace, or VM) with its
    own review. No third option is available inside the evaluated Seatbelt
    boundary; the bypass is not accepted as a residual.

### 13.3 What this proposal does not authorize

It does not adopt a backend, add a dependency, implement or enable any shell
execution, open networking, change accepted policy, code, tests, contracts, or
provenance, modify canonical state, stage, commit, push, or publish anything.
After maintainer approval of the backend and guarantees, implementation
proceeds under the Goal 3 handoff and its verification requirements, followed
by independent review and owner acceptance.

### 13.4 Primary sources

- Installed `@earendil-works/pi-coding-agent` 0.84.4: `docs/extensions.md`
  (`tool_call`, `user_bash`), `docs/security.md`, `docs/containerization.md`,
  `dist/index.d.ts`, `dist/core/tools/bash.d.ts`,
  `examples/extensions/sandbox/`, `examples/extensions/gondolin/`.
- Accepted repository code inspected read-only: `src/gate/authorizer.ts`,
  `src/gate/runtime.ts`, `src/policy/{paths,resources,decisions,effective,merge,configuration,config-loader,control-plane,operations}.ts`,
  `src/approvals/approvals.ts`, `docs/FILE-GATE.md`.
- `@anthropic-ai/sandbox-runtime` 0.0.76 (npm pack, source read):
  `dist/sandbox/macos-sandbox-utils.js`, `dist/sandbox/sandbox-utils.js`,
  `dist/sandbox/sandbox-manager.js`, `dist/sandbox/sandbox-config.js`,
  package metadata (dependencies, size, license, dates). Package page
  <https://www.npmjs.com/package/@anthropic-ai/sandbox-runtime>; project
  <https://github.com/anthropic-experimental/sandbox-runtime>.
- `man sandbox-exec` (macOS 27.0): marked DEPRECATED; `-f`, `-p`, `-D`.
- `/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/servers/bootstrap_defs.h`
  (`BOOTSTRAP_NOT_PRIVILEGED` 1100, `BOOTSTRAP_UNKNOWN_SERVICE` 1102).
- npm metadata for parser alternatives (`web-tree-sitter` 0.27.0,
  `tree-sitter-bash` 0.25.1, `bash-parser` 0.5.0).

### 13.5 Second architectural review response (REVISE, revision 3)

The second review returned **REVISE** with five focused points. This revision
implements each one in place; revision-2 evidence (E1-E9) is unchanged.

| Second-review point | Change in this revision | Outcome |
| --- | --- | --- |
| 1. B4: reconcile the verified pre-existing hard-link read with Goal 2's `nlink === 1` rule and the no-shell-bypass requirement; propose an enforceable in-boundary solution or record Option B incompatibility; no acceptable residual; a pre-scan is not race protection | New 10.5: executor-vs-profile analysis, SBPL predicate attempts (E10), pre-scan rejection, considered copy-in mirror, explicit backend-selection incompatibility and required maintainer decision (13.2 item 11); 10.2 row upgraded | **Concrete incompatibility**: no evaluated mechanism enforces inode identity through path rules; B4 is a backend-selection blocker, not a residual |
| 2. Profile coverage over every secret/sensitive classifier category and protected zone; fix the env-template exception; show a mapping table; unrepresentable rules are blockers or fail closed | New 6.6 matrix (all 15 classifier reasons, both protected zones, control files); 6.3 corrected (no `.env*` template exception; `sensitive` denies); generation rules (global anchoring, explicit ASCII case classes, refusal on unrenderable rules) | Matrix proposed; E10 supports the constructs; B8 makes per-rule effect tests mandatory; B4/B2 remain unrepresentable blockers |
| 3. Safe `mutationOutcome=ASK` semantics: any arbitrary program with a writable profile requires approval; without approval only an effect-excluding profile is admissible; names and static parsing prove nothing about descendants | 7.2 step 4 rewritten as a per-outcome rule: `ASK` requires approval for every invocation with no command-name/parse exemption; no silent read-only substitution; `ALLOW` needs none because the policy already grants those effects; approval never widens | Contract change; required tests added to section 12 rows 3 and 7; no probe can substitute for it |
| 4. Bind verified content of source scripts and other decision inputs to execution; replacement after verification/approval must not preserve the prior permission; a path re-check is not race elimination | New 8.5: one-read buffer, classification/hash/sealing from the same bytes, sealed copy in a root not writable by the contained process, token rewrite, approval hash binding and invalidation; 8.1/8.2/8.3 and section 9 updated; direct script execution and dynamic sources denied | Mechanism proposed; B7 requires implementation and effect tests; host-side same-uid writers remain the declared B3 class |
| 5. Perform only the missing bounded B5 case/Unicode probe on the actual filesystem, comparing classifier and profile; separate confirmed behavior from unsupported | New 4.11 E10: volume alias facts, classifier table, sandboxed profile matrix (pA/pB/pF/pG), `(?i)` and predicate failures, alias read/write results | Confirmed on this volume class with explicit case classes; B5 updated to partially resolved with an explicit UNVERIFIED remainder (other filesystems, non-ASCII folding, engine differences) |

### 13.6 Blocker classification

**Backend-selection blockers** — must be resolved by the maintainer before any
backend approval, because they determine whether the claimed guarantee is
achievable at all:

- **B4 (10.5).** No evaluated option can enforce Goal 2's `nlink === 1`
  identity rule for pre-existing hard links on the shell route. Decision:
  explicitly narrow the claimed guarantee, or authorize a mechanism class
  outside the current boundaries (13.2 item 11). The bypass is not a residual.
- **B2 mount guarantee**, if the maintainer requires it: same root cause
  (path rules cannot express object identity); a separate mechanism is needed.
- Backend choice and declared macOS target (13.2 items 1-2) remain open
  approval decisions, not findings.

**Pre-acceptance verification blockers** — an accepted proposal is impossible
without these implemented and independently reviewed; they do not block the
backend decision itself:

- **B1/B6**: Keychain/broker boundary regression suite with a hermetic
  synthetic helper.
- **B5 remainder**: per-rule and alias-corpus effect tests on the declared
  target; other filesystem classes stay unsupported.
- **B7**: content-binding implementation and tests (8.5).
- **B8**: per-rule classifier-coverage effect tests and generation-refusal
  tests (6.6).
- **B3**: host-side same-user changes between classification and syscall stay a
  declared boundary of the policy gate; not closed by Goal 3.

No PASS transfers between revisions: E10 extends the preparation evidence but
does not verify the proposed production profile, and no guarantee in 10.1 is
changed from "proposed" by this revision.

Snapshot and hygiene checks performed for this revision: `git status`,
`git rev-parse HEAD`, `sha256` of STATE/ROADMAP/manifest/manifest test against
the handoff anchors (all matched), `npm run test:manifest` PASS, and
confirmation that the revision-3 probe directory was removed and the working
tree retained only the pre-existing accepted changes plus this document.
