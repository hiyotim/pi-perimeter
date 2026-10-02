import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

// Distribution maintenance changes no runtime guarantee and preserves released evidence.
const MANIFEST_PATH = "docs/maintenance-hashes-2026-10-02.json";
const COVERED_FILES = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "ROADMAP.md",
  "SECURITY.md",
  "STATE.md",
  "docs/COMPATIBILITY.md",
  "docs/CONFIGURATION-AUTHORIZATION.md",
  "docs/DEVELOPMENT.md",
  "docs/MAINTENANCE-2026-10-02.md",
  "docs/PACKAGING.md",
  "docs/PI-1.0.0-AUDIT-2026-10-02.md",
  "docs/README.md",
  "docs/USAGE.md",
  "docs/pi-1.0.0-results-2026-10-02.json",
  "package.json",
  "test/ci-manifest.test.ts",
  "test/ci-test-budget.json",
  "test/compatibility-manifest.test.ts",
  "test/gate-runtime.test.ts",
  "test/hash-manifest.test.ts",
  "test/independent-audit-manifest.test.ts",
  "test/maintenance-manifest.test.ts",
  "test/network-manifest.test.ts",
  "test/package-lifecycle.test.ts",
  "test/packaging-identity.test.ts",
  "test/packaging-manifest.test.ts",
  "test/pi-1.0.0-probe.mjs",
  "test/post-transfer-manifest.test.ts",
  "test/regression-evidence-manifest.test.ts",
  "test/release-1.0.1-final-manifest.test.ts",
  "test/release-1.0.1-manifest.test.ts",
  "test/release-1.0.1-postpublication-manifest.test.ts",
  "test/release-manifest.test.ts",
  "test/release-review-manifest.test.ts",
  "test/shell-manifest.test.ts",
  "test/startup-readiness-manifest.test.ts",
  "test/unknown-bounds-manifest.test.ts",
  "test/user-install-onboarding-manifest.test.ts",
  "test/v1-guarantees-manifest.test.ts"
] as const;
const HISTORICAL_BINDINGS: Record<string, readonly { path: string; sha256: string }[]> = {
  "test/ci-manifest.test.ts": [
    {
      "path": "docs/ci-hashes.json",
      "sha256": "796fcf2b8b7a928ab045e4e38ea886f3fb1afc67d618755bc125722796d52c1e"
    }
  ],
  "test/compatibility-manifest.test.ts": [
    {
      "path": "docs/compatibility-hashes.json",
      "sha256": "0657cfd7803e11b4e7d4f7842667eaa250b461be96945cfb95852dea77d9e841"
    }
  ],
  "test/hash-manifest.test.ts": [
    {
      "path": "docs/file-gate-hashes.json",
      "sha256": "9698efea51aaa47a47679fa0520d395cbcc3d5282e4e2b7131106a86da13fd1d"
    }
  ],
  "test/independent-audit-manifest.test.ts": [
    {
      "path": "docs/independent-audit-hashes.json",
      "sha256": "32cb0399a29b71d7f8b4716f25afdd8f9583d81990fcf748236c5e60ba57070f"
    }
  ],
  "test/network-manifest.test.ts": [
    {
      "path": "docs/network-gate-hashes.json",
      "sha256": "152c7fa25fe2b95ad5d61005e677eabf341ef269884653c879551ad14385b972"
    }
  ],
  "test/packaging-manifest.test.ts": [
    {
      "path": "docs/packaging-hashes.json",
      "sha256": "9dc00b9cd9ab7b4ad297e95452b206bbbc5c0405443257f095fcf4bbc3b62209"
    }
  ],
  "test/post-transfer-manifest.test.ts": [
    {
      "path": "docs/post-transfer-hashes.json",
      "sha256": "7f1608c64d7053e84a1960815b6cd350c8e59e2d9f5c615b3be39fc6975e33a9"
    }
  ],
  "test/regression-evidence-manifest.test.ts": [
    {
      "path": "docs/regression-evidence-hashes.json",
      "sha256": "8a42fd593997b38a08fd1376add072fab5c4053a09684236602e22394e52687e"
    }
  ],
  "test/release-1.0.1-final-manifest.test.ts": [
    {
      "path": "docs/release-hashes-1.0.1-final.json",
      "sha256": "17ab9761d97a220dd55cd3c474f504ae887a8007782c6479e4d1a6c39b268bef"
    }
  ],
  "test/release-1.0.1-manifest.test.ts": [
    {
      "path": "docs/release-hashes-1.0.1.json",
      "sha256": "4a0fad66763b64d3c40e0a5e20b25c96d7e14e19ada4aa98a235a66305966d8f"
    }
  ],
  "test/release-1.0.1-postpublication-manifest.test.ts": [
    {
      "path": "docs/release-hashes-1.0.1-postpublication.json",
      "sha256": "4f8410633a6a1bb3ae76d6cc1d604bc4bfe9127962aec05a35eccdf626566680"
    },
    {
      "path": "docs/release-hashes-1.0.1-acceptance.json",
      "sha256": "1428104e3fe6a6af36506efc221803352729cf598c88427510f507e52315834b"
    }
  ],
  "test/release-manifest.test.ts": [
    {
      "path": "docs/release-hashes.json",
      "sha256": "625d1ce87ed94989eb712235f4f94e3db7fe252bff2cc3586ad22e55b31ad879"
    }
  ],
  "test/release-review-manifest.test.ts": [
    {
      "path": "docs/release-review-hashes.json",
      "sha256": "92968811dd4ea55b5eb09d97ded07b63d06f7d8571746b43dd58e5827aebc0c4"
    }
  ],
  "test/shell-manifest.test.ts": [
    {
      "path": "docs/shell-gate-hashes.json",
      "sha256": "d5e4e5f2f8497d4da39826130e37f23287b066fe1369fcd3a4a87f971b97cfaa"
    }
  ],
  "test/startup-readiness-manifest.test.ts": [
    {
      "path": "docs/startup-readiness-hashes.json",
      "sha256": "0aa01cbc5e4b1f5941c17cbf2bd756315d88a1cf84bd235e195066e6bc510302"
    }
  ],
  "test/unknown-bounds-manifest.test.ts": [
    {
      "path": "docs/unknown-bounds-hashes.json",
      "sha256": "2b7ad6b55bfd654f5d42dd9a24e9e2b3927a85136eafec223399bc094ae83bd9"
    }
  ],
  "test/user-install-onboarding-manifest.test.ts": [
    {
      "path": "docs/user-install-onboarding-hashes.json",
      "sha256": "7104d7538ffe87d0ba711a0688b45f6b8074065f0ca75520d056c6882c30a447"
    }
  ],
  "test/v1-guarantees-manifest.test.ts": [
    {
      "path": "docs/v1-guarantees-hashes.json",
      "sha256": "2d59ca09f8d2bdb195164bfba5de630cc8e8410186df7822b5dc33a1bb56cfe5"
    }
  ]
};

async function sha256(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

test("maintenance binding checks every changed file without rewriting historical release hashes", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Record<string, string>;
  assert.deepEqual(Object.keys(manifest).sort(), [...COVERED_FILES].sort());
  assert.ok(!Object.hasOwn(manifest, MANIFEST_PATH), "a binding cannot list itself");
  for (const file of COVERED_FILES) {
    assert.equal(await sha256(file), manifest[file], `maintenance bytes mismatch: ${file}`);
  }
  for (const bindings of Object.values(HISTORICAL_BINDINGS)) {
    for (const historical of bindings) {
      assert.equal(await sha256(historical.path), historical.sha256, `historical evidence was rewritten: ${historical.path}`);
    }
  }
});

test("historical maintenance exceptions are exact and every skipped file has a successor binding", async () => {
  const current = new Set<string>(COVERED_FILES);
  for (const [suite, bindings] of Object.entries(HISTORICAL_BINDINGS)) {
    const historicalFiles = new Set<string>();
    for (const binding of bindings) {
      const manifest = JSON.parse(await readFile(binding.path, "utf8")) as Record<string, string>;
      for (const file of Object.keys(manifest)) historicalFiles.add(file);
    }
    const expected = [...historicalFiles].filter((file) => current.has(file)).sort();
    const source = await readFile(suite, "utf8");
    const match = /CHANGED_IN_MAINTENANCE = new Set<string>\(\[([\s\S]*?)\]\)/.exec(source);
    assert.ok(match, `${suite} must declare its exact successor files`);
    const declared = [...match[1]!.matchAll(/"([^"]+)"/g)].map((item) => item[1]!).sort();
    assert.deepEqual(declared, expected, `${suite} has an unbound or missing maintenance exception`);
    assert.ok(current.has(suite), `${suite} must itself be maintenance-bound`);
  }
});
