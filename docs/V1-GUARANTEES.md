# v1.0 Stabilized Security Guarantees

Task ID: `20260922-stabilize-guarantees`. Phase 7 checklist item:
"Stabilize the supported security guarantees" (step 1 of 4; step 2+
regression-per-guarantee, unknowns-bound, and the independent v1 audit are
separate and open).

This record is the single stabilized list of what `pi-perimeter` promises
for v1.0 and what it does not. Every promise names its exact platform,
operation, and threat boundary plus the evidence that demonstrates it.
Every known residual names its explicit bound. Nothing here exceeds the
accepted Goal 1–4 contracts and their recorded evidence; where a
user-facing line elsewhere says more, less, or otherwise, this record
governs and the disagreement is listed in §8 rather than smoothed over.

Status: draft of this Goal; stabilization wording only. No runtime,
policy, approval, sandbox, network, dependency, packaging, or CI behavior
changes. Accepted evidence bytes stay bound by their manifests
(`docs/*-hashes.json` plus the suite-enforced `CHANGED_IN_*` records).

## 1. How to read this

- **P-items** are promises. Each states the exact boundary (declared
  target, operations, threat) and cites the contract section, the audit
  section, and the regression suite that demonstrate it.
- **R-items** are explicit non-promises. Each states the bound that
  applies instead. An R-item is not a roadmap commitment.
- "The declared target" means macOS 27.0 (build `26A428`), arm64, pinned
  `/usr/bin/sandbox-exec` identity `sha256
  58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8`,
  Pi `0.84.4` the only verified peer, Node `26.8.1` (target) /
  `22.19.0` (hosted Linux floor). The only verified rows are in
  [COMPATIBILITY.md](COMPATIBILITY.md); hosted CI covers the
  platform-independent Linux suite only and supplies no containment
  evidence ([CI-EVIDENCE.md](CI-EVIDENCE.md)).
- Approval and containment are separate controls. Approval never implies
  sandboxing, and containment never implies authorization.

## 2. Authorization promises (Goals 1–2)

**P1. Monotonic authority.** The effective decision is the join of the
baseline with every applicable restriction under `ALLOW < ASK < DENY`,
strictest wins. Project-controlled configuration can only preserve or
strengthen the baseline; it cannot create authority, weaken a restriction,
grant approval, or remove a containment requirement. An approval satisfies
one specific matching `ASK` only; it never overrides `DENY`, never cancels
containment, and never transfers across resource, operation, or session.
Boundary: all `read`/`write`/`edit` decisions, every platform.
Evidence: [MONOTONIC-POLICY-AUTHORITY.md](MONOTONIC-POLICY-AUTHORITY.md)
§§3.1–3.4 (join table, `SANDBOX` as a separate axis), §4 source roles;
suites `test/authority.test.ts`, `test/merge.test.ts`.

**P2. Bounded configuration loading.** Exactly one optional user/global
source and one optional project source, fixed locations, fixed loader
positions as the only source identity (embedded role/trust labels are
rejected as unknown keys). Strict version-1 schema, no coercion or
aliasing. Whole-source failure domains: an invalid source denies every
decision consuming it; absence contributes nothing. Issued values are
immutable and bound to the canonical workspace they were loaded for.
Boundary: `read`/`write`/`edit` effective evaluation, every platform.
Evidence: [CONFIGURATION-AUTHORIZATION.md](CONFIGURATION-AUTHORIZATION.md)
§§Bounded schema, Sources and lifecycle, Effective decisions;
[CONFIGURATION-AUTHORIZATION-AUDIT.md](CONFIGURATION-AUTHORIZATION-AUDIT.md);
suite `test/configuration.test.ts`.

**P3. Fixed path baselines.** Ordinary inside-workspace targets allow
(where existence requirements hold), ordinary external targets ask,
secret/sensitive targets deny, missing edit targets deny, ambiguous or
unresolvable identity denies. An `ALLOW` here is a default path-rule
result only and cannot bypass a stronger restriction (P1).
Boundary: `read`/`write`/`edit` baselines before composition.
Evidence: [READ-PATH-DECISIONS.md](READ-PATH-DECISIONS.md),
[WRITE-PATH-DECISIONS.md](WRITE-PATH-DECISIONS.md),
[EDIT-PATH-DECISIONS.md](EDIT-PATH-DECISIONS.md) and their audits; suites
`test/decisions.test.ts`, `test/write-decisions.test.ts`,
`test/edit-decisions.test.ts`, `test/resources.test.ts`,
`test/paths.test.ts`.

## 3. File-gate promises (Goal 2)

**P4. Central mediation with fail-closed coverage.** Every supported
model-facing file tool (`read`, `write`, `edit`, `grep`, `find`, `ls`)
passes one authorizer. Every other tool name, including dynamically
registered tools and lost/overridden same-name registrations, is blocked.
`grep`/`find`/`ls` run as controlled same-name replacements that
canonicalize and classify every entry before reading; secret/sensitive,
protected-zone, external-escaping, and broken-symlink entries are withheld
without read-then-filter; excluded directories are neither emitted nor
descended into; symlinked directories are never descended into. No helper
process performs these reads.
Boundary: the six tools on every platform; shell routes stay blocked by
this gate (containment belongs to §4).
Evidence: [FILE-GATE.md](FILE-GATE.md) §§Scope, Operation mapping,
Authorization sequence, Controlled search and listing tools, Unknown tools;
[FILE-GATE-AUDIT.md](FILE-GATE-AUDIT.md) §§Scope, Machine evidence,
Fresh independent review, What the implementation guarantees;
`docs/file-gate-hashes.json`; suites `test/gate-runtime.test.ts`,
`test/controlled-traversal.test.ts`, `test/package-compat.test.ts`.

**P5. Execution bound to the authorized object.** Controlled
`read`/`write`/`edit` effects consume a one-time plan captured from
trusted host code before any approval dialog and bind the effect to the
planned object: through the verified directory-descriptor chain where
descriptor-relative execution is available, or through an `O_NOFOLLOW`
direct open verified against the plan on macOS, where every creation
variant refuses. Approval delay cannot rebind the object. Residuals:
one microsecond-scale open-to-verify window per chain step on the
descriptor-relative class; a substitute reusing the authorized inode
number with reproduced size/timestamp on the direct-leaf class.
Boundary: direct file effects; creation exists only on the
descriptor-relative class.
Evidence: [FILE-GATE.md](FILE-GATE.md) §§Authorization sequence,
Explicit limits; [FILE-GATE-AUDIT.md](FILE-GATE-AUDIT.md)
§§Explicit limitations; suite `test/gate-runtime.test.ts`.

**P6. Exact single-use approvals.** An effective `ASK` opens one dialog
showing tool, operation, requested and canonical resource, workspace,
reason, one-call scope, and protection status. Single use, consumed by
that call, no persisted state; session replacement discards every
binding. `DENY` and protected-zone denials are never approvable and open
no dialog. Refusal, unavailable UI, thrown dialogs, timeouts, replay,
expiry, or target/operation/session mismatch blocks execution.
Boundary: file-tool approvals, every platform.
Evidence: [FILE-GATE.md](FILE-GATE.md) §§Scoped approvals,
Protected control-plane resources; suite `test/approvals.test.ts`.

**P7. Control-plane protection.** The Pi agent directory (from Pi's own
supported directory API) and the trusted user-policy root deny every
resource at or below them, above workspace allowance, configuration
outcomes, and any approval. Zones come from trusted host inputs only;
repository-controlled files cannot weaken or redefine them.
Boundary: structural zones, every platform.
Evidence: [FILE-GATE.md](FILE-GATE.md) §Protected control-plane
resources; suites `test/gate-runtime.test.ts` (override test),
`test/projection.test.ts`, `test/export.test.ts` (refusal rows).

## 4. Contained-shell promises (Goal 3, variant B)

All promises in this section hold on the declared target only. Off-target
the shell route is blocked by `verifyPlatform`; blocking is the promise
there (P13 in §6 covers the refusal table).

**P8. Containment or nothing.** Both supported routes (model `bash`,
user `!`/`!!`) either run inside the verified containment of
[SHELL-GATE.md](SHELL-GATE.md) §7 or do not run at all. Missing or
identity-mismatched `sandbox-exec`, missing/unverifiable native helper,
failed profile generation, failed self-test, cancellation, timeout, spawn
or helper failure are distinct reported outcomes; none degrades to an
unrestricted run. Unsupported shell forms (model `powershell`, unknown
tools) stay blocked.
Boundary: declared target, both routes.
Evidence: [SHELL-GATE.md](SHELL-GATE.md) §§1–2, 4, 7, 12/G1;
[SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md) §4.1 effect evidence, §5
adversarial and failure-path coverage; `docs/shell-gate-hashes.json`;
suite `test/shell-containment.test.ts`.

**P9. Private projection and constructed environment.** The child sees a
private projection, never the original workspace. Import classifies and
authorizes every entry on the original object before any byte is read;
`.git`, project policy sources, protected zones, sensitive/secret entries,
non-regular files, and multi-linked files are excluded; symlinks are
recreated only for in-projection singly-linked targets and never followed
on descent. The environment is constructed from `{}` (`PATH`, `HOME`,
`TMPDIR` inside the invocation, locale, `SHELL`); provider credentials,
secret-name patterns, agent state, loader controls, and proxy variables
are absent by construction. The launcher closes every descriptor above
stdio before `exec`. Descendants inherit the same restrictions.
Boundary: declared target, one invocation.
Evidence: [SHELL-GATE.md](SHELL-GATE.md) §§5–7, 12/G2;
[SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md) §§4–5, 7;
suites `test/projection.test.ts`, `test/seatbelt-profile.test.ts`,
`test/shell-containment.test.ts`.

**P10. Bounded grammar with conservative policy.** The entry string is
parsed by a bounded lexer/parser with fixed limits; anything not exactly
representable is refused. Command-risk classes come from fixed
repository tables: denied classes (`privilege`, `system`, `credential`,
`network` while closed, `publish`, unsupported builtins) deny; unknown
and destructive ask; only `ordinary` may allow, and an `ALLOW` never
waives a stronger risk or resource outcome. Every `ASK` invocation
requires approval with no read-only exemption. The parser is advisory
with teeth; the profile and the controlled export remain the enforcement
boundary.
Boundary: declared target, static command text plus sealed script bytes
(§9 of the contract); interpreter-string arguments are not parsed and are
bounded by the profile and per-target re-authorization instead.
Evidence: [SHELL-GATE.md](SHELL-GATE.md) §§8–10;
suites `test/shell-grammar.test.ts`, `test/shell-plan.test.ts`,
`test/shell-policy.test.ts`.

**P11. Fully bound single-use shell approvals.** One private in-memory
record per invocation: single-use, at most 60 s, bound to the exact
rewritten command hash, parsed form, workspace/cwd, runtime instance and
session epoch, loaded policy states, profile hash, environment hash,
sealed input hashes, and static resource outcomes. Any mismatch, expiry,
replay, missing UI, or malformed/refused response blocks execution. The
grant authorizes one contained run only: it never satisfies a `DENY`,
never widens the profile or the network, and never pre-authorizes a host
write — every export effect carries its own fresh decision.
Boundary: declared target, one invocation.
Evidence: [SHELL-GATE.md](SHELL-GATE.md) §10;
suite `test/shell-approvals.test.ts`.

**P12. Authorized export only, under observational quiescence.** Host
effects exist only for individually re-authorized projections of changed
or created objects, through bound objects and the native helper. No host
delete, rename, or last-writer-wins overwrite exists. No effect is applied
until observational quiescence holds (process group empty, no attributed
invocation process alive, projection unchanged for two consecutive windows
after entry exit); an attributed survivor is killed and refuses the
export. The applied bytes are exactly the captured, verified,
re-authorized content of the descriptor-bound frozen copy (payload bytes
plus captured permission bits; set-user/group-ID and sticky bits are not
propagated) — the captured-bytes invariant. With no trusted frozen source
the export ends with the already-known refusal and no projection walk at
all. This is explicitly not descendant termination, not an atomic tree
snapshot, and not freedom from pre-capture influence (R3).
Boundary: declared target; one canonical workspace root, one device, no
mount point below the root.
Evidence: [SHELL-GATE.md](SHELL-GATE.md) §§11–12/G4–G6;
[SHELL-GATE-AUDIT.md](SHELL-GATE-AUDIT.md) §§4–5, 7 plus the
variant-B/freeze/measure/no-read-after-refusal record;
suites `test/export.test.ts`, `test/quiescence.test.ts`,
`test/shell-containment.test.ts`.

## 5. Restricted-network promises (Goal 4)

These extend §4 on the same route and target; with an empty scope the
profile and environment are byte-identical to Goal 3 and P8–P12 hold
word for word.

**P13. Destination-exact pinned enforcement.** A contained invocation
runs with zero network rules or with exactly one rule granting only its
per-invocation broker endpoint (one TCP port on local addresses; the
profile language has no single-address form), and no Mach rule is ever
emitted. A tunnel opens only on an exact host+port match against the
pinned scope and dials only the addresses pinned at preparation (host-side
resolution with public-address validation; no re-resolution). Empty scope
is byte-identical to Goal 3. Child-originated DNS does not exist; UDP,
listening, Unix-domain, and Mach routes stay kernel-denied; redirects,
rebinding, proxies, alternate encodings, and `http://` transfers fail
closed; a destination whose addresses change mid-invocation fails closed
for that invocation and re-pins on the next.
Boundary: declared target; tools that honour the proxy variables and
speak HTTP CONNECT (others fail closed); TLS clients needing the system
CA file fail closed.
Evidence: [NETWORK-GATE.md](NETWORK-GATE.md) §§2, 5–7, 11/N1–N2, N5;
[NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md) §§2–6 (probe matrix,
effect matrix, positive controls, registered suites, mutation checks);
`docs/network-gate-hashes.json`; suites `test/network-policy.test.ts`,
`test/network-effects.test.ts`, `test/seatbelt-profile.test.ts`.

**P14. Narrow scope composition.** The scope comes only from
trusted-configuration entries plus per-invocation approvals for
representable destinations; project data can only restrict it; no
repository, model, or tool-output value can widen it. No approval
satisfies a `DENY` or a protected-resource refusal. Authority is bound to
the displayed destination identity, the pinned addresses, the broker
endpoint, the command, workspace, runtime instance, session epoch, policy
state, profile, and constructed environment; mismatch, expiry, replay, or
disposal blocks before any byte flows. The broker refuses every request
before arming and dies with the invocation.
Boundary: every invocation, declared target.
Evidence: [NETWORK-GATE.md](NETWORK-GATE.md) §§5–7, 11/N3–N4;
[NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md) §§4–6, 8;
suites `test/network-policy.test.ts`, `test/network-effects.test.ts`,
`test/shell-approvals.test.ts`.

**P15. No cross-boundary weakening.** Allowing network access cannot
reveal host credentials, expand filesystem permissions, override `DENY`,
or remove containment: P1–P2, P7, and P9 hold unchanged on the network
route. With an empty scope every reachable effect is unchanged from Goal 3.
Boundary: declared target.
Evidence: [NETWORK-GATE.md](NETWORK-GATE.md) §§10–11/N7;
[NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md) §§4, 8.

## 6. Platform, distribution, and evidence promises

**P16. Declared target with fail-closed refusal.** Verified: macOS 27.0
(26A428) arm64 with the pinned `sandbox-exec` identity, Pi `0.84.4`,
Node `26.8.1` (full local suite) and `22.19.0` (hosted Linux floor,
platform-independent suite). Refused by mechanism: any other Darwin
major, any other architecture, the shell route off-target
(`verifyPlatform`), Windows in every respect, non-darwin native-helper
builds. Below-floor Node is unsupported by declaration only
(`engines`, advisory). The similarly named unscoped package on the public
registry is another maintainer's project; installing that name does not
install this one. No other version, platform, or installation path is
verified or supported.
Boundary: as tabled per dimension; a passing check on one target never
widens another row.
Evidence: [COMPATIBILITY.md](COMPATIBILITY.md) (matrix, per-dimension
sections, evidence index); `src/sandbox/containment.ts`
(`verifyPlatform`), `scripts/build-native.mjs`;
suite `test/package-compat.test.ts`.

**P17. Unpublished distribution with inert safeguards.** The publishable
identity is `pi-perimeter` at `0.0.0`, unpublished. `private: true`
blocks accidental publish; no `pre*`/`post*` lifecycle scripts exist; CI
never publishes; provenance is unwired by design until a release
decision; the build-output directory never enters the tarball; the
contracts and audits ship as the documented limitations. There is no
installation path and no supported installation.
Boundary: the repository as distributed; publication and provenance are
separate explicit maintainer decisions that have not been taken.
Evidence: [PACKAGING.md](PACKAGING.md); suites
`test/packaging-identity.test.ts`, `test/package-lifecycle.test.ts`;
`docs/packaging-hashes.json`.

**P18. Counted, platform-tagged regression evidence.** `npm run check`
(typecheck plus the full suite) is the local gate: 388 tests / 387 pass /
0 fail / 1 declared platform skip at the release-review acceptance
commit. Hosted CI asserts the declared per-platform counts
(`test/ci-test-budget.json`, `scripts/assert-test-outcome.mjs`) on Linux;
the assertion verifies counts, not test identities. Darwin containment
suites execute executor-locally on the declared target; they skip (never
pass vacuously) off-target by their own platform conditions.
Boundary: `linux` budget only; no `darwin` hosted budget exists.
Evidence: [CI-EVIDENCE.md](CI-EVIDENCE.md) §§1–5 (workflow, run history,
limits, assertion); suites `test/ci-budget.test.ts`,
`test/ci-manifest.test.ts`; `docs/ci-hashes.json`.

## 7. Explicit non-promises and residuals

**R1. Mount isolation is UNVERIFIED.** A mount point below the workspace
is refused when observed (device-mismatch refusal), but no unprivileged
fixture can create a real mount crossing, so isolation across mounts is
not established and not claimed. Bound: P5, P9, P12 refuse on observed
device mismatch; nothing beyond that is promised.

**R2. Same-user host writers (B3) are outside every claim.** A host
process running as the same user can read or modify anything the user
can, at any time — including ordinary tampering with the disposable
projection and, while an invocation is armed, reaching the loopback
broker endpoint under the same frozen scope. The broker adds no authority
beyond the pinned scope and keeps no record of local callers. Bound: P9,
P12–P14 assume no same-user host writer; such a writer is an accepted
limitation, not a bypass of a promise.

**R3. No descendant-termination guarantee (variant B).** Observational
quiescence proves termination of everything the host can attribute, not
of every descendant: a child that calls `setsid()` and is reparented
between census samples cannot be attributed, killed, or refused on, and
its lifetime and resource consumption are unconstrained. The export
promise is exactly the captured-bytes invariant (P12). Pre-capture
influence is bounded, not absent: a write racing an already-opened object
is detectable unless it preserves size and exact nanosecond mtime; a
write or substitution landing before the object's own measurement is
bounded only by the scan's manifest comparison and per-target
re-authorization. Descendant programs are not parsed; their effects are
bounded only by the profile.

**R4. Class 1 Linux runtime evidence stays open.** The
descriptor-relative file-gate path is the Linux path and the
platform-independent suites exercise it in CI configuration, but no Linux
runtime execution against the accepted bytes was recorded, and no hosted
run covers it. No Linux support follows from this record, and none is
committed to.

**R5. Keychain: synthetic probe only.** Exactly one synthetic-Keychain
effect test bounds the claim (`test/shell-containment.test.ts`, recorded
as a result row in the shell-gate audit). No Keychain isolation is
promised; brokered-service access beyond that probe is uncovered.

**R6. Endpoint exfiltration is declared, not prevented.** An allowed
network endpoint can receive any data the contained process can read
(P15/N6). Permitted destinations are an exfiltration boundary by policy
approval, not a data-confinement guarantee.

**R7. Classification is content-blind.** An `ordinary` result proves
nothing about file contents; secret material inside ordinarily named
files is not detected. Path classification is defense in depth, not
secret discovery.

**R8. Relay surface of the broker rule.** The profile rule is port-exact
but local-address-scoped (the profile language has no single-address
form): during the invocation another local listener on the same ephemeral
port and another local address would also be reachable by the child. This
grants no remote destination; the port is host-generated per invocation.
Same-user callers are R2, not a separate promise.

**R9. No host delete/rename effects; limited creation.** Deletions and
renames inside the projection have no host effect; missing entries after
a run are reported as ignored. Direct file-tool creation is unavailable
on macOS (direct-leaf class) and exists only where descriptor-relative
execution makes it bindable. An abrupt host kill can leave one invocation
directory in the system temporary directory; the projection costs a full
copy per invocation.

**R10. Version and peer bounds.** `peerDependencies: "*"` is a declared
range, not a verified one; Pi `0.84.4` is the only verified peer and
every other version (including a locally installed newer CLI) is
untested. `22.19.0 < version ≠ 26.8.1` is untested. TLS SNI is opaque to
the broker: a pinned endpoint may co-host other virtual hosts.

**R11. Evidence bounds.** Hosted CI verifies counts, not test identities,
on Linux only; it is never containment evidence. Darwin containment
evidence is executor-local on the declared target. A stale review PASS
never transfers to different bytes; each acceptance binds to its
manifest SHA-256 in [STATE.md](STATE.md).

## 8. Agreement with user-facing documents

Read 2026-09-22 against this record (executor check; §9 records the
method). Verdict per document:

| Document | Verdict |
| --- | --- |
| `README.md` (status, Goal, implementation status, does-not-provide list, Platform, Installation, Security notice) | Agrees. The does-not-provide list matches R2, R4–R5, R7, R9; the Platform section matches P16/R4; installation matches P17. |
| `SECURITY.md` (What to trust / Do not trust, three controls, disclosure) | Agrees. Trust bullets match P1–P2, P4, P8–P9, P13–P14; distrust bullets match R2, R4–R9; approval/containment separation matches §1. |
| `ARCHITECTURE.md` (status, §1 integration, §§8–11 sandbox/network/environment/status) | Agrees for the integrated routes. §§2–5 status lines ("not integrated", "enforcement planned") describe the unenforced policy primitives as such; they do not describe the integrated gates, whose behavior is owned by P1–P7 and the gate contracts. Recorded here, not rewritten: those lines understate rather than overstate. |
| `THREAT_MODEL.md` (vocabulary, matrix, network/credential/sandbox sections) | Agrees. The network section marks Goal 4 implemented with the R2/R6/R8 residuals; Keychain and content-blindness match R5/R7. The "Planned response" column header and the monotonic-authority "plans" wording are historical vocabulary that understates the accepted Goals 1–4; recorded here, not rewritten. |
| `docs/COMPATIBILITY.md` (matrix, per-dimension sections, not-claimed list) | Agrees verbatim with P16–P18 and R4/R10–R11. |
| `docs/PACKAGING.md` (identity, safeguards, checklist, outstanding) | Agrees with P17; it creates no guarantee (stated in its Outstanding section). |
| `docs/CI-EVIDENCE.md` (workflow, limits, assertion, accepted bytes) | Agrees with P18/R11; hosted runs after its acceptance live in [STATE.md](../STATE.md) and the per-Goal audits by design (append-only bound bytes). |
| Gate contracts and audits | Authoritative for their Goals; this record adds no wording beyond them. Stale status lines inside accepted evidence bytes (e.g. the file-gate contract's "acceptance pending" wording) are historical evidence, bound by `docs/file-gate-hashes.json`; the live status is [STATE.md](../STATE.md). |

No line in the documents above was found to promise more than P1–P18,
so this Goal makes no wording change to any of them. Any future line
that does is a finding against this record until corrected or added here
as an explicit R-item.

## 9. Evidence index

| Promise | Contract | Audit | Suite(s) | Manifest |
| --- | --- | --- | --- | --- |
| P1 | MONOTONIC-POLICY-AUTHORITY §§3–4 | CONFIGURATION-AUTHORIZATION-AUDIT (join/absence findings) | authority, merge | — (policy primitive, suite-enforced) |
| P2–P3 | CONFIGURATION-AUTHORIZATION; READ/WRITE/EDIT-PATH-DECISIONS | CONFIGURATION-AUTHORIZATION-AUDIT; per-path audits | configuration, decisions, write-decisions, edit-decisions, resources, paths | — |
| P4–P7 | FILE-GATE | FILE-GATE-AUDIT | gate-runtime, controlled-traversal, approvals, package-compat, projection, export | file-gate-hashes.json |
| P8–P12 | SHELL-GATE §§1–12, §14 | SHELL-GATE-AUDIT §§4–5, 7–22 | shell-grammar, shell-plan, shell-policy, shell-approvals, seatbelt-profile, shell-containment, projection, export, quiescence | shell-gate-hashes.json |
| P13–P15 | NETWORK-GATE §§2, 5–7, 10–12 | NETWORK-GATE-AUDIT §§2–9 | network-policy, network-effects (+ shell suites above) | network-gate-hashes.json |
| P16 | COMPATIBILITY | CI-EVIDENCE §3; release-review audit | package-compat | compatibility-hashes.json |
| P17 | PACKAGING | release-review audit (safeguards verified live) | packaging-identity, package-lifecycle | packaging-hashes.json |
| P18 | CI-EVIDENCE §§1–5 | per-Goal audits (executor vs reviewer runs) | ci-budget, ci-manifest | ci-hashes.json |
| R1–R11 | SHELL-GATE §§11–12; NETWORK-GATE §12; FILE-GATE Explicit limits; COMPATIBILITY Not claimed | SHELL-GATE-AUDIT §7; NETWORK-GATE-AUDIT §9; FILE-GATE-AUDIT Explicit limitations | (declared bounds, not behaviors) | — |

## 10. Limits of this record

- Stabilization only: it closes no other Phase 7 item, no Phase 7 gate,
  and authorizes no release, tag, publication, `private: true` removal,
  provenance wiring, push, or real-profile installation.
- Every promise is bounded by its cited sections; no broader
  exfiltration-resistance, malware-containment, VM-equivalence, or
  cross-version/platform claim is made.
- Acceptance of this Goal closes only "Stabilize the supported security
  guarantees" and binds to the manifest in
  [v1-guarantees-hashes.json](v1-guarantees-hashes.json) plus the review
  record in [V1-GUARANTEES-AUDIT.md](V1-GUARANTEES-AUDIT.md).
