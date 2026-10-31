import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { verifyPlatform } from "../src/sandbox/containment.ts";
import { ShellRefusal } from "../src/sandbox/errors.ts";
import { defaultHelperPath, spawnContainedProcess } from "../src/sandbox/helper.ts";

const skip = process.platform === "darwin" ? false : "declared macOS target only";

test("the approved platform still refuses missing and corrupted native helpers", { skip }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "perimeter-platform-helper-"));
  try {
    const helper = path.join(root, "helper");
    const manifest = path.join(root, "manifest.json");
    await assert.rejects(verifyPlatform(helper, manifest),
      (error: unknown) => error instanceof ShellRefusal && error.code === "HELPER_MISSING");
    const original = Buffer.from("synthetic helper");
    await writeFile(helper, Buffer.from("corrupted helper"));
    await chmod(helper, 0o700);
    await writeFile(manifest, JSON.stringify({ protocol: 2, arch: process.arch,
      outputSha256: createHash("sha256").update(original).digest("hex"), outputSize: original.length }));
    await assert.rejects(verifyPlatform(helper, manifest),
      (error: unknown) => error instanceof ShellRefusal && error.code === "HELPER_UNTRUSTED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a real sandbox initialization failure never executes the requested command", { skip, timeout: 15_000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "perimeter-platform-launch-"));
  try {
    const profile = path.join(root, "invalid.sb");
    const marker = path.join(root, "must-not-exist");
    await writeFile(profile, "deliberately invalid Seatbelt profile");
    await mkdir(path.join(root, "home"));
    const child = spawnContainedProcess({
      helperPath: defaultHelperPath(process.cwd()), profilePath: profile,
      shellPath: "/bin/bash", command: "printf MUST_NOT_EXECUTE > must-not-exist", cwd: root,
      environment: { PATH: "/usr/bin:/bin", HOME: path.join(root, "home"), TMPDIR: root },
    });
    let output = "";
    child.stdout?.on("data", chunk => { output += chunk.toString(); });
    child.stderr?.on("data", chunk => { output += chunk.toString(); });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.notEqual(code, 0, output);
    assert.match(output, /sandbox-exec/);
    assert.equal(existsSync(marker), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
