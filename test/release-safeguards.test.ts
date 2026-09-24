import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * Release safeguards for the controlled published distribution
 * (`20260924-release-v1`), publishing over npm Trusted Publishing
 * (GitHub OIDC) with no publish token.
 *
 * The source tree on `main` stays unpublished by construction; only the
 * deterministic staging artifact (built by the dedicated release workflow)
 * carries the publishable manifest. These tests bite when any safeguard
 * is weakened:
 */

const RELEASE_WORKFLOW = ".github/workflows/release.yml";

/** Minimum npm with OIDC publish support required in the release job. */
const NPM_FLOOR = [11, 5, 1] as const;

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
    if (entry === "release.yml") {
      assert.ok(/npm publish/.test(content), "the dedicated release workflow must publish");
    } else {
      assert.ok(!/npm publish/.test(content), `${entry} must never publish: only ${RELEASE_WORKFLOW} may`);
      assert.ok(!/NPM_TOKEN|NODE_AUTH_TOKEN/.test(content), `${entry} must carry no publish credential`);
      assert.ok(!/--provenance/.test(content), `${entry} must never attest provenance`);
      assert.ok(!/id-token\s*:\s*write/.test(content), `${entry} must never carry OIDC publish permission`);
    }
  }
});

test("the release workflow publishes the staging artifact over OIDC, never with a token", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW, "utf8");
  assert.match(workflow, /staging/i, "the release workflow must build a staging artifact");
  assert.match(workflow, /build-release-staging|release-staging/i, "the release workflow must use the deterministic staging builder");
  assert.match(workflow, /npm publish --provenance/i, "the release workflow must publish with provenance");
  assert.match(workflow, /working-directory: release-staging/i, "the release workflow must use the staging artifact, never the source tree");
  const publishStep = workflow.split(/^ {6}- /m).find((chunk) => /npm publish/.test(chunk));
  assert.ok(publishStep !== undefined, "the release workflow must contain a publish step");
  assert.match(publishStep, /working-directory: release-staging/, "the publish step itself must run inside the staging artifact, never the source tree");
  assert.match(workflow, /id-token\s*:\s*write/, "the release workflow must authenticate to npm over OIDC");
  assert.ok(!/NPM_TOKEN|NODE_AUTH_TOKEN/.test(workflow), "the release workflow must publish over OIDC with no publish token");
  assert.ok(!/secrets\./.test(workflow), "the release workflow must reference no secret: OIDC supplies the publish identity");
  const pins = [...workflow.matchAll(/npm@(\d+)\.(\d+)\.(\d+)/g)];
  assert.ok(pins.length > 0, "the release workflow must pin an explicit npm 11.x release (>= 11.5.1) instead of relying on the Node-bundled npm");
  for (const pin of pins) {
    const version = [Number(pin[1]), Number(pin[2]), Number(pin[3])];
    const atFloor =
      version[0]! > NPM_FLOOR[0] ||
      (version[0] === NPM_FLOOR[0] &&
        (version[1]! > NPM_FLOOR[1] || (version[1] === NPM_FLOOR[1] && version[2]! >= NPM_FLOOR[2])));
    assert.ok(atFloor, `pinned npm ${pin[0]} must stay at or above ${NPM_FLOOR.join(".")} for OIDC publish support`);
  }
});
