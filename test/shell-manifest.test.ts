import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the Goal 3 shell-containment artifacts.
 *
 * Every entry lists the sha256 of the final file. The test recomputes hashes
 * each run, prints the current value for any mismatch, and fails until the
 * manifest matches the working tree, so the audit document and any reviewer
 * verdict are tied to exact file contents. To refresh the manifest after a
 * verified intentional change, replace each entry with the hash printed in the
 * failure diff and re-run this suite.
 */

const MANIFEST_PATH = "docs/shell-gate-hashes.json";

/**
 * Artifacts whose bytes Goal 4 (`20260919-restricted-networking-e2e-evidence`)
 * deliberately changed with fresh evidence; their entries in this manifest are
 * historical accepted bytes, not working-tree assertions. The Goal 4 audit
 * records the old and new hashes, and docs/network-gate-hashes.json binds the
 * current bytes.
 */
const CHANGED_IN_GOAL_4 = new Set<string>([
  "src/gate/shell-runtime.ts",
  "src/policy/shell-plan.ts",
  "src/policy/shell-policy.ts",
  "src/approvals/shell-approvals.ts",
  "src/sandbox/errors.ts",
  "src/sandbox/seatbelt.ts",
  "src/sandbox/containment.ts",
  "docs/SHELL-GATE.md",
  "test/shell-policy.test.ts",
  "test/shell-approvals.test.ts",
  "test/seatbelt-profile.test.ts",
  "test/shell-manifest.test.ts",
]);

const COVERED_FILES = [
  "package.json",
  "src/index.ts",
  "src/policy/operations.ts",
  "src/policy/resources.ts",
  "src/policy/shell-grammar.ts",
  "src/policy/shell-commands.ts",
  "src/policy/shell-plan.ts",
  "src/policy/shell-policy.ts",
  "src/approvals/approvals.ts",
  "src/approvals/shell-approvals.ts",
  "src/gate/runtime.ts",
  "src/gate/shell-runtime.ts",
  "src/gate/authorizer.ts",
  "src/gate/gate-input.ts",
  "src/sandbox/errors.ts",
  "src/sandbox/seatbelt.ts",
  "src/sandbox/projection.ts",
  "src/sandbox/quiescence.ts",
  "src/sandbox/census.ts",
  "src/sandbox/freeze.ts",
  "src/sandbox/export.ts",
  "src/sandbox/helper.ts",
  "src/sandbox/containment.ts",
  "src/sandbox/native/piwarden-helper.c",
  "scripts/build-native.mjs",
  "docs/SHELL-GATE.md",
  "docs/SHELL-GATE-AUDIT.md",
  "test/shell-grammar.test.ts",
  "test/shell-plan.test.ts",
  "test/shell-policy.test.ts",
  "test/shell-approvals.test.ts",
  "test/seatbelt-profile.test.ts",
  "test/projection.test.ts",
  "test/export.test.ts",
  "test/quiescence.test.ts",
  "test/shell-containment.test.ts",
  "test/shell-manifest.test.ts",
] as const;

test("the Goal 3 artifact hash manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    if (CHANGED_IN_GOAL_4.has(file)) continue; // historical bytes; fresh evidence binds the current tree
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

test("the manifest covers every Goal 3 source and test artifact", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  for (const file of COVERED_FILES) {
    assert.ok(typeof manifest[file] === "string" && manifest[file].length === 64, `${file} must be recorded`);
  }
  assert.equal(Object.keys(manifest).length, COVERED_FILES.length);
});

test("the Goal 4 artifacts are split exactly right: changed here, new elsewhere", () => {
  // The Goal 4-only artifacts (new files and artifacts outside this Goal 3
  // manifest's scope) belong to docs/network-gate-hashes.json, not to this
  // historical record.
  const goal4Only = [
    "src/policy/network.ts",
    "src/sandbox/network-broker.ts",
    "test/network-policy.test.ts",
    "test/network-effects.test.ts",
    "test/network-manifest.test.ts",
    "docs/NETWORK-GATE.md",
    "docs/NETWORK-GATE-AUDIT.md",
    "docs/network-gate-hashes.json",
  ];
  for (const file of CHANGED_IN_GOAL_4) {
    assert.ok(COVERED_FILES.includes(file as (typeof COVERED_FILES)[number]), `${file} must be in the Goal 3 manifest`);
    assert.ok(!goal4Only.includes(file), `${file} cannot be both a changed Goal 3 artifact and a Goal 4-only one`);
  }
  for (const file of goal4Only) {
    assert.ok(!COVERED_FILES.includes(file as (typeof COVERED_FILES)[number]), `${file} is Goal 4-only and must not be in the Goal 3 manifest`);
  }
});
