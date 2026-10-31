import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

interface Binding {
  readonly baseline: string;
  readonly files: Record<string, string>;
  readonly historical: Record<string, string>;
}
const bindingPath = "docs/macos-27.2-hashes.json";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

test("macOS 27.2 qualification binds all changed source bytes and preserves historical evidence", async () => {
  const binding: Binding = JSON.parse(await readFile(bindingPath, "utf8"));
  assert.equal(binding.baseline, "a82707b6fa612ac21ea28292a149074908ba090b");
  assert.ok(!Object.hasOwn(binding.files, bindingPath));
  for (const file of ["src/sandbox/containment.ts", "src/sandbox/platform-target.ts", "test/platform-target.test.ts",
    "test/platform-containment.test.ts", "test/pi-1.4.0-probe.mjs", "scripts/bind-release-1.0.3.mjs",
    "test/release-1.0.3-manifest.test.ts", "docs/MACOS-27.2-QUALIFICATION.md"]) {
    assert.ok(Object.hasOwn(binding.files, file), `unbound qualification artifact: ${file}`);
  }
  for (const [file, expected] of Object.entries({ ...binding.files, ...binding.historical })) {
    assert.equal(hash(await readFile(file)), expected, `bytes changed: ${file}`);
  }
});

async function verifySuccessors(binding: Binding): Promise<void> {
  const suites = (await readdir("test")).filter(file => /manifest\.test\.ts$/.test(file) && file !== "release-1.0.3-manifest.test.ts");
  for (const name of suites) {
    const suite = `test/${name}`;
    const source = await readFile(suite, "utf8");
    const declaration = /CHANGED_IN_1_0_3 = new Set<string>\((\[[\s\S]*?\])\)/.exec(source);
    if (!declaration) continue;
    assert.ok(Object.hasOwn(binding.files, suite), `unbound successor suite: ${suite}`);
    const pathMatch = /const MANIFEST_PATH = "([^"]+)"/.exec(source);
    assert.ok(pathMatch, suite);
    const historical: Record<string, string> = JSON.parse(await readFile(pathMatch[1]!, "utf8"));
    const expected = Object.keys(historical).filter(file => Object.hasOwn(binding.files, file)).sort();
    assert.deepEqual(JSON.parse(declaration[1]!), expected, `${suite}: incorrect successor set`);
  }
}

test("every 1.0.3 historical exception has an exact successor binding", async () => {
  const binding: Binding = JSON.parse(await readFile(bindingPath, "utf8"));
  await verifySuccessors(binding);
});

test("removing a historical suite from the current binding cannot hide its successor exceptions", async () => {
  const binding: Binding = JSON.parse(await readFile(bindingPath, "utf8"));
  delete binding.files["test/maintenance-manifest.test.ts"];
  await assert.rejects(verifySuccessors(binding), /unbound successor suite: test\/maintenance-manifest.test.ts/);
});
