#!/usr/bin/env node
/**
 * Explicit native helper build. There is no implicit runtime compilation, no
 * toolchain installation, no download, and no network use: this script fails
 * closed when the compiler or the platform is unavailable.
 *
 * Outputs:
 *   native/piwarden-helper          executable
 *   native/build-manifest.json      recorded build identity (source hash,
 *                                   compiler, flags, output hash and size)
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(packageRoot, "src", "sandbox", "native", "piwarden-helper.c");
const outputDirectory = path.join(packageRoot, "native");
const outputPath = path.join(outputDirectory, "piwarden-helper");
const manifestPath = path.join(outputDirectory, "build-manifest.json");
const protocol = 2;

function fail(message) {
  process.stderr.write(`pi-warden native build refused: ${message}\n`);
  process.exit(1);
}

if (process.platform !== "darwin") {
  fail(`platform ${process.platform} is not supported for the declared target`);
}

const compiler = "/usr/bin/cc";
const compilerProbe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
if (compilerProbe.status !== 0) {
  fail(`${compiler} is unavailable; install the platform toolchain or keep the shell route disabled`);
}
const compilerVersion = compilerProbe.stdout.split("\n")[0]?.trim() ?? "unknown";

const recordedFlags = ["-O2", "-std=c11", "-Wall", "-Wextra", "-Werror", "-arch", process.arch];
const flags = [...recordedFlags, "-o", outputPath, sourcePath];

mkdirSync(outputDirectory, { recursive: true });
const compile = spawnSync(compiler, flags, { encoding: "utf8" });
if (compile.status !== 0) {
  fail(`compilation failed:\n${compile.stderr || compile.stdout}`);
}
if ((compile.stderr ?? "").trim().length > 0) {
  fail(`compilation produced diagnostics:\n${compile.stderr}`);
}
chmodSync(outputPath, 0o755);

const selfTest = spawnSync(outputPath, ["selftest"], { encoding: "utf8" });
if (selfTest.status !== 0) {
  fail(`built helper failed its self-test: ${selfTest.stderr}`);
}
if (!selfTest.stdout.includes(`PROTOCOL ${protocol}`) || !selfTest.stdout.includes(`ARCH ${process.arch}`)) {
  fail(`built helper reported an unexpected identity:\n${selfTest.stdout}`);
}

const sourceBytes = readFileSync(sourcePath);
const outputBytes = readFileSync(outputPath);
const manifest = {
  helperVersion: "1",
  protocol,
  arch: process.arch,
  sourcePath: path.relative(packageRoot, sourcePath).split(path.sep).join("/"),
  sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
  compiler,
  compilerVersion,
  flags: recordedFlags,
  outputPath: path.relative(packageRoot, outputPath).split(path.sep).join("/"),
  outputSha256: createHash("sha256").update(outputBytes).digest("hex"),
  outputSize: outputBytes.length,
  builtAt: new Date().toISOString(),
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(
  [
    `pi-warden native helper built`,
    `  source    ${manifest.sourcePath} ${manifest.sourceSha256.slice(0, 16)}`,
    `  output    ${manifest.outputPath} ${manifest.outputSha256.slice(0, 16)} (${manifest.outputSize} bytes)`,
    `  compiler  ${manifest.compilerVersion}`,
    `  flags     ${manifest.flags.join(" ")}`,
    `  manifest  ${path.relative(packageRoot, manifestPath)}`,
    "",
  ].join("\n"),
);
