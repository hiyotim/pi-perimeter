import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the release Goal
 * (`20260924-release-v1`).
 *
 * This Goal publishes the controlled distribution `pi-perimeter@1.0.0`
 * from the deterministic staging artifact while the source tree on `main`
 * stays `private: true` at `0.0.0`. Covered: the P17/PACKAGING revision
 * and its agreement edits, the release workflow and staging scripts, the
 * adapted + new safeguard suites, the staging gitignore entry, every
 * touched manifest suite, and this suite itself. Every entry lists the
 * sha256 of the final file; the test recomputes hashes each run and fails
 * until the manifest matches the working tree. Earlier manifests keep
 * their historical entries, declared through each suite's own
 * `CHANGED_IN_RELEASE` record. To refresh the manifest after a verified
 * intentional change, replace each entry with the hash printed in the
 * failure diff.
 */
const MANIFEST_PATH = "docs/release-hashes.json";

/** Historical entries changed by the startup-readiness Goal; current bytes are bound by docs/startup-readiness-hashes.json. */
const CHANGED_IN_STARTUP_READINESS = new Set<string>([
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
]);

const COVERED_FILES = [
  "docs/RELEASE-AUDIT.md",
  "docs/V1-GUARANTEES.md",
  "docs/PACKAGING.md",
  "docs/COMPATIBILITY.md",
  "README.md",
  "SECURITY.md",
  ".gitignore",
  ".github/workflows/release.yml",
  "scripts/build-release-staging.mjs",
  "scripts/verify-release-staging.mjs",
  "test/ci-test-budget.json",
  "test/packaging-identity.test.ts",
  "test/release-safeguards.test.ts",
  "test/packaging-manifest.test.ts",
  "test/post-transfer-manifest.test.ts",
  "test/release-review-manifest.test.ts",
  "test/v1-guarantees-manifest.test.ts",
  "test/ci-manifest.test.ts",
  "test/independent-audit-manifest.test.ts",
  "test/release-manifest.test.ts",
] as const;

/** Artifacts this Goal also changed inside an earlier manifest. */
const SHARED_WITH_EARLIER_MANIFESTS: Record<string, string[]> = {
  "test/ci-test-budget.json": [
    "docs/ci-hashes.json",
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
    "docs/regression-evidence-hashes.json",
    "docs/unknown-bounds-hashes.json",
    "docs/independent-audit-hashes.json",
  ],
  "test/ci-manifest.test.ts": [
    "docs/ci-hashes.json",
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
    "docs/regression-evidence-hashes.json",
    "docs/unknown-bounds-hashes.json",
    "docs/independent-audit-hashes.json",
  ],
  "docs/V1-GUARANTEES.md": ["docs/v1-guarantees-hashes.json"],
  "docs/PACKAGING.md": ["docs/packaging-hashes.json", "docs/post-transfer-hashes.json"],
  "docs/COMPATIBILITY.md": ["docs/compatibility-hashes.json"],
  "README.md": ["docs/packaging-hashes.json", "docs/compatibility-hashes.json"],
  "SECURITY.md": ["docs/packaging-hashes.json", "docs/post-transfer-hashes.json"],
  "test/packaging-identity.test.ts": [
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
    "docs/regression-evidence-hashes.json",
    "docs/unknown-bounds-hashes.json",
    "docs/independent-audit-hashes.json",
  ],
  "test/packaging-manifest.test.ts": [
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
    "docs/regression-evidence-hashes.json",
    "docs/unknown-bounds-hashes.json",
    "docs/independent-audit-hashes.json",
  ],
  "test/post-transfer-manifest.test.ts": [
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
    "docs/regression-evidence-hashes.json",
    "docs/unknown-bounds-hashes.json",
    "docs/independent-audit-hashes.json",
  ],
  "test/release-review-manifest.test.ts": [
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
    "docs/regression-evidence-hashes.json",
    "docs/unknown-bounds-hashes.json",
    "docs/independent-audit-hashes.json",
  ],
  "test/v1-guarantees-manifest.test.ts": [
    "docs/v1-guarantees-hashes.json",
    "docs/regression-evidence-hashes.json",
    "docs/unknown-bounds-hashes.json",
    "docs/independent-audit-hashes.json",
  ],
  "test/independent-audit-manifest.test.ts": ["docs/independent-audit-hashes.json"],
};
const DECLARED_CHANGE_SETS: Record<string, string[]> = {
  "test/packaging-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "docs/PACKAGING.md",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
  ],
  "test/post-transfer-manifest.test.ts": ["docs/PACKAGING.md", "test/post-transfer-manifest.test.ts"],
  "test/release-review-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "test/release-review-manifest.test.ts",
  ],
  "test/v1-guarantees-manifest.test.ts": ["docs/V1-GUARANTEES.md", "test/v1-guarantees-manifest.test.ts"],
  "test/independent-audit-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/independent-audit-manifest.test.ts",
  ],
  "test/ci-manifest.test.ts": ["test/ci-test-budget.json", "test/ci-manifest.test.ts"],
};

test("the release artifact hash manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    if (CHANGED_IN_STARTUP_READINESS.has(file)) continue; // current snapshot bound by the startup-readiness manifest
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

test("the release manifest records every artifact of this Goal", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  for (const file of COVERED_FILES) {
    assert.ok(typeof manifest[file] === "string" && manifest[file].length === 64, `${file} must be recorded`);
  }
  assert.equal(Object.keys(manifest).length, COVERED_FILES.length);
  for (const [file, earlier] of Object.entries(SHARED_WITH_EARLIER_MANIFESTS)) {
    assert.ok(
      COVERED_FILES.includes(file as (typeof COVERED_FILES)[number]),
      `${file} must be covered by this manifest`,
    );
    for (const earlierPath of earlier) {
      const previous = JSON.parse(await readFile(earlierPath, "utf8")) as Record<string, string>;
      assert.notEqual(
        previous[file],
        manifest[file],
        `${file} must have a fresh identity after its release change (${earlierPath})`,
      );
    }
  }
});

test("every earlier manifest declares exactly the release changes it covers", async () => {
  for (const [file, expected] of Object.entries(DECLARED_CHANGE_SETS)) {
    const source = await readFile(file, "utf8");
    const declaration = /CHANGED_IN_RELEASE(?:: Record<string, true>)? = \{([\s\S]*?)\};/.exec(source);
    assert.ok(declaration, `${file} must declare its release change record`);
    const declared = [...declaration[1]!.matchAll(/"([^"]+)": true/g)].map((match) => match[1]!).sort();
    assert.deepEqual(declared, [...expected].sort(), `${file} must declare exactly the covered changes`);
  }
});
