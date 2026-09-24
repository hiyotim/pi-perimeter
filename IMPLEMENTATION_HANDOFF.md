# Implementation Handoff

Task ID: `20260924-startup-readiness-lifecycle`
Baseline: `d7c34dd905d4487eb2e541db67b18ac9fa844b5a` (tree clean; `git status --short` empty)
Scope Gate: READY; owner extended this Goal on 2026-09-24 to include an additive startup-readiness manifest, declared change sets in historical manifest tests, an installed-package regression, and the controlled-tool owner correction. Historical manifest values remain unchanged.

## Goal

Fix the release-blocking extension startup lifecycle error: `pi.getAllTools()` is called before Pi `0.84.4` initialization completes. Startup must wait for Pi readiness, verify controlled-tool ownership exactly once after ready, and fail closed (block every model-facing tool, no unrestricted fallback) until readiness plus ownership plus helper trust are established.

## Context

- Entry: `src/index.ts` (`piWarden(pi)`) builds trusted options and calls `createPiWardenRuntime(pi, options)` immediately at extension load.
- Runtime: `src/gate/runtime.ts` (`createPiWardenRuntime`) calls `pi.getAllTools()` synchronously in the controlled-tool registration loop (post-`registerTool` observation, `controlledToolOwners.set`) and re-calls it per tool call / shell call as the foreign-owner check (`CONTROLLED_TOOL_FOREIGN_OWNER_REASON`). `PiRuntimeAPI` (`on`/`registerTool`/`getAllTools`) is a structural subset of `ExtensionAPI`; the cast is confined to `src/index.ts`.
- Verified peer is exactly `@earendil-works/pi-coding-agent@0.84.4` (`docs/COMPATIBILITY.md`, `docs/FILE-GATE.md`, shell/network audits). A locally installed newer CLI is explicitly untested and outside every guarantee. `peerDependencies` is a declared range (`*`), not a verification.
- Helper trust: `src/sandbox/helper.ts` (`packageRootFromModule(import.meta.url)` → `native/piwarden-helper` + `build-manifest.json`); `scripts/build-native.mjs` builds explicitly, fails closed off-target, no implicit runtime compilation/download/network; `native/` is gitignored build output and excluded from the packed tarball (`docs/PACKAGING.md`, `test/packaging-identity.test.ts`).
- Published distribution `pi-perimeter@1.0.0` (2026-09-24, tag `v1.0.0`, release run `36031377325`, binding `ca0fb1c3…`) and all historical manifests/audits/acceptances (`STATE.md`, `ROADMAP.md`, `docs/*-hashes.json`) are frozen evidence and must not be rewritten or reinterpreted by this Goal.

## Scope

- `src/index.ts` and `src/gate/runtime.ts`: readiness-gated startup — defer every `getAllTools()` ownership observation until Pi signals ready; fail-closed (block, `GATE_FAILURE_REASON`-class reason, degraded state) on not-ready access, registration failure, missing/duplicate/foreign-owner observation; keep the per-call owner recheck after ready.
- `src/sandbox/helper.ts` only if the installed-package layout breaks the existing module-URL resolution, plus the explicit build inside the installed-package directory discovered via the `pi list` catalog (test/human discovery path for the build command; the runtime itself resolves the helper only from its own installed module URL and performs no catalog lookup; missing/unverifiable helper still blocks every shell route with an actionable reason).
- Tests only: one installed-package startup regression proving the exact failure (early `getAllTools` against real `0.84.4` bytes) fails pre-fix and passes post-fix, plus readiness/owner refusal-path regressions (not-ready blocked, foreign/missing/duplicate owner blocked, degraded sticks). A foreign owner present at `session_start` must never be recorded as trusted.
- Bind the new snapshot in `docs/startup-readiness-hashes.json` and its test. Historical manifests keep their values; their test suites declare this Goal's changed bytes through `CHANGED_IN_STARTUP_READINESS`. Update the CI count budget for the registered tests.
- Minimal public-doc fixes only: `README.md` (Installation), `docs/COMPATIBILITY.md` (Pi row), `docs/PACKAGING.md` / `docs/DEVELOPMENT.md` startup wording — state the readiness requirement and the `0.84.4`-only verification; no new claims.

## Out of Scope

- Mutating, rebinding, or reinterpreting the published `pi-perimeter@1.0.0`, tag `v1.0.0`, or any historical manifest values, audits, or acceptance bytes (`docs/*-hashes.json`, `STATE.md`/`ROADMAP.md` acceptance entries). New declarations in manifest test suites are in scope.
- Release actions: tagging, publishing, provenance wiring, `private: true` removal, or installing into a real Pi profile as evidence.
- New platform/version support (any Pi version besides `0.84.4`, any Node beyond the verified rows, any OS/arch beyond the declared macOS 27.0 arm64 target), Linux/Windows claims, or resolving the open Class 1 Linux runtime-evidence question.
- Guarantee changes (`docs/V1-GUARANTEES.md` P1–P18/R1–R11), policy/sandbox/network enforcement semantics, approval semantics, dependency changes, refactors, or non-biting tests.
- This handoff authorizes no implementation, commit, push, or publication by itself.

## Risk Gates

- Before wiring the fix, record the exact `0.84.4` readiness signal (which event/API state makes `getAllTools()` safe to call) evidenced from the installed package bytes and Pi docs; the implementation must bind to that evidence, not to assumed load ordering.
- Before relying on the installed-package build path, record the `pi list` → installed-package-root resolution evidenced on the declared target; a missing or ambiguous catalog mapping stops helper-path work. The runtime never shells out to a catalog and never falls back to an unverified path: the module-URL resolution is the only runtime path, and an unverifiable helper stays a blocking refusal.

## Acceptance Criteria

1. Extension startup never calls `pi.getAllTools()` before Pi signals ready; ownership observations are taken exactly once after ready and after each same-name registration.
2. Until readiness plus successful ownership observation, every model-facing tool call (`read`/`write`/`edit`/`grep`/`find`/`ls`/`bash`, unknown tools) and user `!`/`!!` execution is blocked fail-closed with an actionable reason; no tool effect executes and there is no unrestricted fallback.
3. Registration failure, missing/duplicate observation, or foreign-owner controlled tool marks the runtime degraded and blocks the affected tools; the per-call owner recheck still enforced after ready.
4. An installed-package startup regression against the real `@earendil-works/pi-coding-agent@0.84.4` bytes reproduces the early-`getAllTools` failure pre-fix (or by gate-bypass mutation) and passes post-fix, using isolated fixtures only — no real profile, credentials, secret files, or home-directory reads.
5. The native helper is built explicitly inside the installed-package directory discovered via the `pi list` catalog (`npm --prefix <listed directory> run build:native`); at runtime the helper is resolved only from the extension's own installed module URL with no catalog lookup; a missing or unverifiable helper blocks every shell route with an actionable reason; no implicit compilation, download, or network use at runtime.
6. Public docs (`README.md` Installation, `docs/COMPATIBILITY.md` Pi row, plus only the forced `PACKAGING.md`/`DEVELOPMENT.md` startup lines) state the readiness requirement and `0.84.4`-only verification with no new guarantee, platform, or install claim; published `1.0.0` bytes and historical manifests/audits are byte-unchanged.

## Verification

- Criteria 1–3: new readiness/owner regression suite plus `npm run check` (typecheck + full suite), focused `npm run test:gate`, and `git diff --check`; mutation check (restore early `getAllTools` / drop the ready gate) must make the new regressions fail.
- Criterion 4: the installed-package startup regression run on the declared target (macOS 27.0 arm64, Node `26.8.1`, Pi `0.84.4`), with the installed peer version and `pi list` catalog evidence recorded in the test/audit note; `npm run check` green locally.
- Criterion 5: explicit `npm --prefix <directory reported by pi list> run build:native`, helper refusal-path regressions, and `npm run test:containment` on the declared target (declared platform skip elsewhere); no `native/` output enters the tree or tarball (`test/packaging-identity.test.ts` still passes). The runtime continues to derive its helper path from its own installed module URL; no catalog lookup is needed inside the extension.
- Criterion 6: doc diff review limited to the listed files; all manifest suites still pass with no historical entry rewritten (`npm run test:manifest`, `git diff --check`); `package.json` still `private: true`, no lifecycle scripts, ordinary CI never publishes.

## Constraints

- Preserve the `AGENTS.md` security invariants: fail closed across protected boundaries; project-controlled configuration never weakens global policy; approval and containment stay separate; no silent fallback to unrestricted execution.
- Keep `src/index.ts` thin (wiring only, no policy decisions); keep pure decisions in `src/policy/`, containment in `src/sandbox/`, approvals in `src/approvals/`.
- Tests use isolated temporary fixtures only; never real credentials, secret files, home-directory reads, or real-profile installation.
- Exact versions, hashes, and run identifiers only; never invent evidence; documentation states only guarantees demonstrated by the implementation and tests.

## Escalate If

- Pi `0.84.4` exposes no observable readiness signal, or the fix would require supporting another Pi version, changing the peer range semantics, or touching published/historical bytes — stop instead of widening scope.
- The `pi list` catalog mapping is ambiguous or unavailable on the declared target — stop instead of inventing a runtime discovery path; the module-URL resolution is the only runtime path, and an unverifiable helper stays a blocking refusal.
- The Goal splits into independently shippable outcomes (e.g. readiness gate vs helper-catalog work vs docs each reviewable/acceptable alone) — stop; that is a decomposition signal.
- Baseline, ownership, attribution, or overwrite authority becomes ambiguous; stop without changing the handoff.
