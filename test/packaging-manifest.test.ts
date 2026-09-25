import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

/**
 * Deterministic hash manifest for the packaging Goal artifacts
 * (`20260920-npm-packaging`).
 *
 * Every entry lists the sha256 of the final file. The test recomputes hashes
 * each run, prints the current value for any mismatch, and fails until the
 * manifest matches the working tree, so the renamed identity, the packaging
 * document and any reviewer verdict are tied to exact file contents. To refresh
 * the manifest after a verified intentional change, replace each entry with the
 * hash printed in the failure diff and re-run this suite.
 */

const MANIFEST_PATH = "docs/packaging-hashes.json";

/**
 * Artifacts whose bytes the post-transfer pass changed: the canonical URLs, the
 * reporting route, the packaging document, the identity test and the manifest
 * declarations. Their entries in the earlier manifests stay historical;
 * docs/post-transfer-hashes.json binds the current bytes.
 */
const CHANGED_IN_POST_TRANSFER = new Set<string>([
  "package.json",
  "SECURITY.md",
  "docs/PACKAGING.md",
  "test/ci-test-budget.json",
  "test/packaging-identity.test.ts",
  "test/packaging-manifest.test.ts",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
]);

/**
 * Artifacts whose bytes the release-candidate review Goal
 * (`20260922-release-candidate-reviews`) changed: reviewed wording plus the
 * raised declared test count and this declaration. Their entries here stay
 * historical; docs/release-review-hashes.json binds the current bytes.
 */
const CHANGED_IN_RELEASE_REVIEW: Record<string, true> = {
  "README.md": true,
  "SECURITY.md": true,
  "docs/COMPATIBILITY.md": true,
  "test/ci-test-budget.json": true,
  "test/packaging-identity.test.ts": true,
  "test/packaging-manifest.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the v1-guarantee-stabilization Goal
 * (`20260922-stabilize-guarantees`) changed: the raised declared test count,
 * the retention-list entry, and this declaration. Their entries here stay
 * historical; docs/v1-guarantees-hashes.json binds the current bytes.
 */
const CHANGED_IN_V1_GUARANTEES: Record<string, true> = {
  "test/ci-test-budget.json": true,
  "test/packaging-identity.test.ts": true,
  "test/packaging-manifest.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the regression-evidence Goal
 * (`20260922-regression-evidence-per-guarantee`) changed: new biting
 * regressions plus the two declarations below. Their entries here stay
 * historical; docs/regression-evidence-hashes.json binds the current bytes.
 */
const CHANGED_IN_REGRESSION_EVIDENCE: Record<string, true> = {
  "test/controlled-traversal.test.ts": true,
  "test/gate-runtime.test.ts": true,
  "test/shell-policy.test.ts": true,
  "test/hash-manifest.test.ts": true,
  "test/shell-manifest.test.ts": true,
  "test/network-manifest.test.ts": true,
  "test/packaging-identity.test.ts": true,
  "test/packaging-manifest.test.ts": true,
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
  "test/packaging-manifest.test.ts": true,
  "test/hash-manifest.test.ts": true,
  "test/shell-manifest.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
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
  "test/packaging-manifest.test.ts": true,
  "test/ci-manifest.test.ts": true,
  "test/compatibility-manifest.test.ts": true,
};
/**
 * Artifacts whose bytes the release Goal (`20260924-release-v1`) changed:
 * the P17/PACKAGING revision, the release workflow and staging scripts, the
 * adapted + new safeguard suites, and this declaration. Their entries here
 * stay historical; docs/release-hashes.json binds the current bytes.
 */
const CHANGED_IN_RELEASE: Record<string, true> = {
  "README.md": true,
  "SECURITY.md": true,
  "docs/COMPATIBILITY.md": true,
  "docs/PACKAGING.md": true,
  "test/packaging-identity.test.ts": true,
  "test/packaging-manifest.test.ts": true,
};


/** Historical entries changed by the startup-readiness Goal; current bytes are bound by docs/startup-readiness-hashes.json. */
const CHANGED_IN_STARTUP_READINESS = new Set<string>([
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
]);

/** Artifacts whose bytes the 1.0.1 staging-preparation Goal changed; their entries here stay historical; docs/release-hashes-1.0.1.json binds the current bytes. */
const CHANGED_IN_1_0_1 = new Set<string>([
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
]);

/** Historical entries changed by the user-install-onboarding Goal; current bytes are bound by docs/user-install-onboarding-hashes.json. */
const CHANGED_IN_USER_INSTALL_ONBOARDING = new Set<string>([
  "README.md",
  "docs/COMPATIBILITY.md",
  "test/ci-test-budget.json",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
  "test/packaging-manifest.test.ts",
]);

const COVERED_FILES = [
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/COMPATIBILITY.md",
  "docs/PACKAGING.md",
  "test/ci-test-budget.json",
  "test/packaging-identity.test.ts",
  "test/package-lifecycle.test.ts",
  "test/packaging-manifest.test.ts",
  "test/hash-manifest.test.ts",
  "test/shell-manifest.test.ts",
  "test/ci-manifest.test.ts",
  "test/compatibility-manifest.test.ts",
  "test/network-manifest.test.ts",
] as const;

/** Artifacts this Goal also changed inside an earlier manifest. */
const SHARED_WITH_EARLIER_MANIFESTS: Record<string, string[]> = {
  "package.json": ["docs/file-gate-hashes.json", "docs/shell-gate-hashes.json"],
  "README.md": ["docs/compatibility-hashes.json"],
  "docs/COMPATIBILITY.md": ["docs/compatibility-hashes.json"],
  "test/ci-test-budget.json": ["docs/ci-hashes.json", "docs/compatibility-hashes.json"],
  "test/hash-manifest.test.ts": ["docs/ci-hashes.json"],
  "test/package-lifecycle.test.ts": ["docs/file-gate-hashes.json"],
  "test/shell-manifest.test.ts": ["docs/shell-gate-hashes.json", "docs/network-gate-hashes.json"],
  "test/ci-manifest.test.ts": ["docs/ci-hashes.json", "docs/compatibility-hashes.json"],
  "test/compatibility-manifest.test.ts": ["docs/compatibility-hashes.json"],
  "test/network-manifest.test.ts": ["docs/network-gate-hashes.json"],
};

/** The declared change set each earlier manifest must carry, exactly. */
const DECLARED_CHANGE_SETS: Record<string, string[]> = {
  "test/hash-manifest.test.ts": ["package.json", "test/package-lifecycle.test.ts"],
  "test/shell-manifest.test.ts": ["package.json", "test/shell-manifest.test.ts"],
  "test/ci-manifest.test.ts": [
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/hash-manifest.test.ts",
  ],
  "test/compatibility-manifest.test.ts": [
    "docs/COMPATIBILITY.md",
    "README.md",
    "test/ci-test-budget.json",
    "test/ci-manifest.test.ts",
    "test/compatibility-manifest.test.ts",
  ],
  "test/network-manifest.test.ts": ["test/shell-manifest.test.ts", "test/network-manifest.test.ts"],
};

test("the packaging artifact hash manifest matches the final working tree", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  const mismatches: { file: string; current: string; expected: string | null }[] = [];
  for (const file of COVERED_FILES) {
    if (CHANGED_IN_POST_TRANSFER.has(file)) continue; // moved canonical location; the post-transfer manifest binds the current bytes
    if (CHANGED_IN_RELEASE_REVIEW[file] === true) continue; // reviewed wording; the release-review manifest binds the current bytes
    if (CHANGED_IN_V1_GUARANTEES[file] === true) continue; // stabilized wording; the v1-guarantees manifest binds the current bytes
    if (CHANGED_IN_REGRESSION_EVIDENCE[file] === true) continue; // new P17 absence regression; the regression-evidence manifest binds the current bytes
    if (CHANGED_IN_UNKNOWN_BOUNDS[file] === true) continue; // unknowns bound; the unknown-bounds manifest binds the current bytes
    if (CHANGED_IN_INDEPENDENT_AUDIT[file] === true) continue; // independent audit; the independent-audit manifest binds the current bytes
    if (CHANGED_IN_RELEASE[file] === true) continue; // release v1; the release manifest binds the current bytes
    if (CHANGED_IN_STARTUP_READINESS.has(file)) continue; // current snapshot bound by the startup-readiness manifest
    if (CHANGED_IN_1_0_1.has(file)) continue; // 1.0.1 staging preparation; docs/release-hashes-1.0.1.json binds the current bytes
    if (CHANGED_IN_USER_INSTALL_ONBOARDING.has(file)) continue; // user-install onboarding; docs/user-install-onboarding-hashes.json binds the current bytes
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

test("the packaging manifest records every artifact with its earlier-manifest provenance", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  for (const file of COVERED_FILES) {
    assert.ok(typeof manifest[file] === "string" && manifest[file].length === 64, `${file} must be recorded`);
  }
  assert.equal(Object.keys(manifest).length, COVERED_FILES.length);
  // Every artifact this Goal shares with an earlier manifest must carry a fresh
  // identity there, so the historical entries cannot be mistaken for the tree.
  for (const [file, earlier] of Object.entries(SHARED_WITH_EARLIER_MANIFESTS)) {
    for (const earlierPath of earlier) {
      const previous = JSON.parse(await readFile(earlierPath, "utf8")) as Record<string, string>;
      assert.notEqual(
        previous[file],
        manifest[file],
        `${file} must have a fresh identity after its packaging change (${earlierPath})`,
      );
    }
  }
});

test("every earlier manifest declares exactly the packaging changes it covers", async () => {
  for (const [file, expected] of Object.entries(DECLARED_CHANGE_SETS)) {
    const source = await readFile(file, "utf8");
    const declaration = /CHANGED_IN_PACKAGING = new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
    assert.ok(declaration, `${file} must declare its packaging change set`);
    const declared = [...declaration[1]!.matchAll(/"([^"]+)"/g)].map((match) => match[1]!).sort();
    assert.deepEqual(
      declared,
      [...expected].sort(),
      `${file} must declare exactly the covered packaging changes`,
    );
    for (const covered of declared) {
      assert.ok(
        Object.hasOwn(SHARED_WITH_EARLIER_MANIFESTS, covered),
        `${covered} must be listed as shared with an earlier manifest`,
      );
    }
  }
});
