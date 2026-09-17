# File Gate Audit and Provenance (Goal 2)

Task ID: `20260915-pi-file-gates-scoped-approvals`

Status: implementer/executor machine evidence plus a fresh independent FULL review (recorded in "Fresh independent review" below). The independent review returned **PASS with no blocking findings** for the enforcement/test bytes at the reviewed hashes. Owner acceptance and Phase 2 closure are separate and have not occurred; Goal 3 is not authorized. This record describes the bytes recorded in the hash manifest below.

## Scope

This record covers the current Goal 2 enforcement implementation after the corrective pass that followed the owner-reported write escape: a creation target's parent directory was replaced with a symlink between per-ancestor verification and the final path-based `O_CREAT|O_EXCL|O_NOFOLLOW` open, which protects only the final path component. The corrective pass changed:

- descriptor-relative chain execution with fstat identity pinning (creation and existing targets) where the platform supports it;
- an explicit fallback class for platforms where descriptor-relative execution is unavailable (verified on macOS): creation refuses before any path API is used, and existing-target effects open with `O_NOFOLLOW` and must match the plan's dev/ino, pre-approval size/timestamp, and `nlink === 1` before the effect runs on that descriptor;
- external-target execution plans anchored at the filesystem root, walking the canonical path (the earlier plan built external chains relative to the workspace root, producing parent-relative components);
- controlled `find`/`grep` directory-entry classification before emission or descent, so sensitive/secret/protected directory names and subtrees are withheld;
- a test-harness bootstrap (`test/canonical-tmpdir.mjs`) that canonicalizes the platform temporary root so fixtures satisfy the accepted canonical-trusted-root contract on macOS; `test/configuration.test.ts` and all other prior test files are unchanged by this pass.

Earlier executor wording, test counts, and recorded hashes in this document's history described pre-fix bytes; they are preserved only as history and are not attributed to the current files. In particular, an earlier audit paragraph referred to a "post-review fix round" while the status line recorded that no independent review had occurred. This record removes that ambiguity: no independent FULL review existed before this corrective pass, and the fresh independent review recorded below is the only verdict attributed to the current enforcement/test/contract bytes. The accepted Goal 1 snapshot (tracked files and the configuration-authorization audit) is preserved unchanged; this document records Goal 2 artifacts only.

## Exact final artifact hashes

The sha256 manifest of every final Goal 2 source/test/contract/CI artifact is recorded in
[docs/file-gate-hashes.json](file-gate-hashes.json) and enforced as a deterministic test
(`test/hash-manifest.test.ts`, run via `npm run test:manifest`); any intentional change must
update that manifest together with this document so reviewer verdicts stay tied to exact files.
The manifest covers:

| Artifact | Role |
| --- | --- |
| `src/index.ts` | thin Pi entry point |
| `src/policy/operations.ts` | tool→policy-operation mapping |
| `src/policy/control-plane.ts` | protected control-plane zones |
| `src/gate/gate-input.ts` | strict input framing |
| `src/gate/authorizer.ts` | central authorization sequence |
| `src/gate/controlled-traversal.ts` | controlled `grep`/`find`/`ls` |
| `src/gate/bound-execution.ts` | object-bound `read`/`write`/`edit` (both platform classes) |
| `src/gate/runtime.ts` | runtime wiring/lifecycle |
| `src/approvals/approvals.ts` | scoped approval contract |
| `docs/FILE-GATE.md` | behavior contract |
| `test/*` covered files | regression suites plus the canonical-tmpdir harness |
| `package.json` / `.github/workflows/ci.yml` | package/CI safeguards |

The manifest JSON (not this audit statement) is the machine-enforced source of hashes.

## Machine evidence recorded by the executor (macOS)

Environment: macOS, Node v26.8.1, local repository checkout. Fixtures are isolated temporary directories under the canonicalized platform temp root (`test/canonical-tmpdir.mjs`); no real Pi profile, credential, or user data was read. Package checks used isolated temporary fixtures and npm caches. Hosted GitHub Actions has not run; these results are local executor runs, not reviewer evidence.

- `npm run check` — PASS: typecheck plus the complete Node test suite, **213/213** registered scenarios.
- `npm run test:gate` — PASS, 26/26, including:
  - the owner-reported escape shape reproduced through the controlled surface: a planted symlinked parent (missing creation parent and replacement of an existing verified parent) is refused with no file created inside or outside the workspace;
  - final-target symlink swap and real-object substitution after authorization are refused before any effect, and the approval-window substitution regression still refuses (the plan is captured before the dialog and carried unchanged);
  - both platform binding classes are exercised: creation and overwrite through the descriptor plan where available, and — where descriptor-relative execution is unavailable — creation refusal with no effect plus verified existing-target overwrite;
  - external-target plan structure (anchor `/`, no parent-relative components, every existing component carrying its identity) and an approved external read executed end to end;
  - hard-link alias refusal for direct read and search/list, protected control-plane denial, approval single-use/refusal paths, session memo invalidation, single-use bindings, malformed input, foreign registration, and degraded initialization.
- `npm run test:controlled` — PASS, 5/5, including sensitive/secret directory withholding from `find`/`grep` output and no descent into an excluded subtree.
- `npm run test:configuration` — PASS, 11/11 (Goal 1 behavior unchanged; fixtures now run on a canonical temporary root).
- `npm run test:approvals` — PASS, 4/4.
- `npm run test:package` — PASS, 1/1: a real `npm pack` into an isolated destination, `tar -tzf` content verification (intended files only; no `test/`, `node_modules/`, `.npmrc`, or `auth.json` entries), an actual `npm install --legacy-peer-deps --ignore-scripts` of the packed tarball into an isolated consumer with temporary `HOME`, userconfig, and npm cache, manifest/entrypoint verification, and `npm uninstall` rollback confirmed by absence of `node_modules/pi-warden`. Publication safeguards: `private: true` and no publish was attempted or performed. The real home directory, Pi profile, credentials, and the repository's own installation were never touched.
- `npm run test:manifest` — PASS: the recorded hash manifest matches the final working tree.
- `git diff --check` — clean; untracked-file whitespace inspected separately.

The execute-time descriptor-relative (Linux `/proc/self/fd`) path is covered by the platform-independent suites in the CI configuration but has no local macOS execution evidence and no hosted run in this record; only the fallback class and the plan structure run locally.

## Fresh independent review

A separate reviewer agent (fresh context; no prior review evidence reused) performed a read-only review of these corrective-pass bytes on 2026-09-15 on this macOS machine. **Verdict: PASS; no blocking findings.** The reviewer rechecked the working-tree hashes against this record, ran `npm run check` (typecheck plus 213/213 registered scenarios) and `git diff --check` (clean) itself, and confirmed the working tree did not change during the review.

Reviewed enforcement/test/contract hashes (all still match the working tree): `src/gate/bound-execution.ts` `e88a74c75a7299c6bff1f8248f6ed7faeb4d7c5b9037049c011af4abb353e5e2`; `src/gate/controlled-traversal.ts` `f0770ed5622a10fc779672a09181e1f4417ab06f4fb8e3d9ff2f45d5d55017c7`; `src/gate/runtime.ts` `f9dd4f41942bd2431573177ba8a4a14c0284351a47f7f0262edcf08ed6166d08`; `src/gate/authorizer.ts` `7301972f43f8d8b3609bbc63bc810c06b15fd63416317c0223d210ce793248e2`; `src/gate/gate-input.ts` `7c175ff73558f18aba7ccac4109cdb715c4765e6bfd95bcd343f3ce02114d2a9`; `src/approvals/approvals.ts` `505eb3f6a401d256130061144a93720376848ff742dab6b8d972a982ac1ad9ac`; `src/policy/control-plane.ts` `a417b5b9c503798d9eeb8d86dee3098b9720ba3ef737f52f9c413fa9e3bd97c9`; `src/policy/operations.ts` `04ab2e7e2db2fbfae5ca7f00773049269b12f832e9ed70d3938feff57672460e`; `src/index.ts` `dca0d37da378f1d8d9c5492e8e51e69ba796069fca5d3deb3a3eb2aa7da1b46c`; `docs/FILE-GATE.md` `9c512c06f24cdbabe0fa447ab68d393373121a3e807d674f581d05a7b6e6ebd8`; `test/gate-runtime.test.ts` `22d13d475bcaf3602e30988da69b7afded5c4f540399132e45466c7f724e53e3`; `test/controlled-traversal.test.ts` `3d9fdab59971b39bb63fc788e37ba0ead6d4ca7d14f78057376c1153d4aa7c05`; `test/canonical-tmpdir.mjs` `1cc89c0436906b67847b94233a2595cbec66f68ba14340ac5beb699c60116fe5`; `package.json` `2c1c8e28ab13938733e3d90d2529648a699243b58b60a54931f603be2271606e`; `.github/workflows/ci.yml` `891d1c476016c632b77ee7b590afe867c046b6139102f4300b0ecbe5a63c3d63`. The audit document itself was reviewed at hash `c7013a1bf8901f73613cbfbece604a236fb1ae3d4e10b8dace1f784b260778be`; this outcome section was appended afterward, and the manifest was refreshed, without changing any enforcement, test, or contract byte above.

Reviewer-reported limitations: the Class 1 (Linux `/proc/self/fd`) execute-time path cannot run on macOS, so the reviewer verified it structurally (runtime probe, fd-relative path construction, and the verified-parent create/open helpers) and recorded a follow-up to exercise it on Linux or hosted CI. Hosted GitHub Actions has not run against these bytes. The reviewer explicitly stated that no earlier review evidence was reused.

Non-blocking observations recorded by the reviewer (no blocking defect and no acceptance claim; none changes the guarantees above):

- `src/gate/controlled-traversal.ts` (`ls`): the secondary break compares the collected entry count against `MAX_OUTPUT_BYTES`, so it is an entry-count guard rather than a byte guard; the primary entry and byte limits still bound output.
- `src/gate/controlled-traversal.ts`: `outputLinesBytes` approximates UTF-8 byte length with character counts, so the output byte cap is approximate.
- `src/approvals/approvals.ts`: `consumeGrant`/`consumedAtMs` are not wired into `runtime.ts`; the runtime enforces single-use consumption through `authorizedCalls.delete(toolCallId)`, and that contract behavior is tested.
- Directory descent in `find`/`grep` uses saved path strings rather than an open directory descriptor; this is the already-declared bounded traversal residual.

## What the implementation guarantees

See [docs/FILE-GATE.md](FILE-GATE.md) for the complete contract. Centerpiece of the corrective pass: authorization alone no longer grants effects. The controlled `read`/`write`/`edit` executors consume a one-time plan captured from trusted host code before any approval dialog and bind the effect to the planned object: through the verified directory-fd chain (`O_NOFOLLOW`, creation with `O_CREAT|O_EXCL`) where descriptor-relative execution is available, or through an `O_NOFOLLOW` direct open verified against the plan's dev/ino plus pre-approval size/timestamp and `nlink === 1` where it is not — in which case creation refuses without any path-based create. A final-target symlink swap refuses with `O_NOFOLLOW`; substitution with a different real object refuses via identity equality; a conservative hard-link rule (`nlink === 1` at plan capture and at the performing open, plus traversal withholding of `nlink !== 1` regular-file entries) refuses hard-link aliases of secrets. The original unprotected builtins are never used as a fallback.

## Explicit limitations

- Direct-leaf class (macOS): an ancestor swap can only select a different filesystem object, which the post-open identity comparison refuses; a substitute that reuses the authorized inode number and reproduces its size/timestamp remains a bounded residual. Creation and creation under a missing parent refuse entirely, so new-file creation is unavailable on this class.
- Descriptor-relative class: one micro-second window per chain step exists between an ancestor-directory fd open and its fstat verification; once the chain descriptors are opened, the leaf open resolves through the verified descriptors, so ancestor path swaps cannot redirect it. Execute-time evidence for this class is not local to macOS (see above).
- Traversal metadata enumeration (`ls`/`find` names) opens a directory fd at execution time; a substitution within the extremely short gap between that open and its first enumeration read is not isolatable through supported Node/Pi APIs. Excluded directories are not enumerated.
- dev/ino binding is not inode isolation: an attacker able to present a fake object with the authorized dev/ino via mounts is outside the coverage class.
- Controlled search content reads carry only dev/ino/nlink (no size/mtime), so inode reuse by a substitute with equal dev/ino/nlink is an explicitly bounded residual for search.
- Shell and network remain blocked (Goal 3 objective). Platforms without the POSIX `O_NOFOLLOW`/`O_DIRECTORY` constants refuse controlled direct-file effects rather than accept unverified binding.

## Provenance distinction

- Implementer/executor evidence is recorded above, followed by the fresh independent review verdict for the enforcement/test/contract hashes listed there. Owner acceptance is still separate and absent, and any later change to an enforcement/test/contract byte requires fresh review evidence for the changed bytes. No earlier verdict, review, or PASS was transferred to these bytes by either the executor or the reviewer.
- Recording the review outcome changed only this document (and the refreshed manifest); no reviewed enforcement, test, or contract byte changed after the review. The pre-review audit text was reviewed as part of the byte set, and the appended section reports the reviewer's own verdict and observations without adding new guarantees.
- The previously recorded manifest did not match the working tree for `src/gate/bound-execution.ts`, `docs/FILE-GATE.md`, and `test/gate-runtime.test.ts`; this pass refreshed the manifest together with the contract and this record. The earlier hash values remain visible in git history and are not attributed to the current files.
- Historical Goal 1 acceptance artifacts (including [docs/CONFIGURATION-AUTHORIZATION-AUDIT.md](CONFIGURATION-AUTHORIZATION-AUDIT.md)) are unchanged and remain prior evidence.
