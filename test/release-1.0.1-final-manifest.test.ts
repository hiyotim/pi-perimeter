import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Binds the final 1.0.1 release candidate without rewriting historical
 * manifest values (`20260925-release-v101`).
 *
 * The staging-preparation binding `docs/release-hashes-1.0.1.json` stays
 * frozen historical evidence; this additive binding covers the exact final
 * candidate bytes with no exception sets: every entry lists the sha256 of
 * the current file and the test recomputes each hash every run. Covered: the
 * final release audit, this suite itself, every file this Goal creates or
 * modifies, the release machinery, the versioned public surface, the
 * 1.0.1-specific corrections and their evidence, the frozen preparation
 * binding, and the manifest/safeguard suites that participate in release
 * verification. This binding must never list itself: no file it covers may
 * record its own hash.
 */
const MANIFEST_PATH = "docs/release-hashes-1.0.1-final.json";
const COVERED_FILES = [
  ".github/workflows/release.yml",
  ".gitignore",
  "IMPLEMENTATION_HANDOFF.md",
  "README.md",
  "SECURITY.md",
  "docs/COMPATIBILITY.md",
  "docs/INSTALL-ONBOARDING-AUDIT.md",
  "docs/PACKAGING.md",
  "docs/RELEASE-AUDIT-1.0.1-FINAL.md",
  "docs/STARTUP-READINESS-AUDIT.md",
  "docs/release-hashes-1.0.1.json",
  "scripts/build-release-staging.mjs",
  "scripts/verify-release-staging.mjs",
  "src/gate/runtime.ts",
  "test/ci-manifest.test.ts",
  "test/ci-test-budget.json",
  "test/compatibility-manifest.test.ts",
  "test/hash-manifest.test.ts",
  "test/independent-audit-manifest.test.ts",
  "test/network-manifest.test.ts",
  "test/packaging-identity.test.ts",
  "test/packaging-manifest.test.ts",
  "test/post-transfer-manifest.test.ts",
  "test/regression-evidence-manifest.test.ts",
  "test/release-1.0.1-final-manifest.test.ts",
  "test/release-1.0.1-manifest.test.ts",
  "test/release-manifest.test.ts",
  "test/release-review-manifest.test.ts",
  "test/release-safeguards.test.ts",
  "test/shell-manifest.test.ts",
  "test/startup-readiness-manifest.test.ts",
  "test/startup-readiness.test.ts",
  "test/unknown-bounds-manifest.test.ts",
  "test/user-install-onboarding-manifest.test.ts",
  "test/user-install-onboarding.test.ts",
  "test/v1-guarantees-manifest.test.ts",
] as const;

/** The exact final-release change set each earlier manifest suite must declare. */
const FINAL_DECLARATIONS: Record<string, readonly string[]> = {
  "test/ci-manifest.test.ts": ["test/ci-test-budget.json", "test/ci-manifest.test.ts"],
  "test/compatibility-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
  ],
  "test/packaging-manifest.test.ts": [
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
  ],
  "test/post-transfer-manifest.test.ts": [
    "docs/PACKAGING.md",
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
  "test/release-manifest.test.ts": [
    "docs/PACKAGING.md",
    ".github/workflows/release.yml",
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
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
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
    "docs/PACKAGING.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
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
    ".github/workflows/release.yml",
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
    "test/release-safeguards.test.ts",
    "test/startup-readiness-manifest.test.ts",
    "test/unknown-bounds-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
  "test/user-install-onboarding-manifest.test.ts": [
    "IMPLEMENTATION_HANDOFF.md",
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
};

test("release-1.0.1-final manifest binds every candidate file with no exceptions", async () => {
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

test("earlier manifest suites declare exactly the final release changes", async () => {
  for (const [suite, expected] of Object.entries(FINAL_DECLARATIONS)) {
    const source = await readFile(suite, "utf8");
    const match = /CHANGED_IN_1_0_1_RELEASE = new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
    assert.ok(match, `${suite} lacks the 1.0.1-final declaration`);
    const declared = [...match[1]!.matchAll(/"([^"]+)"/g)].map((item) => item[1]!);
    assert.deepEqual(declared.sort(), [...expected].sort(), `${suite} declares the wrong final-release exceptions`);
  }
});
