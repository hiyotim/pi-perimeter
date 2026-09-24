import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the post-transfer pass
 * (`20260920-post-transfer`).
 *
 * The repository moved from `pi-warden/pi-warden` to `hiyotim/pi-perimeter`, so the
 * canonical URLs, the reporting route and the repository locator in the evidence
 * records changed. Every entry lists the sha256 of the final file; the test
 * recomputes hashes each run and fails until the manifest matches the working
 * tree, so the corrected location and any reviewer verdict are tied to exact
 * bytes. Earlier manifests keep their historical entries, declared through each
 * suite's own change set. To refresh the manifest after a verified intentional
 * change, replace each entry with the hash printed in the failure diff.
 */

const MANIFEST_PATH = "docs/post-transfer-hashes.json";

const COVERED_FILES = [
  "package.json",
  "SECURITY.md",
  "docs/PACKAGING.md",
  "docs/CI-EVIDENCE.md",
  "docs/VULNERABILITY-REPORTING-AUDIT.md",
  "test/ci-test-budget.json",
  "test/packaging-identity.test.ts",
  "test/packaging-manifest.test.ts",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
  "test/post-transfer-manifest.test.ts",
] as const;

/**
 * Artifacts whose bytes the release-candidate review Goal
 * (`20260922-release-candidate-reviews`) changed: reviewed wording plus the
 * raised declared test count and this declaration. Their entries here stay
 * historical; docs/release-review-hashes.json binds the current bytes.
 */
const CHANGED_IN_RELEASE_REVIEW: Record<string, true> = {
  "SECURITY.md": true,
  "test/ci-test-budget.json": true,
  "test/packaging-identity.test.ts": true,
  "test/packaging-manifest.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
  "test/post-transfer-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the v1-guarantee-stabilization Goal
 * (`20260922-stabilize-guarantees`) changed: the raised declared test count,
 * the retention-list entry, and this declaration. Their entries here stay
 * historical; docs/v1-guarantees-hashes.json binds the current bytes.
 */
const CHANGED_IN_V1_GUARANTEES: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/packaging-identity.test.ts": true,
  "test/packaging-manifest.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
  "test/post-transfer-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the regression-evidence Goal
 * (`20260922-regression-evidence-per-guarantee`) changed: the raised declared
 * test count and this declaration. Their entries here stay historical;
 * docs/regression-evidence-hashes.json binds the current bytes.
 */
const CHANGED_IN_REGRESSION_EVIDENCE: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/packaging-identity.test.ts": true,
  "test/packaging-manifest.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
  "test/post-transfer-manifest.test.ts": true,
};

/** Artifacts this pass also changed inside an earlier manifest. */
const SHARED_WITH_EARLIER_MANIFESTS: Record<string, string[]> = {
  "package.json": [
    "docs/file-gate-hashes.json",
    "docs/shell-gate-hashes.json",
    "docs/packaging-hashes.json",
  ],
  "SECURITY.md": ["docs/packaging-hashes.json"],
  "docs/PACKAGING.md": ["docs/packaging-hashes.json"],
  "docs/CI-EVIDENCE.md": ["docs/ci-hashes.json", "docs/compatibility-hashes.json"],
  "test/ci-test-budget.json": [
    "docs/ci-hashes.json",
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
  ],
  "test/packaging-identity.test.ts": ["docs/packaging-hashes.json"],
  "test/packaging-manifest.test.ts": ["docs/packaging-hashes.json"],
  "test/ci-manifest.test.ts": [
    "docs/ci-hashes.json",
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
  ],
  "test/compatibility-manifest.test.ts": [
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
  ],
};

/** The declared change set each earlier manifest must carry, exactly. */
const DECLARED_CHANGE_SETS: Record<string, string[]> = {
  "test/packaging-manifest.test.ts": [
    "package.json",
    "SECURITY.md",
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
  ],
  "test/ci-manifest.test.ts": ["docs/CI-EVIDENCE.md", "test/ci-manifest.test.ts"],
  "test/compatibility-manifest.test.ts": [
    "docs/CI-EVIDENCE.md",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
  ],
};

test("the post-transfer manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    if (CHANGED_IN_RELEASE_REVIEW[file] === true) continue; // reviewed wording; the release-review manifest binds the current bytes
    if (CHANGED_IN_V1_GUARANTEES[file] === true) continue; // stabilized wording; the v1-guarantees manifest binds the current bytes
    if (CHANGED_IN_REGRESSION_EVIDENCE[file] === true) continue; // regression evidence; the regression-evidence manifest binds the current bytes
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

test("the post-transfer manifest supersedes exactly the earlier entries it covers", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  for (const file of COVERED_FILES) {
    assert.ok(typeof manifest[file] === "string" && manifest[file].length === 64, `${file} must be recorded`);
  }
  assert.equal(Object.keys(manifest).length, COVERED_FILES.length);
  for (const [file, earlier] of Object.entries(SHARED_WITH_EARLIER_MANIFESTS)) {
    assert.ok(
      COVERED_FILES.includes(file as (typeof COVERED_FILES)[number]),
      `${file} must be covered by this manifest`,
    );
    for (const earlierPath of earlier) {
      const previous = JSON.parse(await readFile(earlierPath, "utf8")) as Record<string, string>;
      assert.notEqual(
        previous[file],
        manifest[file],
        `${file} must have a fresh identity after the post-transfer change (${earlierPath})`,
      );
    }
  }
});

test("every earlier manifest declares exactly the post-transfer changes it covers", async () => {
  for (const [file, expected] of Object.entries(DECLARED_CHANGE_SETS)) {
    const source = await readFile(file, "utf8");
    const declaration = /CHANGED_IN_POST_TRANSFER = new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
    assert.ok(declaration, `${file} must declare its post-transfer change set`);
    const declared = [...declaration[1]!.matchAll(/"([^"]+)"/g)].map((match) => match[1]!).sort();
    assert.deepEqual(declared, [...expected].sort(), `${file} must declare exactly the covered changes`);
  }
});
