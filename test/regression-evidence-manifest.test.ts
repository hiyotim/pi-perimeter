import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the regression-evidence-per-guarantee Goal
 * (`20260922-regression-evidence-per-guarantee`).
 *
 * This Goal adds biting regressions for genuinely uncovered or weakly
 * covered guarantee behavior (plus this audit and the raised count budget);
 * no runtime, policy, approval, sandbox, network, dependency, packaging, or
 * CI behavior changes. Every entry lists the sha256 of the final file; the
 * test recomputes hashes each run and fails until the manifest matches the
 * working tree, so the new regressions and any reviewer verdict are tied
 * to exact bytes. Earlier manifests keep their historical entries, declared
 * through each suite's own `CHANGED_IN_REGRESSION_EVIDENCE` record. To refresh
 * the manifest after a verified intentional change, replace each entry with
 * the hash printed in the failure diff.
 */
const MANIFEST_PATH = "docs/regression-evidence-hashes.json";

const COVERED_FILES = [
  "docs/REGRESSION-EVIDENCE-AUDIT.md",
  "test/ci-test-budget.json",
  "test/controlled-traversal.test.ts",
  "test/gate-runtime.test.ts",
  "test/shell-policy.test.ts",
  "test/packaging-identity.test.ts",
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
  ],
  "test/controlled-traversal.test.ts": ["docs/file-gate-hashes.json"],
  "test/gate-runtime.test.ts": ["docs/file-gate-hashes.json"],
  "test/hash-manifest.test.ts": ["docs/ci-hashes.json", "docs/packaging-hashes.json"],
  "test/shell-policy.test.ts": ["docs/shell-gate-hashes.json", "docs/network-gate-hashes.json"],
  "test/shell-manifest.test.ts": [
    "docs/shell-gate-hashes.json",
    "docs/network-gate-hashes.json",
    "docs/packaging-hashes.json",
  ],
  "test/packaging-identity.test.ts": [
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
  ],
  "test/packaging-manifest.test.ts": [
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
  ],
  "test/ci-manifest.test.ts": [
    "docs/ci-hashes.json",
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
  ],
  "test/compatibility-manifest.test.ts": [
    "docs/compatibility-hashes.json",
    "docs/packaging-hashes.json",
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
  ],
  "test/post-transfer-manifest.test.ts": [
    "docs/post-transfer-hashes.json",
    "docs/release-review-hashes.json",
    "docs/v1-guarantees-hashes.json",
  ],
  "test/release-review-manifest.test.ts": ["docs/release-review-hashes.json", "docs/v1-guarantees-hashes.json"],
  "test/v1-guarantees-manifest.test.ts": ["docs/v1-guarantees-hashes.json"],
  "test/network-manifest.test.ts": ["docs/network-gate-hashes.json", "docs/packaging-hashes.json"],
};
const DECLARED_CHANGE_SETS: Record<string, string[]> = {
  "test/hash-manifest.test.ts": [
    "test/controlled-traversal.test.ts",
    "test/gate-runtime.test.ts",
    "test/hash-manifest.test.ts",
  ],
  "test/shell-manifest.test.ts": ["test/shell-policy.test.ts", "test/shell-manifest.test.ts"],
  "test/ci-manifest.test.ts": ["test/ci-test-budget.json", "test/ci-manifest.test.ts"],
  "test/compatibility-manifest.test.ts": ["test/ci-test-budget.json", "test/compatibility-manifest.test.ts"],
  "test/packaging-manifest.test.ts": [
    "test/controlled-traversal.test.ts",
    "test/gate-runtime.test.ts",
    "test/shell-policy.test.ts",
    "test/hash-manifest.test.ts",
    "test/shell-manifest.test.ts",
    "test/network-manifest.test.ts",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
  ],
  "test/post-transfer-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
  ],
  "test/release-review-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/release-review-manifest.test.ts",
  ],
  "test/network-manifest.test.ts": ["test/shell-policy.test.ts", "test/network-manifest.test.ts"],
  "test/v1-guarantees-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/packaging-identity.test.ts",
    "test/packaging-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
    "test/post-transfer-manifest.test.ts",
    "test/ci-manifest.test.ts",
    "test/release-review-manifest.test.ts",
    "test/v1-guarantees-manifest.test.ts",
  ],
};
/**
 * Artifacts whose bytes the unknowns-bound Goal
 * (`20260924-unknowns-bound`) changed: the raised declared test count,
 * the retention-list entry, and the two declarations below. Their entries
 * here stay historical; docs/unknown-bounds-hashes.json binds the current
 * bytes.
 */
const CHANGED_IN_UNKNOWN_BOUNDS: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/packaging-identity.test.ts": true,
  "test/hash-manifest.test.ts": true,
  "test/shell-manifest.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
  "test/packaging-manifest.test.ts": true,
  "test/post-transfer-manifest.test.ts": true,
  "test/release-review-manifest.test.ts": true,
  "test/v1-guarantees-manifest.test.ts": true,
  "test/regression-evidence-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the independent-audit Goal
 * (`20260924-v1-independent-audit`) changed: the raised declared test count,
 * the retention-list entry, and this declaration. Their entries here stay
 * historical; docs/independent-audit-hashes.json binds the current bytes.
 */
const CHANGED_IN_INDEPENDENT_AUDIT: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/packaging-identity.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
  "test/packaging-manifest.test.ts": true,
  "test/post-transfer-manifest.test.ts": true,
  "test/release-review-manifest.test.ts": true,
  "test/v1-guarantees-manifest.test.ts": true,
  "test/regression-evidence-manifest.test.ts": true,
};


test("the regression-evidence artifact hash manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    const current = createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    if (CHANGED_IN_UNKNOWN_BOUNDS[file] === true) continue; // unknowns bound; the unknown-bounds manifest binds the current bytes
    if (CHANGED_IN_INDEPENDENT_AUDIT[file] === true) continue; // independent audit; the independent-audit manifest binds the current bytes
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

test("the regression-evidence manifest records every artifact of this Goal", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  for (const file of COVERED_FILES) {
    assert.ok(typeof manifest[file] === "string" && manifest[file].length === 64, `${file} must be recorded`);
  }
  assert.equal(Object.keys(manifest).length, COVERED_FILES.length);
  // Every artifact this Goal shares with an earlier manifest must carry a fresh
  // identity there, so the historical entries cannot be mistaken for the tree.
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
        `${file} must have a fresh identity after its regression-evidence change (${earlierPath})`,
      );
    }
  }
});

test("every earlier manifest declares exactly the regression-evidence changes it covers", async () => {
  for (const [file, expected] of Object.entries(DECLARED_CHANGE_SETS)) {
    const source = await readFile(file, "utf8");
    const declaration = /CHANGED_IN_REGRESSION_EVIDENCE(?:: Record<string, true>)? = \{([\s\S]*?)\};/.exec(source);
    assert.ok(declaration, `${file} must declare its regression-evidence change record`);
    const declared = [...declaration[1]!.matchAll(/"([^"]+)": true/g)].map((match) => match[1]!).sort();
    assert.deepEqual(declared, [...expected].sort(), `${file} must declare exactly the covered changes`);
  }
});
