# File Gate Audit and Provenance (Goal 2)

Task ID: `20260915-pi-file-gates-scoped-approvals`
Status: implementer/executor machine evidence only. **No independent FULL review has occurred yet.** Owner acceptance and Phase 2 closure are separate and have not occurred; Goal 3 is not authorized.

## Scope

This record covers the Goal 2 enforcement implementation and its corrective pass (owner-reported P1 execution-time object substitution, P1 isolated package install/rollback evidence, and status/provenance repair). The accepted Goal 1 snapshot (tracked dirty files and the prior configuration-authorization audit) is preserved unchanged; this document only records Goal 2's final artifacts.

## Exact final artifact hashes

The sha256 manifest of every final Goal 2 source/test/contract/CI artifact is recorded in
[docs/file-gate-hashes.json](file-gate-hashes.json) and enforced as a deterministic test
(`test/hash-manifest.test.ts`, run via `npm run test:manifest`); any intentional change must
update that manifest together with this document so reviewer verdicts stay tied to exact files.
Referenced file hashes at the time this document was finalized:

| Artifact | Role |
| --- | --- |
| `src/index.ts` | thin Pi entry point |
| `src/policy/operations.ts` | tool→policy-operation mapping |
| `src/policy/control-plane.ts` | protected control-plane zones |
| `src/gate/gate-input.ts` | strict input framing |
| `src/gate/authorizer.ts` | central authorization sequence |
| `src/gate/controlled-traversal.ts` | controlled `grep`/`find`/`ls` |
| `src/gate/bound-execution.ts` | descriptor-bound `read`/`write`/`edit` |
| `src/gate/runtime.ts` | runtime wiring/lifecycle |
| `src/approvals/approvals.ts` | scoped approval contract |
| `docs/FILE-GATE.md` | behavior contract |
| `test/*` covered files | regression suites (approvals, controlled traversal, gate, package compat, package lifecycle) |
| `package.json` / `.github/workflows/ci.yml` | package/CI safeguards |

The manifest JSON (not the audit statement) is the machine-enforced source of hashes.

## Machine evidence recorded by the executor (Linux)

All commands were run from the repository root on this Linux machine; results are attributed to the implementer/executor, not to a reviewer. This round also records the post-review corrective fix round: the approval-window object-substitution blocker and the hard-link alias blocker.

- `npm run check` — PASS: typecheck plus the complete Node test suite, **208/208** registered scenarios (including the hash-manifest suite and the package cycle suite).
- `npm run test:gate` — PASS, 21/21, including:
  - the owner-reported authorization-time sequence reproduced through the controlled surface (ordinary workspace file authorized, then replaced with a symlink to a fake `.env`; the controlled read refuses before any effect and the fake secret content is never returned);
  - a NEW approval-window regression: an external `ASK` target whose real object is swapped with a different regular file by the approval dialog itself is refused at the descriptor check because the plan was captured BEFORE the dialog and carried unchanged (no recapture after approval);
  - a NEW hard-link blocker regression: an ordinary path hard-linked to a fake `.env` is refused for direct read (`target is hard-linked (nlink 2)` plan refusal surfaced by the gate), the same path as a grep root is denied outright (`HARD_LINKED_RESOURCE`), and listing the authorized parent directory withholds the hard-linked alias entry entirely.
- `npm run test:package` — PASS, 1/1: a real `npm pack` into an isolated destination, `tar -tzf` content verification (intended files only; no `test/`, `node_modules/`, `.npmrc`, or `auth.json` entries), an actual `npm install --legacy-peer-deps --ignore-scripts` of the packed tarball into an isolated consumer with temporary `HOME`, userconfig, and npm cache, manifest/entrypoint verification, and `npm uninstall` rollback confirmed by absence of `node_modules/pi-warden`. Publication safeguards: `private: true` and no publish was attempted or performed. The real home directory, Pi profile, credentials, and the repository's own installation were never touched.
- `npm run test:manifest` — PASS: the recorded hash manifest matches the final working tree.
- `git diff --check` and inspection of the tracked diff plus all untracked files (whitespace included) — clean.

## What the implementation guarantees

See [docs/FILE-GATE.md](FILE-GATE.md) for the complete contract. Centerpiece of the corrective pass: authorization alone no longer grants effects — the controlled `read`/`write`/`edit` executors open the authorized object through `O_NOFOLLOW` (creation with `O_CREAT|O_EXCL|O_NOFOLLOW`) and verify fstat dev/ino plus the pre-captured size/timestamp (pinning inode reuse) against the descriptor plan captured from trusted host code at the gate **before** the approval dialog for ASK calls (so approval delay cannot bind a substituted object, and no identity is recaptured after approval), then perform the entire effect through that descriptor. `grep` content reads use the same `O_NOFOLLOW` descriptor path per file, but carry and verify only the pre-evaluation dev/ino and the `nlink` hard-link rule; grep/find/ls do NOT capture or compare size/mtime, so inode reuse by a substitute with equal dev/ino/nlink is an explicitly bounded residual for controlled search. A final-target symlink swap refuses with `O_NOFOLLOW`; substitution with a different real object refuses via dev/ino equality; the original unprotected builtins are never used as a fallback. A conservative hard-link rule (`nlink === 1` at plan capture and at the performing open, plus traversal withholding of `nlink !== 1` regular-file entries) refuses hard-link aliases of secrets rather than accepting them.

## Explicit limitations

- Same-filesystem ancestor substitution in the micro-second window between the per-ancestor verification and the final `O_CREAT|O_EXCL` open can create the leaf in a substituted (same-filesystem) directory; this window is bounded but not eliminated and is documented, not claimed away.
- Traversal metadata enumeration (`ls`/`find` names) opens a directory fd at execution time; a substitution within the extremely short gap between that open and its first enumeration read is not isolatable through supported Node/Pi APIs.
- dev/ino binding is not inode isolation: an attacker able to present a fake object with the authorized dev/ino via mounts is outside the coverage class.
- The owner-reported P1 probe reproduced in the test suite exercises the same final-target symlink-swap effect shape documented by the owner (temporary fixtures only; no real credentials or profile persisted).
- Shell and network remain blocked (Goal 3 Objective). Node-in-host `O_NOFOLLOW` missing platforms (Windows) refuse all controlled file effects rather than accept unverified binding.

## Provenance distinction

- Implementer/executor evidence is recorded above. A separate fresh independent FULL review must be performed against the exact files/hashes above before any acceptance claim is attributed beyond this record.
- Historical Goal 1 acceptance artifacts (including [docs/CONFIGURATION-AUTHORIZATION-AUDIT.md](CONFIGURATION-AUTHORIZATION-AUDIT.md)) are unchanged and remain prior evidence.
