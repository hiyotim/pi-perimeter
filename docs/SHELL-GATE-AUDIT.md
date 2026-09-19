# Shell Gate Audit and Evidence (Goal 3)

Status: **contract amended to variant B by the owner (2026-09-18); amended
implementation verified; awaiting owner acceptance.** Task ID
`20260915-sandboxed-shell-network-closed`. This document records what was run,
what was observed, what is bounded, and which exact bytes the evidence applies
to. It is not owner acceptance and does not open Goal 4.

Contract: [SHELL-GATE.md](SHELL-GATE.md). Architecture approval and scope:
[STATE.md](../STATE.md), [IMPLEMENTATION_HANDOFF.md](../IMPLEMENTATION_HANDOFF.md).
Research inputs (historical, not production evidence):
[SHELL-ISOLATION-FEASIBILITY.md](SHELL-ISOLATION-FEASIBILITY.md),
[SANDBOX-BACKEND-PROPOSAL.md](SANDBOX-BACKEND-PROPOSAL.md).

## 1. Entry conditions

| Item | Value |
| --- | --- |
| Branch | `codex/mac-migration-snapshot` |
| Starting HEAD | `a80b77749ce6a9d329f18a4badafafe68ddc4596` |
| Baseline (Goal 2 accepted) | `b9060dad829a92d3699da3b689fe909446a1e810` |
| Ancestry check | baseline is an ancestor of HEAD; commits between them changed only `STATE.md`, `ROADMAP.md`, `IMPLEMENTATION_HANDOFF.md` |
| Anchors at entry | all five handoff anchors matched (`docs/file-gate-hashes.json` `7aa0e786…`, `docs/FILE-GATE-AUDIT.md` `84351b60…`, `test/hash-manifest.test.ts` `83d89f7a…`, `docs/SANDBOX-BACKEND-PROPOSAL.md` `4e10c1d5…`, `docs/SHELL-ISOLATION-FEASIBILITY.md` `b1fdad25…`) |
| Entry check | `npm run test:manifest` PASS (1/1); `git status --short` clean apart from the preparation commit |
| Stash | `stash@{0}: mac-local-before-migration` untouched |

## 2. Environment (declared target)

| Item | Value |
| --- | --- |
| OS | macOS 27.0 (build 26A428), `uname -r` `27.0.0`, arm64 |
| Node | v26.8.1 (`/Users/2am./.hermes/node/bin/node`) |
| Compiler | Apple clang 21.0.0 (clang-2100.3.34.2) |
| Confinement | `/usr/bin/sandbox-exec`, SHA-256 `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`, `root:wheel`, mode `0755`, nlink `1` |
| Pi package | `@earendil-works/pi-coding-agent` 0.84.4 (installed, re-read for this Goal) |
| Native helper | built by `npm run build:native`; source and build flags recorded in `native/build-manifest.json` (not committed) |

Pi integration surface re-verified for this Goal: `tool_call` (blocking,
`event.input` mutable, `toolCallId`), controlled same-name tool registration
over the builtin `bash` definition, `user_bash` with a full `{ result }`
replacement, `ExtensionContext.ui.confirm`, cancellation through the tool
`signal`, and `BashResult` output/cancellation shape. See contract §4.

## 3. What was implemented

| Area | Artifact |
| --- | --- |
| Bounded grammar, plan, risk tables, policy join | `src/policy/shell-grammar.ts`, `shell-plan.ts`, `shell-commands.ts`, `shell-policy.ts` |
| Shell approvals (bound, single-use, 60 s) | `src/approvals/shell-approvals.ts` |
| Profile generation, projection, export, helper client, lifecycle | `src/sandbox/seatbelt.ts`, `projection.ts`, `export.ts`, `helper.ts`, `containment.ts`, `errors.ts` |
| Native mechanism (launcher + bound export) | `src/sandbox/native/piwarden-helper.c`, `scripts/build-native.mjs` |
| Runtime wiring for both shell routes | `src/gate/shell-runtime.ts`, `src/gate/runtime.ts` |
| Contract | `docs/SHELL-GATE.md` |

## 4. Recorded results (executor-run, this working tree)

Command: `npm run check` (typecheck plus every registered test file), plus the
focused suites. Results are recorded with the run that produced them; the
permanent regression is the test suite itself.

| Suite | Scope | Result |
| --- | --- | --- |
| `npm run typecheck` | `tsc --noEmit` | PASS |
| `npm test` | all registered files, including the new shell suites | see §4.1 |
| `npm run test:shell` | grammar, plan, policy, approvals, profile | PASS |
| `npm run test:sandbox` | projection, export scanning and refusals | PASS |
| `npm run test:containment` | real containment, declared target only | PASS |
| `npm run test:manifest` | Goal 2 manifest | PASS |
| `test/shell-manifest.test.ts` | Goal 3 manifest | PASS |
| `git diff --check` | whitespace | PASS |

### 4.1 Effect evidence (declared target, real processes)

Every row below is an executed effect assertion in
`test/shell-containment.test.ts`, not an initialization message.

| Property | Evidence |
| --- | --- |
| Ordinary offline workflow | `npm run typecheck && npm run test:manifest` runs inside containment over a projection of this repository (files > 1000), exits 0, and produces **no** host effect |
| Isolation | host secret files, the trusted user root and `$HOME` credential files are unreadable inside; the projection contains no secret bytes; host-side positive control reads them |
| Closed networking | TCP loopback and external, UDP bind, DNS and a Node socket connect all fail inside containment while a host listener control succeeds; no `network*`/`mach*` rule exists in the profile |
| Descriptor envelope | a deliberately inherited fd 3 is unreadable inside (`FD3-CLOSED:…`) with a plain-spawn control that reads the same fd (`FD3-CONTENT:FD-SECRET-VALUE`); the launcher closes descriptors through the process descriptor limit, not a 3–255 scan |
| Nested confinement | `sandbox-exec` inside containment fails with `sandbox_apply: Operation not permitted` (exit 71) |
| Constructed environment | the child environment is exactly the constructed set; `SSH_AUTH_SOCK`, `NODE_OPTIONS`, `DYLD_*`, `BASH_ENV`, proxy variables and provider keys are absent |
| Process-group quiescence | an entry that exits while leaving a same-group descendant is killed; the descendant's later write never reaches the host, with an unsandboxed control that does write |
| Sealed export bytes | the exported digest equals the sealed buffer authorized before the effect; a survivor that rewrites the projection afterwards cannot change the host object |
| Synthetic Keychain boundary (B1/B6) | a synthetic keychain item created in a temporary keychain is readable on the host and **not** inside containment; the user keychain search list is unchanged before/after |
| Helper object binding | component identity mismatch, create-over-existing, wrong leaf identity, `nlink != 1`, and a symlinked component are all refused; a verified create succeeds |
| Post-verification swap | with a deterministic pause barrier, swapping the verified parent directory makes the effect land in the moved (verified) directory; the attacker directory receives nothing |
| Child link tricks | child-created symlinks and hard links are refused at export; nothing is created on the host |
| Prepare/dispose | a prepared invocation leaves no writable authority and removes its own artifacts |
| Mode and content export | a child `chmod` plus append is exported through the bound descriptor with the projected mode |
| Refused effect safety | a 300 KB payload refused by the helper (wrong root identity) neither crashes the host nor writes anything; a short payload is detected before the effect, so a refused `replace` leaves the target byte-identical |
| Parser termination | single-quoted strings containing newlines parse (preserving the byte) instead of looping; a refused multi-line double-quoted string is a bounded refusal |

### 4.2 Regression suites (platform-neutral)

* `test/shell-grammar.test.ts` — supported grammar, exact structures, source
  spans, refusals by code for every unsupported construct, all parse limits.
* `test/shell-plan.test.ts` — operand collection, redirection targets, device
  exceptions, `cd` tracking, subshell cwd isolation, external/dynamic
  refusals, nested-string recursion and depth refusal, sealed-input spans,
  command-risk table (including `npm publish`, `git push`, `npm install`),
  wrapper unwrapping, strictest-class merging, deterministic plans.
* `test/shell-policy.test.ts` — DENY precedence, invalid configuration, forged
  source sets, `ASK` requiring approval for *every* invocation, risk-class
  outcomes, edit contribution constraining mutations.
* `test/shell-approvals.test.ts` — prompt content, single use, every bound
  input invalidating the grant, expiry, forged/absent grants, missing UI,
  refusal, malformed responses.
* `test/seatbelt-profile.test.ts` — deny-default shape, no network/Mach rule,
  workspace never a root, literal-only ancestor metadata, family coverage
  against the accepted classifier's rule reasons, path character refusals,
  toolchain-root derivation, determinism.
* `test/projection.test.ts` — exclusions (`.git`, policy dir, sensitive and
  secret names, `.env.example`, hard-link aliases, external and absolute
  symlinks, chained symlinks), no excluded bytes in staging, mode/identity
  preservation, protected zones, invalid configuration, limit refusals,
  case aliases.
* `test/export.test.ts` — replace/create/mkdir/unchanged/removed, effect
  ordering, symlink and hard-link refusals, type changes, excluded and
  protected paths, mode-only changes, unbound-ancestor refusal, no helper call
  for denied effects, protocol name validation.

## 5. Adversarial and failure-path coverage

| Case | Outcome |
| --- | --- |
| Unsupported syntax (`$(…)`, backticks, globs, here-docs, `&`, keywords) | refused before any process exists |
| External/absolute operands | refused (`SHELL_EXTERNAL_PATH`) |
| `source` / script input | bound read, sealed copy, token rewrite; dynamic forms refused |
| Nested `bash -c` | recursively classified with a depth limit; sealed inputs inside nested strings refused |
| Denied commands (`curl`, `sudo`, `rm`, `launchctl`, `security`, `gh`, `docker`) | refused or approval-bound by fixed tables; `DENY` never approvable |
| Project configuration that weakens policy | impossible: v1 schema has no path selectors; invalid configuration denies the invocation |
| `ASK` outcomes | every invocation requires a single-use, fully bound approval; no command-name exemption |
| Approval replay / TTL / binding drift | refused (see approval suite) |
| Helper protocol attacks | separators, `..`, control characters, malformed integers, identity mismatch, existing leaves, `nlink != 1`, symlinked components refused |
| Export-after-quiescence-failure | export refused and reported |

## 6. Changed accepted bytes (Goal 2 manifest)

Four Goal 2 artifacts changed intentionally within this Goal; the Goal 2
manifest was updated and the old identities are preserved here so no previous
review transfers to the new bytes.

| File | Accepted (Goal 2) | Current (Goal 3) |
| --- | --- | --- |
| `package.json` | `2c1c8e28ab13938733e3d90d2529648a699243b58b60a54931f603be2271606e` | `84a2b6cb0cd68f994c699346cb70fb474e03f61782cf68627f6e5ce17caf01fa` |
| `src/policy/operations.ts` | `04ab2e7e2db2fbfae5ca7f00773049269b12f832e9ed70d3938feff57672460e` | `1dc01a317c25cf6837f8e72af9b1ab9a4ab9eae3795828a8c58cffb415a8713c` |
| `src/gate/runtime.ts` | `f9dd4f41942bd2431573177ba8a4a14c0284351a47f7f0262edcf08ed6166d08` | `44b6ceb91c030ea1bf826191afe567a79b4ceb40e9283a4c306abc45705fb024` (after the review-fix rounds in §10 and §11) |
| `test/gate-runtime.test.ts` | `22d13d475bcaf3602e30988da69b7afded5c4f540399132e45466c7f724e53e3` | `1dd63bb5b94eab2dba57d93685d16ffc644a9bba09ad1f46817699e793d9f5c1` (after the review-fix rounds in §10 and §11) |

`src/policy/resources.ts` gained one additive export
(`RESOURCE_RULE_REASONS`); classification semantics are unchanged and the
classifier suites still pass. `src/index.ts`, `docs/FILE-GATE.md`,
`docs/FILE-GATE-AUDIT.md` and every other Goal 2 artifact listed in
`docs/file-gate-hashes.json` are byte-identical to the accepted snapshot.

The historical handoff anchor `docs/file-gate-hashes.json` `7aa0e786…` is
therefore superseded by the current manifest
(`docs/shell-gate-hashes.json` covers the Goal 3 snapshot; `docs/file-gate-hashes.json`
now records the changed bytes above).

## 7. Bounded limitations (declared, not solved)

1. **B3 same-user host writers.** A host process running as the same user can
   read or modify anything the user can, including the projection, at any time.
   Ordinary projection tampering that matches legitimate child output is
   indistinguishable and is not detected. Object binding is by descriptor and
   identity, not by permanent residence under the original pathname.
2. **Mount isolation is UNVERIFIED.** A device change below the workspace root
   is refused when observed, and the refusal branch is unit-tested, but no
   unprivileged fixture can create a real mount crossing.
3. **Descendants are not parsed.** Only the entry command text (and nested
   `-c` strings) are classified; arbitrary descendant programs are bounded by
   the profile alone.
4. **`sandbox-exec` is deprecated** by Apple and pinned by identity here; an
   OS update changes the pinned bytes and blocks the route until re-verified.
5. **Projection semantics deviate** from the host: absolute workspace paths and
   host-only tooling paths do not exist inside; excluded objects are invisible
   rather than denied with a reason; `$0`/`BASH_SOURCE` inside sealed scripts
   name the sealed path.
6. **Costs**: the projection copies the workspace per invocation (measured
   ≈5 s and ≈125 MB for this repository's 12 848 files), and each effect is a
   separate helper process.
7. **Non-ASCII lookalikes** of classified families are not covered by the
   classifier or the profile.
8. **No host delete/rename**: deletions and renames inside the projection are
   reported and ignored.
9. **A failure after an effect has begun can leave a partial object.** The
   helper now receives the whole declared payload (bounded at 64 MiB) before it
   touches any host object, so a short or failed transfer refuses without
   truncating or creating anything; a failure *during* the write (for example a
   full disk, or a kill in the middle of the write syscall) can still leave a
   partial file. That is reported, and no unlink exists in the helper, so the
   artifact is not removed automatically.
10. **Linux and other macOS versions** are unsupported and fail closed; the
    hosted CI job does not exercise any containment.
11. **An abrupt host kill can leave one invocation directory** under the system
    temporary directory (mode 0700): cleanup runs on every normal path including
    refusals, but a `SIGKILL` of the host prevents it, and nothing sweeps stale
    directories automatically. The residue contains a projection of workspace
    objects that were already readable by the same user and excludes the
    classified/protected objects, so it is not a new disclosure by itself; it is
    still disk residue an operator may need to remove.

## 8. Reproduction

```sh
npm ci --ignore-scripts
npm run build:native        # explicit, no implicit compilation, no download
npm run check               # typecheck + every registered suite
npm run test:containment    # real containment evidence (declared target)
git diff --check
```

Artifact identities for this snapshot: `docs/shell-gate-hashes.json`
(Goal 3 files) and `docs/file-gate-hashes.json` (Goal 2 files, see §6). The
native helper is a build output and is deliberately not committed; its source
hash, compiler, flags and output hash are recorded in
`native/build-manifest.json` when built.

## 9. Review status

The independent reviewer ran against the first frozen snapshot (§10). Its
finding list, the fixes and the re-review of the changed artifacts are recorded
in §10 below. This document contains executor-run evidence only; reviewer-run
commands and verdicts are attributed in §10.

## 10. Independent review round 1 and fixes

Reviewer: a separate fresh-context agent, read-only with respect to the
repository, no prior involvement in the implementation. It verified the
reviewed hashes against `docs/shell-gate-hashes.json`, ran `npm run typecheck`,
`npm run test:shell` (41 pass / 1 platform skip), `npm run test:sandbox`
(18 pass), `npm run test:manifest` (1/1), `npm run test:containment` (16 pass)
and `npm test` (290 pass / 1 skip), plus its own direct helper-protocol attack
probes under `/tmp`. Verdict: **FAIL — blocking findings present**, with the
containment properties themselves holding under direct attack.

| # | Finding (reviewer-verified) | Resolution |
| --- | --- | --- |
| P1-1 | `readQuoted` never advanced the offset for a newline inside single quotes, so `buildShellPlan` spun forever — reachable from raw model/user input before any policy check | the single-quote branch now appends the byte and advances; regression cases in `test/shell-grammar.test.ts` and `test/shell-plan.test.ts` assert termination and byte preservation |
| P1-2 | `runExportEffect` had no `error` handler on the helper's stdin, so a refused effect with a payload above the pipe buffer raised an uncaught `EPIPE` in the host process | stdin errors are handled and every settle path is single-shot and guarded; `test/shell-containment.test.ts` now drives a 300 KB payload into a refusing helper and asserts refusal rather than a crash |
| P2-1 | `replace` truncated the target before the payload was read, so a short payload destroyed the host file | the helper now receives the complete payload (bounded 64 MiB, matching the export per-file bound) before it touches any host object; a refused `replace` leaves the target byte-identical, asserted by test |
| P2-2 | `env -S`/`command -p` and other wrapper flags dropped the wrapped command line, so DENY-class commands (`curl`, `ssh`) classified as `ordinary`; `npx` and `xargs` passed as ordinary command runners | wrapper flags are now explicit: unknown flags are refused, `-S`/`--split-string` is refused, `command -v/-V` is recognized as query-only; `npx`/`xargs` are no longer ordinary, and `find -exec`/`-delete` and `tar -x` carry argument-triggered risk. Regression cases in `test/shell-plan.test.ts` |
| P2-3 | The model `bash` route never passed the Pi context into the controlled execute, so a per-target export `ASK` could never be approved, and the abort signal was dropped | the controlled-run signature now carries the Pi `ctx` and the tool abort signal; `ui` and `signal` reach the contained execution path (cancellation now works on the model route) |
| P3 | `PROTOCOL`-style keyword lines without a value read past the NUL; pending invocations had no lifetime bound; a conditional hard-link assertion could pass silently | keyword lines must contain a space; prepared-but-unexecuted invocations are released after 10 minutes and on session shutdown; the hard-link test now asserts the child created the link before asserting the refusal |

Re-review of the changed artifacts is recorded in §11.

Additional P3 observations accepted without change, with rationale: the profile
keeps `(allow file-read* (literal "/"))`, which the feasibility evidence records
as necessary for absolute path resolution (it exposes root-directory names
only); the toolchain read root is the toolchain prefix derived from
`process.execPath`, which on this machine is a user-home subtree — declared in
the contract as a toolchain exception, and never a home parent; the `--pause`
flag is a test-only interleaving hook, documented in the contract and never set
by the host client.

## 11. Independent review round 2 (re-review of the fixed snapshot) and fixes

The same reviewer role (fresh context, read-only with respect to the
repository) re-verified the round-1 fixes on the current bytes. It recomputed
the reviewed hashes, rebuilt the helper from the reviewed source with the
recorded flags (same size; differences limited to the Mach-O UUID/signature
region), verified all 32 entries of `docs/shell-gate-hashes.json` with
`shasum -a 256 -c`, and ran its own probes.

Reviewer-run results: `npm run typecheck` PASS; `npm run test:shell` 45 pass /
1 platform skip; `npm run test:sandbox` 18 pass; `npm run test:containment`
17 pass; `npm run test:manifest` 1/1; `npm run test:shell-manifest` 2 pass;
`npm test` 295 pass / 1 skip / 0 fail; `git diff --check` clean. 42/42 direct
helper-protocol checks and live cancellation/approval probes passed.

Verdict: **PASS WITH FINDINGS.** Round-1 findings all CLOSED:

| Round-1 finding | Re-review verdict |
| --- | --- |
| P1-1 parser hang | CLOSED — the reviewer audited every lexer/parser loop and ran 43 adversarial inputs; the new regression tests bite |
| P1-2 EPIPE host crash | CLOSED — verified with a real fd and a 300 KB payload against refusing/slow/timeout helpers: caught refusals, single settlement, no crash |
| P2-1 replace truncation | CLOSED — verified a short payload leaves the target byte-identical, and that 0-byte and at-bound payloads, create/mkdir/replace, identity mismatches and symlink components all behave; the new test bites |
| P2-2 wrapper downgrade | PARTIALLY CLOSED — the listed forms were fixed and verified, but the reviewer found a new downgrade (below) |
| P2-3 ctx/signal/UI | CLOSED — verified end to end: abort kills the group, both approvals reach the UI, the binding is consumed once |

New findings from round 2 and their resolution:

| # | Finding | Resolution |
| --- | --- | --- |
| P1 | Five or more nested `env`/`command` wrappers fell through the unwrap budget and returned the wrapper word, so a DENY-class command classified `ordinary` | `unwrapCommand` now refuses when the budget is exhausted (never returns the wrapper for a wrapped command line); regression cases cover `env env env env env curl …`, `command command command rm …`, and 24 levels |
| P3 | The model bash `timeout` field was validated and then discarded, contradicting the contract | the timeout now reaches the contained run (bounded 1 s … 600 s); the contract states this |
| P3 | A leading comment or blank line refused the whole command | separators produced by blank/comment lines are skipped and runs of them collapse, exactly like bash; `;;` stays refused |
| P3 | Pending-invocation release had no test and no injectable bound | `pendingShellTtlMs` is injectable and `test/gate-runtime.test.ts` asserts prepared state cannot accumulate |
| P3 | Interpreter `-e`/`-c` arguments are not parsed | accepted and now stated in the contract: those arguments classify as their command's class and are bounded by the profile plus per-target export re-authorization |

## 12. Independent review round 3 (delta verification) and fixes

Round 3 verified the round-2 delta on the next snapshot. Reviewer-run results:
`npm run typecheck` clean; `npm run test:shell` 47 pass / 1 skip;
`npm run test:sandbox` 18 pass; `npm run test:containment` 17 pass;
`npm run test:manifest` 1/1; `node --test test/shell-manifest.test.ts` 2 pass;
`npm test` 298 pass / 1 skip / 0 fail; `git diff --check` clean; all 32 Goal 3
manifest entries and all 19 Goal 2 entries verified independently; the shipped
helper matched its build manifest. It also confirmed the containment
properties live with its own probes (single spawn path, closed networking with
a working host control, original workspace unreachable, per-target export
authorization, denials and approvals unchanged) and mutation-tested the new
regressions (they bite).

Verdict: **PASS WITH FINDINGS**, with the reviewed delta CLOSED (wrapper-depth
refusal, separator handling, timeout plumbing and bounds, injectable pending
TTL, and biting tests), and three new classification findings in the same
family plus two documentation overclaims:

| # | Finding (reviewer-verified) | Resolution |
| --- | --- | --- |
| P1 | `timeout` was listed as an ordinary tool although it runs its remaining arguments, so `timeout 10 sudo id` classified `ordinary` | `timeout`/`gtimeout` are unwrapped as command runners: flags, then a duration that must match a bounded form, then the command; a missing duration refuses |
| P1 | A dispatcher flag whose value was not consumed hid the subcommand (`git -c x=y push`, `npm --prefix ./x install` → `ordinary`) | the dispatcher tables now model value-taking and boolean flags per command; a flag before the subcommand that is not recognized refuses rather than guessing |
| P2 | A lone `-` broke `env` unwrapping and became the classified command name (`env - curl …` → `unknown`/ASK instead of DENY) | `-` ends option parsing for `env`, exactly like `--` |
| P3 | The contract claimed an unlisted dispatcher subcommand is refused | corrected: an unlisted subcommand takes the dispatcher's base class, and it is the flag handling that refuses when the subcommand position is ambiguous |
| P3 | The contract attributed the model route's output truncation to Pi's helpers | corrected: the bound is pi-warden's own (8 MiB streamed, 4 MiB retained tail) because the controlled tool replaces Pi's `execute` |

## 13. Independent review round 4 (exhaustive classification hunt) and fixes

Round 4 verified the round-3 delta and then enumerated command forms that make
a shell execute something other than the word the classifier treats as the
command name, checking both `buildShellPlan` and what bash actually runs (with
argument-dumping shims on PATH and the real git/npm). It confirmed rounds 1–3
findings CLOSED, confirmed N-2/N-3/N-5 CLOSED live, and found:

| # | Finding (reviewer-verified, with the exact inputs) | Resolution |
| --- | --- | --- |
| P0 | The `timeout` unwrap branch pre-sliced the word list and the shared post-loop code sliced it again with the stale index: `timeout 10 git push` and `timeout 10 npm publish` classified `ordinary` while real `timeout` ran the dispatcher, and `timeout 10 env curl …`/`sh -c '…'`/`command curl …` classified `unknown` while the denied command ran | `unwrapCommand` is now a single state machine that records `commandStart` per iteration and slices exactly once; regression cases cover all reported forms |
| P1 | `env -- NAME=VALUE command` stopped treating assignments as assignments after `--`, so the assignment word became "the command" (`curl` became approvable) | assignments are always assignments for `env`, before or after `--` |
| P2 | npm aliases/prefixes (`npm x`, `up`, `ins`, `pub`, `tok`, `view`, …) and git network/destructive subcommands (`daemon`, `send-email`, `svn`, `fetch-pack`, `send-pack`, `clean`, `reset`, `rm`, `gc`) were absent from the tables and took the ordinary base class | the tables list them explicitly, common git read-only subcommands were added, and an unlisted dispatcher subcommand now **refuses** instead of taking the base class |
| P3 | `./env`, `sub/env` were unwrapped as wrappers, so a workspace object executed by path classified as the wrapped command | wrappers are unwrapped only as a bare name or a `/usr/bin`//`/bin` spelling; any other path form refuses as execution of a workspace object by path |
| P2/P3 | Contract overclaims: the dispatcher base class was called "conservative", and sourced/script content was described as recursively classified | both statements corrected: unlisted subcommands refuse, and a sealed script's *content* is bound and hashed but not parsed (its commands run inside the same containment) |

## 14. Independent review round 5 (final classification verification) and fixes

Round 5 verified the round-4 delta on the next snapshot and then ran an
exhaustive downgrade hunt (about 200 `buildShellPlan` probes plus real-binary
probes with the installed `timeout`/`gtimeout`, `env`, `bash`, `git` and `npm`,
including registry-reach probes). It confirmed the round-4 P0 fix CLOSED
(structurally and by mutation: restoring the double-slice makes 7 tests fail),
confirmed the `env --`/`command` assignment semantics and the relative-path
refusals, verified all 32 manifest entries itself, and reported
`npm run typecheck`, `npm run test:shell` (51/52, 1 platform skip),
`npm run test:sandbox` (18), `npm run test:containment` (17),
`npm run test:manifest` (1/1), `test/shell-manifest.test.ts` (2),
`npm test` (302 pass / 1 skip / 0 fail) and `git diff --check` all passing.

Verdict: **PASS WITH FINDINGS — nothing blocking.** Two findings remained:

| # | Finding (reviewer-verified, with the exact inputs) | Resolution |
| --- | --- | --- |
| P1 | Only the bare wrapper name or a literal `/usr/bin`//`/bin` prefix was unwrapped, so `/usr//bin/env`, `/usr/./bin/env`, `//usr/bin/env` and case-shifted `ENV` were classified by the wrapper's own (ordinary) class while bash resolved and ran the wrapped command | wrapper recognition now normalizes the path lexically and compares the bare name case-folded; all those spellings unwrap, and a relative spelling still refuses as a workspace object executed by path |
| P2 | First-argument-only dispatcher tables left network-reaching forms ordinary: `npm pack <spec>`, `npm link <spec>`, `git remote update`, `git remote add -f`, `git archive --remote=` | `npm pack`/`npm link` are `network`; a bounded second-word rule classifies `git remote update|prune|set-head` and `git remote add -f|--fetch` as `network`, while `git remote add` without `-f`, `git remote -v` and `git add -f` stay ordinary |
| P3 | §10 stated that an unrecognized flag is a refusal, which is true for `env`/`command` but not for `timeout` (unknown flags are skipped; a bad duration refuses) | the contract now states each wrapper's flag handling separately and documents the spelling normalization |

## 15. Independent review round 6 (delta verification) and fixes

Round 6 verified the round-5 delta, re-verified all 33 manifest entries itself,
and mutation-tested the new regressions (four mutations, each caught by the
intended test). Reviewer-run: `npm run typecheck` clean; `npm run test:shell`
53/54 with 1 platform skip; `npm run test:sandbox` 18; `npm run test:containment`
17; `npm run test:manifest` 1/1; `test/shell-manifest.test.ts` 2; `npm test`
304 pass / 1 skip / 0 fail; `git diff --check` clean.

Verdict: **PASS WITH FINDINGS — nothing blocking**, with three further variants
of the same classification family, all fixed:

| # | Finding (reviewer-verified) | Resolution |
| --- | --- | --- |
| P1 | Case-shifted directory components (`/USR/bin/env`, `/usr/BIN/env`, `//USR//BIN/env`) are kernel-resolvable on the case-insensitive target but were not unwrapped, so the wrapped command ran while the plan classified the wrapper's own class | wrapper path matching now case-folds the whole normalized path |
| P1 | `secondWordRisk` filtered dash arguments independently, so the value of a preceding flag became the "subcommand" word (`git -c x=y remote update` → ordinary while git fetches) | both the subcommand rule and the second-word rule share one positional-word walk that consumes flag values |
| P2 | `git remote show <name>` queries the remote (the man page documents the `-n` option as suppressing exactly that query) but was ordinary | `git remote show` is `network` |
| P3 | §10 claimed a case-folded spelling guarantee that only held for the basename | corrected together with the case-folding fix; a wrapper reached by a non-system path is now `unknown` (approval required) rather than ordinary, and `env`/`command` were removed from the ordinary table for the same reason |

## 16. Independent review round 7 (final delta verification)

Round 7 verified the round-6 delta on the next snapshot, re-verified every
manifest entry itself, and mutation-tested the new regressions (baseline 25/25;
each of three mutations produced exactly the intended failure). Reviewer-run:
`npm run typecheck` clean; `npm run test:shell` 55/56 with 1 platform skip;
`npm run test:sandbox` 18; `npm run test:containment` 17;
`npm run test:manifest` 1/1; `test/shell-manifest.test.ts` 2; `npm test`
306 pass / 1 skip / 0 fail; `git diff --check` clean.

Verdict: **PASS — nothing blocking.** Round-6 findings all CLOSED
(case-folded wrapper paths, the shared positional-word walk, `git remote show`),
`env`/`command` removal from the ordinary table verified not to affect the
ordinary workflow, and the contract's §10 statements verified against the code.
The reviewer's own enumeration (19 wrapper-spelling forms, 12 dispatcher walks,
`--`/empty/quote/repeat forms) found no input whose executed-by-bash form
classifies less strictly than its real effect; every remaining divergence fails
toward refusal, `unknown` or `DENY`. Three documentation notes were applied
afterwards (naming `gtimeout` among the runners, clarifying that an absolute
path into the original workspace is stopped by the profile rather than refused,
and recording the accepted one-directional divergences); a bounded verification
of that documentation-only delta is recorded in §17.

Declared residual risk at acceptance (reviewer's wording, adopted here):

1. Dispatchers whose base class is ordinary (`npm run …`, git config aliases,
   interpreter `-e`/`-c` arguments) execute arbitrary contained content; their
   effects are bounded by the profile and by per-target export re-authorization,
   per §10 and G5.
2. The tables are a fixed subset: an unlisted dispatcher subcommand refuses and
   an unlisted command name is `unknown` (approval), so future tooling degrades
   to approval rather than to silent `ordinary`.
3. A leading assignment prefix (`PATH=…`) is not treated as affecting command
   lookup: the binary that actually runs may differ from the name, but only ever
   inside the containment.
4. Case folding is ASCII-only, matching the declared target's filesystem.

## 17. Documentation-delta verification

The three documentation notes from round 7 were applied (naming `gtimeout`
among the unwrapped runners, clarifying that an absolute path into the original
workspace is blocked by the profile rather than refused by the parser, and
recording the accepted one-directional divergences). A bounded independent
review of that documentation-only delta plus a full snapshot integrity check
ran afterwards: both manifests (32 + 19 entries) verified entry by entry, the
native helper matched its build manifest, `/usr/bin/sandbox-exec` matched the
recorded pinned identity, `npm run typecheck` was clean, `test:shell` 55/56
(1 platform skip), `test:sandbox` 18, `test:containment` 17, `test:manifest`
1/1, `shell-manifest` 2, `npm test` 306 pass / 1 skip / 0 fail, and
`git diff --check` clean. Verdict: **PASS WITH FINDINGS — nothing blocking**,
with six wording-precision notes in the safe direction. Five were corrected in
the contract (npm prefix expansion is not modeled; the workspace root's
metadata literal; the divergence examples; `timeout` handling — a missing
duration before a command refuses, while a bare `timeout` with no command
yields the wrapper and therefore approval; the stale code comment), and one was
a real gap: an unknown inline
`--flag=value` before a subcommand was skipped rather than refused, which the
code now refuses. The evidence document itself is now an entry in
`docs/shell-gate-hashes.json`, so this record is integrity-bound like the Goal 2
audit.

Round 8 verified the inline-flag fix and the five wording corrections on the
next snapshot: delta **CLOSED** (refusal wired to DENY, mutation-biting test),
all 33 Goal 3 and 19 Goal 2 manifest entries verified, the historical column of
§6 cross-checked against `git show b9060da:<file>`, and the reviewer's own
~90-form comparison against the installed git and npm found no case where the
plan is less strict than what those tools execute. Verdict **PASS WITH FINDINGS
— nothing blocking**, with two cosmetic notes (a duplicated docstring above
`positionalDispatcherWords` and a compressed phrasing in this section), both
corrected afterwards. Those two corrections are comment- and prose-only: no
executable behavior changed, and the full suite plus both manifest tests pass
on the final bytes.

## 18. Owner finding after the acceptance review: process-tree quiescence

The acceptance review of this Goal found a real non-conformance with
IMPLEMENTATION_HANDOFF line 50. The executor's quiescence step proved only that
the *original process group* was empty; the regression at
`test/shell-containment.test.ts` ("export with an unprovable process group
refuses instead of exporting") accepted a detached descendant and still
reported `quiescent: true`, contradicting its own name. The requirement is
"establish process-tree quiescence before export ... If quiescence cannot be
established, refuse export", and the sealed in-memory bytes are not a
substitute for it.

### What was changed

| Artifact | Change |
| --- | --- |
| `src/sandbox/native/piwarden-helper.c` | new `census` mode: one process-table sample (`sysctl KERN_PROC_ALL`), refusing a truncated sample rather than approximating it |
| `src/sandbox/census.ts` (new) | attribution (process group, entry's children, transitively their descendants), survivor detection by pid **and** start time, periodic sampling while the entry process runs, and best-effort killing of attributed survivors |
| `src/sandbox/quiescence.ts` (new) | projection snapshot (path, type, size, mode, mtime, device, inode, link text), deviation reporting, and the three-condition quiescence gate: group empty, no attributed survivor alive, projection unchanged for two consecutive windows — any change after the entry process exited refuses |
| `src/sandbox/freeze.ts` (new) | frozen export source: per-object copy into `<invocation>/frozen` with the import discipline (`O_NOFOLLOW`, identity before/after the read, `nlink === 1`), outside every writable root |
| `src/sandbox/containment.ts` | starts the census watch with the child, gates the export on the new quiescence result, freezes the source, scans/authorizes/applies from the frozen copy, refuses the export when the source could not be frozen, and re-verifies the measured tree immediately before any effect |
| `docs/SHELL-GATE.md` | §11 now defines quiescence (three conditions), the census attribution rules, the frozen source, and the declared limitation; §5 records the high-descriptor evidence; the guarantee list gained G5 |
| tests | deterministic regressions (below) plus 10 unit tests in `test/quiescence.test.ts` |

### Deterministic regressions (executor-run)

* **Attributed detached survivor** — the entry process spawns a descendant in its
  own group and session, stays alive long enough for a census sample to
  attribute it, then exits; the survivor rewrites the export candidate
  afterwards. Asserted: `quiescent === false`, the report names the surviving
  attributed process, `exported === false`, `export.applied` empty, and the host
  file unchanged. A host-side control runs the same survivor uncontained and
  shows it does write.
* **Silent detached survivor** — the survivor leaves the session, never writes
  during the measurement, and rewrites the candidate after the export window.
  Asserted: whatever the quiescence verdict, the host object never receives that
  write (checked after the survivor's write), and any applied effect for the
  candidate carries the digest of the state that was measured as stable. This is
  the frozen-source invariant.
* **Unit coverage** (`test/quiescence.test.ts`) — attribution (group, children,
  transitive descendants, never the host, no attribution without lineage),
  survivor identity by start time (pid reuse is not a survivor), snapshot
  deviations (content, added/removed, mode, symlink), group never empty / group
  regrows, attributed survivor (refusal *and* kill attempt), post-exit writer,
  the success path, frozen-source independence from later projection writes, and
  the freeze refusing `nlink != 1`.
* The previous test at the flagged line was replaced: no test may accept a
  survivor as quiescent.

### Descriptor evidence above 255

The envelope test now passes inherited descriptors **3, 300 and 1024** to the
launcher (with the same plain-spawn control for each) and asserts the child
reports them closed and never reads their content; the helper's close step
enumerates the process's descriptor table rather than scanning 3–255.

### Declared limitation (not B3)

macOS gives an unprivileged observer no way to prove that a descendant is gone
once it has called `setsid()` and been reparented: `kinfo_proc.kp_eproc.e_sess`
is zero on the declared build, and reparenting destroys the lineage. Such a
descendant cannot be attributed, killed or refused on. It remains confined by
the inherited profile (writable paths: the disposable projection, session home
and session temp only, verified independently by the design advisor), and the
frozen export source keeps it out of every byte, structure and decision the host
authorizes and applies. This is a limitation of the quiescence proof for a
child-controlled descendant, and it is *not* the same-user host-writer boundary.

### Review of this correction (round 9) and its findings

An independent review of the changed bytes verified the gate (no path reaches
`applyExportChanges` without an empty group, no attributed survivor, two stable
windows, a successful freeze and an unchanged re-measurement), and confirmed the
frozen sibling is unreachable for the child and any survivor by an actual
contained probe (read, list, create, append, rename-into, unlink and rmdir all
denied; a staging write as positive control succeeded). Mutation testing showed
seven of eight mutations caught, including removal of the census watch, of the
survivor check, of the start-time comparison and of the stability comparison, and
disabling the descriptor envelope (which produced a real `FD3-CONTENT` leak).
Verdict: **PASS WITH FINDINGS, nothing blocking.** Its findings and the
follow-ups applied here:

| # | Finding | Resolution |
| --- | --- | --- |
| P2 | The end-to-end silent-survivor test does not by itself catch a lost frozen source (its write lands after the export) | a deterministic regression was added: a projection the host cannot freeze (a FIFO beside a legitimate change) must produce **no** host effect and report the freeze failure; frozen-source independence itself is unit-tested |
| P3 | The census parser accepted non-decimal numeric spellings | fields must match `^[0-9]+$` |
| P3 | Frozen directories were created with the copy's mode, so an exported `mkdir` would carry 0700 | the freeze preserves file and directory modes |
| P3 | A quiescent result without a measured snapshot would have skipped the pre-apply verification | it is now an explicit refusal |
| P3 | §11 understated that a same-size, mtime-restoring writer is not detectable by the measurement | the contract now states it and bounds it to child-controlled content plus the freeze |
| P3 | An attributed survivor is killed *and* the export is refused | stated in the contract (the kill never rescues the export) |

### Round-10 verification and final precision delta

A bounded independent verification of the round-9 follow-ups returned **PASS
WITH FINDINGS, nothing blocking**: all six follow-ups CLOSED, all 37 manifest
entries recomputed and matching, the freeze-failure regression shown to bite
under the faithful mutation (falling back to live staging makes it fail with a
real `replace` effect), the census parser shown to skip hex/float/signed/empty
fields while a helper failure always refuses, directory and file modes preserved
through the freeze (probe: 0755/0700/0644/0600 round-trip), and §11 verified
against the code. Its three precision notes were then applied: the frozen
directory mode correction now fails closed instead of swallowing an error;
set-user-ID, set-group-ID and sticky bits are documented as deliberately not
propagated (the copy keeps permission bits only, which is the safe direction for
a child-created object); and the contract now says the survivor kill is
best-effort and that the *refusal* does not depend on it succeeding.

The final bounded verification of that delta returned **PASS WITH FINDINGS,
nothing blocking** (all three items CLOSED, all 37 manifest entries recomputed
and matching, all eight required commands green) with one cosmetic note: the
frozen *file* mode correction escaped as a raw filesystem error rather than a
`ShellRefusal` (downstream already failed closed). That one line was corrected
afterwards; it changes only the error type, is covered by the full suite and
both manifest tests, and introduces no new security-relevant behavior.

## 19. Owner contract decision 2026-09-18 (variant B) and the changed guarantees

The owner reviewed the observational-quiescence residual and decided: **variant
B is approved as a contract change; Goal 3 acceptance is NOT granted.** The
decision, paraphrased without weakening:

- Refusal to guarantee the termination of every descendant is accepted. A
  contained descendant that keeps working may exist, with **no** guaranteed
  lifetime or resource-consumption limits.
- The export guarantee is the **captured-bytes invariant**: only captured,
  verified and authorized bytes are applied. The contract must not promise
  absence of descendant influence *before* the capture, and must not present
  the freeze as an atomic snapshot of the tree.
- The handoff and the canonical documents must be updated accordingly, and
  claims of proven tree termination (and of a fully-everything cancellation)
  must be removed.
- Deterministic freeze-time concurrency regressions are required: a
  size-preserving, mtime-restoring write, file substitution and directory
  substitution; plus proof that the per-target authorization binds to the
  bytes actually applied.
- Additional census/`lsof` heuristics are not authorized without a concrete
  justification. No commit; no Goal 4.

### What was changed

| Artifact | Change |
| --- | --- |
| `IMPLEMENTATION_HANDOFF.md` | the Goal 3 export requirement rewritten to the variant-B contract (observational quiescence, captured-bytes invariant, explicitly *not* an atomic snapshot and *not* a descendant-termination claim); the evidence bullet now names the freeze-time concurrency regressions |
| `docs/SHELL-GATE.md` | stage [4] named observational (variant B); §11 scan intro reads "after observational quiescence and a successful freeze, the frozen export source is scanned"; the quiescence header records the owner-accepted variant; the frozen-source paragraph now states the captured-bytes invariant and the pre-capture residual (a size-preserving, mtime-restoring racing write is undetectable); the former "Not established" quiescence item became "Accepted contract boundary (variant B)" recording the unconstrained survivor lifetime/resources; G5/G6 rewritten — G5 is the captured-bytes invariant and explicitly not a tree-termination, atomic-snapshot or no-pre-capture-influence claim |
| `src/sandbox/freeze.ts` | the header comment no longer claims that *every* racing write is detected; it names the four detection signals and the declared residual; a test-only `interleave` hook (`FreezeHooks`) runs after each entry's metadata is measured and before that entry is copied; production callers never pass it and the default is a no-op |
| `test/quiescence.test.ts` | four deterministic freeze-race regressions (below) |
| `test/shell-containment.test.ts` | the authorization-binding evidence regression (below) |
| `docs/shell-gate-hashes.json` | refreshed for the intentionally changed covered files; old versus new identities below |

Old versus new identities for the intentionally changed covered files
(sha256, recorded from the last verified pre-change manifest and the current
working tree):

| File | Old (pre-decision) | New (post-decision) |
| --- | --- | --- |
| `src/sandbox/freeze.ts` | `70571532ac0cdf3ae196b9b022ebd69422c5f68395977420c5eed314f15825e7` | recorded in `docs/shell-gate-hashes.json` |
| `docs/SHELL-GATE.md` | `71c90dc944fd079648585a95665d2b1cca5dbe059f6def25a4908f859ab93497` | recorded in `docs/shell-gate-hashes.json` |
| `docs/SHELL-GATE-AUDIT.md` | `0d87baae3cd4df477d14f1cdc009242bbe066ddbebb5210b1bad3309dfae7fe1` | recorded in `docs/shell-gate-hashes.json` |
| `test/quiescence.test.ts` | `68c3fb0d02d6ad046dd603f57710f9008e3d9d042c76e973d32e6f839e5e8ae6` | recorded in `docs/shell-gate-hashes.json` |
| `test/shell-containment.test.ts` | `b6b751896e044ccfa27a136fd2455477766b5b348bfbca6f96bf436a190dc932` | recorded in `docs/shell-gate-hashes.json` |

§18 is a historical record and is not rewritten. Its sentence that the frozen
export source keeps an unattributable survivor "out of every byte, structure
and decision the host authorizes and applies" overclaimed: it described
post-capture isolation while the pre-capture residual was already declared in
§11. The current contract wording in §11 and G5 supersedes it.

### Deterministic freeze-time concurrency regressions (executor-run, `test/quiescence.test.ts`)

* **Size-preserving, mtime-restoring racing write — declared residual.** The
  hook rewrites the file in place (same length, `utimes` restores the
  measured mtime) between the per-entry identity measurement and the read.
  Asserted: the freeze *completes* (this interleaving is undetectable by
  design) and the frozen bytes are the racing writer's bytes. This is the
  documented residual: the export is not an atomic snapshot, and the applied
  content is child-controlled output that passes per-target
  re-authorization under its own digest.
* **File substitution — refused.** The hook replaces the source file with a
  different inode (rename over it) in that same window. Asserted:
  `ShellRefusal` "was replaced while being frozen" and the substituted
  content never appears in the frozen source.
* **Directory replaced by a file — refused.** The hook deletes the projected
  directory and creates a file under the same name. Asserted: the freeze
  refuses ("frozen source directory could not be read") and nothing under the
  substituted path enters the frozen source.
* **Directory replaced by a symlink — caught by the pre-apply
  re-measurement.** The hook swaps the projected directory for a symlink to a
  sibling directory during the freeze. Asserted: the freeze alone descends
  through the swapped symlink (documented), and the pre-apply re-measurement
  between the quiescence snapshot and the live staging reports a deviation
  including `sub: changed` — the layer that refuses the whole export before
  any host effect.

### Authorization-to-applied-bytes binding (executor-run, `test/shell-containment.test.ts`)

The new contained-run regression drives the real adapter, real profile, real
native helper and a recording `authorizeExport`: the contained run modifies an
imported file, the authorizer records the exact payload bytes and their
digest, and the test asserts that (a) the authorizer's payload is exactly the
captured content, (b) its digest equals `sha256(captured bytes)`, (c) the
applied effect carries that digest, and (d) the host object's bytes after the
effect hash to the same digest. Per-target authorization therefore binds to
the bytes actually applied, not to a separately re-read or recomputed state.

### Review of this contract change

A fresh independent read-only reviewer (fresh context, no reuse of prior review
evidence, own test runs) reviewed the changed bytes on 2026-09-18. Its own
verification: all 37 manifest entries independently recomputed and matching
(`node --test test/shell-manifest.test.ts` 2/2), `npm run check` typecheck PASS
with 323/324 tests passing (1 skip = the pre-existing declared non-macOS
platform skip), `git diff --check` clean, HEAD unchanged at `a80b777` and all
Goal 3 work uncommitted. It hunted for leftover proven-termination, atomic-
snapshot and no-pre-capture-influence claims (none found), verified the seam is
test-only with the sole production call site passing no hook, verified the
freeze-race tests are deterministic and exercise the claimed windows, traced
the export path (`applyExportChanges` sends only the captured `change.payload`;
the scan reads the frozen copy; freeze failure yields zero effects; the
pre-apply re-measurement refuses post-snapshot changes), and confirmed all six
elements of the owner's decision checklist.

**Verdict: PASS WITH FINDINGS, nothing blocking.** Its three P3 precision
findings were applied here:

| # | Finding | Resolution |
| --- | --- | --- |
| P3 | §11's quiescence header still pointed to the old section name "Not established by this Goal" | pointer corrected to "Accepted contract boundary" |
| P3 | G5's "captured, verified, re-authorized bytes" under-described mode-only effects: a chmod-only change is an exported `replace` effect whose content is the captured payload plus captured permission bits | G5 (and the matching handoff/STATE wording) now say "content — payload bytes and captured permission bits" |
| P3 | the freeze header's "no symlink following" was imprecise: directory descent does resolve a directory swapped for a symlink mid-copy (demonstrated by the dir→symlink regression), and the pre-apply re-measurement is the layer that refuses it | the header now states this explicitly, with the refusal layer named |

These wording fixes changed only documentation text and the freeze header
comment (no behavior change); the affected suites and both manifests were
re-run green afterwards, and the manifest was refreshed for the new bytes of
`docs/SHELL-GATE.md`, `docs/SHELL-GATE-AUDIT.md` and `src/sandbox/freeze.ts`.

## 20. Blocker: directory swap with restore bypassed the re-measurement; descriptor-bound capture

### The blocker (owner finding, reproduced by the executor)

The §19 freeze-time race tests exposed a real bypass. With the test-only
interleave hook placed on a projected directory `sub`, a same-user writer could:

1. rename the original `sub` directory to a preserved name,
2. place a symlink to an external fixture (a synthetic secret directory
   outside every writable root) under the `sub` name,
3. let the host's path-following freeze walk descend through the symlink and
   copy the external bytes into the frozen source,
4. delete the symlink and restore the original directory.

Because the swap was undone before the pre-apply re-measurement, the live
projection matched the measured snapshot exactly (`snapshotDeviation` empty)
while the frozen source already contained the foreign content — which the
scanner would then treat as ordinary new-file output and export under per-target
re-authorization. The executor reproduced this deterministically against the
§19 bytes: `deviations: []` and `SYNTHETIC-SECRET-BYTES` in the frozen copy.
The §19 layered story (freeze copies, re-measurement refuses) therefore had a
real hole: the freeze's reads were *path-based*, so the re-measurement layer was
not sufficient when the attacker controls the swap window between the
measurement and the copy.

### The fix

| Artifact | Change |
| --- | --- |
| `src/sandbox/native/piwarden-helper.c` | new `freeze` mode: descriptor-bound projection capture. The trusted parent passes two verified directory descriptors (projection root, frozen root); the walker enumerates entries through a duplicate of the held descriptor, resolves every lookup as a single component with `openat`/`fstatat(AT_SYMLINK_NOFOLLOW)`/`readlinkat`/`mkdirat`/`symlinkat` against held directory descriptors, refuses directory descent through a symlink, identity-checks every opened file and directory against the directory-entry measurement taken immediately before the open (symlink entries carry only link text, read from the name's current target and compared against the import manifest at scan), re-checks every regular file (identity, link count, size, modification time at nanosecond precision) after its bytes are read, enforces the host-provided limits against compiled caps, raises the descriptor budget for the walk depth, and refuses a truncated enumeration. An object swapped for a FIFO inside the measure→open window stalls the copy's `openat` until the host timer kills it — fail-closed, bounded by the freeze timeout. Refusal reasons interpolate projection-relative paths verbatim, so the *text* of a reported reason can be influenced by entry names; every such path still fails closed. A `--pause-name` hook (test-only, like `export --pause`) stops the walker after a measured entry so adversarial tests can swap objects deterministically. Protocol version bumped 1 → 2; the selftest reports the freeze caps. |
| `src/sandbox/helper.ts` | protocol version 2; new `runFreezeCopy` client with the protocol header, the ARMED release coordination (one awaited host callback while the helper is paused) and the refusal extraction. |
| `src/sandbox/freeze.ts` | rewritten as the descriptor-bound orchestrator: creates the frozen root (must not exist), opens and identity-verifies the projection root against the recorded staging identity (refuses a replaced or symlinked root), opens the frozen root, and delegates the whole walk to the helper. The previous JS walker and its `interleave` seam are gone; the residual comment now describes the descriptor-bound discipline. |
| `src/sandbox/projection.ts` | the import step records the staging root's device and inode in the manifest (`stagingDevice`/`stagingInode`), so the later freeze and every measurement can bind the staging tree object. |
| `src/sandbox/containment.ts` | passes the recorded staging identity to the freeze and to every projection measurement; the quiescence snapshot and the pre-apply re-measurement now verify the root object before walking. |
| `src/sandbox/quiescence.ts` | `snapshotProjection` accepts an expected root identity and refuses a measured root whose identity changed since import; the quiescence gate threads it through all measurement windows. |
| `scripts/build-native.mjs` | records protocol 2. |
| tests | rewritten freeze regressions (below); the two handcrafted helper streams in `test/shell-containment.test.ts` now speak protocol 2. |

Old versus new identities of the intentionally changed covered files (sha256,
recorded from the last verified pre-fix manifest and the current working tree;
the final post-review identities are recorded in `docs/shell-gate-hashes.json`):

| File | Old (pre-fix) |
| --- | --- |
| `src/sandbox/projection.ts` | `543c910a483efb2388350f74752d26de33b7e82dbc5b6ead1b8b6a8a930984d1` |
| `src/sandbox/quiescence.ts` | `569754e926812ad0feb5c4ff2a44f7f316b637bc0e2d196138dcf808700c494c` |
| `src/sandbox/freeze.ts` | `5ef2bdfb2c93e4d73ff7ed5c33d9425e67a6d03d09c73e2e1352a9fa72d798e6` |
| `src/sandbox/helper.ts` | `0915f6d6d7173b8ba7cdd467e69d94a7b43def0393870d1b97c7ef7a8f4fc74e` |
| `src/sandbox/containment.ts` | `a6de6622339ec293e69db35038f331e4acc6163a38073af23998c6b8ce9fc1fd` |
| `src/sandbox/native/piwarden-helper.c` | `2b2802f484bd07c4bc336613b417f1427fc65698d31b7f5a9033e6c30c6f0f7f` |
| `scripts/build-native.mjs` | `9d5bb7d07d75d602d6620c84c94370de8bc59d1a913243b9380c87e6238d7581` |
| `test/quiescence.test.ts` | `6b0041d5612fb2ae98a4d23d05abb44ee950b9377b11cd8c14b913df811666a7` |
| `test/shell-containment.test.ts` | `d43098cf794d29fd4c9a5926583c6dfd4b681e35c2e5327ac35e5172ee2a2ec2` |

### Deterministic regressions (executor-run, `test/quiescence.test.ts`)

* **Blocker regression — swap→copy→restore with an external synthetic
  secret.** The helper pauses on `sub` (after its directory identity was
  measured, before it is opened); the release hook renames the original away,
  places a symlink to the external fixture, and the helper resumes; the copy
  refuses at access time (`openat` with `O_NOFOLLOW|O_DIRECTORY` fails). The
  test then restores the original object and asserts: the freeze refused, the
  measured deviation between the pre-freeze snapshot and the restored tree is
  **empty** (documenting that the measurement layer alone cannot catch this
  swap — the access-time binding is the protection), no frozen byte contains
  the external secret content, and no frozen entry exists under the swapped
  name.
* **Descriptor-bound independence and residuals.** The frozen source remains
  independent of later projection writes; the freeze refuses `nlink != 1`; the
  recorded staging-root identity is verified (a wrong identity refuses before
  the helper runs); a size-preserving, mtime-restoring write racing the copy
  still completes and freezes the writer's bytes (the declared residual — the
  write is a single in-place write restoring the pinned modification time);
  a file substituted mid-copy is refused at the open-time identity check; a
  directory replaced by a file mid-copy is refused and nothing under it is
  frozen.
* The contained evidence suite (real adapter, real helper, protocol 2)
  passes unchanged, including the attributed-survivor refusal, the
  freeze-failure zero-effect control and the authorization-binding proof.

### The same bypass class in the other host-side readers (checked)

* `snapshotProjection` (quiescence) walks the projection by path, and the
  projection is child-writable, so the executor verified every swap-and-restore
  interleaving against the composed gate: a swap visible in only one measurement
  window produces a window-to-window deviation; a swap held across both windows
  is recorded in the quiescence snapshot and refused by the pre-apply
  re-measurement (which also verifies the root object); a swap timed inside a
  single window's walk is blind there, but the freeze then reads the restored
  or swapped object only through descriptor-bound access, and the scan's
  manifest comparison refuses a captured type change. The measurement itself is
  additionally hardened: the root object is verified against the recorded
  identity at every measurement, so a replaced projection root cannot supply a
  "stable" measurement of a different tree.
* `scanProjection`, `readSealedBuffer` and the export apply path read the
  frozen copy — a directory outside every writable root of the containment;
  the round-9 contained probe verified the child and any survivor cannot write,
  rename, unlink or even read it. Same-user host writers remain the accepted B3
  boundary.
* `importWorkspace` reads the original workspace before any child process
  exists, with the accepted resolver/classifier discipline (`O_NOFOLLOW`,
  descriptor-anchored reads); there is no concurrent contained writer at that
  point, and a same-user host writer is B3.
* The native helper never resolves a multi-component path in `export` or
  `freeze`; both walk held descriptors only.

### Review of this blocker fix (independent, fresh context)

A fresh independent read-only reviewer re-ran every check itself — all covered
manifest hashes recomputed and matching, `npm run check` typecheck PASS with
324/325 tests (the single pre-existing declared platform skip), `git diff
--check` clean, HEAD unchanged, all work uncommitted — and additionally built
its own /tmp adversarial probes against the real helper (symlink→symlink swaps,
size-changing and substitution windows, transient creates, FIFO swaps, link
lengths, external hard-link attempts) plus mutation-style probes on the
regressions. Its explicit answers: (1) **no foreign/external byte can reach the
frozen source through any interleaving it could construct** — every freeze read
is single-component against a held, identity-verified directory descriptor, and
link-text reads contribute no target bytes; (2) every swap-and-restore
interleaving ends in refusal or a manifest-compared capture (the applied bytes
are always the frozen bytes, re-authorized per target); (3) every new
deterministic regression bites (removing `O_NOFOLLOW`, the identity check, or
both reproduces the bypass); (4) the residual test is deterministic (pinned
absolute timestamps, blocking release barrier, no scheduler races).

**Verdict: PASS WITH FINDINGS, nothing blocking.** Its findings and the
follow-ups applied here:

| # | Finding | Resolution |
| --- | --- | --- |
| P2 | §11's residual enumeration ("the one write … always refused") was narrower than the implementation: a same-inode write completing between the directory-entry measurement and the open, a full substitution completing before that measurement, and a transient create in a not-yet-enumerated directory are also undetectable by the copy — each is bounded only by the scan's manifest comparison and per-target re-authorization, which the broader §11 boundary sentence already declares | the enumerating residual sentence (§11 frozen-source paragraph), G5's residual list, and the STATE.md echoes were rewritten to the accurate two-part boundary |
| P3 | "no swap of any path component — ancestor or leaf" overstated symlink leaves: a symlink→symlink swap redirects the link-text read (`readlinkat`), and the refusal comes from the scan's manifest text comparison, not the copy | §11 now says symlink entries contribute only link text, never followed, and the captured text is compared against the manifest at scan; audit §20's "identity-checks every opened object" corrected to files and directories |
| P3 | undeclared stall window: an object swapped for a FIFO inside the measure→open window blocks the copy's `openat` until the host timeout kills it | declared in §11 (fail-closed, bounded by the freeze timeout) and in §20's artifact table |
| P3 | refusal reasons interpolate entry names verbatim, so the text of a reported reason is attacker-influenceable (ARMED lines are test-only) | declared in §20's artifact table; every such path fails closed |
| P3 | the helper's own root re-verification had no isolating regression (every test reached it with a host-verified identity) | new deterministic regression: a raw protocol invocation claiming the recorded staging identity while holding a different directory's descriptor is refused with "source identity mismatch" before any walk |

These follow-ups changed only documentation text and added one test; no
production behavior changed. The affected suites and both manifests were re-run
green afterwards, and the manifest was refreshed for the new bytes.

## 21. Blocker: the measurement walk itself was path-based; descriptor-bound measurement

### The blocker (owner finding)

The §20 fix bound the *frozen capture* at access time, but
`snapshotProjection` — the quiescence measurement and the pre-apply
re-measurement — still walked the child-modifiable projection by path
(`readdir(absoluteDirectory)` plus `lstat(absolutePath)`). A swap of
`staging/sub` for a symlink to an outside directory landing in the window
between the entry's own measurement and `readdir(staging/sub)` redirected the
enumeration: the outside directory's names entered the snapshot as
`sub/…` entries, and — because the subsequent `lstat` calls resolved through
the same symlink — their metadata as well. From there the same name could
appear in the returned snapshot, in `snapshotDeviation` diagnostics, and in
the quiescence result. The layered story checked in §20 (root verification,
window-to-window comparison, pre-apply re-measurement, export refusal) does
not cover this: the *measurement itself* was the redirectable access, so the
layers that consume its output inherit the poison. The executor confirmed the
class against the pre-fix code by inspection of the walk and reproduced the
composed-gate blindness reasoning from §20 against it; the fix below removes
the redirectable access entirely.

### The fix

| Artifact | Change |
| --- | --- |
| `src/sandbox/native/piwarden-helper.c` | new `measure` mode (protocol version unchanged at 2; existing `export`/`freeze` protocols untouched): descriptor-bound projection measurement. The trusted parent passes one identity-verified projection-root descriptor; the helper re-verifies it, enumerates each directory through a duplicate of the held descriptor (refusing a truncated enumeration), resolves every lookup as a single component with `fstatat(AT_SYMLINK_NOFOLLOW)`/`readlinkat` against held directory descriptors, emits one `ENTRY` line per object (relative paths and link text hex-encoded, so no entry name or link target can break the line protocol), and descends into directories only through `openat(O_RDONLY\|O_DIRECTORY\|O_NOFOLLOW\|O_NONBLOCK)` with an identity check against the just-measured entry — a component swapped for a symlink is refused at access time (`"could not be opened for measurement"`), a directory swapped inside the measure→open window is refused (`"was replaced while being measured"`), and `O_NONBLOCK` keeps a name swapped for a FIFO from stalling the open (`O_DIRECTORY` then rejects it), so the measurement cannot hang where the freeze needed the host timer. Symlink entries contribute only their link text, read relative to the held descriptor (a failed read is reported as no text and left to the window-to-window and scan comparisons; a read truncated at the 1024-byte bound refuses — unreachable for macOS symlink targets, fail-closed). Host-provided entry and depth limits are enforced against compiled caps. No policy decision, no byte copy, and no process operation. |
| `src/sandbox/helper.ts` | new `runMeasurement` client: the protocol header (`PROTOCOL`/`ROOT`/`LIMITS`/`GO`), strict `ENTRY` line parsing (every field required; hex fields validated and decoded; an incomplete or invalid entry refuses the whole measurement), the ARMED release coordination (same test-only interleave hook as the freeze), and the `RESULT entries=N` consistency check against the parsed entries. |
| `src/sandbox/quiescence.ts` | `snapshotProjection` rewritten as the descriptor-bound orchestrator: it opens the projection root with `O_RDONLY\|O_DIRECTORY\|O_NOFOLLOW`, refuses a non-directory root, verifies the root object against the recorded staging identity when supplied (message unchanged: `"the measured root identity changed since import"`), and delegates the whole walk to the helper. The JS path-based walk (`readdir`/`lstat`/`readlink` by path) is gone; the snapshot entries are built from the helper's measured metadata with the same kinds, identity fields, full mode and link text, and the same hash discipline. `QuiescenceOptions` now carries `helperPath`, threaded into every measurement window. |
| `src/sandbox/containment.ts` | passes the helper path to `establishTreeQuiescence` and to the pre-apply re-measurement; the re-measurement verifies the staging-root object as before. |
| tests | updated to the helper-backed measurement; new regressions below. |

Old versus new identities of the intentionally changed covered files (sha256,
recorded from the last verified pre-fix manifest and the final working tree;
the final post-review identities are recorded in `docs/shell-gate-hashes.json`):

| File | Old (pre-fix) |
| --- | --- |
| `src/sandbox/quiescence.ts` | `953984f2a92ed1bfe3d48673fec41a348d6637d64f37ebbd484e3cc47ae5281c` |
| `src/sandbox/helper.ts` | `5eb0ba3654f2acbf0a211975503fcbb4cf4dc405b859f667b19c321568933d1b` |
| `src/sandbox/containment.ts` | `cb0c729ee43debbae1f544c084af4fbfb3c3d8ea9b0e139f3eec9971f8b96da0` |
| `src/sandbox/native/piwarden-helper.c` | `f4db819e6c460cb42afe0491b3ed93152aaae56cf9ed5c0ff1ab216398fcc8af` |
| `docs/SHELL-GATE.md` | `47db36eb317824a9055c21aeea080796947afd20ad6159884de52cef1973c4d5` |
| `test/quiescence.test.ts` | `510601815e592b881ed3123c6f0d26e0b917e528d0815d396dafd44f9056beea` |
| `docs/SHELL-GATE-AUDIT.md` | `f1437274d3a63f4197b132b27e4c6a527e82acfa38e9ef0b57295e8c6a975dfd` |

### Deterministic regressions (executor-run, `test/quiescence.test.ts`)

* **Blocker regression — swap before the descent with an external synthetic
  fixture.** The measurement pauses on `sub` (after its directory identity was
  measured, before it is opened); the release hook renames the original
  directory away and places a symlink to the external fixture under the name;
  the helper resumes and refuses at access time. The test asserts: the
  interleave hook was armed, the refusal fired, **the external name appears in
  neither the refusal text nor any entry of any snapshot taken before or
  after** (the synthetic name and its content never appear in the snapshot,
  the diagnostics or the results), and — after the attacker's restore — the
  measurement is blind to the completed swap (`snapshotDeviation` empty),
  documenting that the protection is the access-time descriptor binding, not
  a re-measurement.
* **A held swap is measured as a symlink, never enumerated.** With `sub`
  already a symlink to the external fixture across the whole window, the
  measurement succeeds and records `sub` as a symlink entry with its link
  text; no `sub/…` child is enumerated, the deviation against the pre-swap
  snapshot is exactly `sub: changed` (so the next window and the scan's
  manifest comparison see the change), and no external name appears anywhere.
* **The measure helper re-verifies the root descriptor itself** (defense in
  depth): a raw protocol invocation claiming a recorded identity while holding
  a different directory's descriptor is refused with
  `"measured root identity mismatch"` before any walk.
* All previous quiescence and freeze regressions pass against the helper-backed
  measurement, including the mid-freeze blocker regression and its blindness
  assertion (both sides of that comparison now use the descriptor-bound
  measurement).

Mutation checks (run in a copy of the working tree, never in place): removing
only the `O_NOFOLLOW` flag, or only the post-open identity check, still leaves
the measurement blocker regression passing (the other check refuses); the
bypass — the external directory being enumerated — reproduces only when both
checks are removed, or when the test-only interleave hook is disabled (no
deterministic swap window). The directory-to-external-symlink bypass is
therefore blocked by the **combination** of the `O_NOFOLLOW` open and the
post-open identity check, and the regression bites when either combination
protection or the interleave hook is removed.

### The whole chain of host-side traversals of the child-modifiable projection (re-checked)

* `snapshotProjection` (every quiescence window and the pre-apply
  re-measurement) — now descriptor-bound (this §). A swap can no longer
  redirect a directory open: it either lands before the entry's own
  measurement (measured as-is, no descent through a swapped symlink) or
  inside the measure→open window (refused at access time by the `O_NOFOLLOW`
  open and the post-open identity check together). A directory outside the
  projection cannot be enumerated into any snapshot, so no external name can
  reach the snapshot, the deviation diagnostics or the quiescence result
  through the measurement; a symlink swapped for another symlink redirects
  only the link-text read, which the next window or the scan's manifest
  comparison catches.
* The frozen capture (`freeze`, native) — descriptor-bound since §20; the
  measurement fix closes the last path-based reader that could be *poisoned*
  by the same swap class, and the pre-apply re-measurement now runs on the
  same descriptor-bound walk as the windows it is compared against.
* `scanProjection` and `readSealedBuffer` — in the effect-producing chain they
  read only the frozen copy, a directory outside every writable root of the
  containment (verified by the round-9 contained probe, §20). When the frozen
  source is unavailable the scan runs on the live projection for diagnostics
  only: the export is already refused or every change is ignored before any
  authorization, so no host effect can derive from that walk (code paths in
  `executePreparedInvocation`: changes computed against a missing frozen root
  are ignored with `"no host effect: the export source was not frozen"`, and a
  non-quiescent run skips the export entirely).
* `importWorkspace` and `sealInputs` — read the original workspace and the
  freshly built staging before any child process exists, with the accepted
  resolver/classifier discipline and `O_NOFOLLOW` opens; there is no
  concurrent contained writer at that point, and a same-user host writer is
  the accepted B3 boundary.
* `removeInvocationArtifacts` — cleanup only, tolerant by design, makes no
  security decision.
* The native helper never resolves a multi-component path in `export`,
  `freeze` or `measure`; all three walk held, identity-verified descriptors
  only.

### Review of this boundary (independent, fresh context)

A fresh independent read-only reviewer ran against the final bytes of this
section on the declared target: branch and HEAD unchanged, all work
uncommitted, all 37 `docs/shell-gate-hashes.json` entries recomputed and
matching the working tree, `npm run check` typecheck PASS with 328/329 tests
(the single pre-existing declared-platform skip), `npm run test:sandbox`
37/37, `npm run test:containment` 19/19, `git diff --check` clean. It built
its own /tmp adversarial probes against the real helper and the raw measure
protocol (12/12 passing: a directory swapped for an external symlink in the
measure→open window via the test hook, a directory swapped for another real
directory, a file swapped for a FIFO, a symlink swapped for a different
symlink, a mid-walk ancestor swap, a held external symlink across the whole
walk, a root identity mismatch, depth/entry caps, unreadable directories, and
a normal measurement) plus mutation-style runs on the regressions in a copied
tree. Its explicit answers: (a) **no external name reached any snapshot,
deviation diagnostic or quiescence result through any interleaving it could
construct** — the helper never resolves a multi-component path and never
follows a swapped directory component; (b) the new regressions bite, with the
combination nuance recorded above (single-check removals are caught by the
other check; the bypass reproduces only when both are removed or the interleave
hook is disabled); (c) the composed gate (quiescence windows → freeze → scan →
re-measure → apply) remains sound with the helper-backed measurement; (d) no
new residual was introduced by the fix.

**Verdict: PASS WITH FINDINGS, nothing blocking.** Its findings and the
resolutions applied here:

| # | Finding | Resolution |
| --- | --- | --- |
| P3 | the §21 regression shorthand implied each protection alone blocks the directory-to-external-symlink swap; the mutation runs showed the bypass is blocked by `O_NOFOLLOW` and the post-open identity check **together**, and the regression fails only when both are removed (or the interleave hook is disabled) | the regression bullet and the chain bullet now state the combination and the symlink-redirect bound |
| P3 | "no swap of a path component — ancestor or leaf — can redirect a lookup" overstated symlink leaves: a symlink→symlink swap redirects the link-text read (`readlinkat` has no inode re-check); no external directory is enumerated, and the change is caught by the next window or the scan's manifest comparison | the contract's quiescence item 3 and the quiescence module comment now bound the claim to directory/file opens and state the symlink-text bound explicitly |

These resolutions changed only documentation and comment wording; no
production behavior changed. The affected suites, the manifest and
`git diff --check` were re-run green afterwards, and the manifest was
refreshed for the final bytes.

## 22. Owner finding: the live-projection fallback scan after a failed export precondition

### The finding

The §21 chain table still contained a diagnostic-only read of the
child-modifiable projection: `executePreparedInvocation` called
`scanProjection` unconditionally, with `frozenRoot ?? prepared.paths.staging`
as the source. When quiescence was refused, or the freeze refused, the scan
therefore ran against the **live staging tree** — a tree a surviving writer
may still be modifying — and its output (per-entry refusals, change records,
removal reports) reached the run's diagnostics. The read was declared
diagnostic-only because nothing was applied afterwards; the owner rejected
that reasoning: a walk of a tree whose state is unproven has no trustworthy
output regardless of what a later step would do with the results, and the
read itself must not happen.

### The fix

| Artifact | Change |
| --- | --- |
| `src/sandbox/containment.ts` | the export flow now ends at the refusal when no frozen source exists. The already-known reason is recorded first (`export skipped: <quiescence detail>` or `export skipped: the export source could not be frozen (...)`), and when it exists **no** scan runs at all: no directory walk, no payload read, no manifest diff, no removal computation over the live projection. `scanProjection`'s single production call receives `stagingRoot: frozenRoot`, reachable only after `freezeProjection` returned successfully (the guard checks the recorded identity chain of both preconditions). The report and the result carry the skip reason and empty scan-layer fields instead of live-projection-derived entries. The pre-apply re-measurement and apply logic are unchanged inside the frozen-source branch. |
| `docs/SHELL-GATE.md` | the frozen-source paragraph now states that after a failed freeze the live projection is never walked, read or diffed, and the scan runs only against a successfully frozen source. |

Old versus new identities of the intentionally changed covered files (sha256,
recorded from the last verified pre-change manifest and the final working
tree; the final post-review identities are recorded in
`docs/shell-gate-hashes.json`):

| File | Old (pre-change) |
| --- | --- |
| `src/sandbox/containment.ts` | `ffa205a1888365f22932656bc9db1291696efb40cd8ad3ac376f401e6eda1ca1` |
| `docs/SHELL-GATE.md` | `68e31c59de41e56d3106b28723833404c05c05eb2357c71ec62414d50c572fc5` |
| `test/shell-containment.test.ts` | `5041b223892ec2d6d6e3bc79b4ec8144ae9d27f16a5940c27da52f61db3762d4` |
| `docs/SHELL-GATE-AUDIT.md` | `ec2c19f6c081ba9b31246ab937648394d6fac99a45d018a181b5af894e613a1c` |

### Deterministic runtime regressions (executor-run, `test/shell-containment.test.ts`)

* **Quiescence refused — the live projection is not walked, read or diffed.**
  A contained run plants an external synthetic fixture outside every writable
  root, and the child changes an export candidate, creates a FIFO, and a
  symlink to the external fixture, then exits leaving an attributed detached
  survivor. Assertions: quiescence refused with the survivor detail; the
  export ends not-exported with no applied effect; `export.refusals` is
  **empty** — a live-projection scan would have refused the FIFO and the
  external symlink by name and diffed the changed file, so their absence
  proves the scan and its payload reads never ran; the only export record is
  the export-level skip carrying the already-known reason; `SYNTHETIC-SECRET`
  and the child's staged content appear nowhere in any result; the host
  object is unchanged.
* **Freeze refused — same proof for the second branch.** The freeze-failure
  regression now additionally plants a hard link and an external symlink
  besides the FIFO and a changed file. Assertions: the export ends with the
  freeze reason; `export.refusals` is empty (no live scan); every ignored
  record is export-level (`relativePath === ""` — the former per-change
  `"no host effect: the export source was not frozen"` records are gone);
  no external or live content in any result; the host object is unchanged and
  no hard-link artifact appears on the host.
* **Mutation check.** In a copy of the working tree, restoring the fallback
  (`stagingRoot: frozenRoot ?? prepared.paths.staging`, scan unconditional)
  makes both new regressions fail (per-entry scan refusals reappear), so the
  regressions bite exactly on the removed fallback.
* **Test-suite adjustment.** The former "child-created symlinks and hard
  links cannot trick export" test relied on the removed fallback: its hard
  link made the freeze refuse, and the per-entry symlink/hard-link refusals
  came from the live-projection scan. It now creates only the symlink (the
  freeze succeeds and the scan's symlink refusal is still exercised at
  runtime); the hard link's refusal at scan level remains covered by
  `test/export.test.ts`, and the freeze-refusing path is covered by the
  extended freeze-failure regression.

### All `scanProjection` call sites (re-checked)

* Production: exactly one call, in `executePreparedInvocation`
  (`src/sandbox/containment.ts`), whose `stagingRoot` argument is the frozen
  source variable guarded by the post-freeze success check — a production
  scan therefore receives only a directory that `freezeProjection` created
  and verified. No other production module calls `scanProjection`.
* Tests: `test/export.test.ts` unit-tests the scanner itself against
  purpose-built fixtures; no production path is involved.

### The composed-gate reading discipline (re-checked, no read justified by a later prohibition)

After this §, the projection is read by the host exactly twice while its
state is not host-owned: the descriptor-bound quiescence measurements
(§21) and the descriptor-bound frozen capture (§20). Both refuse at access
time instead of following a swapped component. Everything the host reads
afterwards — the scan, the sealed payloads, the per-target authorization and
the applied effects — comes from the frozen copy, and the scan only runs when
that copy exists. There is no code path left that walks the live projection
by path after an export precondition failed: the fallback scan, the payload
reads and the removal diff are gone, not merely inert.

### Review of this chain (independent, fresh context)

A fresh independent read-only reviewer ran against the final bytes of this
section on the declared target: branch and HEAD unchanged, all work
uncommitted, all 37 `docs/shell-gate-hashes.json` entries recomputed and
matching the working tree, `npm run check` typecheck PASS with 329/330 tests
(the single pre-existing declared-platform skip), `git diff --check` clean.
It restored the fallback scan in a copied tree (`stagingRoot: frozenRoot ??
prepared.paths.staging`, scan unconditional) and confirmed both new
regressions fail exactly as designed: the freeze-refusal regression surfaced
the live-projection scan refusals for `ext-link`, `fifo`, `safe.txt` and
`trick-hard`, and the quiescence-refusal regression surfaced the refusals for
`ext-link` and `fifo` — the per-entry output this fix removes. It also
verified structurally that (a) no production code path reads or walks the
live projection after a failed export precondition (the scan guard requires a
successfully frozen source; the pre-apply re-measurement is reachable only
inside that branch), (b) the skip reason is the already-known quiescence or
freeze refusal detail, never computed from a walk, and (c) this section's
wording and the contract's frozen-source sentence describe the reads as
*removed*, not as safe-by-later-prohibition. A second mutation (skip the scan
but still compute payloads/removals from staging) is not constructible as a
distinct mutation: deriving scan output from staging inherently performs the
removed walk, which the first mutation already demonstrates.

**Verdict: PASS, no findings.**
