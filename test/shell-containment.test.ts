/**
 * Contained shell evidence suite (declared target: macOS 26A428, arm64).
 *
 * These tests exercise the production adapter with real processes, the real
 * generated profile and the real native helper. On other platforms they are
 * explicitly skipped; on the declared target a missing helper or an unexpected
 * refusal is a failure, never a silent pass.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { constants as fsConstants, openSync } from "node:fs";
import { chmod, link, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadOperationPolicySources } from "../src/policy/config-loader.ts";
import { resolveWorkspacePath } from "../src/policy/paths.ts";
import { createProtectedZone } from "../src/policy/control-plane.ts";
import {
  prepareContainedInvocation,
  runContainedShellCommand,
  type ContainedRunResult,
} from "../src/sandbox/containment.ts";
import { defaultBuildManifestPath, defaultHelperPath, runExportEffect } from "../src/sandbox/helper.ts";
import { ShellRefusal } from "../src/sandbox/errors.ts";

const darwin = process.platform === "darwin";
const skip = darwin ? false : "declared macOS target only";
// Tests run with the package root as the working directory; the runtime
// derives its own root from the extension module location instead.
const packageRoot = process.cwd();
const helperPath = defaultHelperPath(packageRoot);
const buildManifestPath = defaultBuildManifestPath(packageRoot);
const constants = {
  O_RDONLY: fsConstants.O_RDONLY,
  O_DIRECTORY: fsConstants.O_DIRECTORY,
  O_NOFOLLOW: fsConstants.O_NOFOLLOW,
};

interface Fixture {
  readonly root: string;
  readonly workspace: string;
  readonly userRoot: string;
  cleanup: () => Promise<void>;
}

async function fixture(name: string): Promise<Fixture> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), `piw-evidence-${name}-`)));
  const workspace = path.join(root, "workspace");
  const userRoot = path.join(root, "user");
  await mkdir(workspace);
  await mkdir(userRoot);
  return { root, workspace, userRoot, cleanup: () => rm(root, { recursive: true, force: true }) };
}

async function runContained(
  fixtureValue: Fixture,
  command: string,
  authorize: (change: { relativePath: string; kind: "create" | "mkdir" | "replace" }) => Promise<{
    decision: "ALLOW" | "ASK" | "DENY";
    reason: string;
  }> = async () => ({ decision: "ALLOW", reason: "evidence-allow" }),
): Promise<{ output: string; result: ContainedRunResult }> {
  const resolved = await resolveWorkspacePath(fixtureValue.workspace, ".");
  const loaded = await loadOperationPolicySources(resolved, fixtureValue.userRoot);
  let output = "";
  const result = await runContainedShellCommand({
    command,
    workspaceRoot: fixtureValue.workspace,
    loaded,
    protectedZones: [createProtectedZone("pi-warden-user-config", fixtureValue.userRoot)].filter(
      (zone) => zone !== undefined,
    ),
    trustedUserConfigRoot: fixtureValue.userRoot,
    helperPath,
    buildManifestPath,
    sealedInputs: [],
    timeoutMs: 60_000,
    signal: undefined,
    onOutput: (chunk) => {
      output += chunk.toString("utf8");
    },
    authorizeExport: authorize,
  });
  return { output, result };
}

test("declared target prerequisites are present", { skip }, async () => {
  assert.ok(
    existsSync(helperPath),
    `the native helper is required evidence on the declared target; build it with "npm run build:native"`,
  );
  assert.ok(existsSync(buildManifestPath));
});

test("an ordinary offline build and test workflow succeeds inside containment", { skip, timeout: 300_000 }, async () => {
  // The real repository is the workspace: the contained child receives a
  // projection of it and runs the project's own typecheck and a real test.
  const value = await fixture("workflow");
  try {
    const resolved = await resolveWorkspacePath(packageRoot, ".");
    const loaded = await loadOperationPolicySources(resolved, value.userRoot);
    let output = "";
    const result = await runContainedShellCommand({
      command: "npm run typecheck && npm run test:manifest",
      workspaceRoot: packageRoot,
      loaded,
      protectedZones: [],
      trustedUserConfigRoot: value.userRoot,
      helperPath,
      buildManifestPath,
      sealedInputs: [],
      timeoutMs: 240_000,
      signal: undefined,
      onOutput: (chunk) => {
        output += chunk.toString("utf8");
      },
      authorizeExport: async () => ({ decision: "ALLOW", reason: "workflow-evidence" }),
    });
    assert.equal(result.exitCode, 0, `contained workflow failed:\n${output}\n${result.report}`);
    assert.ok(result.projection.files > 1_000, `the projection must contain the repository (${result.projection.files} files)`);
    assert.ok(output.includes("typecheck") || output.includes("sha256"), "the workflow must actually run");
    // A read-only workflow must not change the host workspace.
    assert.deepEqual(
      result.export.applied,
      [],
      `a read-only workflow must produce no host effect: ${JSON.stringify(result.export.applied)}`,
    );
    assert.equal(result.quiescent, true);
  } finally {
    await value.cleanup();
  }
});

test("the child cannot reach the original workspace, credentials or the control plane", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("isolation");
  try {
    const secret = path.join(value.root, "host-secret.txt");
    await writeFile(secret, "HOST-SECRET-VALUE\n");
    await writeFile(path.join(value.workspace, "visible.txt"), "VISIBLE\n");
    await writeFile(path.join(value.workspace, ".env"), "FAKE_TOKEN=projection-secret\n");
    const reference = path.join(value.userRoot, "reference.txt");
    await writeFile(reference, "CONTROL-PLANE\n");

    const { output, result } = await runContained(
      value,
      [
        "cat visible.txt",
        "cat .env",
        `cat ${secret}`,
        `cat ${reference}`,
        `ls ${value.workspace}`,
        `stat ${value.workspace}`,
        "node -e 'console.log(process.env.HOME)'",
      ].join("\n"),
    );
    assert.equal(result.exitCode, 0);
    assert.ok(output.includes("VISIBLE"), "the projection is readable");
    for (const expected of ["No such file or directory", "Operation not permitted"]) {
      assert.ok(output.includes(expected), `expected an isolation refusal in:\n${output}`);
    }
    assert.ok(!output.includes("HOST-SECRET-VALUE"), "host content must never be reachable");
    assert.ok(!output.includes("CONTROL-PLANE"), "control-plane content must never be reachable");
    assert.ok(!output.includes("projection-secret"), "excluded project secrets must not be projected");
    assert.match(result.report, /contained run finished/);

    // Working positive control: the same commands succeed on the host.
    const control = await new Promise<string>((resolve) => {
      const child = spawn("/bin/bash", ["-c", `cat ${secret}; cat ${reference}`], { stdio: ["ignore", "pipe", "pipe"] });
      let text = "";
      child.stdout.on("data", (chunk: Buffer) => {
        text += chunk.toString("utf8");
      });
      child.on("close", () => resolve(text));
    });
    assert.ok(control.includes("HOST-SECRET-VALUE") && control.includes("CONTROL-PLANE"));
  } finally {
    await value.cleanup();
  }
});

test("networking is closed, with working host-side controls", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("network");
  try {
    const server = net.createServer((socket) => {
      socket.on("error", () => undefined);
      socket.end("HOST-LISTENER\n");
    });
    server.on("error", () => undefined);
    server.unref();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address !== null && typeof address === "object");
    const port = address.port;

    // Positive control: the host can reach the listener.
    const hostControl = await new Promise<string>((resolve) => {
      const socket = net.connect(port, "127.0.0.1", () => socket.write("ping\n"));
      let text = "";
      socket.on("data", (chunk) => {
        text += chunk.toString();
      });
      socket.on("close", () => resolve(text));
      socket.on("error", (error) => resolve(`error:${error.message}`));
    });
    assert.match(hostControl, /HOST-LISTENER/, "the host control must reach the listener");

    const { output, result } = await runContained(
      value,
      [
        `/usr/bin/nc -z -w 2 127.0.0.1 ${port} && echo tcp-connected || echo tcp-denied`,
        "/usr/bin/nc -z -w 2 1.1.1.1 443 && echo external-connected || echo external-denied",
        "node -e 'const s=require(\"net\").connect(1, \"127.0.0.1\"); s.on(\"connect\",()=>{console.log(\"node-connected\");process.exit(0)}); s.on(\"error\",(e)=>{console.log(\"node-denied\", e.code);process.exit(0)})'",
        "node -e 'require(\"dgram\").createSocket(\"udp4\").bind(0,()=>{console.log(\"udp-bound\");process.exit(0)}).on(\"error\",(e)=>{console.log(\"udp-denied\",e.code);process.exit(0)})'",
        "node -e 'setTimeout(()=>{console.log(\"dns-timeout\");process.exit(0)},6000).unref(); require(\"dns\").lookup(\"example.com\",(e,a)=>{console.log(e?\"dns-denied\"+e.code:\"dns-resolved\"+a);process.exit(0)})'",
        "node -e 'const f=require(\"fs\");try{f.statSync(\"/Users/2am./.hermes/auth.json\");console.log(\"home-readable\")}catch(e){console.log(\"home-denied\")}'",
      ].join("\n"),
    );
    assert.equal(result.exitCode, 0);
    assert.ok(output.includes("tcp-denied"), `loopback TCP must be denied:\n${output}`);
    assert.ok(output.includes("external-denied"), `external TCP must be denied:\n${output}`);
    assert.ok(output.includes("node-denied"), `socket connect must be denied:\n${output}`);
    assert.ok(output.includes("udp-denied"), `UDP bind must be denied:\n${output}`);
    assert.ok(
      output.includes("dns-denied") || output.includes("dns-timeout"),
      `DNS resolution must not succeed:\n${output}`,
    );
    assert.ok(output.includes("home-denied"), `home reads must be denied:\n${output}`);
    for (const marker of ["tcp-connected", "external-connected", "node-connected", "udp-bound", "dns-resolved", "home-readable"]) {
      assert.ok(!output.includes(marker), `the contained run must not report ${marker}`);
    }
    // close() waits for open connections; the control connection may still be
    // half-closed, so drop sockets first and do not depend on its callback.
    (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  } finally {
    await value.cleanup();
  }
});

test("the descriptor envelope closes every inherited descriptor above stdio", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("fdenvelope");
  try {
    const secretPath = path.join(value.root, "fd-secret.txt");
    await writeFile(secretPath, "FD-SECRET-VALUE\n");
    const profilePath = path.join(value.root, "probe.sbpl");
    // A permissive probe profile: the envelope, not the profile, is what this
    // test measures. It still comes from the production launcher invocation.
    await writeFile(
      profilePath,
      [
        "(version 1)",
        "(deny default)",
        "(allow process*)",
        '(allow sysctl-read (sysctl-name-prefix "hw.") (sysctl-name-prefix "kern."))',
        '(allow file-read* (subpath "/"))',
      ].join("\n") + "\n",
    );
    const reader =
      'const b=Buffer.alloc(128); try { const n=require("fs").readSync(3,b,0,128,null); process.stdout.write("FD3-CONTENT:"+b.subarray(0,n).toString()) } catch (e) { process.stdout.write("FD3-CLOSED:"+e.code) }';

    const launcher = spawn(
      helperPath,
      ["launch", "--profile", profilePath, "--", process.execPath, "-e", reader],
      { stdio: ["ignore", "pipe", "pipe", secretFd(secretPath)] },
    );
    let launcherOutput = "";
    let launcherError = "";
    launcher.stdout?.on("data", (chunk: Buffer) => {
      launcherOutput += chunk.toString("utf8");
    });
    launcher.stderr?.on("data", (chunk: Buffer) => {
      launcherError += chunk.toString("utf8");
    });
    await new Promise<void>((resolve) => launcher.on("close", () => resolve()));
    assert.match(
      launcherOutput,
      /FD3-CLOSED:/,
      `the launcher must close inherited descriptors: stdout=${launcherOutput} stderr=${launcherError}`,
    );
    assert.ok(!launcherOutput.includes("FD-SECRET-VALUE"), "no inherited descriptor may leak its content");

    // Working control: the same descriptor handed to a plain spawn is readable,
    // which is exactly what the envelope must prevent.
    const control = spawn(process.execPath, ["-e", reader], {
      stdio: ["ignore", "pipe", "pipe", secretFd(secretPath)],
    });
    let controlOutput = "";
    control.stdout?.on("data", (chunk: Buffer) => {
      controlOutput += chunk.toString("utf8");
    });
    await new Promise<void>((resolve) => control.on("close", () => resolve()));
    assert.match(controlOutput, /FD3-CONTENT:FD-SECRET-VALUE/, "the control must show a held descriptor leaks");

    // Descriptors above 255 are part of the required envelope too: the
    // launcher must close high-numbered descriptors, not just 3–255, and the
    // same plain-spawn control must show such a descriptor leaking.
    const highFds = [300, 1024];
    for (const fd of highFds) {
      const readerSource = `const b=Buffer.alloc(128); try { const n=require("fs").readSync(${fd},b,0,128,null); process.stdout.write("FD${fd}-CONTENT:"+b.subarray(0,n).toString()) } catch (e) { process.stdout.write("FD${fd}-CLOSED:"+e.code) }`;
      const padded: ("ignore" | "pipe" | number)[] = ["ignore", "pipe", "pipe"];
      for (let index = 3; index <= fd; index += 1) padded[index] = "ignore";
      padded[fd] = secretFd(secretPath);

      const launcherHigh = spawn(
        helperPath,
        ["launch", "--profile", profilePath, "--", process.execPath, "-e", readerSource],
        { stdio: padded as unknown as import("node:child_process").StdioOptions },
      );
      let highOutput = "";
      let highError = "";
      launcherHigh.stdout?.on("data", (chunk: Buffer) => {
        highOutput += chunk.toString("utf8");
      });
      launcherHigh.stderr?.on("data", (chunk: Buffer) => {
        highError += chunk.toString("utf8");
      });
      await new Promise<void>((resolve) => launcherHigh.on("close", () => resolve()));
      assert.match(
        highOutput,
        new RegExp(`FD${fd}-CLOSED:`),
        `descriptor ${fd} must be closed by the launcher: stdout=${highOutput} stderr=${highError}`,
      );
      assert.ok(!highOutput.includes("FD-SECRET-VALUE"), `descriptor ${fd} must not leak its content`);

      const controlHigh = spawn(process.execPath, ["-e", readerSource], {
        stdio: padded as unknown as import("node:child_process").StdioOptions,
      });
      let controlHighOutput = "";
      controlHigh.stdout?.on("data", (chunk: Buffer) => {
        controlHighOutput += chunk.toString("utf8");
      });
      await new Promise<void>((resolve) => controlHigh.on("close", () => resolve()));
      assert.match(
        controlHighOutput,
        new RegExp(`FD${fd}-CONTENT:FD-SECRET-VALUE`),
        `the control must show descriptor ${fd} leaking without the launcher`,
      );
    }
    // Inside the production containment the probe reports a closed descriptor
    // as well, and the secret value is nowhere in the output.
    const { output, result } = await runContained(value, `${JSON.stringify(process.execPath)} -e ${JSON.stringify(reader)}`);
    assert.equal(result.exitCode, 0);
    assert.match(output, /FD3-CLOSED:/);
    assert.ok(!output.includes("FD-SECRET-VALUE"), "no inherited descriptor may leak its content");
  } finally {
    await value.cleanup();
  }
});

/**
 * A raw descriptor for the envelope probe. A FileHandle would be reported as
 * an error by Node when it is garbage-collected, and the probe needs a plain
 * inherited descriptor anyway.
 */
function secretFd(target: string): number {
  return openSync(target, constants.O_RDONLY);
}

test("nested sandbox-exec is refused inside containment", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("nested");
  try {
    const { output, result } = await runContained(
      value,
      "/usr/bin/sandbox-exec -p '(version 1)(allow default)' /bin/echo nested-ok; echo rc=$?",
    );
    assert.equal(result.exitCode, 0);
    assert.ok(!output.includes("nested-ok"), `a nested sandbox must not run:\n${output}`);
    assert.match(output, /rc=71/, "nested sandbox_apply is refused by the outer profile");
    assert.ok(result.report.includes("contained run finished"));
  } finally {
    await value.cleanup();
  }
});

test("the child environment is exactly the constructed set", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("environment");
  try {
    await writeFile(path.join(value.workspace, "ordinary.txt"), "x\n");
    const { output, result } = await runContained(
      value,
      "node -e 'process.stdout.write(JSON.stringify(Object.keys(process.env).sort()))'",
    );
    assert.equal(result.exitCode, 0);
    const keys = JSON.parse(output.trim().split("\n").pop() ?? "[]") as string[];
    for (const forbidden of ["SSH_AUTH_SOCK", "NODE_OPTIONS", "DYLD_INSERT_LIBRARIES", "BASH_ENV", "PI_API_KEY", "HTTP_PROXY"]) {
      assert.ok(!keys.includes(forbidden), `${forbidden} must not be inherited`);
    }
    assert.ok(keys.includes("HOME") && keys.includes("TMPDIR") && keys.includes("PATH"));
  } finally {
    await value.cleanup();
  }
});

test("process-group quiescence is established before export", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("quiescence");
  try {
    await writeFile(path.join(value.workspace, "data.txt"), "original\n");
    // The entry process exits immediately and leaves a descendant in the same
    // process group: an ordinary entry process would otherwise wait for it.
    const program =
      'node -e \'const cp=require("child_process"); const c=cp.spawn("/bin/sh",["-c","sleep 3; printf tampered >> data.txt"],{stdio:"ignore"}); c.unref(); process.exit(0);\'';
    const { result } = await runContained(value, program);
    assert.equal(result.quiescent, true, "the process group must be proven empty");
    assert.equal(result.exitCode, 0);
    assert.equal(
      await readFile(path.join(value.workspace, "data.txt"), "utf8"),
      "original\n",
      "a killed descendant must not reach the host object",
    );
    assert.deepEqual(result.export.applied, [], "an unmodified projection produces no host effect");

    // Working control: the same program does write when nothing kills it.
    const controlRoot = path.join(value.root, "control");
    await mkdir(controlRoot);
    await writeFile(path.join(controlRoot, "data.txt"), "original\n");
    await new Promise<void>((resolve) => {
      const child = spawn(
        "/bin/sh",
        [
          "-c",
          `cd ${controlRoot} && node -e 'const cp=require("child_process"); const c=cp.spawn("/bin/sh",["-c","sleep 1; printf tampered >> data.txt"],{stdio:"ignore"}); c.unref(); process.exit(0);'`,
        ],
        { stdio: "ignore" },
      );
      child.unref();
      setTimeout(resolve, 2_500);
    });
    assert.equal(
      await readFile(path.join(controlRoot, "data.txt"), "utf8"),
      "original\ntampered",
      "the control shows the descendant does write when it survives",
    );
  } finally {
    await value.cleanup();
  }
});

test("an attributed detached survivor refuses the export and produces no host effect", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("survivor");
  try {
    await writeFile(path.join(value.workspace, "data.txt"), "original\n");
    // A detached descendant (own process group and session) that outlives the
    // entry process and rewrites an export candidate. The entry stays alive
    // briefly so the process census can attribute the survivor to the
    // invocation while its parent is still observable; the write happens after
    // the entry exited, so an export would publish a survivor's unsanctioned
    // bytes.
    const program =
      'node -e \'const cp=require("child_process"); const c=cp.spawn("/bin/sh",["-c","sleep 2; printf SURVIVOR-WROTE >> data.txt; sleep 2"],{stdio:"ignore",detached:true}); c.unref(); setTimeout(() => process.exit(0), 1200);\'';
    const { result } = await runContained(value, program);
    assert.equal(result.quiescent, false, "a surviving attributed descendant must block quiescence");
    assert.match(result.report, /attributed invocation process survived/i);
    assert.equal(result.export.exported, false, "no export may run while a descendant is unproven");
    assert.deepEqual(result.export.applied, [], "no host effect may be applied");
    assert.equal(
      await readFile(path.join(value.workspace, "data.txt"), "utf8"),
      "original\n",
      "the survivor's write must not reach the host object",
    );

    // Working control: the same detached descendant does write when nothing
    // refuses the export and nothing confines it.
    const controlRoot = path.join(value.root, "control");
    await mkdir(controlRoot);
    await writeFile(path.join(controlRoot, "data.txt"), "original\n");
    await new Promise<void>((resolve) => {
      spawn(
        "/bin/sh",
        [
          "-c",
          `cd ${controlRoot} && node -e 'const cp=require("child_process"); const c=cp.spawn("/bin/sh",["-c","sleep 1; printf SURVIVOR-WROTE >> data.txt"],{stdio:"ignore",detached:true}); c.unref(); setTimeout(() => process.exit(0), 400);'`,
        ],
        { stdio: "ignore" },
      );
      setTimeout(resolve, 2_500);
    });
    assert.equal(
      await readFile(path.join(controlRoot, "data.txt"), "utf8"),
      "original\nSURVIVOR-WROTE",
      "the control must show the detached descendant writing",
    );
  } finally {
    await value.cleanup();
  }
});

test("a projection the host cannot freeze produces no host effect and is not scanned or read", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("freeze-failure");
  try {
    await writeFile(path.join(value.workspace, "data.txt"), "original\n");
    await writeFile(path.join(value.workspace, "safe.txt"), "safe\n");
    // External synthetic fixture outside every writable root, referenced only
    // by a child-created symlink's text.
    const secretDirectory = path.join(value.root, "external-secret");
    await mkdir(secretDirectory);
    await writeFile(path.join(secretDirectory, "SYNTHETIC-SECRET-NAME.txt"), "SYNTHETIC-SECRET-BYTES\n");
    // The child changes a file (a legitimate export candidate) and creates
    // objects the frozen export source cannot represent: a FIFO and a hard
    // link. The freeze therefore refuses, and the export must end with the
    // known refusal reason — without walking, reading or diffing the live,
    // still-writable projection at all.
    const program =
      'node -e \'const cp=require("child_process"); cp.execSync("mkfifo fifo"); cp.execSync("ln safe.txt trick-hard"); cp.execSync("ln -s ' +
      secretDirectory +
      ' ext-link"); require("fs").writeFileSync("data.txt","changed-by-child\\n");\'';
    const { result } = await runContained(value, program);
    assert.equal(result.quiescent, true, "the invocation itself finished");
    assert.equal(result.export.exported, false, "an unfrozen export source refuses the export");
    assert.deepEqual(result.export.applied, [], "an unfrozen export source must produce no host effect");
    // No scan-layer refusals: a live-projection scan would have refused the
    // FIFO, the hard link and the external symlink by name.
    assert.deepEqual(
      result.export.refusals,
      [],
      `the live projection must not be scanned: ${JSON.stringify(result.export.refusals)}`,
    );
    // The only export record is the skip itself, with the known reason; no
    // per-entry live-scan records (changes, removals) exist.
    for (const record of result.export.ignored) {
      assert.equal(record.relativePath, "", "only the export-level skip record may exist");
    }
    assert.ok(
      result.report.includes("could not be frozen") ||
        result.export.ignored.some((entry) => /could not be frozen/.test(entry.reason)),
      `the freeze failure must be reported:\n${result.report}`,
    );
    // No external name, external byte or live-projection content may appear in
    // any reported result.
    const rendered = JSON.stringify({
      report: result.report,
      ignored: result.export.ignored,
      refusals: result.export.refusals,
      applied: result.export.applied,
      removed: result.export.removedInProjection,
      output: "",
    });
    assert.ok(!rendered.includes("SYNTHETIC-SECRET"), "no external name or byte may appear in the results");
    assert.ok(!rendered.includes("changed-by-child"), "no live-projection content may appear in the results");
    assert.equal(
      await readFile(path.join(value.workspace, "data.txt"), "utf8"),
      "original\n",
      "the child's change must not reach the host through a live source",
    );
    assert.ok(!existsSync(path.join(value.workspace, "trick-hard")));
  } finally {
    await value.cleanup();
  }
});

test("a quiescence refusal ends the export without walking or reading the live projection", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("quiescence-refusal-noscan");
  try {
    await writeFile(path.join(value.workspace, "data.txt"), "original\n");
    const secretDirectory = path.join(value.root, "external-secret");
    await mkdir(secretDirectory);
    await writeFile(path.join(secretDirectory, "SYNTHETIC-SECRET-NAME.txt"), "SYNTHETIC-SECRET-BYTES\n");
    // The entry exits leaving an attributed detached survivor (quiescence
    // refusal), after creating a FIFO, a symlink to the external fixture and
    // a changed export candidate. A live-projection fallback scan would
    // produce per-entry refusals and a diff for all of them; the export must
    // end with the known reason instead, touching nothing.
    const program =
      'node -e \'const cp=require("child_process"); cp.execSync("mkfifo fifo"); cp.execSync("ln -s ' +
      secretDirectory +
      ' ext-link"); require("fs").writeFileSync("data.txt","changed-by-child\\n"); const c=cp.spawn("/bin/sh",["-c","sleep 3"],{stdio:"ignore",detached:true}); c.unref(); setTimeout(() => process.exit(0), 1200);\'';
    const { result } = await runContained(value, program);
    assert.equal(result.quiescent, false, "a surviving attributed descendant must block quiescence");
    assert.equal(result.export.exported, false, "no export may run while a descendant is unproven");
    assert.deepEqual(result.export.applied, [], "no host effect may be applied");
    // No scan-layer refusals: a live-projection scan would have refused the
    // FIFO and the external symlink by name and diffed the changed file.
    assert.deepEqual(
      result.export.refusals,
      [],
      `the live projection must not be scanned after the quiescence refusal: ${JSON.stringify(result.export.refusals)}`,
    );
    for (const record of result.export.ignored) {
      assert.equal(record.relativePath, "", "only the export-level skip record may exist");
    }
    assert.ok(
      result.export.ignored.some((entry) => /attributed invocation process survived|export skipped/.test(entry.reason)),
      `the known refusal reason must be reported:\n${JSON.stringify(result.export.ignored)}`,
    );
    const rendered = JSON.stringify({
      report: result.report,
      ignored: result.export.ignored,
      refusals: result.export.refusals,
      applied: result.export.applied,
      removed: result.export.removedInProjection,
    });
    assert.ok(!rendered.includes("SYNTHETIC-SECRET"), "no external name or byte may appear in the results");
    assert.ok(!rendered.includes("changed-by-child"), "no live-projection content may appear in the results");
    assert.equal(
      await readFile(path.join(value.workspace, "data.txt"), "utf8"),
      "original\n",
      "the survivor's world must not reach the host object",
    );
    assert.ok(!existsSync(path.join(value.workspace, "ext-link")));
  } finally {
    await value.cleanup();
  }
});

test("a silent detached survivor cannot change what is applied (frozen export source)", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("silent-survivor");
  try {
    await writeFile(path.join(value.workspace, "data.txt"), "original\n");
    // The survivor leaves the session and never touches the projection during
    // the measurement, so an unprivileged observer cannot attribute it. It
    // rewrites the candidate only after the export would have finished.
    const program =
      'node -e \'const cp=require("child_process"); const c=cp.spawn("/bin/sh",["-c","sleep 3; printf late >> data.txt"],{stdio:"ignore",detached:true}); c.unref(); process.exit(0);\'';
    const { result } = await runContained(value, program);
    assert.equal(result.exitCode, 0);
    const applied = result.export.applied.find((effect) => effect.relativePath === "data.txt");
    if (applied !== undefined) {
      // If anything was applied it must be the state measured as stable, never
      // the survivor's later write.
      assert.equal(applied.sha256, createHash("sha256").update("original\n").digest("hex"));
    }
    // Wait past the survivor's write and re-check: the frozen source means the
    // host object can never receive it.
    await new Promise((resolve) => setTimeout(resolve, 3_500));
    assert.equal(
      await readFile(path.join(value.workspace, "data.txt"), "utf8"),
      "original\n",
      "a post-quiescence write by an unattributable survivor must not reach the host",
    );
  } finally {
    await value.cleanup();
  }
});

test("a synthetic Keychain item is reachable on the host and not inside containment", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("keychain");
  try {
    const keychain = path.join(value.root, "synthetic.keychain-db");
    const before = await new Promise<string>((resolve) => {
      const child = spawn("/usr/bin/security", ["list-keychains"], { stdio: ["ignore", "pipe", "pipe"] });
      let text = "";
      child.stdout.on("data", (chunk: Buffer) => {
        text += chunk.toString("utf8");
      });
      child.on("close", () => resolve(text));
    });
    const create = spawn("/usr/bin/security", ["create-keychain", "-p", "piwarden-synthetic", keychain]);
    await new Promise<void>((resolve, reject) => {
      create.on("error", reject);
      create.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`create-keychain exit ${code}`))));
    });
    const add = spawn("/usr/bin/security", [
      "add-generic-password",
      "-a",
      "piwarden-test",
      "-s",
      "piwarden-synthetic-service",
      "-w",
      "piwarden-synthetic-secret",
      keychain,
    ]);
    await new Promise<void>((resolve, reject) => {
      add.on("error", reject);
      add.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`add-generic-password exit ${code}`))));
    });

    // Host control: the synthetic item is readable with the explicit keychain.
    const hostFind = spawn("/usr/bin/security", [
      "find-generic-password",
      "-a",
      "piwarden-test",
      "-s",
      "piwarden-synthetic-service",
      "-w",
      keychain,
    ]);
    const hostOutput = await new Promise<string>((resolve) => {
      let text = "";
      hostFind.stdout.on("data", (chunk: Buffer) => {
        text += chunk.toString("utf8");
      });
      hostFind.on("close", () => resolve(text));
    });
    assert.match(hostOutput, /piwarden-synthetic-secret/, "the host control must read the synthetic item");

    const { output, result } = await runContained(
      value,
      `/usr/bin/security find-generic-password -a piwarden-test -s piwarden-synthetic-service -w ${keychain}; echo rc=$?`,
    );
    assert.equal(result.exitCode, 0);
    assert.ok(!output.includes("piwarden-synthetic-secret"), "the contained process must not read the synthetic item");
    assert.match(output, /rc=(?!0\b)\d+/, "the contained lookup must fail");

    const after = await new Promise<string>((resolve) => {
      const child = spawn("/usr/bin/security", ["list-keychains"], { stdio: ["ignore", "pipe", "pipe"] });
      let text = "";
      child.stdout.on("data", (chunk: Buffer) => {
        text += chunk.toString("utf8");
      });
      child.on("close", () => resolve(text));
    });
    assert.equal(after, before, "no user keychain search-list setting may change");

    const remove = spawn("/usr/bin/security", ["delete-keychain", keychain]);
    await new Promise<void>((resolve) => remove.on("close", () => resolve()));
    assert.ok(!existsSync(keychain), "the synthetic keychain is removed");
  } finally {
    await value.cleanup();
  }
});

test("export effects are bound to verified objects and refuse ancestor swaps", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("helper-binding");
  try {
    const directory = path.join(value.workspace, "swapdir");
    await mkdir(directory);
    await writeFile(path.join(directory, "existing.txt"), "existing\n");
    const linkTarget = path.join(value.workspace, "hardlinked.txt");
    await writeFile(linkTarget, "linked\n");
    await link(linkTarget, path.join(value.workspace, "hardlink-two.txt"));
    const rootHandle = await open(value.workspace, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const rootStat = await rootHandle.stat({ bigint: true });
    const directoryStat = await lstat(directory, { bigint: true });
    const base = {
      helperPath,
      rootFd: rootHandle.fd,
      rootDevice: rootStat.dev.toString(),
      rootInode: rootStat.ino.toString(),
      operation: "create" as const,
      leafDevice: "0",
      leafInode: "0",
      mode: 0o644,
      payload: Buffer.from("payload\n"),
      timeoutMs: 10_000,
    };
    try {
      const component = { device: directoryStat.dev.toString(), inode: directoryStat.ino.toString(), name: "swapdir" };

      // Pre-swap: the verified identity no longer matches the object in place.
      const moved = path.join(value.workspace, "swapdir-moved");
      await rename(directory, moved);
      await mkdir(directory);
      await assert.rejects(
        () => runExportEffect({ ...base, components: [component], name: "escape.txt" }),
        (error: unknown) => /identity mismatch/.test(String(error)),
        "a component whose identity changed must be refused",
      );
      assert.deepEqual(await readDirNames(directory), [], "nothing may be created through the swapped ancestor");
      assert.deepEqual(await readDirNames(moved), ["existing.txt"]);

      // Create over an existing entry is refused (no last-writer-wins).
      const freshComponent = {
        device: directoryStat.dev.toString(),
        inode: directoryStat.ino.toString(),
        name: "swapdir-moved",
      };
      await assert.rejects(
        () => runExportEffect({ ...base, components: [freshComponent], name: "existing.txt" }),
        (error: unknown) => /create failed/.test(String(error)),
      );

      // Replace with a wrong leaf identity is refused.
      await assert.rejects(
        () =>
          runExportEffect({
            ...base,
            components: [freshComponent],
            operation: "replace",
            leafDevice: "1",
            leafInode: "2",
            name: "existing.txt",
          }),
        (error: unknown) => /identity mismatch/.test(String(error)),
      );

      // Replace of a hard-linked target is refused.
      const hardStat = await lstat(linkTarget, { bigint: true });
      await assert.rejects(
        () =>
          runExportEffect({
            ...base,
            components: [],
            operation: "replace",
            leafDevice: hardStat.dev.toString(),
            leafInode: hardStat.ino.toString(),
            name: "hardlinked.txt",
          }),
        (error: unknown) => /nlink != 1/.test(String(error)),
      );

      // A symlinked component is refused by the per-component open.
      const symlinkPath = path.join(value.workspace, "linkdir");
      await symlink(moved, symlinkPath);
      await assert.rejects(
        () => runExportEffect({ ...base, components: [{ ...freshComponent, name: "linkdir" }], name: "x.txt" }),
        (error: unknown) => /component open/.test(String(error)),
      );

      // A verified create still works through the same helper.
      const created = await runExportEffect({
        ...base,
        components: [{ ...freshComponent, name: "swapdir-moved" }],
        name: "created.txt",
      });
      assert.equal(created.nlink, "1");
      assert.equal(await readFile(path.join(moved, "created.txt"), "utf8"), "payload\n");
    } finally {
      await rootHandle.close();
    }
  } finally {
    await value.cleanup();
  }
});

async function readDirNames(directory: string): Promise<string[]> {
  return (await readdir(directory)).sort();
}

test("a post-verification ancestor swap still lands in the verified directory", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("post-swap");
  try {
    const directory = path.join(value.workspace, "swapdir");
    await mkdir(directory);
    const rootHandle = await open(value.workspace, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const rootStat = await rootHandle.stat({ bigint: true });
    const directoryStat = await lstat(directory, { bigint: true });
    try {
      const child = spawn(helperPath, ["export", "--root-fd", "3", "--pause"], {
        stdio: ["pipe", "pipe", "pipe", rootHandle.fd],
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      // The helper receives the whole request (head plus payload), verifies
      // the chain, and only then stops at the barrier — before the effect.
      child.stdin?.write(
        [
          "PROTOCOL 2",
          `ROOT ${rootStat.dev} ${rootStat.ino}`,
          `COMP ${directoryStat.dev} ${directoryStat.ino} swapdir`,
          "OP create",
          "LEAF 0 0 420 bound.txt",
          "SIZE 6",
          "",
        ].join("\n") + "bound\n",
      );
      const armed = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 10_000);
        child.stdout?.on("data", () => {
          if (stdout.includes("ARMED")) {
            clearTimeout(timer);
            resolve(true);
          }
        });
      });
      assert.equal(armed, true, `the helper must reach the pause barrier (stderr: ${stderr})`);

      // Swap the verified parent for an attacker-controlled directory while
      // the helper holds the verified descriptor.
      const moved = path.join(value.workspace, "swapdir-moved");
      await rename(directory, moved);
      await mkdir(directory);

      // One release line ends the barrier; the payload was already received.
      child.stdin?.end("GO\n");
      const exitCode = await new Promise<number | null>((resolve) => child.on("close", resolve));
      assert.equal(exitCode, 0, `helper exit ${exitCode}: ${stderr}`);
      assert.deepEqual(await readDirNames(directory), [], "the attacker directory must receive nothing");
      assert.deepEqual(await readDirNames(moved), ["bound.txt"], "the effect follows the verified descriptor");
    } finally {
      await rootHandle.close();
    }
  } finally {
    await value.cleanup();
  }
});

test("child-created symlinks cannot trick export", { skip, timeout: 180_000 }, async () => {
  const value = await fixture("export-tricks");
  try {
    await writeFile(path.join(value.workspace, "safe.txt"), "safe\n");
    await writeFile(path.join(value.workspace, "target.txt"), "target\n");
    const { output, result } = await runContained(
      value,
      [
        "ln -s target.txt trick-link && echo LINK-CREATED",
        "printf 'rewritten\\n' > safe.txt",
      ].join("\n"),
    );
    const refusedPaths = result.export.refusals.map((refusal) => refusal.relativePath);
    assert.ok(output.includes("LINK-CREATED"), `the child must create the symlink for this test to bite: ${output}`);
    assert.ok(refusedPaths.includes("trick-link"), "a child-created symlink is refused");
    assert.ok(!result.export.applied.some((effect) => effect.relativePath === "trick-link"));
    assert.ok(!existsSync(path.join(value.workspace, "trick-link")));
    // The run itself stays exportable: the freeze succeeded, so the scan's
    // per-entry refusals are reachable (a hard link would have refused the
    // freeze first — that path is covered by the freeze-failure test).
    assert.ok(result.export.exported);
  } finally {
    await value.cleanup();
  }
});

test("a refused effect never mutates the host object", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("refusal-safety");
  const original = "ORIGINAL CONTENT\n";
  try {
    const target = path.join(value.workspace, "data.txt");
    await writeFile(target, original);
    const rootHandle = await open(value.workspace, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const rootStat = await rootHandle.stat({ bigint: true });
    const targetStat = await lstat(target, { bigint: true });
    try {
      // A large payload against a helper that refuses (wrong root identity)
      // must not crash the host and must not write anything.
      const large = Buffer.alloc(300 * 1024, 0x41);
      await assert.rejects(
        () =>
          runExportEffect({
            helperPath,
            rootFd: rootHandle.fd,
            rootDevice: rootStat.dev.toString(),
            rootInode: (BigInt(rootStat.ino) + 1n).toString(),
            components: [],
            operation: "create",
            leafDevice: "0",
            leafInode: "0",
            mode: 0o644,
            name: "large.txt",
            payload: large,
            timeoutMs: 20_000,
          }),
        (error: unknown) => error instanceof ShellRefusal,
      );
      assert.deepEqual(await readDirNames(value.workspace), ["data.txt"], "a refused effect writes nothing");

      // A short payload must be detected before the effect, so a refused
      // replace leaves the existing target intact.
      const child = spawn(helperPath, ["export", "--root-fd", "3"], {
        stdio: ["pipe", "pipe", "pipe", rootHandle.fd],
      });
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.stdin?.on("error", () => undefined);
      child.stdin?.end(
        [
          "PROTOCOL 2",
          `ROOT ${rootStat.dev} ${rootStat.ino}`,
          "OP replace",
          `LEAF ${targetStat.dev} ${targetStat.ino} 420 data.txt`,
          "SIZE 100000",
          "",
        ].join("\n") + "short",
      );
      const exitCode = await new Promise<number | null>((resolve) => child.on("close", resolve));
      assert.equal(exitCode, 3, `a short payload must be refused (stderr: ${stderr})`);
      assert.match(stderr, /payload shorter than declared size/);
      assert.equal(await readFile(target, "utf8"), original, "a refused replace must not truncate the target");
      assert.equal((await lstat(target)).size, Buffer.byteLength(original));
    } finally {
      await rootHandle.close();
    }
  } finally {
    await value.cleanup();
  }
});

test("a prepared invocation is disposed without leaving writable authority", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("dispose");
  try {
    await writeFile(path.join(value.workspace, "a.txt"), "a\n");
    const resolved = await resolveWorkspacePath(value.workspace, ".");
    const loaded = await loadOperationPolicySources(resolved, value.userRoot);
    const prepared = await prepareContainedInvocation({
      command: "ls",
      workspaceRoot: value.workspace,
      loaded,
      protectedZones: [],
      trustedUserConfigRoot: value.userRoot,
      helperPath,
      buildManifestPath,
      sealedInputs: [],
    });
    const staging = prepared.paths.staging;
    assert.ok(existsSync(staging));
    assert.ok(existsSync(prepared.paths.sealed));
    await prepared.dispose();
    assert.ok(!existsSync(staging), "invocation artifacts must be removed");
    assert.ok(!existsSync(prepared.paths.base));
  } finally {
    await value.cleanup();
  }
});

test("mode change on an existing file is exported through the bound descriptor", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("mode");
  try {
    const script = path.join(value.workspace, "script.sh");
    await writeFile(script, "#!/bin/sh\necho hi\n");
    await chmod(script, 0o644);
    const { result } = await runContained(value, "chmod 755 script.sh && printf 'ran\\n' >> script.sh");
    assert.equal(result.exitCode, 0);
    const stat = await lstat(script);
    assert.equal(stat.mode & 0o777, 0o755, "the exported mode follows the projection");
    assert.ok((await readFile(script, "utf8")).includes("ran"));
  } finally {
    await value.cleanup();
  }
});

test("per-target export authorization binds to the bytes actually applied", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("auth-binding");
  try {
    await writeFile(path.join(value.workspace, "data.txt"), "original\n");
    const captured: { relativePath: string; kind: string; payload: string; sha256: string }[] = [];
    const { result } = await runContained(value, 'printf "authorized-bytes\\n" > data.txt', async (change) => {
      const full = change as { relativePath: string; kind: string; payload: Buffer; sha256: string | null };
      captured.push({
        relativePath: full.relativePath,
        kind: full.kind,
        payload: full.payload.toString("utf8"),
        sha256: full.sha256 ?? "",
      });
      return { decision: "ALLOW", reason: "evidence-allow" };
    });
    assert.equal(result.exitCode, 0);

    const recorded = captured.find((entry) => entry.relativePath === "data.txt");
    assert.ok(recorded, "the authorizer must see the data.txt effect");
    assert.equal(recorded.kind, "replace");
    // The authorization decision is made on the exact captured payload bytes.
    assert.equal(recorded.payload, "authorized-bytes\n", "authorization must see the captured bytes");
    assert.equal(
      recorded.sha256,
      createHash("sha256").update("authorized-bytes\n").digest("hex"),
      "the authorized digest must be the digest of the captured payload",
    );

    const applied = result.export.applied.find((effect) => effect.relativePath === "data.txt");
    assert.ok(applied, "the replace effect must be applied");
    assert.equal(applied.sha256, recorded.sha256, "the applied effect must carry the authorized digest");

    const hostDigest = createHash("sha256")
      .update(await readFile(path.join(value.workspace, "data.txt")))
      .digest("hex");
    assert.equal(hostDigest, recorded.sha256, "the host object must contain exactly the authorized bytes");
  } finally {
    await value.cleanup();
  }
});
