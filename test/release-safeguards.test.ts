import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

test("the staging resolvers default to 1.0.0 and the historical manifest, with argv over env over default", () => {
  function probe(modulePath: string, expression: string): string {
    const code = `import(${JSON.stringify(`./${modulePath}`)}).then((mod) => console.log(${expression}));`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
    assert.equal(result.status, 0, `resolver probe ${expression} must exit 0; stderr: ${result.stderr}`);
    return (result.stdout as string).trim();
  }
  const builder = "scripts/build-release-staging.mjs";
  const verifier = "scripts/verify-release-staging.mjs";
  assert.equal(
    probe(builder, "mod.resolveReleaseVersion([], {})"),
    "1.0.0",
    "without argv or env the builder resolves 1.0.0",
  );
  assert.equal(
    probe(verifier, "mod.resolveExpectedVersion([], {})"),
    "1.0.0",
    "without argv or env the verifier expects 1.0.0",
  );
  assert.equal(
    probe(verifier, "mod.DEFAULT_MANIFEST_PATH"),
    "docs/release-hashes.json",
    "the default manifest stays the historical 1.0.0 manifest",
  );
  assert.equal(
    probe(verifier, "mod.resolveManifestPath([], {})"),
    "docs/release-hashes.json",
    "without argv or env the verifier checks the historical manifest",
  );
  assert.equal(
    probe(builder, 'mod.resolveReleaseVersion([], { RELEASE_VERSION: "1.0.1" })'),
    "1.0.1",
    "env RELEASE_VERSION overrides the default",
  );
  assert.equal(
    probe(builder, 'mod.resolveReleaseVersion(["--release-version=1.0.2"], { RELEASE_VERSION: "1.0.1" })'),
    "1.0.2",
    "argv --release-version overrides env",
  );
  assert.equal(
    probe(verifier, 'mod.resolveExpectedVersion(["--release-version=1.0.2"], { RELEASE_VERSION: "1.0.1" })'),
    "1.0.2",
    "the verifier resolves the expected version with the same precedence",
  );
  assert.equal(
    probe(verifier, 'mod.resolveManifestPath([], { RELEASE_MANIFEST_PATH: "docs/release-hashes-1.0.1.json" })'),
    "docs/release-hashes-1.0.1.json",
    "env RELEASE_MANIFEST_PATH overrides the default manifest",
  );
  assert.equal(
    probe(
      verifier,
      'mod.resolveManifestPath(["--manifest=docs/custom.json"], { RELEASE_MANIFEST_PATH: "docs/release-hashes-1.0.1.json" })',
    ),
    "docs/custom.json",
    "argv --manifest overrides env",
  );
});

test("the release workflow pins one guarded version and publishes only on tag push", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW, "utf8");
  const steps = workflow.split(/^ {6}- /m);
  const buildStep = steps.find((chunk) => chunk.includes("scripts/build-release-staging.mjs"));
  const verifyStep = steps.find((chunk) => chunk.includes("scripts/verify-release-staging.mjs"));
  assert.ok(buildStep !== undefined, "the release workflow must contain the staging build step");
  assert.ok(verifyStep !== undefined, "the release workflow must contain the staging verify step");
  for (const [name, step] of [["build", buildStep] as const, ["verify", verifyStep] as const]) {
    assert.ok(
      step.includes("RELEASE_VERSION: ${{ steps.release-guard.outputs.version }}"),
      `the ${name} step must take RELEASE_VERSION from the guard outputs`,
    );
    assert.ok(
      step.includes("RELEASE_MANIFEST_PATH: ${{ steps.release-guard.outputs.manifest }}"),
      `the ${name} step must take RELEASE_MANIFEST_PATH from the guard outputs`,
    );
  }
  assert.match(workflow, /TAG#v/, "the guard step must strip the leading v from the tag before comparing");
  assert.match(
    workflow,
    /workflow_dispatch requires an explicit version input/,
    "the guard step must refuse a dispatch without an explicit version input",
  );
  const publishSteps = steps.filter((chunk) => chunk.includes("npm publish"));
  assert.ok(publishSteps.length > 0, "the release workflow must contain a publish step");
  for (const step of publishSteps) {
    assert.match(
      step,
      /if:\s*github\.event_name\s*==\s*'push'/,
      "every publish step must run only on tag push; a workflow_dispatch run is verify-only and must never publish",
    );
  }
});

test("the release workflow selects the final 1.0.1 binding and keeps the historical 1.0.0 binding", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW, "utf8");
  assert.ok(
    workflow.includes('if [ "$VERSION" = "1.0.0" ]; then'),
    "the guard must keep the explicit 1.0.0 branch",
  );
  assert.ok(
    workflow.includes('MANIFEST="docs/release-hashes.json"'),
    "the guard must keep selecting the historical manifest for 1.0.0",
  );
  assert.ok(
    workflow.includes('[ "$VERSION" = "1.0.1" ]'),
    "the guard must carry an explicit 1.0.1 branch instead of the version-formula fallback",
  );
  assert.ok(
    workflow.includes('MANIFEST="docs/release-hashes-1.0.1-final.json"'),
    "the guard must select the final 1.0.1 binding for 1.0.1",
  );
  assert.ok(
    workflow.includes('MANIFEST="docs/release-hashes-$VERSION.json"'),
    "other versions must keep the version-formula fallback",
  );
  const steps = workflow.split(/^ {6}- /m);
  const verifyStep = steps.find((chunk) => chunk.includes("scripts/verify-release-staging.mjs"));
  assert.ok(verifyStep !== undefined, "the release workflow must contain the staging verify step");
  assert.ok(
    verifyStep.includes("RELEASE_MANIFEST_PATH: ${{ steps.release-guard.outputs.manifest }}"),
    "the staging verifier must be given the guard-selected manifest, so the final binding is the one enforced for 1.0.1",
  );
});

test("a non-X.Y.Z release version refuses instead of staging", () => {
  const builder = spawnSync(process.execPath, ["scripts/build-release-staging.mjs", "--release-version=bad"], {
    encoding: "utf8",
  });
  assert.notEqual(builder.status, 0, "the builder must refuse a non-X.Y.Z version");
  assert.match(builder.stderr, /not X\.Y\.Z/, "the builder refusal must name the version shape");
  const verifier = spawnSync(process.execPath, ["scripts/verify-release-staging.mjs", "--release-version=bad"], {
    encoding: "utf8",
  });
  assert.notEqual(verifier.status, 0, "the verifier must refuse a non-X.Y.Z version");
  assert.match(verifier.stderr, /not X\.Y\.Z/, "the verifier refusal must name the version shape");
});
