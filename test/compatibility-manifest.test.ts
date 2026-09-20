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
