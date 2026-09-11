# Phase 1B Final Independent Audit

Date: 2026-09-11
Branch: `phase-1b-resource-classification`
HEAD: `548032665b57fdbaa4399ad2c0aaaa9ea001a2f6`

## Verdict and scope

**PASS — no implementation, test, or documentation defects found within the Phase 1B scope.** A separate read-only reviewer inspected the accumulated working tree, including the untracked classifier and resource tests, the Phase 1A provenance changes, relevant documentation, and the inert integration entry point. The primary agent corrected documentation and recorded this report; the reviewer did not modify repository files.

This verdict supports final owner acceptance of the path-only classification primitive. It does not itself close Phase 1B, authorize a commit, advance the phase, or establish enforcement. The authoritative acceptance record remains [STATE.md](../STATE.md).

## Documentation consistency review

The documentation pass changed only statements of current behavior and status:

- `AGENTS.md` now identifies both implemented, unenforced primitives and links to the acceptance checkpoint.
- `ROADMAP.md` distinguishes accepted remediations from pending final acceptance and no longer implies a next Goal is selected.
- `ARCHITECTURE.md` describes the checkpoint as accepted Goals, evidence, and remaining gates.
- `docs/DEVELOPMENT.md` accurately describes genuine resolver inputs from temporary fixtures and separate forged-input rejection tests.
- `src/policy/README.md` limits the conventional `.config` statement to the GitHub CLI and Google Cloud rules and preserves independent stronger evidence.

The independent reviewer found one remaining stale roadmap reference to a selected Goal; the primary agent corrected it before the final PASS. Local links in the ten reviewed current documentation files resolved, and whitespace checks passed. Production source and tests were unchanged by this pass.

## Verified security contracts

- Only exact successful resolver-issued objects pass the private WeakSet check. The brand alone, copies, inheritance, proxies, and serialization cannot transfer issuance. Genuine results are frozen and their fields are readonly in TypeScript.
- Non-issued input fails with `INVALID_PROVENANCE` before path identity inspection. Resolver `ENOTDIR` remains `ANCESTOR_NOT_DIRECTORY`; resolution failure cannot produce classification input.
- Canonical and normalized lexical identities contribute independently. Matches follow rule-table order, evidence is canonical then lexical, each rule emits at most one merged match, and maximum sensitivity wins within a rule and across the result.
- Complete dot-delimited environment template markers, the bounded SSH backup suffixes, generic `.key` sensitivity, `.p12`/`.pfx` secret classification, and conventional terminal GitHub/GCloud paths match their accepted contracts.
- The classifier performs no filesystem or content reads and returns classification rather than authorization. No Pi hooks, runtime dependencies, or enforcement were added.

## Verification evidence

Reported by the independent reviewer, with test summaries and probe logs inspected by the primary agent:

| Check | Result |
| --- | --- |
| `node --test test/resources.test.ts` | PASS, 69/69 |
| `npm run check` | PASS, typecheck and 111/111 tests |
| `git diff --check` | PASS |
| Independent temporary synthetic probes | PASS, 92/92: 74 complete classifications, 17 provenance/freeze attacks, 1 ENOTDIR case |
| Separate TypeScript negative probe | Expected rejection: six TS2540 readonly errors and one TS2741 missing private-brand error |

The independent classifications use complete expected objects supplied independently of production rule data. They exercise positive and near-miss environment, cloud, SSH and key names, mixed extension alias directions, and deterministic multi-rule evidence. Provenance probes include assignment, `Object.assign`, `defineProperty`, spread, descriptor copies, inheritance, JSON, Proxy, structural/malformed input, and copied symbols. All resources are fabricated in temporary directories; no real credentials are used.

Reviewer environment: macOS 27.0 build 26A428, Darwin 27.0.0 arm64, Node v26.8.1, npm 11.19.0. This is evidence for this environment, not a cross-platform compatibility certification.

Temporary evidence files (not durable repository artifacts): `/tmp/pi-warden-final-audit.mjs`, `/tmp/pi-warden-final-audit.log`, `/tmp/pi-warden-readonly-audit.ts`, `/tmp/pi-warden-readonly-audit.log`, `/tmp/pi-warden-final-resources-test.log`, and `/tmp/pi-warden-final-npm-check.log`. Synthetic probe script SHA-256: `cc5e075dbe4bd51651c8a4ddc6cb4360572a07ebb99956010acb0370439c22e5`.

## Audited source anchors

| File | SHA-256 |
| --- | --- |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `test/paths.test.ts` | `676e00aaef9f26e70dfad5ea9513a702352d2d707fd5cc0f04f62c0ed3b21398` |
| `test/resources.test.ts` | `f9a03c98a6ee9c01ae9103ede6f87fc37ee656966a14730ffe6e35df31478436` |

The reviewer's tracked-diff SHA-256 was `e642498a87156bca848a77a7afd35805559dd258d80a2d90a7bce70f6bf69249`. It excludes untracked files, including this report and `STATE.md`; the four explicit source/test anchors cover the audited implementation and tests. The primary agent rechecked those four anchors after the documentation edits.

## Limits and commit boundary

This classifier is path-only and content-blind. Custom credential roots, unsupported backup conventions, and ordinary filenames can conceal secrets. Neither `ordinary` nor `sensitive` authorizes reading. Environment-variable classification is absent. Provenance protects trusted-module issuance/integrity, not hostile same-process JavaScript or filesystem TOCTOU. Hard-link, mount, alias, and other Phase 1A filesystem limits remain. There is no Pi enforcement, approval flow, shell/network policy, or OS containment.

The reviewer considers the audited Phase 1B implementation suitable for a selectively prepared commit after owner acceptance and review of the final state/report records. No commit or broad staging is authorized. Local `.opencode-permission-canary.txt`, `.qwen/`, the unrelated `.gitignore` change, and the historical implementation handoff are not implicitly part of that commit. A future commit must review its exact staged contents separately.
