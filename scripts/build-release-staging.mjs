#!/usr/bin/env node
/**
 * Build the deterministic staging artifact for `20260924-release-v1`.
 *
 * Copies the exact release-commit tree (tracked files only) into
 * `release-staging/`, then applies ONLY the publishable-manifest transform:
 * `version` → `1.0.0`, `private` removed. The source tree is never mutated;
 * the script refuses to run when the working tree is dirty, so staging bytes
 * are exactly the committed release bytes plus the manifest transform.
 *
 * Determinism: sorted file order, fixed manifest key order is preserved from
 * the source file (only the two fields change), no timestamps are embedded
 * by this script.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = process.cwd();
const STAGING = path.join(REPO_ROOT, "release-staging");
export const RELEASE_VERSION = "1.0.0";

function git(args) {
  return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
}

const status = git("status --porcelain");
if (status !== "") {
  console.error(`refusing: working tree is dirty:\n${status}`);
  process.exit(1);
}
const head = git("rev-parse HEAD");
console.log(`staging from HEAD ${head}`);

rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING, { recursive: true });

const tracked = git("ls-files -z").split("\0").filter((entry) => entry.length > 0);
const ordered = [...tracked].sort();
for (const file of ordered) {
  const source = path.join(REPO_ROOT, file);
  const target = path.join(STAGING, file);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target);
}

const manifestPath = path.join(STAGING, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.private !== true) {
  console.error("refusing: source manifest must carry private: true");
  process.exit(1);
}
if (manifest.version !== "0.0.0") {
  console.error("refusing: source manifest must carry version 0.0.0");
  process.exit(1);
}
delete manifest.private;
manifest.version = RELEASE_VERSION;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const hash = createHash("sha256");
for (const file of ordered) {
  const bytes = readFileSync(path.join(STAGING, file));
  hash.update(file);
  hash.update(bytes);
}
console.log(`release-staging: ${ordered.length} files, tree sha256 ${hash.digest("hex")}`);
console.log(`publishable manifest: pi-perimeter@${RELEASE_VERSION}, private removed`);
