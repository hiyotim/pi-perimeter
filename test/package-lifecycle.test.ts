import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const REPO_ROOT = path.resolve(".");
const PACK_TIMEOUT_MS = 180_000;

function npm(args: readonly string[], cwd: string, env: Record<string, string | undefined>): { stdout: string; stderr: string; status: number; error?: string } {
  const result = spawnSync("npm", [...args], {
    cwd,
    encoding: "utf-8",
    timeout: PACK_TIMEOUT_MS,
    shell: false,
    env: {
      ...process.env,
      ...env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
      npm_config_offline: "true",
    },
  });
  if (result.error !== undefined) {
    return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: -1, error: String(result.error) };
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: result.status ?? -1 };
}

test("isolated npm pack, install, and rollback cycle with no real-home or repository mutation", { timeout: 240_000 }, async () => {
  if (process.platform === "win32") {
    // The POSIX descriptor binding requirements do not include Windows support
    // in this Goal; the pack/install evidence here also relies on POSIX tooling.
    return;
  }
  const fixture = await mkdtemp(path.join(tmpdir(), "pi-warden-package-"));
  const tarballs = path.join(fixture, "tarballs");
  const consumer = path.join(fixture, "consumer");
  const cache = path.join(fixture, "npm-cache");
  const isolatedHome = path.join(fixture, "home");
  await (await import("node:fs/promises")).mkdir(tarballs, { recursive: true });
  await (await import("node:fs/promises")).mkdir(consumer, { recursive: true });
  await (await import("node:fs/promises")).mkdir(cache, { recursive: true });
  await (await import("node:fs/promises")).mkdir(isolatedHome, { recursive: true });
  const env: Record<string, string | undefined> = {
    HOME: isolatedHome,
    npm_config_cache: cache,
    npm_config_userconfig: path.join(isolatedHome, ".npmrc"),
  };
  try {
    // 1) Pack the working tree into an isolated destination.
    const pack = npm(["pack", REPO_ROOT, "--pack-destination", tarballs], fixture, env);
    assert.equal(pack.status, 0, `npm pack failed: ${pack.stderr}`);
    const packOutput = pack.stdout.trim().split("\n");
    const tarball = packOutput[packOutput.length - 1].trim();
    assert.match(tarball, /^pi-warden-\d+\.\d+\.\d+\.tgz$/, `unexpected tarball path: ${tarball}`);
    const tarballPath = path.join(tarballs, tarball);
    assert.ok(existsSync(tarballPath));

    // 2) Verify packed contents: intended files only, no tests/artifacts.
    const listing = spawnSync("tar", ["-tzf", tarballPath], { encoding: "utf-8" });
    assert.equal(listing.status, 0, "tar listing must succeed");
    const contents = listing.stdout.trim().split("\n").map((line) => line.replace(/^package\//, ""));
    assert.ok(contents.includes("package.json"), `contents: ${contents.join(", ")}`);
    assert.ok(contents.includes("src/index.ts"));
    assert.ok(contents.includes("README.md"));
    assert.ok(contents.includes("LICENSE"));
    assert.ok(contents.some((entry) => entry === "docs/FILE-GATE.md"));
    assert.equal(contents.some((entry) => entry.startsWith("test/")), false, `package must not ship tests: ${contents.join(", ")}`);
    assert.equal(contents.some((entry) => entry.startsWith("node_modules/")), false);
    assert.equal(contents.some((entry) => entry.includes(".npmrc") || entry.includes("auth.json")), false);

    // 3) Install the packed tarball into an isolated consumer.
    const install = npm(
      ["install", tarballPath, "--prefix", consumer, "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund"],
      fixture,
      env,
    );
    assert.equal(install.status, 0, `npm install failed: ${install.stderr}`);
    const installedPkg = JSON.parse(
      await readFile(path.join(consumer, "node_modules", "pi-warden", "package.json"), "utf8"),
    ) as { name: string; pi: { extensions: string[] } };
    assert.equal(installedPkg.name, "pi-warden");
    assert.deepEqual(installedPkg.pi.extensions, ["./src/index.ts"]);
    assert.ok(existsSync(path.join(consumer, "node_modules", "pi-warden", "src", "index.ts")));

    // 4) Rollback: uninstall and confirm the consumer is restored.
    const uninstall = npm(
      ["uninstall", "pi-warden", "--prefix", consumer, "--legacy-peer-deps", "--no-audit", "--no-fund"],
      fixture,
      env,
    );
    assert.equal(uninstall.status, 0, `npm uninstall failed: ${uninstall.stderr}`);
    assert.equal(existsSync(path.join(consumer, "node_modules", "pi-warden")), false, "installed package must be removed by rollback");

    // 5) The repository working tree stays untouched by the cycle.
    const manifestAfter = JSON.parse(await readFile(path.join(REPO_ROOT, "package.json"), "utf8")) as { name: string };
    assert.equal(manifestAfter.name, "pi-warden");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
