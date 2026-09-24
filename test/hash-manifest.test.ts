import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the Goal 2 file-gate artifacts.
 *
 * Every entry lists the sha256 of the final file. The test recomputes hashes
 * each run, prints the current value for any mismatch, and fails until the
 * manifest matches the working tree, so the audit document and any reviewer
 * verdict are tied to exact file contents. To refresh the manifest after a
 * verified intentional change, replace each entry with the hash printed in
 * the failure diff and re-run this suite.
 */

const MANIFEST_PATH = "docs/file-gate-hashes.json";

/**
 * Artifacts whose bytes the hosted-CI Goal
 * (`20260920-hosted-ci-reproducibility`) deliberately changed with fresh
 * evidence; their entries in this manifest are historical accepted bytes, not
 * working-tree assertions. docs/CI-EVIDENCE.md records the old and new hashes,
 * and docs/ci-hashes.json binds the current bytes.
 */
const CHANGED_IN_HOSTED_CI = new Set<string>([".github/workflows/ci.yml"]);

/**
 * Artifacts whose bytes the packaging Goal (`20260920-npm-packaging`) changed:
 * the package identity in `package.json`. Its entry here is historical accepted
 * bytes; docs/packaging-hashes.json binds the current bytes.
 */
const CHANGED_IN_PACKAGING = new Set<string>(["package.json", "test/package-lifecycle.test.ts"]);
/**
 * Artifacts whose bytes the regression-evidence Goal
 * (`20260922-regression-evidence-per-guarantee`) changed: new biting
 * regressions plus this declaration. Their entries here stay historical;
 * docs/regression-evidence-hashes.json binds the current bytes.
 */
const CHANGED_IN_REGRESSION_EVIDENCE: Record<string, true> = {
  "test/controlled-traversal.test.ts": true,
  "test/gate-runtime.test.ts": true,
  "test/hash-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the unknowns-bound Goal
 * (`20260924-unknowns-bound`) changed: one new R10 regression plus this
 * declaration. Their entries here stay historical;
 * docs/unknown-bounds-hashes.json binds the current bytes.
 */
const CHANGED_IN_UNKNOWN_BOUNDS: Record<string, true> = {
  "test/package-compat.test.ts": true,
  "test/hash-manifest.test.ts": true,
};

/** Historical entries changed by the startup-readiness Goal; current bytes are bound by docs/startup-readiness-hashes.json. */
const CHANGED_IN_STARTUP_READINESS = new Set<string>([
  "src/gate/runtime.ts",
  "test/gate-runtime.test.ts",
]);

const COVERED_FILES = [
  "package.json",
  ".github/workflows/ci.yml",
  "src/index.ts",
  "src/policy/operations.ts",
  "src/policy/control-plane.ts",
  "src/gate/gate-input.ts",
  "src/gate/authorizer.ts",
  "src/gate/controlled-traversal.ts",
  "src/gate/bound-execution.ts",
  "src/gate/runtime.ts",
  "src/approvals/approvals.ts",
  "docs/FILE-GATE.md",
  "docs/FILE-GATE-AUDIT.md",
  "test/canonical-tmpdir.mjs",
  "test/approvals.test.ts",
  "test/controlled-traversal.test.ts",
  "test/gate-runtime.test.ts",
  "test/package-compat.test.ts",
  "test/package-lifecycle.test.ts",
] as const;

test("the Goal 2 artifact hash manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    if (CHANGED_IN_HOSTED_CI.has(file)) continue; // historical bytes; fresh evidence binds the current tree
    if (CHANGED_IN_PACKAGING.has(file)) continue; // renamed identity; the packaging manifest binds the current bytes
    if (CHANGED_IN_REGRESSION_EVIDENCE[file] === true) continue; // new regressions; the regression-evidence manifest binds the current bytes
    if (CHANGED_IN_UNKNOWN_BOUNDS[file] === true) continue; // unknowns bound; the unknown-bounds manifest binds the current bytes
    if (CHANGED_IN_STARTUP_READINESS.has(file)) continue; // current snapshot bound by the startup-readiness manifest
    const current = createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    if (manifest[file] !== current) {
      mismatches.push({ file, current, expected: manifest[file] ?? null });
    }
    console.log(`sha256 ${file} = ${current}`);
  }
  assert.equal(
    mismatches.length,
    0,
    `hash manifest mismatch for:\n${mismatches
      .map((entry) => `${entry.file}: current ${entry.current} recorded ${entry.expected}`)
      .join("\n")}`,
  );
});

test("the hosted-CI Goal changed exactly the CI workflow in this manifest", () => {
  // The hosted-CI Goal's own artifacts (the accounting script, its budget and
  // tests, and the evidence record) are new files outside this Goal 2
  // manifest's scope; docs/ci-hashes.json carries them.
  const hostedCiOnly = [
    "scripts/assert-test-outcome.mjs",
    "test/ci-test-budget.json",
    "test/ci-budget.test.ts",
    "test/ci-manifest.test.ts",
    "docs/CI-EVIDENCE.md",
    "docs/ci-hashes.json",
  ];
  for (const file of CHANGED_IN_HOSTED_CI) {
    assert.ok(
      COVERED_FILES.includes(file as (typeof COVERED_FILES)[number]),
      `${file} must be in the Goal 2 manifest`,
    );
  }
  for (const file of hostedCiOnly) {
    assert.ok(
      !COVERED_FILES.includes(file as (typeof COVERED_FILES)[number]),
      `${file} is hosted-CI-only and must not be in the Goal 2 manifest`,
    );
  }
});
