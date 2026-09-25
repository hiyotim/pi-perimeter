#!/usr/bin/env node
/**
 * Verify the staging artifact against a release hash manifest.
 *
 * The manifest resolves as `argv --manifest=<path>` over
 * `env RELEASE_MANIFEST_PATH` over `docs/release-hashes.json`; the expected
 * version resolves as `argv --release-version=X` over `env RELEASE_VERSION`
 * over `1.0.0` with the same X.Y.Z validation as the builder. The log prints
 * both resolutions, so a run can never silently check the wrong pair.
 *
 * Fails when the staging directory is absent, when the staging version file
 * (written by the builder) diverges from the expected version, when any
 * covered file differs from the manifest, when staging carries a file
 * outside the expected set (exactly the tracked tree plus the
 * builder-written version record), or when the publishable manifest is not
 * exactly the expected version with `private` removed. The ordinary CI runs
 * this against executor-built staging; the release workflow runs it before
 * `npm publish`, so a divergent tarball can never publish.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const STAGING = path.join(REPO_ROOT, "release-staging");
const DEFAULT_MANIFEST_PATH = "docs/release-hashes.json";
const DEFAULT_RELEASE_VERSION = "1.0.0";
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const VERSION_FILE_NAME = ".release-version";

/** Resolve the manifest path: argv `--manifest=<path>` > env `RELEASE_MANIFEST_PATH` > default. */
function resolveManifestPath(argv = process.argv.slice(2), env = process.env) {
  const flag = argv.find((arg) => arg.startsWith("--manifest="));
  return flag !== undefined ? flag.slice("--manifest=".length) : (env["RELEASE_MANIFEST_PATH"] ?? DEFAULT_MANIFEST_PATH);
}

/** Resolve the expected version: argv `--release-version=X` > env `RELEASE_VERSION` > default. */
function resolveExpectedVersion(argv = process.argv.slice(2), env = process.env) {
  const flag = argv.find((arg) => arg.startsWith("--release-version="));
  const raw =
    flag !== undefined ? flag.slice("--release-version=".length) : (env["RELEASE_VERSION"] ?? DEFAULT_RELEASE_VERSION);
  if (!VERSION_PATTERN.test(raw)) {
    console.error(`refusing: expected release version ${JSON.stringify(raw)} is not X.Y.Z`);
    process.exit(1);
  }
  return raw;
}

export { DEFAULT_MANIFEST_PATH, resolveManifestPath, resolveExpectedVersion };

/** The expected staging file set: exactly the tracked tree plus the builder-written version record. */
function expectedStagingFiles() {
  const tracked = execSync("git ls-files -z", { cwd: REPO_ROOT, encoding: "utf-8" })
    .split("\0")
    .filter((entry) => entry.length > 0);
  return new Set([...tracked, VERSION_FILE_NAME]);
}

function listStagingFiles(directory, base = "") {
  const entries = [];
  for (const entry of readdirSync(directory).sort()) {
    const relative = base === "" ? entry : `${base}/${entry}`;
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) entries.push(...listStagingFiles(absolute, relative));
    else entries.push(relative);
  }
  return entries;
}

function main() {
  const argv = process.argv.slice(2);
  const manifestRel = resolveManifestPath(argv, process.env);
  const expectedVersion = resolveExpectedVersion(argv, process.env);
  const manifestPath = path.isAbsolute(manifestRel) ? manifestRel : path.join(REPO_ROOT, manifestRel);
  console.log(`verifying staging against manifest ${manifestRel}; expected version ${expectedVersion}`);

  if (!existsSync(STAGING)) {
    console.error("refusing: release-staging/ is absent; run scripts/build-release-staging.mjs first");
    process.exit(1);
  }

  if (!existsSync(manifestPath)) {
    console.error(`refusing: manifest ${manifestRel} is absent`);
    process.exit(1);
  }

  const versionFile = path.join(STAGING, VERSION_FILE_NAME);
  if (!existsSync(versionFile)) {
    console.error(
      `refusing: staging version record ${VERSION_FILE_NAME} is absent; rebuild staging with scripts/build-release-staging.mjs`,
    );
    process.exit(1);
  }
  const stagedVersionRecord = readFileSync(versionFile, "utf8").trim();
  if (stagedVersionRecord !== expectedVersion) {
    console.error(
      `refusing: staging version record ${JSON.stringify(stagedVersionRecord)} diverges from expected ${expectedVersion}`,
    );
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const mismatches = [];
  for (const file of Object.keys(manifest).sort()) {
    const staged = path.join(STAGING, file);
    if (!existsSync(staged) || statSync(staged).isDirectory()) {
      mismatches.push(`${file}: absent from staging`);
      continue;
    }
    const current = createHash("sha256").update(readFileSync(staged)).digest("hex");
    if (manifest[file] !== current) {
      mismatches.push(`${file}: current ${current} recorded ${manifest[file]}`);
    }
  }
  const expected = expectedStagingFiles();
  const actual = new Set(listStagingFiles(STAGING));
  for (const file of [...expected].sort()) {
    if (!actual.has(file) && !Object.hasOwn(manifest, file)) {
      mismatches.push(`${file}: absent from staging`);
    }
  }
  for (const file of [...actual].sort()) {
    if (!expected.has(file)) {
      mismatches.push(`${file}: present in staging but unlisted in the tracked tree`);
    }
  }
  if (mismatches.length > 0) {
    console.error(`staging manifest mismatch for:\n${mismatches.join("\n")}`);
    process.exit(1);
  }

  const stagedPkg = JSON.parse(readFileSync(path.join(STAGING, "package.json"), "utf8"));
  if (stagedPkg.name !== "pi-perimeter" || stagedPkg.version !== expectedVersion || "private" in stagedPkg) {
    console.error(
      `staging manifest is not publishable: ${JSON.stringify({ name: stagedPkg.name, version: stagedPkg.version, private: stagedPkg.private })}; expected pi-perimeter@${expectedVersion} with no private field`,
    );
    process.exit(1);
  }
  console.log(
    `staging verified: ${Object.keys(manifest).length} files match ${manifestRel}; publishable pi-perimeter@${expectedVersion}`,
  );
}

const invokedAsScript =
  process.argv[1] !== undefined && path.resolve(process.argv[1]).endsWith("verify-release-staging.mjs");
if (invokedAsScript) {
  main();
}
