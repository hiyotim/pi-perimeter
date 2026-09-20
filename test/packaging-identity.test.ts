import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * Packaging identity for the renamed distribution (`20260920-npm-packaging`).
 *
 * The project was renamed from `pi-warden` to `pi-perimeter` on the distribution
 * surface only. These tests pin the publishable identity and enforce the declared
 * rename boundary: an old-name occurrence outside docs/PACKAGING.md's retention
 * list fails the suite, and a listed file that no longer contains one fails too,
 * so the list cannot rot. Identity mentions in distribution files must be
 * qualified (the former name, or the other maintainer's npm entry) rather than
 * claiming the old name for this project.
 */

const OLD_NAME = /pi-warden|piwarden/i;
const QUALIFIED =
  /formerly|former name|organization|other maintainer|another maintainer|npm:pi-warden|github\.com\/pi-warden|native\/piwarden-helper|PIWARDEN_/;
const PACKAGE_NAME = "pi-perimeter";
const REPOSITORY = {
  type: "git",
  url: "git+https://github.com/hiyotim/pi-perimeter.git",
  homepage: "https://github.com/hiyotim/pi-perimeter#readme",
  bugs: "https://github.com/hiyotim/pi-perimeter/issues",
};

/** Directories that are not part of the repository's tracked content. */
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", ".commandcode", ".zcode", "dist", "coverage"]);

/** Distribution-surface files whose the old name must always be qualified. */
const DISTRIBUTION_FILES = [
  "package.json",
  "README.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "SECURITY.md",
  "docs/COMPATIBILITY.md",
  "docs/PACKAGING.md",
];

/**
 * Files that may keep the former spelling, per docs/PACKAGING.md. Every entry
 * names why; the values here are the categories documented there.
 */
const RETAINED: Record<string, string> = {
  // Runtime and build identifiers (renaming them would change accepted, hash-bound bytes).
  ".gitignore": "runtime-identifier",
  "native/build-manifest.json": "runtime-identifier (build artifact)",
  "native/piwarden-helper": "runtime-identifier (compiled helper artifact)",
  "test/packaging-identity.test.ts": "declares the old-name pattern and the retention list",
  "test/packaging-manifest.test.ts": "declares the earlier-manifest change sets and reads the manifest verbose flag",
  "test/post-transfer-manifest.test.ts": "records the moved repository and the earlier-manifest change sets",
  "scripts/assert-test-outcome.mjs": "runtime-identifier (assertion prefix)",
  "scripts/build-native.mjs": "runtime-identifier (helper binary)",
  "src/approvals/approvals.ts": "runtime-identifier",
  "src/approvals/shell-approvals.ts": "runtime-identifier",
  "src/gate/bound-execution.ts": "runtime-identifier",
  "src/gate/controlled-traversal.ts": "runtime-identifier",
  "src/gate/runtime.ts": "runtime-identifier",
  "src/gate/shell-runtime.ts": "runtime-identifier",
  "src/index.ts": "runtime-identifier",
  "src/policy/config-loader.ts": "runtime-identifier",
  "src/policy/configuration.ts": "runtime-identifier",
  "src/policy/control-plane.ts": "runtime-identifier",
  "src/policy/paths.ts": "runtime-identifier",
  "src/sandbox/census.ts": "runtime-identifier",
  "src/sandbox/containment.ts": "runtime-identifier",
  "src/sandbox/helper.ts": "runtime-identifier",
  "src/sandbox/native/piwarden-helper.c": "runtime-identifier (helper source)",
  "test/approvals.test.ts": "runtime-identifier",
  "test/ci-budget.test.ts": "runtime-identifier",
  "test/ci-manifest.test.ts": "runtime-identifier",
  "test/compatibility-manifest.test.ts": "runtime-identifier",
  "test/configuration.test.ts": "runtime-identifier",
  "test/controlled-traversal.test.ts": "runtime-identifier",
  "test/decisions.test.ts": "runtime-identifier",
  "test/edit-decisions.test.ts": "runtime-identifier",
  "test/export.test.ts": "runtime-identifier",
  "test/gate-runtime.test.ts": "runtime-identifier",
  "test/network-effects.test.ts": "runtime-identifier",
  "test/network-manifest.test.ts": "runtime-identifier",
  "test/network-policy.test.ts": "runtime-identifier",
  "test/paths.test.ts": "runtime-identifier",
  "test/projection.test.ts": "runtime-identifier",
  "test/quiescence.test.ts": "runtime-identifier",
  "test/resources.test.ts": "runtime-identifier",
  "test/seatbelt-profile.test.ts": "runtime-identifier",
  "test/shell-approvals.test.ts": "runtime-identifier",
  "test/shell-containment.test.ts": "runtime-identifier",
  "test/shell-manifest.test.ts": "runtime-identifier",
  "test/shell-policy.test.ts": "runtime-identifier",
  "test/write-decisions.test.ts": "runtime-identifier",
  "docs/CI-EVIDENCE.md": "evidence-bound (records the assertion output prefix)",
  // Accepted, hash-bound contracts and their audits: their bytes are bound by the
  // acceptance records, so the former name stays.
  "docs/FILE-GATE.md": "evidence-bound",
  "docs/FILE-GATE-AUDIT.md": "evidence-bound",
  "docs/SHELL-GATE.md": "evidence-bound",
  "docs/SHELL-GATE-AUDIT.md": "evidence-bound",
  "docs/NETWORK-GATE.md": "evidence-bound",
  "docs/NETWORK-GATE-AUDIT.md": "evidence-bound",
  "docs/shell-gate-hashes.json": "evidence-bound (records the helper source path)",
  "docs/VULNERABILITY-REPORTING-AUDIT.md": "evidence-bound (records the reporting route)",
  "THREAT_MODEL.md": "outside the rename surface (current document, stable anchors)",
  "docs/CONFIGURATION-AUTHORIZATION.md": "outside the rename surface (stable anchors)",
  "docs/MONOTONIC-POLICY-AUTHORITY.md": "outside the rename surface (stable anchors)",
  // Historical records: never rewritten.
  "STATE.md": "historical record",
  "docs/BRANCH-TRANSITION.md": "historical record",
  "docs/EDIT-PATH-ACCEPTANCE-TRANSITION.md": "historical record",
  "docs/WRITE-PATH-ACCEPTANCE-TRANSITION.md": "historical record",
  "docs/PHASE-1B-AUDIT.md": "historical record",
  "docs/PHASE-1B-COMMIT.md": "historical record",
  "docs/SANDBOX-BACKEND-PROPOSAL.md": "historical record",
  "docs/SHELL-ISOLATION-FEASIBILITY.md": "historical record",
  // Distribution surface: intentional, qualified mentions of the former name and
  // of the other maintainer's npm entry.
  "package.json": "distribution mention (qualified)",
  "README.md": "distribution mention (qualified)",
  "CONTRIBUTING.md": "distribution mention (qualified)",
  "AGENTS.md": "distribution mention (qualified)",
  "SECURITY.md": "distribution mention (qualified)",
  "docs/COMPATIBILITY.md": "distribution mention (qualified)",
  "docs/PACKAGING.md": "distribution mention (qualified)",
};

function repositoryFiles(directory = "."): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      found.push(...repositoryFiles(path.join(directory, entry.name)));
      continue;
    }
    found.push(path.join(directory, entry.name).replace(/^\.\//, ""));
  }
  return found;
}

function oldNameLines(file: string): string[] {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return content.split("\n").filter((line) => OLD_NAME.test(line));
}

test("the publishable identity is pi-perimeter and stays unpublished by default", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, unknown>;
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
    name: string;
    packages: Record<string, { name?: string }>;
  };
  assert.equal(pkg["name"], PACKAGE_NAME, "the package name is the renamed identity");
  assert.equal(lock.name, PACKAGE_NAME, "the lockfile root name follows the package name");
  assert.equal(lock.packages[""]?.name, PACKAGE_NAME, "the lockfile package entry follows too");
  assert.equal(pkg["private"], true, "private: true blocks an accidental npm publish");
  assert.deepEqual(
    { type: (pkg["repository"] as { type: string }).type, url: (pkg["repository"] as { url: string }).url },
    { type: REPOSITORY.type, url: REPOSITORY.url },
    "the repository field names the project's current location",
  );
  assert.equal(pkg["homepage"], REPOSITORY.homepage);
  assert.equal((pkg["bugs"] as { url: string }).url, REPOSITORY.bugs);
  assert.deepEqual(pkg["publishConfig"], { access: "public", provenance: true });
  assert.equal((pkg["engines"] as { node: string }).node, ">=22.19.0");
  const files = pkg["files"] as string[];
  for (const entry of ["src", "scripts", "docs", "README.md", "LICENSE", "package.json"]) {
    assert.ok(files.includes(entry), `the packaged files list must include ${entry}`);
  }
  assert.ok(
    !files.includes("native"),
    "the build-output directory must not ship: a locally built helper must never enter the tarball",
  );
  const pi = pkg["pi"] as { extensions: string[] };
  assert.deepEqual(pi.extensions, ["./src/index.ts"], "the Pi manifest entry is unchanged by the rename");
  assert.ok(readdirSync("src").includes("index.ts"), "the Pi manifest entry path exists");
});

test("distribution files qualify every mention of the former name", () => {
  for (const file of DISTRIBUTION_FILES) {
    for (const line of oldNameLines(file)) {
      assert.match(
        line,
        QUALIFIED,
        `${file} mentions the old name without qualifying it: ${line.trim()}`,
      );
    }
  }
  for (const file of ["README.md", "CONTRIBUTING.md", "AGENTS.md", "SECURITY.md"]) {
    assert.match(
      readFileSync(file, "utf8"),
      /formerly `pi-warden`/,
      `${file} must say the project was formerly pi-warden`,
    );
  }
});

test("the former name appears only where the retention list declares it", () => {
  const observed = new Set<string>();
  for (const file of repositoryFiles()) {
    if (oldNameLines(file).length > 0) observed.add(file);
  }
  const declared = new Set(Object.keys(RETAINED));
  const undeclared = [...observed].filter((file) => !declared.has(file)).sort();
  // A declared build artifact (the compiled helper and its manifest) is absent in a
  // clean checkout; absence is not rot, so only an existing file can go stale.
  const stale = [...declared].filter((file) => existsSync(file) && !observed.has(file)).sort();
  assert.deepEqual(
    undeclared,
    [],
    `these files mention the former name without a declared retention reason:\n${undeclared.join("\n")}`,
  );
  assert.deepEqual(
    stale,
    [],
    `these declared files no longer mention the former name; drop them from the list:\n${stale.join("\n")}`,
  );
});
