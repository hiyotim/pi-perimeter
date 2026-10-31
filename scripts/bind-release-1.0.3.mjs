#!/usr/bin/env node
// Reproduce the exact successor declarations and candidate bindings for this release.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const baseline = "a82707b6fa612ac21ea28292a149074908ba090b";
const currentPath = "docs/macos-27.2-hashes.json";
const releasePath = "docs/release-hashes-1.0.3.json";
const currentOnly = process.argv.includes("--current-only");
const git = (...args) => execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { encoding: "utf8" });
const names = output => output.split("\0").filter(Boolean);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = file => JSON.parse(readFileSync(file, "utf8"));
const write = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
if (!currentOnly && git("tag", "--list", "v1.0.3").trim()) {
  throw new Error("v1.0.3 is frozen; use --current-only for subsequent source evidence");
}
const files = names(git("ls-files", "--cached", "--others", "--exclude-standard", "-z"));
const changed = new Set([
  ...names(git("diff", "--name-only", "-z", baseline)),
  ...names(git("ls-files", "--others", "--exclude-standard", "-z")),
].filter(file => file !== currentPath && file !== releasePath));
const baselineFiles = names(git("ls-tree", "-r", "--name-only", "-z", baseline));
const historical = Object.fromEntries(baselineFiles.filter(file => /^docs\/.*hash.*\.json$/.test(file))
  .sort().map(file => [file, hash(execFileSync("git", ["show", `${baseline}:${file}`]))]));
for (const [file, expected] of Object.entries(historical)) {
  if (hash(readFileSync(file)) !== expected) throw new Error(`historical binding changed: ${file}`);
}
const suites = files.filter(file => /^test\/.*manifest\.test\.ts$/.test(file) && file !== "test/release-1.0.3-manifest.test.ts")
  .map(file => {
    const source = readFileSync(file, "utf8");
    const match = /const MANIFEST_PATH = "([^"]+)"/.exec(source);
    if (!match) throw new Error(`no manifest path: ${file}`);
    return { file, manifest: json(match[1]), source };
  });
let expanded;
do {
  expanded = false;
  for (const suite of suites) {
    if (Object.keys(suite.manifest).some(file => changed.has(file)) && !changed.has(suite.file)) {
      changed.add(suite.file); expanded = true;
    }
  }
} while (expanded);
for (const suite of suites) {
  if (!changed.has(suite.file)) continue;
  const successors = Object.keys(suite.manifest).filter(file => changed.has(file)).sort();
  let source = suite.source.replace(/\n\/\*\* Successor bytes are bound by docs\/macos-27\.2-hashes\.json\. \*\/\nconst CHANGED_IN_1_0_3 = new Set<string>\(\[[\s\S]*?\]\);\n\n/, "\n")
    .replace(/    if \(CHANGED_IN_1_0_3\.has\(file\)\) continue;[^\n]*\n/, "");
  const declaration = `/** Successor bytes are bound by docs/macos-27.2-hashes.json. */\nconst CHANGED_IN_1_0_3 = new Set<string>(${JSON.stringify(successors, null, 2)});\n\n`;
  const firstTest = source.indexOf("test(");
  if (firstTest < 0) throw new Error(`no tests: ${suite.file}`);
  source = source.slice(0, firstTest) + declaration + source.slice(firstTest);
  const loop = "for (const file of COVERED_FILES) {\n";
  if (!source.includes(loop)) throw new Error(`no hash loop: ${suite.file}`);
  source = source.replace(loop, `${loop}    if (CHANGED_IN_1_0_3.has(file)) continue; // exact successor hashes are checked by release-1.0.3-manifest.test.ts\n`);
  writeFileSync(suite.file, source);
}
const changedFiles = [...changed].filter(file => existsSync(file)).sort();
write(currentPath, { baseline, files: Object.fromEntries(changedFiles.map(file => [file, hash(readFileSync(file))])), historical });
if (!currentOnly) {
  const releaseFiles = [...new Set([...files, currentPath])].filter(file => file !== releasePath).sort();
  const manifest = Object.fromEntries(releaseFiles.map(file => {
    let bytes = readFileSync(file);
    if (file === "package.json") {
      const value = JSON.parse(bytes.toString()); delete value.private; value.version = "1.0.3";
      bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    }
    return [file, hash(bytes)];
  }));
  write(releasePath, manifest);
}
console.log(`bound ${changedFiles.length} current files and ${Object.keys(historical).length} frozen historical manifests`);
