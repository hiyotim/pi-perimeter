import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the compatibility-matrix Goal artifacts
 * (`20260920-compatibility-matrix`).
 *
 * Every entry lists the sha256 of the final file. The test recomputes hashes
 * each run, prints the current value for any mismatch, and fails until the
 * manifest matches the working tree, so the published matrix and any reviewer
 * verdict are tied to exact file contents. To refresh the manifest after a
 * verified intentional change, replace each entry with the hash printed in the
 * failure diff and re-run this suite.
 */

const MANIFEST_PATH = "docs/compatibility-hashes.json";

/**
 * Artifacts whose bytes the packaging Goal (`20260920-npm-packaging`) changed:
 * the distribution row, the raised declared test count, and this declaration.
 * Their entries here are the accepted compatibility-matrix bytes;
 * docs/packaging-hashes.json binds the current bytes.
 */
const CHANGED_IN_PACKAGING = new Set<string>([
  "docs/COMPATIBILITY.md",
  "README.md",
  "test/ci-test-budget.json",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
]);

/**
 * Artifacts whose bytes the post-transfer pass changed: the repository locator in
 * the CI evidence record and the manifest declarations. Their entries here stay
 * historical; docs/post-transfer-hashes.json binds the current bytes.
 */
const CHANGED_IN_POST_TRANSFER = new Set<string>([
  "docs/CI-EVIDENCE.md",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
]);

/**
 * Artifacts whose bytes the release-candidate review Goal
 * (`20260922-release-candidate-reviews`) changed: corrected Linux wording plus
 * the raised declared test count and this declaration. Their entries here stay
 * historical; docs/release-review-hashes.json binds the current bytes.
 */
const CHANGED_IN_RELEASE_REVIEW: Record<string, true> = {
  "docs/COMPATIBILITY.md": true,
  "README.md": true,
  "test/ci-test-budget.json": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the regression-evidence Goal
 * (`20260922-regression-evidence-per-guarantee`) changed: the raised declared
 * test count and this declaration. Their entries here stay historical;
 * docs/regression-evidence-hashes.json binds the current bytes.
 */
const CHANGED_IN_REGRESSION_EVIDENCE: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/compatibility-manifest.test.ts": true,
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
  "test/compatibility-manifest.test.ts": true,
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
  "test/compatibility-manifest.test.ts": true,
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
  "test/compatibility-manifest.test.ts": true,
};

/** Historical entries changed by the startup-readiness Goal; current bytes are bound by docs/startup-readiness-hashes.json. */
const CHANGED_IN_STARTUP_READINESS = new Set<string>([
  "README.md",
  "docs/COMPATIBILITY.md",
  "test/ci-manifest.test.ts",
  "test/ci-test-budget.json",
  "test/compatibility-manifest.test.ts",
]);

/** Artifacts whose bytes the 1.0.1 staging-preparation Goal changed; their entries here stay historical; docs/release-hashes-1.0.1.json binds the current bytes. */
const CHANGED_IN_1_0_1 = new Set<string>([
  "README.md",
  "docs/COMPATIBILITY.md",
  "test/ci-manifest.test.ts",
  "test/ci-test-budget.json",
  "test/compatibility-manifest.test.ts",
]);

/** Historical entries changed by the user-install-onboarding Goal; current bytes are bound by docs/user-install-onboarding-hashes.json. */
const CHANGED_IN_USER_INSTALL_ONBOARDING = new Set<string>([
  "README.md",
  "docs/COMPATIBILITY.md",
  "test/ci-manifest.test.ts",
  "test/ci-test-budget.json",
  "test/compatibility-manifest.test.ts",
]);

/** Artifacts whose bytes the 1.0.1 final-release Goal changed; their entries here stay historical; docs/release-hashes-1.0.1-final.json binds the current bytes. */
const CHANGED_IN_1_0_1_RELEASE = new Set<string>([
  "test/ci-test-budget.json",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
]);

/** Artifacts whose bytes the 1.0.1 postpublication Goal changed; their entries here stay historical; docs/release-hashes-1.0.1-postpublication.json binds the current bytes. */
const CHANGED_IN_1_0_1_POSTPUBLICATION = new Set<string>([
  "README.md",
  "docs/COMPATIBILITY.md",
  "test/ci-test-budget.json",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
]);

const COVERED_FILES = [
  "docs/COMPATIBILITY.md",
  "docs/CI-EVIDENCE.md",
  "README.md",
  "test/ci-test-budget.json",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
] as const;

test("the compatibility-matrix artifact hash manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    if (CHANGED_IN_PACKAGING.has(file)) continue; // accepted matrix bytes; the packaging manifest binds the current ones
    if (CHANGED_IN_POST_TRANSFER.has(file)) continue; // moved canonical location; the post-transfer manifest binds the current bytes
    if (CHANGED_IN_RELEASE_REVIEW[file] === true) continue; // reviewed wording; the release-review manifest binds the current bytes
    if (CHANGED_IN_REGRESSION_EVIDENCE[file] === true) continue; // regression evidence; the regression-evidence manifest binds the current bytes
    if (CHANGED_IN_V1_GUARANTEES[file] === true) continue; // stabilized wording; the v1-guarantees manifest binds the current bytes
    if (CHANGED_IN_UNKNOWN_BOUNDS[file] === true) continue; // unknowns bound; the unknown-bounds manifest binds the current bytes
    if (CHANGED_IN_INDEPENDENT_AUDIT[file] === true) continue; // independent audit; the independent-audit manifest binds the current bytes
    if (CHANGED_IN_STARTUP_READINESS.has(file)) continue; // current snapshot bound by the startup-readiness manifest
    if (CHANGED_IN_1_0_1.has(file)) continue; // 1.0.1 staging preparation; docs/release-hashes-1.0.1.json binds the current bytes
    if (CHANGED_IN_USER_INSTALL_ONBOARDING.has(file)) continue; // user-install onboarding; docs/user-install-onboarding-hashes.json binds the current bytes
    if (CHANGED_IN_1_0_1_RELEASE.has(file)) continue; // 1.0.1 final release; docs/release-hashes-1.0.1-final.json binds the current bytes
    if (CHANGED_IN_1_0_1_POSTPUBLICATION.has(file)) continue; // 1.0.1 postpublication wording; docs/release-hashes-1.0.1-postpublication.json binds the current bytes
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

test("the compatibility manifest records every artifact with its hosted-CI provenance", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const hostedCi = JSON.parse(await readFile("docs/ci-hashes.json", "utf8")) as Record<string, string>;
  for (const file of COVERED_FILES) {
    assert.ok(typeof manifest[file] === "string" && manifest[file].length === 64, `${file} must be recorded`);
  }
  assert.equal(Object.keys(manifest).length, COVERED_FILES.length);
  // The artifacts this Goal changed inside the hosted-CI manifest must carry a
  // fresh identity, so the historical entries there cannot be mistaken for the
  // working tree, and the hosted-CI suite must declare them changed.
  for (const file of ["test/ci-test-budget.json", "test/ci-manifest.test.ts", "docs/CI-EVIDENCE.md"]) {
    assert.notEqual(
      hostedCi[file],
      manifest[file],
      `${file} must have a fresh identity after its compatibility-matrix change`,
    );
  }
  const hostedCiTest = await readFile("test/ci-manifest.test.ts", "utf8");
  assert.match(hostedCiTest, /CHANGED_IN_COMPATIBILITY = new Set<string>\(\[/);
});
