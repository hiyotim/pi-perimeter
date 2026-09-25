import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Binds the 1.0.1 postpublication wording update without rewriting
 * historical manifest values (`20260925-release-v101`, Criterion 4).
 *
 * The candidate, preparation, and final-release bindings stay frozen
 * historical evidence; this additive binding covers the exact current bytes
 * of every file the postpublication update creates or modifies, plus the
 * frozen final binding and final audit as references. Every entry lists the
 * sha256 of the current file and the test recomputes each hash every run,
 * with no exception sets. This binding must never list itself: no file it
 * covers may record its own hash.
 */
const MANIFEST_PATH = "docs/release-hashes-1.0.1-postpublication.json";
const COVERED_FILES = [
  "README.md",
  "SECURITY.md",
  "docs/COMPATIBILITY.md",
  "docs/PACKAGING.md",
  "docs/RELEASE-AUDIT-1.0.1-FINAL.md",
  "docs/RELEASE-AUDIT-1.0.1-POSTPUBLICATION.md",
  "docs/release-hashes-1.0.1-final.json",
  "STATE.md",
  "ROADMAP.md",
  "test/ci-test-budget.json",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
  "test/independent-audit-manifest.test.ts",
  "test/packaging-identity.test.ts",
  "test/packaging-manifest.test.ts",
  "test/post-transfer-manifest.test.ts",
  "test/regression-evidence-manifest.test.ts",
  "test/release-1.0.1-final-manifest.test.ts",
  "test/release-1.0.1-manifest.test.ts",
  "test/release-1.0.1-postpublication-manifest.test.ts",
  "test/release-manifest.test.ts",
  "test/release-review-manifest.test.ts",
  "test/unknown-bounds-manifest.test.ts",
  "test/user-install-onboarding-manifest.test.ts",
  "test/v1-guarantees-manifest.test.ts",
  "test/startup-readiness-manifest.test.ts",
] as const;

/** The exact postpublication change set each earlier manifest suite must declare. */
const POSTPUBLICATION_DECLARATIONS: Record<string, readonly string[]> = {
  "test/ci-manifest.test.ts": ["test/ci-test-budget.json", "test/ci-manifest.test.ts"],
  "test/compatibility-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
  ],
  "test/packaging-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
  ],
  "test/post-transfer-manifest.test.ts": [
    "SECURITY.md",
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
  ],
  "test/regression-evidence-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
  ],
  "test/unknown-bounds-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
  ],
  "test/independent-audit-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
  ],
  "test/release-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/release-review-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
  ],
  "test/v1-guarantees-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/startup-readiness-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/release-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/startup-readiness-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/release-1.0.1-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/release-1.0.1-manifest.test.ts",
    "test/release-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/startup-readiness-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/user-install-onboarding-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/release-1.0.1-manifest.test.ts",
    "test/release-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/startup-readiness-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/user-install-onboarding-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/release-1.0.1-final-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/release-1.0.1-final-manifest.test.ts",
    "test/release-1.0.1-manifest.test.ts",
    "test/release-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/startup-readiness-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/user-install-onboarding-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
};

test("release-1.0.1-postpublication manifest binds every updated file with no exceptions", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  assert.deepEqual(Object.keys(manifest).sort(), [...COVERED_FILES].sort());
  assert.ok(!Object.hasOwn(manifest, MANIFEST_PATH), "the binding must not list itself");
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    const current = createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    if (manifest[file] !== current) {
      mismatches.push({ file, current, expected: manifest[file] ?? null });
    }
  }
  assert.equal(
    mismatches.length,
    0,
    `hash manifest mismatch for:\n${mismatches
      .map((entry) => `${entry.file}: current ${entry.current} recorded ${entry.expected}`)
      .join("\n")}`,
  );
});

test("earlier manifest suites declare exactly the postpublication changes", async () => {
  for (const [suite, expected] of Object.entries(POSTPUBLICATION_DECLARATIONS)) {
    const source = await readFile(suite, "utf8");
    const match = /CHANGED_IN_1_0_1_POSTPUBLICATION = new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
    assert.ok(match, `${suite} lacks the 1.0.1-postpublication declaration`);
    const declared = [...match[1]!.matchAll(/"([^"]+)"/g)].map((item) => item[1]!);
    assert.deepEqual(declared.sort(), [...expected].sort(), `${suite} declares the wrong postpublication exceptions`);
  }
});
