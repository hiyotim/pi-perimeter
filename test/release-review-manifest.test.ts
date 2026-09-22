import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the release-candidate review Goal
 * (`20260922-release-candidate-reviews`).
 *
 * This Goal changes only documentation wording plus the review audit below;
 * no runtime, policy, approval, sandbox, network, dependency, packaging, or
 * CI behavior changes. Every entry lists the sha256 of the final file; the
 * test recomputes hashes each run and fails until the manifest matches the
 * working tree, so the reviewed wording and any reviewer verdict are tied to
 * exact bytes. Earlier manifests keep their historical entries, declared
 * through each suite's own `CHANGED_IN_RELEASE_REVIEW` record. To refresh
 * the manifest after a verified intentional change, replace each entry with
 * the hash printed in the failure diff.
 */

const MANIFEST_PATH = "docs/release-review-hashes.json";

const COVERED_FILES = [
  "README.md",
  "SECURITY.md",
  "ARCHITECTURE.md",
  "THREAT_MODEL.md",
  "docs/COMPATIBILITY.md",
  "docs/RELEASE-REVIEW-AUDIT.md",
  "test/ci-test-budget.json",
  "test/packaging-identity.test.ts",
  "test/packaging-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
  "test/post-transfer-manifest.test.ts",
  "test/ci-manifest.test.ts",
  "test/release-review-manifest.test.ts",
] as const;

/** Artifacts this Goal also changed inside an earlier manifest. */
const SHARED_WITH_EARLIER_MANIFESTS: Record<string, string[]> = {
  "README.md": ["docs/packaging-hashes.json", "docs/compatibility-hashes.json"],
  "SECURITY.md": ["docs/packaging-hashes.json", "docs/post-transfer-hashes.json"],
  "docs/COMPATIBILITY.md": ["docs/packaging-hashes.json", "docs/compatibility-hashes.json"],
  "test/ci-test-budget.json": [
    "docs/ci-hashes.json",
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
  ],
  "test/packaging-manifest.test.ts": ["docs/packaging-hashes.json", "docs/post-transfer-hashes.json"],
  "test/packaging-identity.test.ts": ["docs/packaging-hashes.json", "docs/post-transfer-hashes.json"],
  "test/compatibility-manifest.test.ts": [
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
  ],
  "test/post-transfer-manifest.test.ts": ["docs/post-transfer-hashes.json"],
  "test/ci-manifest.test.ts": [
    "docs/ci-hashes.json",
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
  ],
};

/** The declared change record each earlier manifest must carry, exactly. */
const DECLARED_CHANGE_RECORDS: Record<string, string[]> = {
  "test/packaging-manifest.test.ts": [
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "test/ci-test-budget.json",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
  ],
  "test/compatibility-manifest.test.ts": [
    "docs/COMPATIBILITY.md",
    "README.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
  ],
  "test/post-transfer-manifest.test.ts": [
    "SECURITY.md",
    "test/ci-test-budget.json",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
  ],
  "test/ci-manifest.test.ts": ["test/ci-test-budget.json", "test/ci-manifest.test.ts"],
};

test("the release-review artifact hash manifest matches the final working tree", async () => {
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

test("the release-review manifest supersedes exactly the earlier entries it covers", async () => {
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
        `${file} must have a fresh identity after the release-review change (${earlierPath})`,
      );
    }
  }
});

test("every earlier manifest declares exactly the release-review changes it covers", async () => {
  for (const [file, expected] of Object.entries(DECLARED_CHANGE_RECORDS)) {
    const source = await readFile(file, "utf8");
    const declaration = /CHANGED_IN_RELEASE_REVIEW: Record<string, true> = \{([\s\S]*?)\};/.exec(source);
    assert.ok(declaration, `${file} must declare its release-review change record`);
    const declared = [...declaration[1]!.matchAll(/"([^"]+)": true/g)].map((match) => match[1]!).sort();
    assert.deepEqual(declared, [...expected].sort(), `${file} must declare exactly the covered changes`);
  }
});
