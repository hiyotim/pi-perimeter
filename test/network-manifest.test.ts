import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the Goal 4 network-gate artifacts
 * (`20260919-restricted-networking-e2e-evidence`).
 *
 * Every entry lists the sha256 of the final file. The test recomputes hashes
 * each run, prints the current value for any mismatch, and fails until the
 * manifest matches the working tree, so the audit document and any reviewer
 * verdict are tied to exact file contents. To refresh the manifest after a
 * verified intentional change, replace each entry with the hash printed in
 * the failure diff and re-run this suite.
 */

const MANIFEST_PATH = "docs/network-gate-hashes.json";

const COVERED_FILES = [
  "src/policy/configuration.ts",
  "src/policy/network.ts",
  "src/policy/shell-plan.ts",
  "src/policy/shell-policy.ts",
  "src/gate/shell-runtime.ts",
  "src/approvals/shell-approvals.ts",
  "src/sandbox/errors.ts",
  "src/sandbox/seatbelt.ts",
  "src/sandbox/containment.ts",
  "src/sandbox/network-broker.ts",
  "test/network-policy.test.ts",
  "test/network-effects.test.ts",
  "test/network-manifest.test.ts",
  "test/shell-policy.test.ts",
  "test/shell-approvals.test.ts",
  "test/seatbelt-profile.test.ts",
  "test/shell-manifest.test.ts",
  "docs/SHELL-GATE.md",
  "docs/NETWORK-GATE.md",
  "docs/NETWORK-GATE-AUDIT.md",
] as const;

test("the Goal 4 artifact hash manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
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

test("the Goal 4 manifest records every changed or new artifact with its Goal 3 provenance", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const goal3 = JSON.parse(await readFile("docs/shell-gate-hashes.json", "utf8")) as Record<string, string>;
  for (const file of COVERED_FILES) {
    assert.ok(typeof manifest[file] === "string" && manifest[file].length === 64, `${file} must be recorded`);
  }
  assert.equal(Object.keys(manifest).length, COVERED_FILES.length);
  // Files this manifest shares with the Goal 3 manifest must carry different
  // bytes there (they were changed by this Goal with fresh evidence); the old
  // hashes are preserved in the Goal 3 audit.
  for (const file of COVERED_FILES) {
    if (goal3[file] !== undefined) {
      assert.notEqual(goal3[file], manifest[file], `${file} must have a fresh identity after its Goal 4 change`);
    }
  }
});
