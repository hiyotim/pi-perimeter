#!/usr/bin/env node
/**
 * Verify the staging artifact against `docs/release-hashes.json`.
 *
 * Fails when the staging directory is absent, when any covered file differs
 * from the manifest, or when the publishable manifest is not exactly
 * `pi-perimeter@1.0.0` with `private` removed. The ordinary CI runs this
 * against executor-built staging; the release workflow runs it before
 * `npm publish`, so a divergent tarball can never publish.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const STAGING = path.join(REPO_ROOT, "release-staging");
const MANIFEST_PATH = path.join(REPO_ROOT, "docs/release-hashes.json");

if (!existsSync(STAGING)) {
  console.error("refusing: release-staging/ is absent; run scripts/build-release-staging.mjs first");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const mismatches = [];
for (const file of Object.keys(manifest).sort()) {
  const staged = path.join(STAGING, file);
  if (!existsSync(staged)) {
    mismatches.push(`${file}: absent from staging`);
    continue;
  }
  const current = createHash("sha256").update(readFileSync(staged)).digest("hex");
  if (manifest[file] !== current) {
    mismatches.push(`${file}: current ${current} recorded ${manifest[file]}`);
  }
}
if (mismatches.length > 0) {
  console.error(`staging manifest mismatch for:\n${mismatches.join("\n")}`);
  process.exit(1);
}

const stagedPkg = JSON.parse(readFileSync(path.join(STAGING, "package.json"), "utf8"));
if (stagedPkg.name !== "pi-perimeter" || stagedPkg.version !== "1.0.0" || "private" in stagedPkg) {
  console.error(`staging manifest is not publishable: ${JSON.stringify({ name: stagedPkg.name, version: stagedPkg.version, private: stagedPkg.private })}`);
  process.exit(1);
}
console.log(`staging verified: ${Object.keys(manifest).length} files match docs/release-hashes.json; publishable pi-perimeter@1.0.0`);
