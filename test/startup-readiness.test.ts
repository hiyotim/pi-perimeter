import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { release as osRelease, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const REPO_ROOT = path.resolve(".");
const PI_CLI = path.join(REPO_ROOT, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js");
const PI_SDK = pathToFileURL(path.join(REPO_ROOT, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "index.js")).href;

function run(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, [...args], { cwd, env, encoding: "utf8", timeout: 180_000 });
  assert.equal(result.error, undefined, `${command}: ${result.error}`);
  return result;
}

// A real Pi loader and managed npm directory are required here: the fake host
// in gate-runtime.test.ts cannot reproduce the factory-load action stubs.
test("an isolated packed install loads in Pi 0.84.4 and binds its own tools", { timeout: 240_000 }, async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "pi-perimeter-startup-"));
  const home = path.join(fixture, "home");
  const agentDir = path.join(fixture, "agent");
  const workspace = path.join(fixture, "workspace");
  const tarballs = path.join(fixture, "tarballs");
  const cache = path.join(fixture, "cache");
  try {
    for (const directory of [home, agentDir, workspace, tarballs, cache]) await mkdir(directory);
    await writeFile(path.join(workspace, "ordinary.txt"), "synthetic ordinary\n");
    await writeFile(path.join(workspace, ".env"), "SYNTHETIC_ONLY=1\n");

    const env: NodeJS.ProcessEnv = {
      HOME: home,
      PATH: process.env.PATH,
      TMPDIR: fixture,
      PI_CODING_AGENT_DIR: agentDir,
      npm_config_cache: cache,
      npm_config_userconfig: path.join(fixture, "user.npmrc"),
      npm_config_globalconfig: path.join(fixture, "global.npmrc"),
      npm_config_offline: "true",
      npm_config_audit: "false",
      npm_config_fund: "false",
    };
    const pack = run("npm", ["pack", REPO_ROOT, "--pack-destination", tarballs, "--json"], fixture, env);
    assert.equal(pack.status, 0, pack.stderr);
    const packed = JSON.parse(pack.stdout) as { filename: string }[];
    assert.equal(packed.length, 1);
    const tarball = path.join(tarballs, packed[0]!.filename);
    const install = run("npm", ["install", tarball, "--prefix", path.join(agentDir, "npm"), "--legacy-peer-deps", "--ignore-scripts"], fixture, env);
    assert.equal(install.status, 0, install.stderr);

    const installedRoot = path.join(agentDir, "npm", "node_modules", "pi-perimeter");
    const installed = JSON.parse(await readFile(path.join(installedRoot, "package.json"), "utf8")) as { version: string };
    const peer = JSON.parse(await readFile(path.join(REPO_ROOT, "node_modules", "@earendil-works", "pi-coding-agent", "package.json"), "utf8")) as { version: string };
    assert.equal(peer.version, "0.84.4", "this regression is verified against Pi 0.84.4 bytes only");
    await writeFile(path.join(agentDir, "settings.json"), JSON.stringify({ packages: [`npm:pi-perimeter@${installed.version}`] }));
    const listing = run(process.execPath, [PI_CLI, "list"], workspace, env);
    assert.equal(listing.status, 0, listing.stderr);
    assert.ok(listing.stdout.includes(`npm:pi-perimeter@${installed.version}`), "Pi's catalog must list the installed package version");
    assert.ok(listing.stdout.includes(installedRoot), "Pi's catalog must point to the installed package");

    const probe = `
      import assert from "node:assert/strict";
      import {createAgentSession, SessionManager} from ${JSON.stringify(PI_SDK)};
      const cwd=process.env.PI_AUDIT_WORKSPACE;
      const agentDir=process.env.PI_CODING_AGENT_DIR;
      const entry=process.env.PI_AUDIT_ENTRY;
      const {session}=await createAgentSession({cwd,agentDir,sessionManager:SessionManager.inMemory(cwd)});
      try {
        await session.bindExtensions({mode:"rpc"});
        const loaded=session.resourceLoader.getExtensions();
        assert.deepEqual(loaded.errors, []);
        assert.ok(loaded.extensions.some(extension=>extension.path===entry));
        for(const name of ["read","write","edit","grep","find","ls","bash"]){
          assert.equal(session.getAllTools().find(tool=>tool.name===name)?.sourceInfo?.path,entry);
        }
        const gate=async(name,args,id)=>await session.agent.beforeToolCall({toolCall:{type:"toolCall",id,name,arguments:args},args});
        assert.match((await gate("read",{path:".env"},"secret"))?.reason??"",/SECRET_RESOURCE/);
        assert.equal(await gate("read",{path:"ordinary.txt"},"ordinary"),undefined);
        const shellArgs={command:"printf STARTUP_SMOKE"};
        const shell=await gate("bash",shellArgs,"shell-check");
        if(process.env.PI_AUDIT_HELPER_BUILT==="1"){
          assert.equal(shell,undefined);
          const tool=session.agent.state.tools.find(tool=>tool.name==="bash");
          assert.ok(tool);
          const result=await tool.execute("shell-check",shellArgs,new AbortController().signal);
          const output=result.content.map(item=>item.type==="text"?item.text:"").join(" ");
          assert.match(output,/STARTUP_SMOKE/);
          assert.match(output,/contained run finished/);
          assert.match(output,/network closed/);
        } else {
          assert.match(shell?.reason??"",process.platform==="darwin"?/HELPER_MISSING/:/PLATFORM_UNSUPPORTED/);
        }
      } finally {session.dispose();}
    `;
    const sdk = run(process.execPath, ["--input-type=module", "--eval", probe], workspace, {
      ...env,
      PI_AUDIT_WORKSPACE: workspace,
      PI_AUDIT_ENTRY: path.join(installedRoot, "src", "index.ts"),
    });
    assert.equal(sdk.status, 0, `${sdk.stdout}\n${sdk.stderr}`);

    if (process.platform === "darwin" && process.arch === "arm64" && Number(osRelease().split(".")[0]) === 27) {
      const build = run("npm", ["--prefix", installedRoot, "run", "build:native"], workspace, env);
      assert.equal(build.status, 0, build.stderr);
      const withHelper = run(process.execPath, ["--input-type=module", "--eval", probe], workspace, {
        ...env,
        PI_AUDIT_WORKSPACE: workspace,
        PI_AUDIT_ENTRY: path.join(installedRoot, "src", "index.ts"),
        PI_AUDIT_HELPER_BUILT: "1",
      });
      assert.equal(withHelper.status, 0, `${withHelper.stdout}\n${withHelper.stderr}`);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
