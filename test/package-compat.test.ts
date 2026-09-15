import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

type Manifest = {
  readonly name: string;
  readonly private: boolean;
  readonly version: string;
  readonly engines: { readonly node: string };
  readonly pi: { readonly extensions: readonly string[] };
  readonly peerDependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
  readonly scripts: Record<string, string>;
};

async function manifest(): Promise<Manifest> {
  return JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as Manifest;
}

test("manifest remains unpublished and declares the supported Node range", async () => {
  const source = await manifest();
  assert.equal(source.private, true, "staying private prevents accidental npm publication");
  assert.match(source.engines.node, /^>=22\.19/);
  assert.match(source.version, /^\d+\.\d+\.\d+$/);
});

test("the Pi extension entry point is declared and exists on disk", async () => {
  const source = await manifest();
  assert.deepEqual(source.pi.extensions, ["./src/index.ts"]);
  for (const extension of source.pi.extensions) {
    await access(path.resolve(extension.replace(/^\.\//, "")));
  }
  const entryFile = await stat("./src/index.ts");
  assert.ok(entryFile.size < 4096, "the Pi integration entry point must remain thin");
});

test("no runtime dependencies are added beyond the Pi peer dependency", async () => {
  const source = await manifest();
  assert.deepEqual(Object.keys(source.peerDependencies), ["@earendil-works/pi-coding-agent"]);
  // The runtime surface uses only node built-ins plus the Pi host peer dep;
  // development tooling stays under devDependencies.
  assert.deepEqual(Object.keys(source.devDependencies).sort(), [
    "@types/node",
    "typescript",
  ]);
});

test("the CI workflow reproduces dependency installation in an isolated environment", async () => {
  const workflow = await readFile(path.resolve(".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /node-version: 22\.19\.0/);
});
