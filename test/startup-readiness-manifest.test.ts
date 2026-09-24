import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/** Binds the new startup-readiness snapshot without rewriting historical manifest values. */
const MANIFEST_PATH = "docs/startup-readiness-hashes.json";
const COVERED_FILES = [
  "IMPLEMENTATION_HANDOFF.md",
  "README.md",
  "docs/COMPATIBILITY.md",
  "docs/DEVELOPMENT.md",
  "docs/PACKAGING.md",
  "docs/STARTUP-READINESS-AUDIT.md",
  "src/gate/runtime.ts",
  "test/ci-manifest.test.ts",
  "test/ci-test-budget.json",
  "test/compatibility-manifest.test.ts",
  "test/gate-runtime.test.ts",
  "test/hash-manifest.test.ts",
  "test/independent-audit-manifest.test.ts",
  "test/network-manifest.test.ts",
  "test/packaging-identity.test.ts",
  "test/packaging-manifest.test.ts",
  "test/post-transfer-manifest.test.ts",
  "test/regression-evidence-manifest.test.ts",
  "test/release-manifest.test.ts",
  "test/release-review-manifest.test.ts",
  "test/shell-manifest.test.ts",
  "test/startup-readiness-manifest.test.ts",
  "test/startup-readiness.test.ts",
  "test/unknown-bounds-manifest.test.ts",
  "test/v1-guarantees-manifest.test.ts",
] as const;

const HISTORICAL_DECLARATIONS: Record<string, readonly string[]> = {
  "test/ci-manifest.test.ts": [
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
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
    "src/gate/runtime.ts",
    "test/gate-runtime.test.ts",
  ],
  "test/independent-audit-manifest.test.ts": [
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/network-manifest.test.ts": [
    "test/network-manifest.test.ts",
    "test/shell-manifest.test.ts",
  ],
  "test/packaging-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/hash-manifest.test.ts",
    "test/network-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/shell-manifest.test.ts",
  ],
  "test/post-transfer-manifest.test.ts": [
    "docs/PACKAGING.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
  ],
  "test/regression-evidence-manifest.test.ts": [
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/gate-runtime.test.ts",
    "test/hash-manifest.test.ts",
    "test/network-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/shell-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/release-manifest.test.ts": [
    "README.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
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
    "docs/COMPATIBILITY.md",
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
  ],
  "test/shell-manifest.test.ts": [
    "src/gate/runtime.ts",
    "test/shell-manifest.test.ts",
  ],
  "test/unknown-bounds-manifest.test.ts": [
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/hash-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/regression-evidence-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/shell-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/v1-guarantees-manifest.test.ts": [
    "test/ci-manifest.test.ts",
    "test/ci-test-budget.json",
    "test/compatibility-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
};

test("startup-readiness manifest binds every changed artifact", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  assert.deepEqual(Object.keys(manifest).sort(), [...COVERED_FILES].sort());
  for (const file of COVERED_FILES) {
    const current = createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    assert.equal(current, manifest[file], `${file} differs from the startup-readiness snapshot`);
  }
});

test("historical manifest suites declare only this Goal’s covered changes", async () => {
  for (const [suite, expected] of Object.entries(HISTORICAL_DECLARATIONS)) {
    const source = await readFile(suite, "utf8");
    const match = /CHANGED_IN_STARTUP_READINESS = new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
    assert.ok(match, `${suite} lacks the startup-readiness declaration`);
    const declared = [...match[1]!.matchAll(/"([^"]+)"/g)].map((item) => item[1]!);
    assert.deepEqual(declared.sort(), [...expected].sort(), `${suite} declares the wrong historical exceptions`);
  }
});
