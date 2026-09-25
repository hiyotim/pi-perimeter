// Isolated Pi package-manager onboarding evidence (`20260925-user-install-onboarding`).
//
// Route split: this test exercises Pi's own package-manager route (`pi install` /
// `pi list` / `pi remove`) against a synthetic loopback npm registry serving the
// `npm pack` output of this source tree. `test/startup-readiness.test.ts` covers
// runtime behavior of packed bytes via a manual npm install into the managed
// directory plus a settings entry. Neither route proves a published npmjs
// artifact; post-publication verification of a corrected version waits for the
// release Goal.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { release as osRelease, tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const REPO_ROOT = path.resolve(".");
const PI_CLI = path.join(
  REPO_ROOT,
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "dist",
  "bundle",
  "cli.js",
);

function runAsync(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, env });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ status: code, stdout, stderr });
    });
  });
}

function runPack(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return runAsync("npm", args, cwd, env);
}

test("pi package-manager installs, lists, and removes the packed candidate in isolation", { timeout: 240_000 }, async () => {
  const peer = JSON.parse(
    await readFile(
      path.join(REPO_ROOT, "node_modules", "@earendil-works", "pi-coding-agent", "package.json"),
      "utf8",
    ),
  ) as { version: string };
  assert.equal(peer.version, "0.84.4", "this regression is verified against Pi 0.84.4 bytes only");

  const fixture = await mkdtemp(path.join(tmpdir(), "pi-perimeter-onboarding-"));
  const home = path.join(fixture, "home");
  const agentDir = path.join(fixture, "agent");
  const workspace = path.join(fixture, "workspace");
  const tarballs = path.join(fixture, "tarballs");
  const packCache = path.join(fixture, "pack-cache");
  const installCache = path.join(fixture, "install-cache");
  let server: ReturnType<typeof createServer> | undefined;
  try {
    for (const directory of [home, agentDir, workspace, tarballs, packCache, installCache]) {
      await mkdir(directory, { recursive: true });
    }

    const packEnv: NodeJS.ProcessEnv = {
      HOME: home,
      PATH: process.env.PATH,
      TMPDIR: fixture,
      npm_config_cache: packCache,
      npm_config_userconfig: path.join(fixture, "pack.npmrc"),
      npm_config_globalconfig: path.join(fixture, "pack-global.npmrc"),
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
      NO_COLOR: "1",
    };
    const pack = await runPack(
      ["pack", REPO_ROOT, "--pack-destination", tarballs, "--json"],
      fixture,
      packEnv,
    );
    assert.equal(pack.status, 0, pack.stderr);
    const packed = JSON.parse(pack.stdout) as { filename: string }[];
    assert.equal(packed.length, 1);
    const tarballPath = path.join(tarballs, packed[0]!.filename);
    const tarballBytes = await readFile(tarballPath);
    // Packed version comes from the tarball filename (`<name>-<version>.tgz`).
    const tarballBase = path.basename(tarballPath);
    const versionMatch = /^pi-perimeter-(.+)\.tgz$/.exec(tarballBase);
    assert.ok(versionMatch, `unexpected tarball name ${tarballBase}`);
    const packedVersion = versionMatch[1]!;
    const shasum = createHash("sha1").update(tarballBytes).digest("hex");
    const integrity = `sha512-${createHash("sha512").update(tarballBytes).digest("base64")}`;

    let sawPackument = false;
    let sawTarball = false;
    server = createServer((req, res) => {
      const url = req.url ?? "";
      if (req.method === "GET" && url === "/pi-perimeter") {
        sawPackument = true;
        const host = `127.0.0.1:${(server!.address() as AddressInfo).port}`;
        const body = JSON.stringify({
          name: "pi-perimeter",
          "dist-tags": { latest: packedVersion },
          versions: {
            [packedVersion]: {
              name: "pi-perimeter",
              version: packedVersion,
              dist: {
                tarball: `http://${host}/pi-perimeter/-/pi-perimeter-${packedVersion}.tgz`,
                shasum,
                integrity,
              },
            },
          },
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(body);
        return;
      }
      if (req.method === "GET" && url === `/pi-perimeter/-/pi-perimeter-${packedVersion}.tgz`) {
        sawTarball = true;
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.end(tarballBytes);
        return;
      }
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    });
    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as AddressInfo).port;

    const cliEnv: NodeJS.ProcessEnv = {
      HOME: home,
      PATH: process.env.PATH,
      TMPDIR: fixture,
      PI_CODING_AGENT_DIR: agentDir,
      npm_config_cache: installCache,
      npm_config_userconfig: path.join(fixture, "user.npmrc"),
      npm_config_globalconfig: path.join(fixture, "global.npmrc"),
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
      npm_config_registry: `http://127.0.0.1:${port}/`,
      NO_COLOR: "1",
    };

    const install = await runAsync(
      process.execPath,
      [PI_CLI, "install", `npm:pi-perimeter@${packedVersion}`],
      workspace,
      cliEnv,
    );
    assert.equal(install.status, 0, `${install.stdout}\n${install.stderr}`);
    assert.ok(sawPackument, "the synthetic registry must serve the packument");
    assert.ok(sawTarball, "the synthetic registry must serve the tarball");

    const settingsRaw = await readFile(path.join(agentDir, "settings.json"), "utf8");
    const settings = JSON.parse(settingsRaw) as { packages?: unknown };
    assert.ok(
      Array.isArray(settings.packages) &&
        settings.packages.includes(`npm:pi-perimeter@${packedVersion}`),
      `settings must list the installed package: ${settingsRaw}`,
    );

    const expectedRoot = path.join(agentDir, "npm", "node_modules", "pi-perimeter");
    const installedPkg = JSON.parse(
      await readFile(path.join(expectedRoot, "package.json"), "utf8"),
    ) as { version: string };
    assert.equal(installedPkg.version, packedVersion);
    assert.ok(existsSync(expectedRoot));

    const listing = await runAsync(process.execPath, [PI_CLI, "list"], workspace, cliEnv);
    assert.equal(listing.status, 0, `${listing.stdout}\n${listing.stderr}`);
    assert.ok(
      listing.stdout.includes(`npm:pi-perimeter@${packedVersion}`),
      "Pi's catalog must list the installed package version",
    );
    assert.ok(listing.stdout.includes(expectedRoot), "Pi's catalog must point to the installed package");
    // The reported root is the managed install root Pi resolves for this source.
    const reportedRootLine = listing.stdout
      .split("\n")
      .find((line) => line.trim() === expectedRoot);
    assert.ok(reportedRootLine !== undefined, "the reported root must equal the managed install root");

    if (
      process.platform === "darwin" &&
      process.arch === "arm64" &&
      Number(osRelease().split(".")[0]) === 27
    ) {
      const build = await runAsync("npm", ["--prefix", expectedRoot, "run", "build:native"], workspace, cliEnv);
      assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
      const manifestStat = await stat(path.join(expectedRoot, "native", "build-manifest.json"));
      assert.ok(manifestStat.isFile());
    }

    const remove = await runAsync(process.execPath, [PI_CLI, "remove", "npm:pi-perimeter"], workspace, cliEnv);
    assert.equal(remove.status, 0, `${remove.stdout}\n${remove.stderr}`);
    const afterRaw = await readFile(path.join(agentDir, "settings.json"), "utf8");
    const after = JSON.parse(afterRaw) as { packages?: unknown[] };
    assert.ok(
      !Array.isArray(after.packages) || !after.packages.includes(`npm:pi-perimeter@${packedVersion}`),
      `settings must no longer list the package: ${afterRaw}`,
    );
    assert.ok(!existsSync(expectedRoot), "the installed package directory must be removed");
  } finally {
    if (server !== undefined) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await rm(fixture, { recursive: true, force: true });
  }
});
