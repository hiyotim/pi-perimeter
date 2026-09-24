import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the hosted-CI Goal artifacts
 * (`20260920-hosted-ci-reproducibility`).
 *
 * Every entry lists the sha256 of the final file. The test recomputes hashes
 * each run, prints the current value for any mismatch, and fails until the
 * manifest matches the working tree, so the evidence record and any reviewer
 * verdict are tied to exact file contents. To refresh the manifest after a
 * verified intentional change, replace each entry with the hash printed in the
 * failure diff and re-run this suite.
 */

const MANIFEST_PATH = "docs/ci-hashes.json";

/**
 * Artifacts whose bytes the compatibility-matrix Goal
 * (`20260920-compatibility-matrix`) deliberately changed: adding that Goal's
 * manifest suite raises the declared test count, and declaring the change
 * requires editing this file. Their entries below are the accepted hosted-CI
 * bytes, not working-tree assertions; docs/compatibility-hashes.json binds the
 * current bytes.
 */
const CHANGED_IN_COMPATIBILITY = new Set<string>([
  "test/ci-test-budget.json",
  "test/ci-manifest.test.ts",
  "docs/CI-EVIDENCE.md",
]);

/**
 * Artifacts whose bytes the packaging Goal (`20260920-npm-packaging`) changed:
 * the raised declared test count and this declaration. Their entries here are
 * historical accepted bytes; docs/packaging-hashes.json binds the current bytes.
 */
const CHANGED_IN_PACKAGING = new Set<string>([
  "test/ci-test-budget.json",
  "test/ci-manifest.test.ts",
  "test/hash-manifest.test.ts",
]);

/**
 * Artifacts whose bytes the post-transfer pass changed: the repository locator in
 * the evidence record and this declaration. Their entries here stay historical;
 * docs/post-transfer-hashes.json binds the current bytes.
 */
const CHANGED_IN_POST_TRANSFER = new Set<string>(["docs/CI-EVIDENCE.md", "test/ci-manifest.test.ts"]);

/**
 * Artifacts whose bytes the release-candidate review Goal
 * (`20260922-release-candidate-reviews`) changed: the raised declared test
 * count and this declaration. Their entries here stay historical;
 * docs/release-review-hashes.json binds the current bytes.
 */
const CHANGED_IN_RELEASE_REVIEW: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/ci-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the v1-guarantee-stabilization Goal
 * (`20260922-stabilize-guarantees`) changed: the raised declared test count
 * and this declaration. Their entries here stay historical;
 * docs/v1-guarantees-hashes.json binds the current bytes.
 */
const CHANGED_IN_V1_GUARANTEES: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/ci-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the regression-evidence Goal
 * (`20260922-regression-evidence-per-guarantee`) changed: the raised declared
 * test count and this declaration. Their entries here stay historical;
 * docs/regression-evidence-hashes.json binds the current bytes.
 */
const CHANGED_IN_REGRESSION_EVIDENCE: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/ci-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the unknowns-bound Goal
 * (`20260924-unknowns-bound`) changed: the raised declared test count
 * and this declaration. Their entries here stay historical;
 * docs/unknown-bounds-hashes.json binds the current bytes.
 */
const CHANGED_IN_UNKNOWN_BOUNDS: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/ci-manifest.test.ts": true,
  "test/hash-manifest.test.ts": true,
};

/**
 * Artifacts whose bytes the independent-audit Goal
 * (`20260924-v1-independent-audit`) changed: the raised declared test count,
 * the retention-list entry, and this declaration. Their entries here stay
 * historical; docs/independent-audit-hashes.json binds the current bytes.
 */
const CHANGED_IN_INDEPENDENT_AUDIT: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/ci-manifest.test.ts": true,
};

const COVERED_FILES = [
  ".github/workflows/ci.yml",
  "scripts/assert-test-outcome.mjs",
  "test/ci-test-budget.json",
  "test/ci-budget.test.ts",
  "test/ci-manifest.test.ts",
  "test/hash-manifest.test.ts",
  "docs/CI-EVIDENCE.md",
] as const;

test("the hosted-CI artifact hash manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    if (CHANGED_IN_COMPATIBILITY.has(file)) continue; // accepted hosted-CI bytes; the compatibility Goal binds the current ones
    if (CHANGED_IN_PACKAGING.has(file)) continue; // raised count; the packaging manifest binds the current bytes
    if (CHANGED_IN_POST_TRANSFER.has(file)) continue; // moved canonical location; the post-transfer manifest binds the current bytes
    if (CHANGED_IN_RELEASE_REVIEW[file] === true) continue; // reviewed wording; the release-review manifest binds the current bytes
    if (CHANGED_IN_V1_GUARANTEES[file] === true) continue; // stabilized wording; the v1-guarantees manifest binds the current bytes
    if (CHANGED_IN_REGRESSION_EVIDENCE[file] === true) continue; // regression evidence; the regression-evidence manifest binds the current bytes
    if (CHANGED_IN_UNKNOWN_BOUNDS[file] === true) continue; // unknowns bound; the unknown-bounds manifest binds the current bytes
    if (CHANGED_IN_INDEPENDENT_AUDIT[file] === true) continue; // independent audit; the independent-audit manifest binds the current bytes
    const current = createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    if (manifest[file] !== current) {
      mismatches.push({ file, current, expected: manifest[file] ?? null });
    }
    if (process.env["PIWARDEN_MANIFEST_VERBOSE"] === "1") console.log(`sha256 ${file} = ${current}`);
  }
  assert.equal(
    mismatches.length,
    0,
    `hash manifest mismatch for:\n${mismatches
      .map((entry) => `${entry.file}: current ${entry.current} recorded ${entry.expected}`)
      .join("\n")}`,
  );
});

test("the hosted-CI manifest records every artifact with its Goal 2 provenance", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const goal2 = JSON.parse(await readFile("docs/file-gate-hashes.json", "utf8")) as Record<string, string>;
  for (const file of COVERED_FILES) {
    assert.ok(typeof manifest[file] === "string" && manifest[file].length === 64, `${file} must be recorded`);
  }
  assert.equal(Object.keys(manifest).length, COVERED_FILES.length);
  // The CI workflow is the one artifact this manifest shares with the Goal 2
  // manifest: its Goal 2 entry is historical accepted bytes, so the current
  // identity must differ and the Goal 2 test must declare it changed.
  assert.notEqual(
    goal2[".github/workflows/ci.yml"],
    manifest[".github/workflows/ci.yml"],
    "the CI workflow must carry a fresh identity after its hosted-CI Goal change",
  );
  const goal2Test = await readFile("test/hash-manifest.test.ts", "utf8");
  assert.match(goal2Test, /CHANGED_IN_HOSTED_CI = new Set<string>\(\["\.github\/workflows\/ci\.yml"\]\)/);
});

test("the compatibility Goal changed exactly the budget and this manifest suite", () => {
  const compatibilityOnly = [
    "docs/COMPATIBILITY.md",
    "docs/compatibility-hashes.json",
    "test/compatibility-manifest.test.ts",
  ];
  for (const file of CHANGED_IN_COMPATIBILITY) {
    assert.ok(
      COVERED_FILES.includes(file as (typeof COVERED_FILES)[number]),
      `${file} must be in the hosted-CI manifest`,
    );
  }
  for (const file of compatibilityOnly) {
    assert.ok(
      !COVERED_FILES.includes(file as (typeof COVERED_FILES)[number]),
      `${file} is compatibility-matrix-only and must not be in the hosted-CI manifest`,
    );
  }
});
