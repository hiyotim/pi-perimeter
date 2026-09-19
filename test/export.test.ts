import assert from "node:assert/strict";
import { chmod, link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createProtectedZone } from "../src/policy/control-plane.ts";
import { loadOperationPolicySources } from "../src/policy/config-loader.ts";
import { resolveWorkspacePath } from "../src/policy/paths.ts";
import { applyExportChanges, scanProjection, type ScanOptions } from "../src/sandbox/export.ts";
import { runExportEffect } from "../src/sandbox/helper.ts";
import { importWorkspace } from "../src/sandbox/projection.ts";
import { ShellRefusal } from "../src/sandbox/errors.ts";

interface Fixture {
  readonly root: string;
  readonly workspace: string;
  readonly staging: string;
  readonly manifest: ScanOptions["manifest"];
  cleanup: () => Promise<void>;
}

async function projectFixture(populate: (workspace: string) => Promise<void>): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "piw-export-"));
  const workspace = path.join(root, "workspace");
  const staging = path.join(root, "staging");
  const userRoot = path.join(root, "user");
  await mkdir(workspace);
  await mkdir(userRoot);
  await populate(workspace);
  const resolved = await resolveWorkspacePath(workspace, ".");
  const loaded = await loadOperationPolicySources(resolved, userRoot);
  const manifest = await importWorkspace({
    workspaceRoot: workspace,
    stagingRoot: staging,
    loaded,
    protectedZones: [],
    excludedDirectoryNames: [".git"],
    excludedRelativeRoots: [".pi-warden"],
  });
  return { root, workspace, staging, manifest, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function scanOptions(fixture: Fixture, overrides: Partial<ScanOptions> = {}): ScanOptions {
  return {
    stagingRoot: fixture.staging,
    manifest: fixture.manifest,
    excludedDirectoryNames: [".git"],
    excludedRelativeRoots: [".pi-warden"],
    protectedZones: [],
    workspaceRoot: fixture.workspace,
    ...overrides,
  };
}

test("export scans distinguish replaced, created and unchanged objects", async () => {
  const fixture = await projectFixture(async (workspace) => {
    await writeFile(path.join(workspace, "data.txt"), "one\n");
    await writeFile(path.join(workspace, "same.txt"), "same\n");
  });
  try {
    await writeFile(path.join(fixture.staging, "data.txt"), "one\ntwo\n");
    await mkdir(path.join(fixture.staging, "dist"));
    await writeFile(path.join(fixture.staging, "dist", "out.json"), "{}\n");
    const scan = await scanProjection(scanOptions(fixture));
    const byPath = new Map(scan.changes.map((change) => [change.relativePath, change]));
    assert.equal(byPath.get("data.txt")?.kind, "replace");
    assert.equal(byPath.get("data.txt")?.payload.toString("utf8"), "one\ntwo\n");
    assert.equal(byPath.get("dist")?.kind, "mkdir");
    assert.equal(byPath.get("dist/out.json")?.kind, "create");
    assert.equal(byPath.has("same.txt"), false, "an unchanged file produces no effect");
    assert.equal(scan.unchanged, 1);
    assert.deepEqual(scan.refusals, []);
    // Directories are ordered before their children.
    // Effects are ordered by depth so a created directory precedes its
    // children; siblings follow the deterministic path order.
    assert.deepEqual(
      scan.changes.map((change) => change.relativePath),
      ["data.txt", "dist", "dist/out.json"],
    );
  } finally {
    await fixture.cleanup();
  }
});

test("deletions and renames inside the projection have no host effect", async () => {
  const fixture = await projectFixture(async (workspace) => {
    await writeFile(path.join(workspace, "keep.txt"), "keep\n");
    await writeFile(path.join(workspace, "gone.txt"), "gone\n");
  });
  try {
    await rm(path.join(fixture.staging, "gone.txt"));
    await writeFile(path.join(fixture.staging, "renamed.txt"), "gone\n");
    const scan = await scanProjection(scanOptions(fixture));
    assert.deepEqual(scan.removedInProjection, ["gone.txt"]);
    assert.equal(scan.changes.length, 1);
    assert.equal(scan.changes[0].relativePath, "renamed.txt");
    assert.equal(scan.changes[0].kind, "create");
  } finally {
    await fixture.cleanup();
  }
});

test("child-created symlinks, hard links and type changes are refused at export", async () => {
  const fixture = await projectFixture(async (workspace) => {
    await writeFile(path.join(workspace, "plain.txt"), "plain\n");
    await writeFile(path.join(workspace, "swap.txt"), "swap\n");
    await mkdir(path.join(workspace, "was-dir"));
    await symlink("plain.txt", path.join(workspace, "kept-link.txt"));
  });
  try {
    await symlink("/etc/passwd", path.join(fixture.staging, "exfil-link"));
    await link(path.join(fixture.staging, "plain.txt"), path.join(fixture.staging, "hard-alias.txt"));
    await rm(path.join(fixture.staging, "swap.txt"));
    await writeFile(path.join(fixture.staging, "swap.txt"), "now a file\n");
    await rm(path.join(fixture.staging, "was-dir"), { recursive: true });
    await writeFile(path.join(fixture.staging, "was-dir"), "file where a directory was\n");
    await rm(path.join(fixture.staging, "kept-link.txt"));
    await symlink("elsewhere.txt", path.join(fixture.staging, "kept-link.txt"));

    const scan = await scanProjection(scanOptions(fixture));
    const refused = new Map(scan.refusals.map((refusal) => [refusal.relativePath, refusal.reason]));
    assert.match(refused.get("exfil-link") ?? "", /symlinks created/);
    assert.match(refused.get("hard-alias.txt") ?? "", /nlink != 1/);
    assert.match(refused.get("was-dir") ?? "", /changed type/);
    assert.match(refused.get("kept-link.txt") ?? "", /symlink target changed/);
    assert.ok(
      !scan.changes.some((change) => change.relativePath === "exfil-link"),
      "a refused symlink never becomes an effect",
    );
  } finally {
    await fixture.cleanup();
  }
});

test("excluded and protected paths are refused even when the child creates them", async () => {
  const fixture = await projectFixture(async (workspace) => {
    await writeFile(path.join(workspace, "ordinary.txt"), "ordinary\n");
  });
  try {
    await mkdir(path.join(fixture.staging, ".git", "hooks"), { recursive: true });
    await writeFile(path.join(fixture.staging, ".git", "hooks", "pre-commit"), "#!/bin/sh\n");
    await mkdir(path.join(fixture.staging, ".pi-warden"));
    await writeFile(path.join(fixture.staging, ".pi-warden", "policy.json"), "{}\n");
    await mkdir(path.join(fixture.staging, "protected"));
    await writeFile(path.join(fixture.staging, "protected", "state.json"), "{}\n");
    const zone = createProtectedZone("pi-warden-user-config", path.join(fixture.workspace, "protected"));
    assert.ok(zone !== undefined);
    const scan = await scanProjection(scanOptions(fixture, { protectedZones: [zone] }));
    const refused = new Map(scan.refusals.map((refusal) => [refusal.relativePath, refusal.reason]));
    assert.match(refused.get(".git") ?? "", /excluded from export/);
    assert.match(refused.get(".pi-warden") ?? "", /excluded from export/);
    assert.match(refused.get("protected") ?? "", /protected control-plane/);
    assert.deepEqual(scan.changes, []);
  } finally {
    await fixture.cleanup();
  }
});

test("a mode change alone is an exported replacement", async () => {
  const fixture = await projectFixture(async (workspace) => {
    await writeFile(path.join(workspace, "tool.sh"), "#!/bin/sh\n");
  });
  try {
    await chmod(path.join(fixture.staging, "tool.sh"), 0o755);
    const scan = await scanProjection(scanOptions(fixture));
    assert.equal(scan.changes.length, 1);
    assert.equal(scan.changes[0].kind, "replace");
    assert.equal(scan.changes[0].mode & 0o777, 0o755);
  } finally {
    await fixture.cleanup();
  }
});

test("apply refuses an effect whose ancestor is not a bound object", async () => {
  const fixture = await projectFixture(async (workspace) => {
    await writeFile(path.join(workspace, "data.txt"), "one\n");
  });
  try {
    const scan = await scanProjection(scanOptions(fixture));
    const result = await applyExportChanges({
      helperPath: "/nonexistent/helper",
      rootFd: 3,
      workspaceRoot: fixture.workspace,
      manifest: fixture.manifest,
      changes: [
        {
          relativePath: "unbound-dir/child.txt",
          kind: "create",
          payload: Buffer.from("x\n"),
          sha256: "0".repeat(64),
          mode: 0o644,
          manifestEntry: undefined,
        },
      ],
      authorize: async () => ({ decision: "ALLOW", reason: "test" }),
    });
    assert.equal(result.applied.length, 0);
    assert.match(result.refusals[0]?.reason ?? "", /not a bound object/);
    assert.equal(scan.changes.length, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("apply never calls the helper for a denied effect", async () => {
  const fixture = await projectFixture(async (workspace) => {
    await writeFile(path.join(workspace, "data.txt"), "one\n");
  });
  try {
    await writeFile(path.join(fixture.staging, "data.txt"), "changed\n");
    const scan = await scanProjection(scanOptions(fixture));
    assert.equal(scan.changes.length, 1);
    const result = await applyExportChanges({
      helperPath: "/nonexistent/helper",
      rootFd: 3,
      workspaceRoot: fixture.workspace,
      manifest: fixture.manifest,
      changes: scan.changes,
      authorize: async () => ({ decision: "DENY", reason: "policy denied" }),
    });
    assert.equal(result.applied.length, 0);
    assert.match(result.refusals[0]?.reason ?? "", /DENY: policy denied/);
  } finally {
    await fixture.cleanup();
  }
});

test("helper requests are validated before any process is spawned", async () => {
  const base = {
    helperPath: "/nonexistent/helper",
    rootFd: 3,
    rootDevice: "1",
    rootInode: "2",
    components: [],
    operation: "create" as const,
    leafDevice: "0",
    leafInode: "0",
    mode: 0o644,
    payload: Buffer.from("x"),
    timeoutMs: 1000,
  };
  for (const name of ["..", ".", "", "a/b", "a\0b", "a\nb"]) {
    await assert.rejects(
      () => runExportEffect({ ...base, name }),
      (error: unknown) => error instanceof ShellRefusal,
      `leaf name ${JSON.stringify(name)} must be refused`,
    );
  }
  await assert.rejects(
    () => runExportEffect({ ...base, name: "ok", components: [{ device: "1", inode: "2", name: "../escape" }] }),
    (error: unknown) => error instanceof ShellRefusal,
  );
});
