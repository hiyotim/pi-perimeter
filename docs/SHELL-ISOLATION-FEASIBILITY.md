# Shell-Isolation Feasibility Decision (Goal 3 Research Checkpoint)

Status: research checkpoint only — Goal 3 unfulfilled; no backend approved, selected, or implemented; no shell execution enabled; repository, canonical docs, code, tests and dependencies unchanged. Authorization: [Task 20260915-sandboxed-shell-network-closed](../IMPLEMENTATION_HANDOFF.md); context [STATE.md](../STATE.md), [ROADMAP.md](../ROADMAP.md) Goal 3, [ARCHITECTURE.md](../ARCHITECTURE.md) §§7–10, [AGENTS.md](../AGENTS.md). Prior evidence reused, not rerun: [proposal §§10.5, 13.6, E1–E10](SANDBOX-BACKEND-PROPOSAL.md) (linked, not copied). All probe records, commands, versions and limits for this revision are in the appendices; every claim below is OBSERVED here unless marked otherwise.

> **Verdict: FEASIBLE CANDIDATE WITH STATED PREREQUISITES (A) — projection.** A hard-link-free staging copy built by a **per-object open-verify-read import** (internal symlinks recreated only under the stated policy), executed under a **staging-only Seatbelt profile**, with a **bound export**. The full synthetic cycle and the full ordinary offline workflow (`npm run check` 213/213 on a real repository copy) completed inside containment with the source tree byte-identical; the B4 hard-link alias is excluded at import by the object check while the accepted path-only classifier labels it `ordinary`; export binds verified objects through the effect. **Prerequisite 1:** fd-bound new-file/new-directory creation/write-back requires adopting a small native helper (demonstrated synthetically; not production code) — with no native component, new-file write-back must be declared explicitly unsupported and fail closed. **Prerequisite 2:** the descriptor envelope must be constructed by closing/refusing inherited descriptors (a native launcher or equivalent audit), because already-open fds bypass path rules. **Prerequisite 3:** the two B3-class boundaries stay declared (same-user host writers; staging tamper that is indistinguishable from legitimate child output). Broker (B) stays REJECTED; MicroVM (C) stays a separately-approved fallback (paper only).

> **Recommended next decision (one):** adopt the bounded native helper described in Appendix C (per-component `openat`, identity compare against a manifest, effect relative to the held parent descriptor, no delete/rename, no policy in the helper) — or, if the owner declines a native component, record the explicit fail-closed declaration "projected new-file/new-directory write-back is unsupported". No backend approval, design, or implementation follows from this checkpoint.

## 1. What the candidate is now (and what it is not)

Direction (A) resolves B4 by **excluding the object, not by naming policy**: nothing is copied until the object that will be read has been verified through the very descriptor the bytes come from, and the contained child never holds rules for the original root. It is not an object-identity guarantee for arbitrary in-workspace content (same-user host writers remain B3), is not mount protection (see §7), and is not a claim about any macOS version other than the one recorded in Appendix A.

## 2. B4 requirement and the synthetic-secret trace

| Step | Evidence |
| --- | --- |
| Fixture: `host/.env` (fake `FAKE_TOKEN=probe-secret-…`, `nlink=2`) plus innocent-name alias `host/notes.txt` (same inode 100134366, `dev=16777230`) | Appendix D.1 |
| Accepted path-only layer sees the alias as harmless: `notes.txt` → `sensitivity=ordinary`, `evaluateReadPath` → `ALLOW/WORKSPACE_READ` (fixture path, read-only import of the accepted modules) | Appendix D.9 |
| Import object check refuses it: `notes.txt` → `stage=object-check, nlink=2 (rule: nlink===1)`; `.env` refused by path policy; `outside-link.txt` refused as an out-of-root symlink. Staging contains no secret bytes (`grep` for both nonces → nothing) | Appendix D.2 |
| Substitution control: with the path swapped (symlink and hard link) **after** verification, the bound reader (verify→read one descriptor) wrote the original object's bytes in both cases; the naive verify-by-path-then-reopen reader wrote the secret in both cases | Appendix D.3 |
| Race point after import: the child has no rules for the original root at all — `cat`, `stat`, `ls`, and writes against the host fixture were denied in every run (positive controls: the same commands unsandboxed succeeded) | Appendix D.1, D.4 |
| Race point inside the projection: child-created `exfil-link.txt` (→ host secret) and child-created hard link (`nlink=2`) are refused at export (`ELOOP`, `nlink=2`) | Appendix D.6 |
| Copying is not a substitute: OBSERVED `cp -R` turns the `nlink=2` pair into two `nlink=1` files (**launders** the object — a "copy then verify in the projection" design would accept the secret), while `ditto` preserves `nlink=2` | Appendix D.5 |

B4 is therefore addressed as a **required protection at the import boundary** for this candidate, and by path/exclusion for the child. It is not converted into an accepted residual, and no wording substitutes for the mechanism.

## 3. Compact comparison (updated)

| Dimension | (A) Projection — plausible, prerequisites listed above | (B) Broker — rejected | (C) MicroVM — separately-approved change |
| --- | --- | --- | --- |
| Boundary | Hard-link-free staging copy (internal symlinks recreated by policy); child sees staging + system/toolchain read only; no rules for the original root | Deny workspace + host broker serving fds | Separate guest kernel; copy-transfer only |
| B4 handling | **Excluded at import** by per-object `O_NOFOLLOW`+`nlink===1`+read-same-fd, verified with controls (Appendix D.2/D.3); aliases created later cannot be named by the child | Refusal only for cooperative clients; no attachment to arbitrary-descendant opens (§A) | Structurally excluded at import (INFERENCE) |
| B2/B3 limits | No mount/device dependence in the demonstrated path; a `dev` mismatch vs the root is refused by the probe importer (branch implemented, **not exercised** — no root fixture); B3 declared (host writers, staging tamper) | B2 N/A; B3 unchanged | Mount/object semantics UNVERIFIED |
| Closed networking | Same deny-default profile with roots swapped: TCP loopback/external, UDP, AF_UNIX all denied with working host controls; zero `network*`/`mach*` rules | Socketpair works with no `network*` rule (§A) | Hypervisor config UNVERIFIED |
| Secret / control-plane | Credential denies carry over with roots swapped; policy/plan decisions computed on HOST paths pre-import; the projection contains no secret bytes (probed) | Broker holds policy; fd-passing sound only for served files | Host keeps auth per Gondolin docs |
| Config / approval propagation | Monotonic authority preserved; approvals never widen containment; a DENY item refused before any effect (probed) | Approvals cannot satisfy DENY | Design UNVERIFIED |
| Offline workflow | **Full ordinary workflow demonstrated**: import 12 839 files/2.8 s, `npm run check` 213/213 offline in 3.2–4.4 s, modify-existing + create-new exported back with the workspace diff exactly the two intended paths | Serves only cooperative clients | UNVERIFIED for this use |
| Deps / privileges | Zero new runtime deps and zero entitlements for the JS part; **new-file write-back needs the native helper** (compiled in the probe with installed clang; build/distribution options in Appendix C.3) | No install-free/entitlement-free filesystem option (§A) | Node ≥23.6.0 + QEMU + image provenance |
| Evidence | OBSERVED cycle + adversarial records (Appendices C–E); `sandbox-exec` identity hash-pinned (Appendix A) | §A VERIFIED-EXACT (this revision adds nothing) | Paper only |

## 4. Import contract (as demonstrated)

Per entry: `lstat` → symlinks only when the link text resolves **inside** the source root to a singly-linked regular file (recreated in staging with the same text and re-verified) → for regular files `open(O_RDONLY|O_NOFOLLOW)` → `fstat` (regular, `nlink===1`, `dev` equals the root's) → read bytes **from that same descriptor** → post-read re-`fstat` (size/mtime/ino/nlink unchanged, else refuse) → write into staging and record `import-manifest.json` (host object identity) + `staging-manifest.json`. `.git` is excluded by project decision (the p5 real-repository import refused exactly `.git`; the p6 fixture was created with `--exclude=.git`, so it had nothing to refuse — Appendix D.2, D.8). Policy/authorization is represented by a stand-in decision in the probe; **the accepted policy layer is not modified or integrated**.

## 5. Containment and the descriptor/environment envelope

Staging-only Seatbelt profile (`(deny default)`, no network/mach rules; Appendix B): staging read/write allowed; host fixture, outside fixture, and the real repository copy denied (reads, `stat`, `ls`, writes); nested `sandbox-exec` refused (`sandbox_apply: Operation not permitted`, exit 71); `/dev/fd/<n>` entries are per-process and not traversable as directories; the child environment was exactly the constructed set (`HOME`, `PATH`, `PIW_PROBE_PORT`, `TMPDIR`, plus shell-added `PWD`/`SHLVL`/`_`). **Envelope finding:** Seatbelt still enforces path rules for `openat`/`fchdir` on an *inherited directory* fd (denied), but an inherited *file* fd is readable regardless of path rules — demonstrated with a deliberate `stdio[3]` channel and with a non-CLOEXEC fd held by a host process (both read the fake secret inside containment; Appendix C.2). A launcher that closes every descriptor above stdio (fd 3–255 in the probe; `closefrom`-equivalent for production) before `sandbox-exec` leaves the child with only stdio and no leak. Node cannot close unknown fds from JS and cannot distinguish its own runtime descriptors from inherited ones (a Node parent's `/dev/fd` listing shows its own 0–12), so the production envelope must control the exec path — the demonstrated shape is a launcher that closes every descriptor above stdio (`closefrom`-equivalent) before `sandbox-exec`; a naive parent-side "any fd > 2 → refuse" check is **not** implementable from JS. An ancestor-metadata literal is required for `chdir`/`mkdir -p` inside the projection and exposes only the listed ancestors' existence, never their listings (Appendix D.7).

## 6. Export contract and the native prerequisite

*Existing files:* source = staging object (open `O_NOFOLLOW` → `fstat` → read the same fd → hash recorded); target = host object (open `O_RDWR|O_NOFOLLOW` → `fstat` → regular, `nlink===1`, identity/metadata must equal the import manifest) → truncate+write **through that verified target fd**. Refusals OBSERVED through the exporter itself (Appendix D.10): in-place change (`target-conflict`, no silent last-writer-wins), target became a symlink (`ELOOP`), source symlink (`ELOOP`), source hard link (`nlink=2`). Helper-level refusals (identity mismatch and `nlink≠1` at the target, pre-swap and one-shot multi-component escapes) are driver-level runs with the helper invoked directly and captured request identities (Appendix D.6 cases 1a/2a/3b/3c/5a/5b).
*New files/directories:* no JS primitive exists — `fs.openat` is `undefined` (node v26.8.1) while macOS provides `openat(2)` (`fcntl.h:621`, since 10.10) and the accepted Goal 2 executor still refuses all macOS creation (Class 2, `/proc/self/fd` absent). A temporary native helper therefore performed them: it opens the root, walks **each component separately** with `openat(O_DIRECTORY|O_NOFOLLOW)` and compares `dev`/`ino` to the manifest, holds the parent descriptor **through the effect**, and creates `O_CREAT|O_EXCL|O_NOFOLLOW` or `mkdirat`. OBSERVED: create/mkdir effects; `EEXIST`; identity mismatch; `nlink≠1`; a symlinked component refused (`ENOTDIR`); one-shot multi-component resolution (`--naive-chain` control) escaping into the attacker directory; a parent swapped **after** verification still landing in the moved original directory (bound), while the equivalent JS path-based writer wrote into the attacker's directory (escape). Full source: Appendix C.

## 7. Supported versus fail-closed actions (projected workspace)

| Action | Status |
| --- | --- |
| Read inside projection | supported (staging rules) |
| Modify an existing file, export back | supported, bound to the verified target object (JS-only) |
| Create a new file or directory, export back | supported **only with the native helper**; without it — fail closed (new primitive/contract decision required) |
| Rename / delete inside projection | performed only inside staging (no host effect); **no host delete/rename policy is introduced** — export ignores them |
| Conflicts (host object changed, inode replaced, `nlink≠1`, symlink) | fail closed; never last-writer-wins |
| Symlinks | imported only when internal and singly-linked; child-created or external symlinks refused at export |
| Hard links | refused in both directions (`nlink===1` at import and at export) |
| Host-side replacement during export | refused by identity comparison at the verified descriptor |
| Host-side change inside staging after the child exits | symlink/hard-link tamper refused; an ordinary-file tamper is indistinguishable from legitimate child output — **declared B3**, and the export records the content hash and whether the file changed since import |
| Mount crossing below the root | refusal branch implemented in the probe importer, **UNVERIFIED** (no unprivileged fixture; consistent with E9) |

## 8. Trust-boundary sketch (A, as demonstrated)

```text
[trusted host importer: per-object O_NOFOLLOW open -> fstat nlink==1/dev -> read SAME fd -> staging; manifests(dev/ino/size/sha256)]
      -> [staging dir] -> [Seatbelt child: staging-only rules, no original-root rules, no network/mach, constructed env,
          descriptor envelope closed (launcher) ] --results--> [trusted host exporter: source binding (same-fd read) +
          target binding (verified fd or native helper held-parent chain) + conflict checks + policy decision] -> [host workspace]
Approvals/policy decisions sit OUTSIDE the child and never widen containment.
```

## 9. Rejections (unchanged verdicts, evidence not re-run)

(B) Broker: no evaluated macOS mechanism attaches broker object checks to arbitrary-descendant opens without a new filesystem/kext/entitlement; §A records the `DYLD` bypass, the cooperative-clients-only refusal, and the socketpair channel. This revision adds no probe and does not relabel §A. Rejected, not pursued.
(C) MicroVM: requires overturning the Gondolin rejection and the no-VM-wrapper non-goal in writing plus image provenance; same fail-closed new-file prerequisite as (A); held as a fallback that does not fit current scope.

## 10. Limits of this checkpoint

Not established here: object-identity guarantees against same-user host writers (B3); mount protection; any macOS version other than 27.0 (26A428) arm64; Linux; production readiness of the helper (build/distribution/provenance options are cost sketches only); `sandbox-exec` deprecation is unchanged and its identity is pinned by hash in Appendix A. The carried implementation-verification obligations B1/B6, B5 remainder, B7, B8 were not re-run and remain as recorded in [proposal §13.6](SANDBOX-BACKEND-PROPOSAL.md). The descriptor envelope is demonstrated for the two shapes tested (Appendix C.2): a Node-spawned contained child holds exactly stdio, while a host process that holds a non-CLOEXEC fd and execs `sandbox-exec` itself leaks it — so the production envelope must control the exec path (spawn from the containment layer, or close every descriptor above stdio in a launcher) rather than assume closure; `stat`/`ls` of `/dev/fd` is self-observing and must not be used as the audit.

## 11. Preservation, bounded follow-up, approvals

No weakening: file denials, authority monotonicity, fail-closed containment (no unrestricted fallback), closed networking, and approval-never-widens-containment are preserved; no historical review evidence transfers to any new backend or profile. Bounded follow-up after the decision in the verdict block: (i) if the helper is adopted — pick the build/distribution form, pin the helper protocol (single-component ops only, no policy, no delete/rename), and implement import/export contracts with effect tests per §7; (ii) if it is not adopted — record the explicit unsupported-new-file declaration and keep write-back limited to bound replacement of existing files. Owner approvals needed before adoption/implementation: the native component (or its explicit rejection), the import contract (symlink policy and `.git` exclusion), the descriptor-envelope construction requirement, and the retained B3/mount declarations — per [ROADMAP.md](../ROADMAP.md) Goal 3 backend/guarantee gate. Nothing in this checkpoint approves a backend or enables shell execution.

---

# Appendices

Legend: **OBSERVED** = narrow synthetic probe with working controls (records below); **DOCUMENTATION** = current primary docs/SDK headers; **INSPECTION** = source/header/profile inspection; **INFERENCE** = reasoned, marked; **UNVERIFIED** = lacking evidence/authority, not a license to bypass. Probe instruments were temporary (`/private/tmp/piwarden-feas-cycle`, retained until the independent assessment and deleted afterwards; sources quoted below).

## A. Environment, versions, artifact inventory

* macOS 27.0 (build 26A428), arm64; Node v26.8.1 (`/Users/2am./.hermes/node`); Apple clang 21.0.0 (clang-2100.3.34.2); `/usr/bin/sandbox-exec` size 135136, mtime Sep 3 13:34, SHA-256 `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8` (build identity otherwise UNVERIFIED; improvement over §A's "not captured").
* Probe root `/private/tmp/piwarden-feas-cycle` (canonical `/private/tmp`), fixtures: `host/` (micro fixture), `host-repo/` and `staging-repo{,2}/` (real-repository copies), `outside/secret.txt`, `attack/`, `copyprobe/`, `staging/probe-bin/`.
* Recorders (SHA-256): `tool/import.mjs` `2845e412…`, `tool/export.mjs` `19eb8f66…`, `tool/substitution-import.mjs` `4ac36e18…`, `tool/substitution-export-probe.mjs` `0a0d0de6…`, `tool/naive-export.mjs` `a93e5dc1…`, `tool/p3-cycle.mjs` `9456f452…`, `tool/p4-adversarial.mjs` `433897af…`, `tool/p5-repo-workflow.mjs` `7f0396fb…`, `tool/p6-repo-cycle.mjs` `925ddadf…`, `tool/p7-fd-envelope.mjs` `6fdb2837…`, `tool/p8-export-and-oracle.mjs` `3066dba3…`, `tool/chainwrite.c` `a4167122…` (binary `chainwrite` `0475a432…`), `tool/fdprobe.c` `2cb67815…`, `tool/fileread.c` `6a543bda…`, `tool/fdscan.c` `a62bfce6…`, `tool/launcher-fd.c` `c59f2c48…`, `tool/launcher-close.c` `23031802…` (binary `launcher-close` `29f5875f…`), `tool/classifier-check.mjs` `5e55a70d…`, `tool/oracle.sh` `755e51e2…`, `tool/p10-corrections.mjs` `ed7a31402e66fe3ff347556a5fadc6cbd8873ef823f7985424147ebd30de5bc4`, `tool/profile-staging.sbpl` `79a992dc…`, `tool/profile-workflow.sbpl` `64462616…`, `tool/profile-repo.sbpl` `8eb3d718…`, `tool/profile-repo2.sbpl` `326fa7f1…`, `tool/logs/*.log` (per-probe logs captured during the runs; decisive lines are quoted in Appendix D; the post-review corrections run is `tool/logs/p10-corrections.log` `2435dcb9bbebc9606b44787d4df63e71a6a12b28515c8dd81a7c2fa7c9a2a4bb`; all logs are deleted with the probe root after the assessment).
* Repository verification for this checkpoint: `git rev-parse HEAD` = `664871d9276049322f30acfb58e792462ad8538f`; all five handoff anchors matched (`STATE.md` `fe799443…`, `ROADMAP.md` `27cbb4d3…`, `docs/file-gate-hashes.json` `7aa0e786…`, `test/hash-manifest.test.ts` `83d89f7a…`, `docs/SANDBOX-BACKEND-PROPOSAL.md` `4e10c1d5…`); `npm run test:manifest` PASS (1/1); `git status --porcelain` shows exactly the pre-existing modified/untracked set listed in the handoff and no additional file. Working tree was not modified: the only edited file is this report.

## B. Profiles (exact)

`tool/profile-workflow.sbpl` — the profile used for the cycle and repository runs (staging-root path substituted per run; `profile-staging.sbpl` is the same shape without the toolchain, `/etc`, and timezone read allowances, with the fixture-root metadata literal removed). Full text:

```sbpl
(version 1)
(deny default)
(allow process*)
(allow sysctl-read (sysctl-name-prefix "hw.") (sysctl-name-prefix "kern."))
(allow file-read-metadata
  (literal "/")
  (literal "/bin")
  (subpath "/bin")
  (literal "/sbin")
  (subpath "/sbin")
  (literal "/usr")
  (subpath "/usr")
  (subpath "/System")
  (literal "/etc")
  (subpath "/etc")
  (literal "/private")
  (literal "/private/etc")
  (subpath "/private/etc")
  (literal "/private/var")
  (literal "/private/var/db")
  (literal "/private/var/db/timezone")
  (subpath "/private/var/db/timezone")
  (literal "/private/var/select")
  (subpath "/private/var/select")
  (literal "/private/tmp")
  (literal "/private/tmp/piwarden-feas-cycle")
  (literal "/dev")
  (literal "/dev/fd")
  (subpath "/dev/fd")
  (literal "/dev/null")
  (literal "/dev/zero")
  (literal "/dev/random")
  (literal "/dev/urandom")
  (literal "/Users")
  (literal "/Users/2am.")
  (literal "/Users/2am./.hermes")
  (subpath "/Users/2am./.hermes/node")
  (subpath "/private/tmp/piwarden-feas-cycle/staging"))
(allow file-read*
  (literal "/")
  (subpath "/System")
  (subpath "/usr")
  (subpath "/bin")
  (subpath "/sbin")
  (subpath "/etc")
  (subpath "/private/etc")
  (subpath "/private/var/db/timezone")
  (literal "/private/var/select")
  (subpath "/private/var/select")
  (subpath "/Users/2am./.hermes/node")
  (literal "/dev/fd")
  (subpath "/dev/fd")
  (literal "/dev/null")
  (literal "/dev/zero")
  (literal "/dev/random")
  (literal "/dev/urandom")
  (subpath "/private/tmp/piwarden-feas-cycle/staging"))
(allow file-write*
  (subpath "/private/tmp/piwarden-feas-cycle/staging")
  (literal "/dev/null")
  (literal "/dev/zero"))
(allow file-ioctl
  (literal "/dev/null")
  (literal "/dev/zero")
  (literal "/dev/random")
  (literal "/dev/urandom"))
```

Note: `/etc` and `/Users/2am./.hermes/node` are read-only allowances for the runtime/toolchain (as in the E1 profile class), not part of the projection. No `network*`, no `mach*`, no home read root.

## C. Native creation/export helper (temporary probe)

### C.1 Request grammar and discipline

```
ROOT <dev> <ino> <path>        # anchor verified by identity, opened O_DIRECTORY|O_NOFOLLOW
COMP <dev> <ino> <name>        # one component per line; openat(O_RDONLY|O_DIRECTORY|O_NOFOLLOW); dev/ino must match
OP   create|replace|mkdir
LEAF <dev> <ino> <name>        # create: 0 0 (must not exist); replace: must match the verified object
PAYLOAD <file|->               # bytes; read after the --pause barrier; stdin used only for '-'
Flags: --pause (print ARMED after chain verification, wait for a stdin line), --naive-chain (negative control)
```

The helper makes no policy decisions, resolves no multi-component path in one call, offers no delete/rename op, and holds every verified descriptor until the effect completes. Source (exact; 159 lines; SHA-256 `a4167122a265f9634469baac3d5433cceda136899403bdee3ccc69473ba7aa9b`) — key sections:

```c
  int fd = open(rootName, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
  if (fd < 0) refuse("root open");
  if (fstat(fd, &st) != 0) refuse("root fstat");
  if ((unsigned long long)st.st_dev != rootDev || (unsigned long long)st.st_ino != rootIno) refuse("root identity mismatch");
  ...
  for (int i = 0; i < ncomp; i++) {
      if (strchr(comps[i].name, '/')) refuse("component name contains '/'");
      int nfd = openat(fd, comps[i].name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
      if (nfd < 0) refuse("component open (symlink or missing)");
      if (fstat(nfd, &st) != 0) refuse("component fstat");
      if (!S_ISDIR(st.st_mode)) refuse("component not a directory");
      if ((unsigned long long)st.st_dev != comps[i].dev || (unsigned long long)st.st_ino != comps[i].ino) refuse("component identity mismatch");
      close(fd); fd = nfd;                       /* the verified descriptor is held onward */
  }
  ...
  if (!strcmp(op, "create")) {
    int cfd = openat(fd, leafName, O_CREAT | O_EXCL | O_NOFOLLOW | O_WRONLY, 0600);
    if (cfd < 0) refuse("create (exists, symlink, or denied)");
    ... write(payload) ... fstat(cfd) ... printf("RESULT create name=%s dev=%llu ino=%llu nlink=%llu size=%lld\n", ...);
  } else if (!strcmp(op, "replace")) {
    int cfd = openat(fd, leafName, O_RDONLY | O_NOFOLLOW);
    if (cfd < 0) refuse("target open (symlink or missing)");
    if (fstat(cfd, &st) != 0) refuse("target fstat");
    if (!S_ISREG(st.st_mode)) refuse("target not a regular file");
    if (st.st_nlink != 1) refuse("target nlink != 1");
    if ((unsigned long long)st.st_dev != leafDev || (unsigned long long)st.st_ino != leafIno) refuse("target identity mismatch");
    if (ftruncate(cfd, 0) != 0) refuse("truncate"); ... write(payload) ...
  } else if (!strcmp(op, "mkdir")) {
    if (mkdirat(fd, leafName, 0700) != 0) refuse("mkdirat");
    int dfd = openat(fd, leafName, O_RDONLY | O_DIRECTORY | O_NOFOLLOW); ...
```

The `--naive-chain` control resolves all components in ONE `openat` (no per-component rule): OBSERVED escaping through a symlinked component into the attacker directory, which is the working positive control for the per-component requirement. Payload bytes travel over the helper's stdin (no host temp file), so the exported bytes are the exporter's verified-source bytes.

### C.2 Descriptor envelope results

Instruments: `tool/fdscan.c` (fcntl `F_GETFD` scan — not self-observing), `tool/fileread.c` (reads a given fd), `tool/fdprobe.c` (`openat`/`fchdir` relative to a given fd), `tool/launcher-fd.c` (host process opening a file without `O_CLOEXEC`), `tool/launcher-close.c` (closes 3–255 then execs). Outputs below are from `tool/logs/p10-corrections.log` (this execution; the whole set, including the two-profile mkdir rows, is reproducible from `tool/p10-corrections.mjs`), except case F, whose `/dev/fd/<n>` traversal record is in the D.1 matrix log.

| Case | Result |
| --- | --- |
| A: Node passes a host-secret file fd as the child's `stdio[3]` | `read-inherited-fd => OK \| FAKE_TOKEN=probe-secret-…` — path rules do not govern an already-open fd |
| B: C launcher holds a non-CLOEXEC fd to the secret, execs `sandbox-exec` | identical read inside containment; `launcher-fd: opened …/host/.env as fd 3 (no CLOEXEC)` |
| C: launcher closes 3–255 before `sandbox-exec`; `fdscan` inside the child | `fd 0/1/2 open kind=sock` and `scan complete` — no descriptor above stdio |
| D: Node (`spawnSync`, `stdio` pipes) spawns `sandbox-exec` directly; `fdscan` inside the child | same: only fds 0,1,2 — the exact shape used by the cycle/repository runs |
| E: parent-side `/dev/fd` check (why a naive JS audit fails) | the same run shows the Node parent's own listing `0,1,10,11,12,2,3,4,5,6,7,8,9` (Node runtime fds), while its contained child holds only 0,1,2: a JS "refuse when any fd > 2" audit would fire on the parent's runtime descriptors, and Node exposes no `F_GETFD`/close-all. The demonstrated construction is the launcher (case C), not a JS audit. |
| F: `/dev/fd/<n>` as a path | the fd itself is openable/readable (same descriptor), but `<n>` is not traversable as a directory (`/dev/fd/<n>/<child>` fails) |
| G: helper channel | the helper is host-side; nothing from it is passed into the child in the demonstrated flow |
| H: inherited host-directory fd | `faccessat`/`openat`/`fchdir` relative to it: `Operation not permitted` (errno 1) — Seatbelt path rules still apply |

`ls -l /dev/fd` is self-observing (the listing opens a descriptor), so it must not be used as the audit. The reviewing agent independently reproduced cases C, D, and H (reviewer-run; recorded in Appendix F) and matched them to these records.

### C.3 Build/distribution cost sketch (paper only; no adoption)

(i) transient compile at setup — clang is present on this machine but not guaranteed, and must fail closed where absent; (ii) a prebuilt, signed per-platform binary — provenance and review burden, conflicts with reproducible-build expectations unless built reproducibly from reviewed source; (iii) `node-gyp`/install-time build — adds a build toolchain and build-time dependency (heaviest conflict with the zero-runtime-dependency constraint). All options require a separate adoption decision; none is approved here, and no repository file, dependency, or lockfile was touched.

## D. Probe records (exact commands and verbatim outcomes)

### D.1 Effect matrix (staging-only profile) with unsandboxed controls

Commands: `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin HOME=<staging> /bin/bash <staging>/matrix-child.sh` (control) and `cd <staging> && /usr/bin/sandbox-exec -f tool/profile-staging.sbpl /usr/bin/env -i PATH=… HOME=<staging> TMPDIR=<staging> /bin/bash <staging>/matrix-child.sh`.

| Case | Control (unsandboxed) | Sandboxed |
| --- | --- | --- |
| read own file | OK `own-content` | OK `own-content` |
| write own file | OK `wrote` | OK `wrote` |
| mkdir in staging | OK | OK for a plain `mkdir` by absolute path inside the allowed root, under both profiles; `mkdir -p` (which stats parent components) is denied and a shell `cd` reports failure because its post-`chdir` `getcwd()` cannot resolve the denied ancestor — both need the ancestor metadata literal (D.7) |
| `cat host/.env` (fake secret) | OK secret | `Operation not permitted` |
| `cat host/notes.txt` (innocent-name alias) | OK secret | `Operation not permitted` |
| `stat host/notes.txt` | OK `nlink=2` | `Operation not permitted` |
| `cat outside/secret.txt` | OK | `Operation not permitted` |
| `ls host` | OK | `Operation not permitted` |
| write host file / new host file | OK / ENOENT | `Operation not permitted` |
| read toolchain binary | OK (145 803 984 bytes) | `Operation not permitted` (profile without toolchain allowance) |
| nested `sandbox-exec` | (allowed unsandboxed) | `sandbox_apply: Operation not permitted`, exit 71 |
| `/dev/fd` | entries for own fds | per-process entries; `/dev/fd/0/../…` and `/dev/fd/3/<name>` fail |

### D.2 Import (micro fixture) and real repository

* Fixture: `node tool/import.mjs host staging manifests` → `IMPORT summary: files=3 dirs=1 symlinks=1 refused=3` (before the workload added files); refusals: `.env` policy, `notes.txt` object-check `nlink=2`, `outside-link.txt` symlink → outside root; `grep -rl "FAKE_TOKEN\|OUTSIDE-SECRET" staging` → nothing.
* Real repository (`node tool/p5-repo-workflow.mjs`): `IMPORT summary: files=12839 dirs=1322 symlinks=11 refused=1` (`refused .git :: excluded :: project decision: VCS metadata is not projected`), elapsed 2 997 ms. The second run (`p6-repo-cycle.mjs`) imported the same counts in 2 821 ms with `refused=[]` because its fixture was created with `rsync --exclude=.git` — there was no `.git` entry to refuse; the exclusion rule itself was exercised in the p5 run (`refused=1`).

### D.3 Import substitution (bound vs naive)

`node tool/p2-substitution.mjs` →

```
mode=bound attack=symlink  ... bytes=32 content="ORIGINAL-CONTENT-of-swap-target" | secret_leaked=false
mode=naive attack=symlink  ... bytes=41 content="FAKE_TOKEN=probe-secret-…"           | secret_leaked=true
mode=bound attack=hardlink ... bytes=32 content="ORIGINAL-CONTENT-of-swap-target" | secret_leaked=false
mode=naive attack=hardlink ... bytes=41 content="FAKE_TOKEN=probe-secret-…"           | secret_leaked=true
```

### D.4 Full cycle (micro fixture): import → execution → export

`node tool/p3-cycle.mjs` → import as D.2; host-side controls `tcp=TCP-CONTROL-OK unix=UNIX-CONTROL-OK`; child highlights: `host-denied` (all host/outside access), `tcp-denied` (loopback and external), `udp-denied`, `unix-denied`, `dns` unresolved, `build-ok BUILD OK lines=3`, `child-link` (symlink to host secret, symlink to outside secret, hard link inside projection), `symlink-read-denied`, `host-hardlink-denied`, `nested-denied`; the child environment was exactly the constructed set; **host tree identical (no diff)** and `outside secret unchanged=true`; export:

```
EFFECT replace data/state.txt :: target-descriptor :: wrote 65 bytes through verified target fd … source MODIFIED-in-projection sha256=2d64d900…
EFFECT mkdir dist :: helper-mkdir :: CHAIN verified components=0 parent-ino=… / RESULT mkdir name=dist dev=… ino=…
EFFECT create dist/result.json :: helper-create :: CHAIN verified components=1 … RESULT create … nlink=1 size=22
EFFECT create dist/summary.md :: helper-create :: RESULT create … nlink=1 size=16
REFUSED create notes.txt :: policy :: policy decision is not ALLOW
EXPORT summary: effects=4 refused=1
```

Host afterwards: `data/state.txt` contains the child's appended line; `dist/result.json`/`dist/summary.md` exist; `notes.txt` remains the untouched `nlink=2` alias of the fake secret.

### D.5 Copy semantics (why copying is not the import mechanism)

`cp -R copyprobe/src/. copyprobe/cp-dest/` and `ditto copyprobe/src copyprobe/ditto-dest` on a source pair with `nlink=2`:

```
cp -R result:    real.txt nlink=1 ino=100213515 | alias.txt nlink=1 ino=100213516   # links broken -> alias laundered into a plain file
ditto result:    real.txt nlink=2 ino=100213517 | alias.txt nlink=2 ino=100213517   # links preserved
```

### D.6 Adversarial export probes

`node tool/p4-adversarial.mjs` (helper request identities captured pre-swap; `--pause` gives deterministic interleaving):

```
1a helper, parent swapped before effect      :: REFUSED component open (symlink or missing) (errno=20) | attack-dir empty | moved-dir=existing.txt
1b naive JS writer, swapped before verify    :: REFUSED parent not a verified directory
2a helper, parent swapped AFTER verification :: CHAIN verified parent-ino=… | ARMED | RESULT create … | attack-dir empty | moved-dir=new-after-post-swap.txt
2b naive JS writer, same interleaving        :: ARMED parent-ino=… | RESULT created …/swapdir/new-by-naive-post.txt | attack-dir=new-by-naive-post.txt   # escape
3a helper create over existing leaf          :: REFUSED create (exists, symlink, or denied) (errno=17 File exists)
3b helper replace, new inode at target       :: REFUSED target identity mismatch
3c helper replace, target nlink=2            :: REFUSED target nlink != 1
3d JS bound replace, target changed in place :: same-object=true size=15->23 => REFUSED (target-conflict)   [driver-level expectation; executed end-to-end: D.10 case 2]
3e JS bound replace, target is a symlink     :: REFUSED (ELOOP)
4  child-supplied sources                    :: exfil-link.txt symlink->host/.env REFUSED (ELOOP); hardlink.txt/ linktest-src.txt REFUSED (nlink=2); outside-link-2.txt REFUSED (ELOOP)   [driver-level source checks; executed exporter versions: D.10 cases 4/5]
5a helper per-component chain via symlinked component :: REFUSED component open (errno=20)
5b helper one-shot multi-component control   :: CHAIN naive-resolved one-openat … | RESULT create … | attack-dir=pwned-by-naive-chain.txt   # escape
```

Export source substitution (`node tool/p8-export-and-oracle.mjs`): `mode=bound … content="STAGING-ORIGINAL-CONTENT" | secret_leaked_into_workspace=false` versus `mode=naive … content="FAKE_TOKEN=probe-secret-…" | secret_leaked_into_workspace=true`. Staging tamper after the child exited, re-run cleanly **through `export.mjs`** (Appendix D.10): symlink source → `REFUSED (ELOOP)`; hard-linked source → `REFUSED (nlink=2)`; ordinary-file tamper → `EFFECT` (B3-class, hash recorded, §7 row). The pre-swap/anti-escape rows of the table above (`1a`, `2a`, `5a`, `5b`) are driver-level runs against the helper with captured request identities; `3d` and the child-supplied-source checks are re-executed end-to-end in D.10.

### D.7 Metadata / existence-oracle probe (both profiles, re-run cleanly)

`/usr/bin/sandbox-exec -f tool/<profile> /bin/sh -c '<mkdir / mkdir -p / cd / stat / ls>'` with the target inside the profile's allowed staging root, reproducible from `tool/p10-corrections.mjs` and recorded in `tool/logs/p10-corrections.log`:

```
profile-staging.sbpl : plain-mkdir-OK | mkdir-p-DENIED ("mkdir: /private/tmp/piwarden-feas-cycle: Operation not permitted")
                       cd-inside-FAILED | stat-ancestor-DENIED | list-ancestor-DENIED
profile-workflow.sbpl: plain-mkdir-OK | mkdir-p-OK | cd-inside-OK | stat-ancestor-OK | list-ancestor-DENIED
```

Earlier single-profile oracle run (`tool/logs/p8-export-and-oracle.log`, `profile-workflow.sbpl`): `stat-OK /private/tmp/piwarden-feas-cycle` (the listed ancestor only), `stat-denied` for `host`, `host/.env`, `outside/secret.txt`, `/Users/2am./.hermes/.env`; `list-denied` for the fixture root; `stat-OK /etc/hosts` (explicit system read allowance). Conclusion: the ancestor metadata literal is required for `chdir`/`mkdir -p` inside the projection and exposes only existence/type of the entries explicitly listed — never listings, never children.

### D.8 Real-repository workflow and full cycle

* `node tool/p5-repo-workflow.mjs`: `HOST-REPO-READABLE` never appeared — `host-repo-denied`; `tcp-denied` (host control `TCP-CONTROL-OK`); `ℹ tests 213 / ℹ pass 213 / ℹ fail 0 / npm-exit=0`, run elapsed 4 371 ms; **host repository byte-identical (no diff)** over 12 850 files (excluding `.git`); `git status --porcelain` unchanged.
* `node tool/p6-repo-cycle.mjs`: child `host-repo-denied`, `ℹ tests 213 / pass 213 / fail 0`, `check-exit=0`, `modified-existing-ok`, `created-new-ok` (elapsed 3 160 ms); export `EFFECT replace README.md` (5 208 bytes through the verified target fd), `EFFECT mkdir dist-out`, `EFFECT create dist-out/result.json` (helper); **workspace diff after export: exactly `README.md, dist-out/result.json`**; `staging README == host README` true; the real working tree still contains no build marker.

### D.9 Accepted-code B4 check and Node/OS facts

`node tool/classifier-check.mjs` (read-only import of the accepted modules against the fixture workspace):

```
path=notes.txt      nlink=2 sensitivity=ordinary matches=-  readDecision=ALLOW/WORKSPACE_READ
path=.env           nlink=2 sensitivity=secret   matches=env-file readDecision=DENY/SECRET_RESOURCE
path=data/state.txt nlink=1 sensitivity=ordinary matches=-  readDecision=ALLOW/WORKSPACE_READ
path=outside-link.txt nlink=1 sensitivity=ordinary matches=- readDecision=ASK/EXTERNAL_READ
```

DOCUMENTATION/INSPECTION re-verified: `MacOSX.sdk/usr/include/sys/fcntl.h:621` declares `int openat(int, const char *, int, ...)` (since macOS 10.10); `nm -gU /usr/lib/system/libsystem_kernel.dylib` lists `_openat`/`_openat$NOCANCEL`; `O_RESOLVE_BENEATH` is documented "only for open(2)" while `AT_RESOLVE_BENEATH` (0x2000) is not available to `openat` (no at-flags parameter); no `openat2`; `node -e "typeof require('fs').openat"` → `undefined` (also `fs/promises`); `ls /proc/self/fd` → `No such file or directory`; the accepted `src/gate/bound-execution.ts` still probes `/proc/self/fd/<dirfd>/<name>` and therefore refuses macOS creation (Class 2) — unchanged.

### D.10 Post-review corrections run (executed end-to-end through `export.mjs`)

`node tool/p10-corrections.mjs` — fresh import of the micro fixture (`files=8 dirs=4 symlinks=1 refused=3` after the workload files were present), then one exporter invocation per case (`tool/logs/p10-corrections.log`):

```
1 ordinary staging source (clean fixture) :: EFFECT create tamperlink.txt :: helper-create :: CHAIN verified components=0 … RESULT create name=tamperlink.txt … nlink=1 size=15
                                            host result "tamper-payload\n"                                    (EXPORT summary: effects=1 refused=0)
2 host target changed in place            :: REFUSED replace data/state.txt :: target-conflict :: host target changed since import (dev/ino/size/mtime)
3 host target is a symlink                :: REFUSED replace data/state.txt :: target-open :: ELOOP
4 symlink source (child-supplied)         :: REFUSED create exfil2.txt :: source-open :: ELOOP
5 hard-linked source, nlink=2             :: REFUSED create hl-src.txt :: source-object :: nlink=2 (rule: nlink===1)
```

Case 1 is the B3-class row of §7: the write-back proceeds and the exporter reports the source state and hash (`source created-in-projection sha256=563495884951d4ea`) — a same-user host writer inside staging is indistinguishable from the child, which is why that row is declared rather than solved. Cases 2–5 are refusals produced by the exporter binary itself (not computed expectations).

## E. Artifact disposition and reproduction

The probe root `/private/tmp/piwarden-feas-cycle` (505 MB: fixtures, instruments, logs, manifests) was retained **until the independent assessment in Appendix F completed**, so that the reviewing agent could inspect the actual artifacts rather than only this report. After the delta verification and the corrections run (D.10), the probe root was deleted and the cleanup was verified (executor-run): `ls /private/tmp | grep -c piwarden-feas` → `0`, and no `piwarden` entry remains in `/private/tmp`. This appendix and Appendices A–D are therefore the persistent record: profile text verbatim (B), helper source and grammar (C), and exact commands with verbatim decisive outputs (D). No repository file, dependency, lockfile, canonical document, or Pi configuration was created, modified, or installed by this checkpoint; no real credentials, keychain, profile, or host security setting was accessed or changed, and no shell route was enabled.

## F. Independent assessment (reviewer record)

The assessment required by the handoff was performed by a **separate fresh-context reviewing agent** (general-purpose agent, launched by the executor with no prior involvement in the work, instructed to be read-only), which confirmed its identity and independence in the delta pass. Attribution below distinguishes what the reviewer executed from what it inspected statically.

* **Reviewed revision:** `0aac65c549fab38d2c4566f77ddec04b3d5bb9b71171c74d59e24d66f9060906` → verdict **PASS WITH FINDINGS**, 12 findings, no P0 (1× P1 — the criterion-8 appendix/hash absence; 4× P2; 1× P2/P3; 6× P3; reporting- and evidence-attribution-level, none of them a protection claim), no invariant weakening, no adoption/install/scope violation, no misattribution of prior evidence found.
* **Reviewer-run checks** (executed read-only by the reviewer): SHA-256 of this report, of every listed instrument, of `/usr/bin/sandbox-exec`, and of the five handoff anchors; `git rev-parse HEAD`, `git status --porcelain`, `git diff --check`; `npm run test:manifest` (PASS 1/1); `stat` on fixtures/aliases/copy probes; `grep` for the secret nonces across the staging trees and the repository; `sw_vers`, `node --version`, `typeof fs.openat`, `clang --version`, SDK header greps, `ls /proc/self/fd`; `lsof` and `/dev/fd` reads in shell and Node shapes; and independent re-runs of descriptor-envelope cases C, D and H (`fdscan` via a raw Node spawn and via `launcher-close`, `fileread` with `stdio[3]`, `fdprobe` through `launcher-fd`) which matched the recorded results. The reviewer disclosed one transient helper file it created and deleted outside the repository (`/tmp/rv-profile-extract.txt`) and that its `npm run test:manifest` used the project's own temporary-fixture harness.
* **Reviewer static-only checks:** p2–p8 interleavings, the `--pause` runs, the `chainwrite.c` adversarial semantics beyond the retained logs, and the p5/p6 `npm run check` cycles (logs read; not re-run). Full disclosure is in the reviewer's reports.
* **Findings and resolution (all closed):** (1) criterion-8 appendix and reviewed hash absent → this Appendix F; (2) the tamper "ordinary source → EFFECT" claim did not match a non-idempotent retained log → fixture reset and re-executed through the exporter (D.10 case 1); (3) target-conflict and child-supplied-link refusals were computed inline rather than executed → now executed through `export.mjs` (D.10 cases 2–5) with driver-level runs attributed separately; (4) the JS pre-spawn fd-audit claim was an overclaim → §5/C.2 now record the Node parent's own runtime fds and name the launcher as the demonstrated construction; (5) the artifact-deletion wording contradicted the retained fixtures → this Appendix E; (6) instrument outputs/hashes missing → C.2 and Appendix A completed; (7) "180 lines" → 159 lines + hash; (8) §4 cross-reference → corrected to the p5/p6 distinction; (9) "link-free" → "hard-link-free (internal symlinks recreated by policy)"; (10) the D.1/D.7 mkdir rows mixed profiles → two-profile record, reproducible from `tool/p10-corrections.mjs`; (11) "closes fd ≥ 3" → "every descriptor above stdio (`closefrom`-equivalent)"; (12) the p6 `refused=[]` parenthetical → explained by `--exclude=.git`.
* **Delta verification:** the corrected revision `cc73dff9b281a6c56190c23ebc4831cfa4a8e60cf31ff24576e52502457b4761` received a second reviewer pass. The reviewer re-verified every hash it could still inspect, confirmed findings 2, 4, 6 (hash part), 7, 8, 9, 10 and 12 resolved, 3 substantially resolved (one attribution sentence, since corrected), 5 and 11 with leftover wording (since corrected), and 1 pending by design. The reviewer's remaining items were then applied in this delivered revision: the §6 attribution split, the `(D.11)` → `(D.7)` reference, the §10 "close fd ≥ 3" wording, the legend/E reconciliation, the corrections-script hash, the single-source mkdir record, and this Appendix.
* **Delivered revision:** `62c058f971dfb2fa3448bb778de9c3c83db90bbe876b3b3e52d55775dabf29b4` — computed **before** this line and the three documentation edits above were inserted, so the shipped bytes hash to a different value; the reviewing agent read and confirmed `62c058f9…` as the last revision in which the report text was otherwise final. No new protection claim was introduced between the delta-verified revision and this one; the only wording refinements beyond the delta-verified text are the D.1 `mkdir` row (now naming the `getcwd` mechanism the record shows) and the §10 closing wording, plus this record and the appended final hash. No implementation test suite, no production code, and no backend were verified or approved by this assessment — it covers this research report only.
