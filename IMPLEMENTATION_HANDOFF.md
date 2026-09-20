# Implementation Handoff

Task ID: `20260920-hosted-ci-reproducibility`
Baseline: `2fa89b6b0ff37b4eef2624acaa8dafd198a38c5c` (the transition that consolidated `main` and pushed it); index empty; untracked `.commandcode/` only.
Scope Gate: READY

## Goal

Make the hosted CI check meaningful and reproducible on a clean checkout, record its
results as evidence, and correct the hosted-run wording, closing only the Phase 6
checklist item "Add GitHub CI and reproducible checks".

## Context

- Goals 1–4 are accepted; the private vulnerability-reporting Phase 6 item is closed.
  `main` is the single working line and is pushed to `origin`.
- The workflow already exists (`.github/workflows/ci.yml`): `ubuntu-latest`, Actions
  referenced by moving tags (`actions/checkout@v4`, `actions/setup-node@v4`), Node
  `22.19.0`, `npm ci --ignore-scripts && npm run check`.
- Hosted history is not what the documentation claims. Run `34985125954`
  (2026-09-15T14:57Z, push of the Goal 2 snapshot `664871d`) **failed**: 209/210 tests
  passed and test 69, "the Goal 2 artifact hash manifest matches the final working
  tree", failed. That run was never recorded. Run `35523982904` (2026-09-20, push of
  `2fa89b6`, current `main`) passed with 356 tests, 302 pass, 0 fail, 54 skipped.
- Observed platform constraints (2026-09-20, local inspection):
  `scripts/build-native.mjs` refuses any platform other than darwin;
  `verifyPlatform` (`src/sandbox/containment.ts`) requires darwin, `arm64`, a Darwin
  major equal to the declared target, and a pinned `/usr/bin/sandbox-exec` sha256.
  A GitHub-hosted macOS runner therefore cannot satisfy the containment suite by
  design, and 54 darwin-only tests are skipped on Linux.
- `npm run check` is the only job step today; skipped and failed counts are printed but
  not asserted, so a silently growing skip set can still show as green.

## Scope

- Pin `actions/checkout` and `actions/setup-node` to immutable commit SHAs (with the
  corresponding tagged release recorded in a comment), keep `permissions: contents:
  read`, keep `npm ci --ignore-scripts`, and keep the Node version pinned.
- Make test accounting explicit: record a declared per-platform skip budget and fail
  the job when the observed pass/fail/skip counts deviate from it, so neither a new
  skip nor a real failure can pass as green.
- Record the hosted evidence: run identifier/URL, exact commit SHA, and per-run
  pass/fail/skip counts, with hosted and executor-local evidence clearly separated,
  bound to the reviewed bytes using the existing manifest convention or an explicit
  statement why no new manifest is needed.
- Correct the hosted-run wording in `STATE.md` and the affected audits so it states the
  qualified truth instead of an unqualified "hosted GitHub Actions has not run".
- Determine, on evidence, whether the hosted Linux run supplies the outstanding Goal 2
  Class 1 (`/proc/self/fd`) execute-time runtime evidence, and record the answer.

## Out of Scope

- A hosted macOS job that claims containment evidence. macOS containment evidence stays
  executor-local. A refusal-path job is a separate explicit decision because it requires
  new tests asserting refusal on a foreign darwin target.
- Publication, npm packaging, the npm name collision, compatibility-matrix publication,
  Phase 5 hardening, release or public-beta acceptance.
- Runtime, policy, approval, sandbox, network behavior; new runtime dependencies;
  weakening, rewriting, or relaxing any accepted guarantee.

## Risk Gates

- Never add `continue-on-error`, `|| true`, `if: always()`, or any other masking
  construct to make a job pass.
- Never convert a real failure into a skip: every skip must correspond to a declared
  platform condition and to the recorded budget for that platform.
- Never present a green Linux run as Linux support, or as darwin containment evidence.
- A real defect surfaced by the hosted run in accepted code stops this Goal and requires
  an owner decision: fixing it changes accepted Goal 1–4 bytes and their evidence.

## Acceptance Criteria

1. A hosted run exists for the Goal's final commit, identified by URL/ID and exact SHA,
   and the recorded outcome matches that run; no hosted run remains unrecorded.
2. The workflow reproduces from a clean checkout with no local machine state: no
   gitignored artifact, no secret, and no network use beyond what `npm ci` needs.
3. Counts are asserted, not merely printed: the job fails when pass, fail, or skip
   counts deviate from the recorded budget for that platform.
4. Third-party Actions are pinned to immutable SHAs and permissions stay least-privilege.
5. Documentation distinguishes hosted from local evidence, states the darwin limitation
   with its cause, and no longer claims hosted CI "has not run" without qualification.
6. No guarantee is added, widened, or weakened, and no platform support claim is added.

## Verification

- Inspect the workflow diff and the new accounting script; run `npm run check` locally
  and compare counts with the budget.
- Retrieve every referenced hosted run (`gh run view`, `gh run view --log`) and record
  run id, commit SHA, and counts; confirm the recorded numbers match the run output.
- Check the skip budget against the code-level platform conditions in the tests that
  declare them; a budget that cannot be derived from those conditions is a finding.
- Run `git diff --check`, the manifest suites, and the package lifecycle suite.
- Obtain an independent review of the workflow, the accounting mechanism, and every
  evidence claim before owner acceptance.

## Constraints

- No new runtime dependency, no secret, no privileged step.
- Do not edit or delete tests to make CI pass; failure and skip changes require evidence.
- Keep the change small and reviewable: one workflow, one accounting mechanism, one
  evidence record.
- Work on `main` as authorized; no additional topic branches. Do not publish, release,
  or install into a real Pi profile.

## Escalate If

- The hosted run exposes a defect in accepted code, or a fix would require touching
  accepted Goal 1–4 bytes.
- Producing macOS containment evidence would require changing the pinned target,
  `sandbox-exec` identity, or an accepted guarantee.
- Answering the Class 1 question would require an explicit Linux support claim.
- A runner-image change alters the operating system under the declared target, or the
  budget cannot be met without weakening a test.
