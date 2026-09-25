import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/** Binds the user-install-onboarding snapshot without rewriting historical manifest values. */
const MANIFEST_PATH = "docs/user-install-onboarding-hashes.json";
const COVERED_FILES = [
  "IMPLEMENTATION_HANDOFF.md",
  "README.md",
  "docs/COMPATIBILITY.md",
  "docs/INSTALL-ONBOARDING-AUDIT.md",
  "test/ci-manifest.test.ts",
  "test/ci-test-budget.json",
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
  "test/user-install-onboarding.test.ts",
  "test/v1-guarantees-manifest.test.ts",
] as const;

const HISTORICAL_DECLARATIONS: Record<string, readonly string[]> = {
  "test/ci-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
  ],
  "test/compatibility-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
  ],
  "test/packaging-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
  ],
  "test/post-transfer-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
  ],
  "test/regression-evidence-manifest.test.ts": [
    "test/ci-test-budget.json",
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
    "docs/COMPATIBILITY.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/release-manifest.test.ts",
  ],
  "test/release-review-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
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
  "test/unknown-bounds-manifest.test.ts": [
    "test/ci-test-budget.json",
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
  "test/startup-readiness-manifest.test.ts": [
    "IMPLEMENTATION_HANDOFF.md",
    "README.md",
    "docs/COMPATIBILITY.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
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
    "docs/COMPATIBILITY.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
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
};

test("user-install-onboarding manifest binds every changed artifact", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  assert.deepEqual(Object.keys(manifest).sort(), [...COVERED_FILES].sort());
  for (const file of COVERED_FILES) {
    const current = createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    assert.equal(current, manifest[file], `${file} differs from the user-install-onboarding snapshot`);
  }
});

test("historical manifest suites declare only this Goal's covered changes", async () => {
  for (const [suite, expected] of Object.entries(HISTORICAL_DECLARATIONS)) {
    const source = await readFile(suite, "utf8");
    const match = /CHANGED_IN_USER_INSTALL_ONBOARDING = new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
    assert.ok(match, `${suite} lacks the user-install-onboarding declaration`);
    const declared = [...match[1]!.matchAll(/"([^"]+)"/g)].map((item) => item[1]!);
    assert.deepEqual(declared.sort(), [...expected].sort(), `${suite} declares the wrong historical exceptions`);
  }
});
