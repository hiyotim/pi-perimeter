import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/** Binds the 1.0.1 staging preparation without rewriting historical manifest values. */
const MANIFEST_PATH = "docs/release-hashes-1.0.1.json";
const COVERED_FILES = [
  ".github/workflows/release.yml",
  "ARCHITECTURE.md",
  "README.md",
  "SECURITY.md",
  "THREAT_MODEL.md",
  "docs/COMPATIBILITY.md",
  "docs/PACKAGING.md",
  "docs/RELEASE-AUDIT-1.0.1.md",
  "package.json",
  "scripts/build-release-staging.mjs",
  "scripts/verify-release-staging.mjs",
  "test/ci-manifest.test.ts",
  "test/ci-test-budget.json",
  "test/compatibility-manifest.test.ts",
  "test/hash-manifest.test.ts",
  "test/independent-audit-manifest.test.ts",
  "test/network-manifest.test.ts",
  "test/packaging-manifest.test.ts",
  "test/post-transfer-manifest.test.ts",
  "test/regression-evidence-manifest.test.ts",
  "test/release-1.0.1-manifest.test.ts",
  "test/release-manifest.test.ts",
  "test/release-review-manifest.test.ts",
  "test/release-safeguards.test.ts",
  "test/shell-manifest.test.ts",
  "test/startup-readiness-manifest.test.ts",
  "test/unknown-bounds-manifest.test.ts",
  "test/v1-guarantees-manifest.test.ts",
] as const;

const HISTORICAL_DECLARATIONS: Record<string, readonly string[]> = {
  "test/ci-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/hash-manifest.test.ts",
  ],
  "test/compatibility-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
  ],
  "test/hash-manifest.test.ts": [
    "package.json",
  ],
  "test/independent-audit-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
  ],
  "test/network-manifest.test.ts": [
    "test/network-manifest.test.ts",
    "test/shell-manifest.test.ts",
  ],
  "test/packaging-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "package.json",
    "test/ci-test-budget.json",
    "test/packaging-manifest.test.ts",
    "test/hash-manifest.test.ts",
    "test/shell-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/network-manifest.test.ts",
  ],
  "test/post-transfer-manifest.test.ts": [
    "package.json",
    "SECURITY.md",
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/packaging-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
  ],
  "test/regression-evidence-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/network-manifest.test.ts",
    "test/hash-manifest.test.ts",
    "test/shell-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
  ],
  "test/release-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    ".github/workflows/release.yml",
    "scripts/build-release-staging.mjs",
    "scripts/verify-release-staging.mjs",
    "test/ci-test-budget.json",
    "test/release-safeguards.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/release-manifest.test.ts",
  ],
  "test/release-review-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "ARCHITECTURE.md",
    "THREAT_MODEL.md",
    "docs/COMPATIBILITY.md",
    "test/ci-test-budget.json",
    "test/packaging-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/release-review-manifest.test.ts",
  ],
  "test/shell-manifest.test.ts": [
    "package.json",
    "test/shell-manifest.test.ts",
  ],
  "test/startup-readiness-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/hash-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/network-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/release-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/shell-manifest.test.ts",
    "test/startup-readiness-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/unknown-bounds-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/hash-manifest.test.ts",
    "test/shell-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
  ],
  "test/v1-guarantees-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
};

test("release-1.0.1 manifest binds every changed artifact", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  assert.deepEqual(Object.keys(manifest).sort(), [...COVERED_FILES].sort());
  for (const file of COVERED_FILES) {
    const current = createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    assert.equal(current, manifest[file], `${file} differs from the 1.0.1 snapshot`);
  }
});

test("historical manifest suites declare only this Goal’s covered changes", async () => {
  for (const [suite, expected] of Object.entries(HISTORICAL_DECLARATIONS)) {
    const source = await readFile(suite, "utf8");
    const match = /CHANGED_IN_1_0_1 = new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
    assert.ok(match, `${suite} lacks the 1.0.1 declaration`);
    const declared = [...match[1]!.matchAll(/"([^"]+)"/g)].map((item) => item[1]!);
    assert.deepEqual(declared.sort(), [...expected].sort(), `${suite} declares the wrong historical exceptions`);
  }
});
