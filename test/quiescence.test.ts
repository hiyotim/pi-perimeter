import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { chmod, link, lstat, mkdir, mkdtemp, open, readFile, readdir, readlink, rename, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { attributeInvocationProcesses, survivingInvocationProcesses, type ProcessTable } from "../src/sandbox/census.ts";
import { ShellRefusal } from "../src/sandbox/errors.ts";
import { FREEZE_LIMITS, freezeProjection, type FreezePauseRecord, type FreezeResult } from "../src/sandbox/freeze.ts";
import { HELPER_PROTOCOL_VERSION } from "../src/sandbox/helper.ts";
import {
  establishTreeQuiescence,
  QUIESCENCE_LIMITS,
  snapshotDeviation,
  snapshotProjection,
} from "../src/sandbox/quiescence.ts";

async function scratch(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(tmpdir(), "piw-quiescence-"));
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function record(pid: number, ppid: number, pgid: number, startSec = 1, startUsec = 1) {
  return Object.freeze({ pid, ppid, pgid, uid: 501, startSec, startUsec });
}

function table(...records: ReturnType<typeof record>[]): ProcessTable {
  return new Map(records.map((entry) => [entry.pid, entry]));
}

test("census attributes the group, the entry's children and their descendants", () => {
  const sample = table(
    record(100, 1, 100), // entry, group leader
    record(101, 100, 100), // child in the group
    record(200, 101, 200), // detached grandchild (own group)
    record(300, 200, 300), // great-grandchild
    record(900, 1, 900), // unrelated process
  );
  const attributed = attributeInvocationProcesses(sample, { entryPid: 100, processGroupId: 100 });
  assert.deepEqual(
    attributed.map((entry) => entry.pid).sort((left, right) => left - right),
    [100, 101, 200, 300],
  );
});

test("census never attributes the observing host process and needs no lineage to a classified pid", () => {
  const sample = table(record(500, 1, 500), record(600, 500, 600));
  const attributed = attributeInvocationProcesses(sample, { entryPid: 100, processGroupId: 100 });
  assert.deepEqual(attributed, []);
});

test("survivor detection requires a matching start time, so pid reuse is not a survivor", () => {
  const recorded = [record(100, 1, 100, 10, 5)];
  assert.equal(survivingInvocationProcesses(recorded, table(record(100, 1, 100, 10, 5))).length, 1);
  assert.equal(
    survivingInvocationProcesses(recorded, table(record(100, 1, 100, 11, 0))).length,
    0,
    "a reused pid with a different start time is not the same process",
  );
  assert.equal(survivingInvocationProcesses(recorded, table()).length, 0);
});

/**
 * Measurement and freeze tests use the real native helper on the declared
 * target; elsewhere they are skipped like the contained evidence suite.
 */
const darwin = process.platform === "darwin";
const skipHelper = darwin ? false : ("declared macOS target only" as const);
const helperPath = path.join(process.cwd(), "native", "piwarden-helper");

test("the stability snapshot detects content, entry-set, mode and symlink changes", { skip: skipHelper }, async () => {
  const scratchRoot = await scratch();
  try {
    const root = path.join(scratchRoot.root, "tree");
    await mkdir(root);
    await writeFile(path.join(root, "a.txt"), "one\n");
    await mkdir(path.join(root, "sub"));
    await writeFile(path.join(root, "sub", "b.txt"), "two\n");
    await symlink("a.txt", path.join(root, "link"));

    const first = await snapshotProjection({ stagingRoot: root, helperPath });
    assert.equal(snapshotDeviation(first, await snapshotProjection({ stagingRoot: root, helperPath })).length, 0);

    await writeFile(path.join(root, "a.txt"), "one-changed\n");
    assert.deepEqual(snapshotDeviation(first, await snapshotProjection({ stagingRoot: root, helperPath })), ["a.txt: changed"]);

    const second = await snapshotProjection({ stagingRoot: root, helperPath });
    await writeFile(path.join(root, "added.txt"), "new\n");
    assert.deepEqual(snapshotDeviation(second, await snapshotProjection({ stagingRoot: root, helperPath })), ["added.txt: added"]);

    const third = await snapshotProjection({ stagingRoot: root, helperPath });
    await rm(path.join(root, "added.txt"));
    assert.deepEqual(snapshotDeviation(third, await snapshotProjection({ stagingRoot: root, helperPath })), ["added.txt: removed"]);

    const fourth = await snapshotProjection({ stagingRoot: root, helperPath });
    await chmod(path.join(root, "sub", "b.txt"), 0o600);
    assert.deepEqual(snapshotDeviation(fourth, await snapshotProjection({ stagingRoot: root, helperPath })), ["sub/b.txt: changed"]);

    const fifth = await snapshotProjection({ stagingRoot: root, helperPath });
    await rm(path.join(root, "link"));
    await symlink("other.txt", path.join(root, "link"));
    assert.deepEqual(snapshotDeviation(fifth, await snapshotProjection({ stagingRoot: root, helperPath })), ["link: changed"]);
  } finally {
    await scratchRoot.cleanup();
  }
});

test("quiescence refuses while the group has members and when it gains one", { skip: skipHelper }, async () => {
  const scratchRoot = await scratch();
  try {
    await writeFile(path.join(scratchRoot.root, "a.txt"), "one\n");
    const neverEmpty = await establishTreeQuiescence({
      stagingRoot: scratchRoot.root,
      helperPath,
      killGroup: () => undefined,
      processGroupHasMembers: async () => true,
      survivors: async () => Object.freeze([]),
      sleep: async () => undefined,
      limits: { killTimeoutMs: 0, quietWindowMs: 0, quietRounds: 1 }
    });
    assert.equal(neverEmpty.quiescent, false);
    assert.match(neverEmpty.detail, /process group still has members/);

    let samples = 0;
    const regrows = await establishTreeQuiescence({
      stagingRoot: scratchRoot.root,
      helperPath,
      killGroup: () => undefined,
      processGroupHasMembers: async () => {
        samples += 1;
        return samples > 1;
      },
      survivors: async () => Object.freeze([]),
      sleep: async () => undefined,
      limits: { quietWindowMs: 0, quietRounds: 2 }
    });
    assert.equal(regrows.quiescent, false);
    assert.match(regrows.detail, /gained a member/);
  } finally {
    await scratchRoot.cleanup();
  }
});

test("quiescence refuses an attributed survivor and attempts to kill it", { skip: skipHelper }, async () => {
  const scratchRoot = await scratch();
  try {
    await writeFile(path.join(scratchRoot.root, "a.txt"), "one\n");
    const killed: number[] = [];
    const result = await establishTreeQuiescence({
      stagingRoot: scratchRoot.root,
      helperPath,
      killGroup: () => undefined,
      processGroupHasMembers: async () => false,
      survivors: async () => Object.freeze([{ pid: 4242 }]),
      killSurvivors: (records) => killed.push(...records.map((entry) => entry.pid)),
      sleep: async () => undefined,
      limits: { quietWindowMs: 0, quietRounds: 1 }
    });
    assert.equal(result.quiescent, false);
    assert.match(result.detail, /attributed invocation process survived/);
    assert.deepEqual(result.survivors, [4242]);
    assert.deepEqual(killed, [4242], "an attributed survivor is killed as well as refused");
  } finally {
    await scratchRoot.cleanup();
  }
});

test("quiescence refuses a projection that changes after the entry process exited", { skip: skipHelper }, async () => {
  const scratchRoot = await scratch();
  try {
    const root = path.join(scratchRoot.root, "tree");
    await mkdir(root);
    await writeFile(path.join(root, "data.txt"), "original\n");
    let rounds = 0;
    const result = await establishTreeQuiescence({
      stagingRoot: root,
      helperPath,
      killGroup: () => undefined,
      processGroupHasMembers: async () => false,
      survivors: async () => Object.freeze([]),
      sleep: async () => {
        rounds += 1;
        // A surviving writer modifies the projection during the window.
        await writeFile(path.join(root, "data.txt"), `write-${rounds}\n`);
      },
      limits: { quietWindowMs: 0, quietRounds: 2 }
    });
    assert.equal(result.quiescent, false);
    assert.match(result.detail, /projection changed after the entry process exited/);
    assert.ok(result.deviations.includes("data.txt: changed"));
  } finally {
    await scratchRoot.cleanup();
  }
});

test("quiescence succeeds only with an empty group, no survivor and a stable projection", { skip: skipHelper }, async () => {
  const scratchRoot = await scratch();
  try {
    const root = path.join(scratchRoot.root, "tree");
    await mkdir(root);
    await writeFile(path.join(root, "data.txt"), "original\n");
    const result = await establishTreeQuiescence({
      stagingRoot: root,
      helperPath,
      killGroup: () => undefined,
      processGroupHasMembers: async () => false,
      survivors: async () => Object.freeze([]),
      sleep: async () => undefined,
    });
    assert.equal(result.quiescent, true);
    assert.equal(result.stableRounds, QUIESCENCE_LIMITS.quietRounds);
    assert.ok(result.snapshot !== undefined);
    assert.equal(
      snapshotDeviation(result.snapshot, await snapshotProjection({ stagingRoot: root, helperPath })).length,
      0,
      "the returned snapshot describes the tree that was measured",
    );
  } finally {
    await scratchRoot.cleanup();
  }
});

/**
 * Freeze tests use the real native helper on the declared target; elsewhere
 * they are skipped like the contained evidence suite.
 */
const skipFreeze = skipHelper;

function buildFreezeTree(scratchRoot: { root: string }): Promise<{ source: string; frozen: string }> {
  const source = path.join(scratchRoot.root, "staging");
  const frozen = path.join(scratchRoot.root, "frozen");
  return mkdir(source).then(() => ({ source, frozen }));
}

async function recordStagingIdentity(source: string): Promise<{ device: string; inode: string }> {
  const metadata = await lstat(source, { bigint: true });
  return { device: metadata.dev.toString(), inode: metadata.ino.toString() };
}

/** Raw helper freeze invocation for defense-in-depth checks bypassing the host client. */
function spawnHelperFreeze(
  sourceDevice: string,
  sourceInode: string,
  frozenDevice: string,
  frozenInode: string,
  sourceFd: number,
  targetFd: number,
): Promise<{ entries: number; bytes: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      helperPath,
      ["freeze", "--source-fd", "3", "--target-fd", "4"],
      { stdio: ["pipe", "pipe", "pipe", sourceFd, targetFd] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString("utf8");
    });
    child.stdin?.on("error", () => undefined);
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new ShellRefusal("EXPORT_FAILED", `the export source could not be frozen: ${stderr.trim().split("\n").pop() ?? `exit ${code}`}`));
        return;
      }
      const line = stdout.trim().split("\n").pop() ?? "";
      const match = /^RESULT entries=(\d+) bytes=(\d+)$/.exec(line);
      if (match === null) {
        reject(new ShellRefusal("EXPORT_FAILED", `unusable freeze result: ${line}`));
        return;
      }
      resolve({ entries: Number(match[1]), bytes: Number(match[2]) });
    });
    child.stdin?.end(
      [
        `PROTOCOL ${HELPER_PROTOCOL_VERSION}`,
        `SOURCE ${sourceDevice} ${sourceInode}`,
        `TARGET ${frozenDevice} ${frozenInode}`,
        `LIMITS ${FREEZE_LIMITS.maxEntries} ${FREEZE_LIMITS.maxFileBytes} ${FREEZE_LIMITS.maxTotalBytes} ${FREEZE_LIMITS.maxDepth}`,
        "GO",
        "",
      ].join("\n"),
    );
  });
}

function freeze(
  source: string,
  frozen: string,
  identity: { device: string; inode: string },
  hooks?: { pauseName?: string; onPause?: (armed: FreezePauseRecord) => Promise<void> },
): Promise<FreezeResult> {
  return freezeProjection({
    helperPath,
    sourceRoot: source,
    frozenRoot: frozen,
    stagingDevice: identity.device,
    stagingInode: identity.inode,
    pauseName: hooks?.pauseName,
    onPause: hooks?.onPause,
    timeoutMs: 60_000,
  });
}

test("the frozen export source is independent of later writes to the projection", { skip: skipFreeze }, async () => {
  const scratchRoot = await scratch();
  try {
    const { source, frozen } = await buildFreezeTree(scratchRoot);
    await mkdir(path.join(source, "sub"), { recursive: true });
    await writeFile(path.join(source, "data.txt"), "stable\n");
    await writeFile(path.join(source, "sub", "tool.sh"), "#!/bin/sh\n");
    await chmod(path.join(source, "sub", "tool.sh"), 0o755);
    await symlink("data.txt", path.join(source, "link"));

    const identity = await recordStagingIdentity(source);
    const result = await freeze(source, frozen, identity);
    assert.equal(result.entries, 4);

    // A surviving writer can only touch the projection; the frozen copy — and
    // therefore everything the export reads — does not move.
    await writeFile(path.join(source, "data.txt"), "tampered\n");
    await rm(path.join(source, "sub", "tool.sh"));
    await writeFile(path.join(source, "added.txt"), "new\n");

    assert.equal(await readFile(path.join(frozen, "data.txt"), "utf8"), "stable\n");
    assert.equal(await readFile(path.join(frozen, "sub", "tool.sh"), "utf8"), "#!/bin/sh\n");
    assert.equal(await readlink(path.join(frozen, "link")), "data.txt");
    await assert.rejects(() => readFile(path.join(frozen, "added.txt"), "utf8"));
    const frozenStat = await lstat(path.join(frozen, "sub", "tool.sh"));
    assert.equal(frozenStat.mode & 0o777, 0o755, "the frozen copy preserves the projected mode");
  } finally {
    await scratchRoot.cleanup();
  }
});

test("the freeze refuses objects that are not safely copyable", { skip: skipFreeze }, async () => {
  const scratchRoot = await scratch();
  try {
    const { source } = await buildFreezeTree(scratchRoot);
    await writeFile(path.join(source, "a.txt"), "one\n");
    await link(path.join(source, "a.txt"), path.join(source, "b.txt"));
    const identity = await recordStagingIdentity(source);
    await assert.rejects(
      () => freeze(source, path.join(scratchRoot.root, "frozen-hard"), identity),
      (error: unknown) => error instanceof ShellRefusal && /nlink != 1/.test(error.detail),
    );
  } finally {
    await scratchRoot.cleanup();
  }
});

test("the freeze verifies the recorded staging-root identity", { skip: skipFreeze }, async () => {
  const scratchRoot = await scratch();
  try {
    const { source, frozen } = await buildFreezeTree(scratchRoot);
    await writeFile(path.join(source, "data.txt"), "stable\n");
    await assert.rejects(
      () =>
        freezeProjection({
          helperPath,
          sourceRoot: source,
          frozenRoot: frozen,
          stagingDevice: "1",
          stagingInode: "1",
          timeoutMs: 60_000,
        }),
      (error: unknown) => error instanceof ShellRefusal && /projection root identity changed/.test(error.detail),
    );
  } finally {
    await scratchRoot.cleanup();
  }
});

test(
  "a mid-freeze swap of a directory for an external secret is refused at access time (blocker regression)",
  { skip: skipFreeze, timeout: 120_000 },
  async () => {
    const scratchRoot = await scratch();
    try {
      const { source, frozen } = await buildFreezeTree(scratchRoot);
      await mkdir(path.join(source, "sub"), { recursive: true });
      await writeFile(path.join(source, "sub", "inner.txt"), "stable\n");
      // External synthetic secret the child could never read but a path-following
      // host copy would import through a swapped symlink.
      const secretDirectory = path.join(scratchRoot.root, "external-secret");
      await mkdir(secretDirectory);
      await writeFile(path.join(secretDirectory, "secret.txt"), "SYNTHETIC-SECRET-BYTES\n");

      const before = await snapshotProjection({
        stagingRoot: source,
        helperPath,
        expectedRoot: await recordStagingIdentity(source),
      });
      const identity = await recordStagingIdentity(source);
      await assert.rejects(
        () =>
          freeze(source, path.join(scratchRoot.root, "frozen"), identity, {
            pauseName: "sub",
            onPause: async (armed) => {
              assert.equal(armed.relativePath, "sub");
              // Swap: preserve the original object, put a symlink to the
              // external secret fixture in its place.
              await rename(path.join(source, "sub"), path.join(source, "sub-kept"));
              await symlink(secretDirectory, path.join(source, "sub"));
            },
          }),
        (error: unknown) => {
          assert.ok(error instanceof ShellRefusal, `expected ShellRefusal, got ${String(error)}`);
          assert.match(error.detail, /was replaced while being frozen|could not be opened for freezing/);
          return true;
        },
      );

      // Restore the projection exactly as the attacker would.
      await rm(path.join(source, "sub"));
      await rename(path.join(source, "sub-kept"), path.join(source, "sub"));

      // The measured tree is blind to the completed swap: the protection is
      // the access-time descriptor binding, not the re-measurement.
      assert.deepEqual(
        snapshotDeviation(
          before,
          await snapshotProjection({
            stagingRoot: source,
            helperPath,
            expectedRoot: await recordStagingIdentity(source),
          }),
        ),
        [],
      );

      // The external secret never entered the frozen source.
      const collected: string[] = [];
      const walk = async (directory: string): Promise<void> => {
        for (const child of await readdir(directory, { withFileTypes: true })) {
          const childPath = path.join(directory, child.name);
          if (child.isDirectory()) await walk(childPath);
          else if (child.isFile()) collected.push(await readFile(childPath, "utf8"));
        }
      };
      await walk(path.join(scratchRoot.root, "frozen"));
      assert.ok(
        collected.every((content) => !content.includes("SYNTHETIC-SECRET")),
        `no frozen byte may come from the external fixture: ${JSON.stringify(collected)}`,
      );
      await assert.rejects(() => readFile(path.join(scratchRoot.root, "frozen", "sub", "secret.txt"), "utf8"));
    } finally {
      await scratchRoot.cleanup();
    }
  },
);

test(
  "a swap to an external symlink inside the measurement window never places external names into the snapshot (blocker regression)",
  { skip: skipHelper, timeout: 120_000 },
  async () => {
    const scratchRoot = await scratch();
    try {
      const source = path.join(scratchRoot.root, "staging");
      await mkdir(source);
      await mkdir(path.join(source, "sub"));
      await writeFile(path.join(source, "sub", "inner.txt"), "stable\n");
      // External synthetic fixture the child could never read but a
      // path-following host measurement would enumerate through a swapped
      // symlink.
      const secretDirectory = path.join(scratchRoot.root, "external-secret");
      await mkdir(secretDirectory);
      await writeFile(path.join(secretDirectory, "SYNTHETIC-SECRET-NAME.txt"), "SYNTHETIC-SECRET-BYTES\n");

      const before = await snapshotProjection({ stagingRoot: source, helperPath });
      let armedSeen = false;
      await assert.rejects(
        () =>
          snapshotProjection({
            stagingRoot: source,
            helperPath,
            pauseName: "sub",
            onPause: async (armed) => {
              armedSeen = true;
              assert.equal(armed.relativePath, "sub");
              // Swap in the measured→opened window: rename the original
              // directory away and place a symlink to the external fixture
              // under its name.
              await rename(path.join(source, "sub"), path.join(source, "sub-kept"));
              await symlink(secretDirectory, path.join(source, "sub"));
            },
          }),
        (error: unknown) => {
          assert.ok(error instanceof ShellRefusal, `expected ShellRefusal, got ${String(error)}`);
          assert.match(error.detail, /could not be opened for measurement|was replaced while being measured/);
          assert.doesNotMatch(error.detail, /SYNTHETIC/, "no external name may appear in the refusal");
          return true;
        },
      );
      assert.ok(armedSeen, "the interleave hook must have been armed");

      // Restore the projection exactly as the attacker would.
      await rm(path.join(source, "sub"));
      await rename(path.join(source, "sub-kept"), path.join(source, "sub"));

      // The measurement is blind to the completed swap: the protection is the
      // access-time descriptor binding, not a re-measurement.
      const after = await snapshotProjection({ stagingRoot: source, helperPath });
      assert.deepEqual(snapshotDeviation(before, after), []);
      for (const entry of [...before.entries, ...after.entries]) {
        assert.ok(!entry.relativePath.includes("SYNTHETIC"), `no external name may appear in the snapshot: ${entry.relativePath}`);
      }
    } finally {
      await scratchRoot.cleanup();
    }
  },
);

test(
  "a projection holding an external symlink is measured as a symlink and never enumerates the outside",
  { skip: skipHelper },
  async () => {
    const scratchRoot = await scratch();
    try {
      const source = path.join(scratchRoot.root, "staging");
      await mkdir(source);
      await mkdir(path.join(source, "sub"));
      await writeFile(path.join(source, "sub", "inner.txt"), "stable\n");
      const secretDirectory = path.join(scratchRoot.root, "external-secret");
      await mkdir(secretDirectory);
      await writeFile(path.join(secretDirectory, "SYNTHETIC-SECRET-NAME.txt"), "SYNTHETIC-SECRET-BYTES\n");

      const before = await snapshotProjection({ stagingRoot: source, helperPath });

      // The swap is already in place when the measurement starts and stays.
      await rename(path.join(source, "sub"), path.join(source, "sub-kept"));
      await symlink(secretDirectory, path.join(source, "sub"));

      const after = await snapshotProjection({ stagingRoot: source, helperPath });
      const swapped = after.entries.find((entry) => entry.relativePath === "sub");
      assert.ok(swapped !== undefined && swapped.kind === "symlink", "the swapped entry is measured as a symlink");
      assert.equal(
        after.entries.some((entry) => entry.relativePath.startsWith("sub/")),
        false,
        "the external directory is never enumerated into the snapshot",
      );
      const deviations = snapshotDeviation(before, after);
      assert.ok(deviations.includes("sub: changed"), `the swap is visible to the next window: ${JSON.stringify(deviations)}`);
      for (const deviation of deviations) {
        assert.doesNotMatch(deviation, /SYNTHETIC/, "no external name may appear in the deviations");
      }
      // Restore the original object.
      await rm(path.join(source, "sub"));
      await rename(path.join(source, "sub-kept"), path.join(source, "sub"));
    } finally {
      await scratchRoot.cleanup();
    }
  },
);

/** Raw helper measure invocation for defense-in-depth checks bypassing the host client. */
function spawnHelperMeasure(
  rootDevice: string,
  rootInode: string,
  rootFd: number,
): Promise<undefined> {
  return new Promise((resolve, reject) => {
    const child = spawn(helperPath, ["measure", "--root-fd", "3"], {
      stdio: ["pipe", "pipe", "pipe", rootFd],
    });
    let stderr = "";
    child.stdout?.on("data", () => undefined);
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString("utf8");
    });
    child.stdin?.on("error", () => undefined);
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new ShellRefusal("EXPORT_FAILED", stderr.trim().split("\n").pop() ?? `exit ${code}`));
        return;
      }
      resolve(undefined);
    });
    child.stdin?.end(
      [
        `PROTOCOL ${HELPER_PROTOCOL_VERSION}`,
        `ROOT ${rootDevice} ${rootInode}`,
        "LIMITS 200000 64",
        "GO",
        "",
      ].join("\n"),
    );
  });
}

test(
  "the measure helper re-verifies the root descriptor itself (defense in depth)",
  { skip: skipHelper },
  async () => {
    const scratchRoot = await scratch();
    try {
      const source = path.join(scratchRoot.root, "staging");
      await mkdir(source);
      await writeFile(path.join(source, "data.txt"), "stable\n");
      const other = path.join(scratchRoot.root, "other");
      await mkdir(other);

      const sourceIdentity = await recordStagingIdentity(source);
      const otherIdentity = await recordStagingIdentity(other);
      const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
      const sourceHandle = await open(source, directoryFlags);
      const otherHandle = await open(other, directoryFlags);
      try {
        // The helper must re-verify the ROOT identity independently of the
        // host: a descriptor that does not match the recorded identity is
        // refused before any walk.
        await assert.rejects(
          spawnHelperMeasure(otherIdentity.device, otherIdentity.inode, sourceHandle.fd),
          (error: unknown) => error instanceof ShellRefusal && /measured root identity mismatch/.test(error.detail),
        );
      } finally {
        await sourceHandle.close().catch(() => undefined);
        await otherHandle.close().catch(() => undefined);
      }
    } finally {
      await scratchRoot.cleanup();
    }
  },
);

test("a size-preserving, mtime-restoring write racing the freeze is not detectable (declared residual)", { skip: skipFreeze }, async () => {
  const scratchRoot = await scratch();
  try {
    const { source } = await buildFreezeTree(scratchRoot);
    const tampered = "bbbbbbbb\n";
    await writeFile(path.join(source, "data.txt"), "aaaaaaaa\n");
    // Pin the modification time to a chosen value so the racing writer can
    // restore exactly the state the identity measurement recorded.
    await utimes(path.join(source, "data.txt"), 1_700_000_000, 1_700_000_000);

    await freezeProjection({
      helperPath,
      sourceRoot: source,
      frozenRoot: path.join(scratchRoot.root, "frozen"),
      stagingDevice: (await recordStagingIdentity(source)).device,
      stagingInode: (await recordStagingIdentity(source)).inode,
      pauseName: "data.txt",
      onPause: async (armed) => {
        assert.equal(armed.relativePath, "data.txt");
        const target = path.join(source, "data.txt");
        const handle = await open(target, "r+");
        try {
          assert.equal((await handle.write(Buffer.from(tampered), 0, tampered.length, 0)).bytesWritten, tampered.length);
        } finally {
          await handle.close();
        }
        await utimes(target, 1_700_000_000, 1_700_000_000);
      },
      timeoutMs: 60_000,
    });

    // The declared residual: the freeze completes and the frozen bytes are the
    // racing writer's bytes. The export is not an atomic snapshot; the applied
    // content stays child-controlled output bound by digest to per-target
    // re-authorization (proved by the authorization-binding evidence test).
    assert.equal(await readFile(path.join(scratchRoot.root, "frozen", "data.txt"), "utf8"), tampered);
  } finally {
    await scratchRoot.cleanup();
  }
});

test("a file substituted during the freeze is refused by the per-object identity check", { skip: skipFreeze }, async () => {
  const scratchRoot = await scratch();
  try {
    const { source } = await buildFreezeTree(scratchRoot);
    await writeFile(path.join(source, "data.txt"), "stable\n");
    const identity = await recordStagingIdentity(source);
    await assert.rejects(
      () =>
        freezeProjection({
          helperPath,
          sourceRoot: source,
          frozenRoot: path.join(scratchRoot.root, "frozen"),
          stagingDevice: identity.device,
          stagingInode: identity.inode,
          pauseName: "data.txt",
          onPause: async () => {
            const substitute = path.join(scratchRoot.root, "substitute.tmp");
            await writeFile(substitute, "substituted\n");
            await rename(substitute, path.join(source, "data.txt"));
          },
          timeoutMs: 60_000,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ShellRefusal, `expected ShellRefusal, got ${String(error)}`);
        assert.match(error.detail, /was replaced while being frozen/);
        return true;
      },
    );
    // The substituted content never entered the frozen source.
    await assert.rejects(() => readFile(path.join(scratchRoot.root, "frozen", "data.txt"), "utf8"));
  } finally {
    await scratchRoot.cleanup();
  }
});

test("a directory replaced by a file during the freeze is refused", { skip: skipFreeze }, async () => {
  const scratchRoot = await scratch();
  try {
    const { source } = await buildFreezeTree(scratchRoot);
    await mkdir(path.join(source, "sub"), { recursive: true });
    await writeFile(path.join(source, "sub", "inner.txt"), "stable\n");
    const identity = await recordStagingIdentity(source);
    await assert.rejects(
      () =>
        freezeProjection({
          helperPath,
          sourceRoot: source,
          frozenRoot: path.join(scratchRoot.root, "frozen"),
          stagingDevice: identity.device,
          stagingInode: identity.inode,
          pauseName: "sub",
          onPause: async () => {
            await rm(path.join(source, "sub"), { recursive: true, force: true });
            await writeFile(path.join(source, "sub"), "now a file\n");
          },
          timeoutMs: 60_000,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ShellRefusal, `expected ShellRefusal, got ${String(error)}`);
        assert.match(error.detail, /could not be opened for freezing/);
        return true;
      },
    );
    // The substituted path never becomes a frozen directory: the refusal fires
    // at access time, before anything under it is copied.
    await assert.rejects(() => readdir(path.join(scratchRoot.root, "frozen", "sub")));
  } finally {
    await scratchRoot.cleanup();
  }
});

test(
  "the freeze helper re-verifies both root descriptors itself (defense in depth)",
  { skip: skipFreeze },
  async () => {
    const scratchRoot = await scratch();
    try {
      const { source } = await buildFreezeTree(scratchRoot);
      await writeFile(path.join(source, "data.txt"), "stable\n");
      const other = path.join(scratchRoot.root, "other");
      await mkdir(other);

      const sourceIdentity = await recordStagingIdentity(source);
      const otherIdentity = await recordStagingIdentity(other);
      const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
      const sourceHandle = await open(source, directoryFlags);
      const otherHandle = await open(other, directoryFlags);
      try {
        // The helper must re-verify the SOURCE identity independently of the
        // host: a source descriptor that does not match the recorded staging
        // identity is refused before any walk.
        const mismatch = spawnHelperFreeze(
          sourceIdentity.device,
          sourceIdentity.inode,
          otherIdentity.device,
          otherIdentity.inode,
          otherHandle.fd,
          otherHandle.fd,
        );
        await assert.rejects(
          mismatch,
          (error: unknown) => error instanceof ShellRefusal && /source identity mismatch/.test(error.detail),
        );
      } finally {
        await sourceHandle.close().catch(() => undefined);
        await otherHandle.close().catch(() => undefined);
      }
    } finally {
      await scratchRoot.cleanup();
    }
  },
);
