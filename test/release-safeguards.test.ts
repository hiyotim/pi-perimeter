import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * Release safeguards for the controlled published distribution
 * (`20260924-release-v1`).
 *
 * The source tree on `main` stays unpublished by construction; only the
 * deterministic staging artifact (built by the dedicated release workflow)
 * carries the publishable manifest. These tests bite when either safeguard
 * is weakened:
 */

const RELEASE_WORKFLOW = ".github/workflows/release.yml";

test("the source manifest stays private and carries no release version", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    private?: unknown;
    version?: unknown;
  };
  assert.equal(pkg["private"], true, "source package.json must keep private: true; the publishable manifest exists only in staging");
  assert.equal(pkg["version"], "0.0.0", "source tree carries no release version; the staging artifact sets 1.0.0");
});

test("publish appears only in the dedicated release workflow", () => {
  const entries = readdirSync(".github/workflows").filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"));
  for (const entry of entries) {
    const content = readFileSync(path.join(".github/workflows", entry), "utf8");
    const publishes = /npm publish|NPM_TOKEN|NODE_AUTH_TOKEN|--provenance|id-token\s*:\s*write/.test(content);
    if (entry === "release.yml") {
      assert.ok(publishes, "the dedicated release workflow must publish with provenance and a scoped token");
    } else {
      assert.ok(!publishes, `${entry} must never publish: only ${RELEASE_WORKFLOW} may`);
    }
  }
});

test("the release workflow publishes the staging artifact, never the source tree", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW, "utf8");
  assert.match(workflow, /staging/i, "the release workflow must build a staging artifact");
  assert.match(workflow, /build-release-staging|release-staging/i, "the release workflow must use the deterministic staging builder");
  assert.match(workflow, /npm publish --provenance/i, "the release workflow must publish with provenance");
  assert.match(workflow, /working-directory: release-staging/i, "publish must run inside the staging artifact, never the source tree");
});
