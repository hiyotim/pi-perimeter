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
