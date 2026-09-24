# Startup readiness remediation — executor record

Task ID: `20260924-startup-readiness-lifecycle`. Baseline:
`d7c34dd905d4487eb2e541db67b18ac9fa844b5a`. This record describes an
uncommitted correction. It does not revise the published `pi-perimeter@1.0.0`,
its tag, or any accepted historical manifest value.

## Trigger and boundary

Readiness evidence (installed `@earendil-works/pi-coding-agent@0.84.4` bytes,
verified 2026-09-24): `dist/core/extensions/loader.js:132-155`
(`createExtensionRuntime` — every action method, including `getAllTools`,
is a stub throwing `Extension runtime not initialized...` during extension
loading); `dist/core/extensions/runner.js:160-170` (`bindCore` copies the
real actions into the shared runtime); `dist/core/agent-session.js`
(`_bindExtensionCore` holds the `bindCore` wiring at `:2003`, called from
`_buildRuntime` at `:2199` during session construction; `bindExtensions` at
`:1916-1920` calls `_applyExtensionBindings` then emits `session_start`,
default event at `:152`, reload re-emit at `:2229-2230`; real `getAllTools`
at `:641`). The `session_start` handler is therefore the first point where
`getAllTools()` is safe, and any factory-load call throws before the gates
become active.

The published `1.0.0` extension calls `pi.getAllTools()` during factory loading.
A fresh install therefore fails to load before its gates
become active. `src/gate/runtime.ts` now registers handlers and tools at factory
load, observes ownership after `session_start`, blocks calls before readiness,
and revokes readiness at `session_shutdown`.

The initial deferred observation accepted whichever same-name tool was visible
at `session_start` as its future owner. Pi's tool registry can select another
extension's same-name registration. The correction verifies that each observed
tool's source path is this package's `src/index.ts` before setting readiness.
The per-call owner check remains in place. Missing, duplicate, foreign, or
unreadable ownership observations degrade the gate and block execution.

## Installed-package path

`test/startup-readiness.test.ts` packs the current source into an isolated
tarball, installs that tarball under a disposable Pi agent directory with
scripts disabled, configures the exact installed version, and invokes Pi
`0.84.4` against it. It checks `pi list` against the installed root, loader
errors, the seven registered tool owners, a denied synthetic `.env`, an
allowed ordinary file, and missing-helper refusal. On the declared macOS
target it explicitly builds the helper in the listed package directory and
executes a contained shell command with closed networking. Temporary HOME,
workspace, npm cache, and Pi profile are removed after the test. No real
credentials or real Pi profile are used.

The runtime locates `native/piwarden-helper` and `native/build-manifest.json`
relative to its own module URL. That URL resolves inside the installed npm
package, so no runtime catalog fallback is necessary. `pi list` supplies the
path for the human's explicit build command.

## Binding, executor evidence, and review status

`docs/startup-readiness-hashes.json` and
`test/startup-readiness-manifest.test.ts` bind this Goal's changed source,
tests, current docs, count budget, and manifest declarations. Historical
manifest values are preserved; older test suites declare only their covered
files intentionally changed by this Goal.

Executor evidence, declared target (macOS 27.0 arm64, Node `26.8.1`, Pi
`0.84.4`, 2026-09-24): `npm run typecheck` PASS; `npm run test:gate` 32/32
PASS (includes the duplicate-owner regression); `test/startup-readiness.test.ts`
1/1 PASS — the installed peer `package.json` reads `0.84.4`, `pi list`
prints both `npm:pi-perimeter@<installed>` and the installed root, and the
post-build probe executes a contained `STARTUP_SMOKE` shell command; full
`npm run check` 420 tests / 419 pass / 0 fail / 1 declared platform skip;
the 13 historical manifest suites PASS 36/36, 38/38 including the new
startup-readiness manifest suite; `git diff --check` clean. The CI budget
`test/ci-test-budget.json` declares the linux total 420 (one added
registered test; skip/fail unchanged). Mutation checks (fake host + real
`0.84.4` stub bytes): dropping the ready gate (`if (!ready)` → `if
(false)`, 3 sites) makes the pre-ready regression fail (pre-ready read
blocks with the foreign-owner reason instead of the not-ready reason);
weakening the session_start observation to accept duplicates (`!== 1` →
`=== 0`) makes the new duplicate regression fail; injecting the pre-fix
early `pi.getAllTools()` into the factory-load loop makes construction
throw (`createPiWardenRuntime ...:817`) against the throwing stub, while the
fixed factory survives with `ready=false, degraded=false`.

Fresh independent review (2026-09-24, reviewer agent `StartupReadinessReview`,
read-only, HEAD `d7c34dd` + uncommitted work): PASS, no blocking findings.
Reviewer-run: typecheck PASS; `test:gate` 31/31 PASS (pre-duplicate-test
snapshot); startup-readiness-manifest + hash-manifest 4/4 PASS; all 14
manifest suites 38/38 PASS (13 historical 36/36); installed-package
regression 1/1 PASS (declared target; helper-build + contained-shell branch
executed); pre-fix mutation reproduced in a throwaway copy (early
`getAllTools` fails with `Extension runtime not initialized...`), post-fix
passes. Three non-blocking findings, all fixed in this snapshot: (1) the
duplicate-owner branch was untested — fixed by the new duplicate regression
in `test/gate-runtime.test.ts` (weaken-to-accept-duplicates mutation now
fails); (2) the recorded manifest-suite total 42/42 was unreproducible —
restated 36/36 (38/38 with the new suite); (3) the `bindExtensions` call
chain compressed `_bindExtensionCore` — corrected in the
`GATE_NOT_READY_REASON` note and the evidence paragraph above to name
`_bindExtensionCore` (`:2003`, via `_buildRuntime` `:2199`) separately from
`bindExtensions` (`:1916-1920`). No review action wrote, committed, pushed,
tagged, published, or installed into a real profile.

Delta re-review (2026-09-24, reviewer agent `StartupDeltaReview`, read-only,
HEAD `d7c34dd` + uncommitted work): PASS, no blocking findings.
Reviewer-run on the declared target: typecheck PASS; `test/gate-runtime.test.ts`
32/32 PASS; 13 historical manifest suites 36/36 (38/38 with the new suite);
full `npm test` 420/419/0/1 matching the linux budget total 420; `git diff
--check` clean. Duplicate-accepting mutation makes exactly the new test fail;
runtime behavior bytes are identical to the PASS snapshot (comment-only
wording delta). No local commit,
push, tag, or publication is authorized by this record.
