import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { controlledFind, controlledGrep, controlledLs, evaluateEntry } from "../src/gate/controlled-traversal.ts";
import { loadOperationPolicySources, type LoadedPolicySources } from "../src/policy/config-loader.ts";
import { canonicalizeWorkspace, resolveWorkspacePath, type ResolvedPath } from "../src/policy/paths.ts";

interface Fixture {
  root: string;
  workspace: string;
  userRoot: string;
}

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "pi-warden-traversal-"));
  const workspace = path.join(root, "workspace");
  const userRoot = path.join(root, "user-config");
  await mkdir(workspace);
  await mkdir(userRoot);
  return { root, workspace, userRoot };
}

async function destroyFixture(fixture: Fixture): Promise<void> {
  await rm(fixture.root, { recursive: true, force: true });
}

async function snapshotFor(fixture: Fixture): Promise<{
  snapshot: {
    services: { trustedUserConfigRoot: string; protectedZones: readonly never[] };
    workspace: string;
    authorizedRoot: ResolvedPath;
    loaded: LoadedPolicySources;
  };
}> {
  const authorizedRoot = await resolveWorkspacePath(fixture.workspace, "target");
  const loaded = await loadOperationPolicySources(authorizedRoot, fixture.userRoot);
  return {
    snapshot: {
      services: { trustedUserConfigRoot: fixture.userRoot, protectedZones: Object.freeze([] as readonly never[]) },
      workspace: fixture.workspace,
      authorizedRoot,
      loaded,
    },
  };
}

test("ls lists only authorized entries and excludes secret resources without reading them", async () => {
  const fixture = await createFixture();
  try {
    const target = path.join(fixture.workspace, "target");
    await mkdir(target);
    await writeFile(path.join(target, "open.txt"), "ordinary content\n");
    await writeFile(path.join(target, ".env"), "TOP=secret\n");
    await writeFile(path.join(target, "backup.pem"), "pem data\n");
    await mkdir(path.join(target, "sub"));
    await symlink(path.join(target, "open.txt"), path.join(target, "alias-open.txt"));

    const { snapshot } = await snapshotFor(fixture);
    const allowed = await evaluateEntry(snapshot, "open.txt");
    assert.equal(allowed.status, "include");

    const result = await controlledLs(snapshot, 500);
    assert.deepEqual(
      [...result.lines].sort(),
      ["alias-open.txt", "open.txt", "sub/"].sort(),
      `unexpected listing: ${JSON.stringify(result)}`,
    );
    assert.ok(!result.lines.some((line) => line.startsWith(".env")));
    assert.ok(!result.lines.some((line) => line.startsWith("backup.pem")));
    assert.ok(result.excludedCount >= 2, `excluded secrets counted: ${result.excludedCount}`);
  } finally {
    await destroyFixture(fixture);
  }
});

test("grep reads only authorized files, excluding secrets and symlink escapes", async () => {
  const fixture = await createFixture();
  try {
    const target = path.join(fixture.workspace, "target");
    await mkdir(target);
    await writeFile(path.join(target, "code.txt"), "marker here\nplain\n");
    await writeFile(path.join(target, ".env"), "marker leaks here\n");
    await mkdir(path.join(fixture.root, "outside"));
    await writeFile(path.join(fixture.root, "outside", "marker.txt"), "marker external leak\n");
    await symlink(path.join(fixture.root, "outside"), path.join(target, "escape-dir"));
    await symlink("missing-target", path.join(target, "broken.txt"));

    const { snapshot } = await snapshotFor(fixture);
    const allowed = await evaluateEntry(snapshot, "code.txt");
    assert.equal(allowed.status, "include");

    const result = await controlledGrep(snapshot, {
      pattern: "marker",
      ignoreCase: false,
      literal: true,
      context: 0,
      limit: 100,
    });
    assert.ok(
      result.lines.some((line) => line === "code.txt:1: marker here"),
      `unexpected grep output: ${JSON.stringify(result)}`,
    );
    assert.ok(!result.lines.some((line) => line.includes("leaks")));
    assert.ok(!result.lines.some((line) => line.includes("external leak")));
    assert.ok(result.excludedCount >= 1, `external escapes excluded: ${result.excludedCount}`);
  } finally {
    await destroyFixture(fixture);
  }
});

test("find walks the authorized root and excludes denied descendants", async () => {
  const fixture = await createFixture();
  try {
    await mkdir(path.join(fixture.workspace, "target", "nested"), { recursive: true });
    await writeFile(path.join(fixture.workspace, "target", "code.ts"), "");
    await writeFile(path.join(fixture.workspace, "target", "nested", ".env"), "secret");
    await symlink(
      path.join(fixture.workspace, "target", "code.ts"),
      path.join(fixture.workspace, "target", "alias.ts"),
    );
    await symlink("missing-target", path.join(fixture.workspace, "target", "broken.ts"));

    const { snapshot } = await snapshotFor(fixture);
    const result = await controlledFind(snapshot, "*.ts", 1000);
    assert.ok(result.lines.includes("code.ts"), `unexpected find output: ${JSON.stringify(result)}`);
    assert.ok(!result.lines.includes("broken.ts"));
    assert.ok(!result.lines.some((line) => line.includes(".env")));
    assert.ok(result.excludedCount >= 1);
  } finally {
    await destroyFixture(fixture);
  }
});

test("find and grep withhold a sensitive directory name and never enumerate its subtree", async () => {
  const fixture = await createFixture();
  try {
    const target = path.join(fixture.workspace, "target");
    await mkdir(path.join(target, ".ssh"), { recursive: true });
    await writeFile(path.join(target, ".ssh", "known_hosts"), "host key data\n");
    await mkdir(path.join(target, "ordinary"));
    await writeFile(path.join(target, "ordinary", "code.ts"), "");

    const { snapshot } = await snapshotFor(fixture);
    const found = await controlledFind(snapshot, "**", 1000);
    assert.ok(
      !found.lines.some((line) => line === ".ssh" || line.startsWith(".ssh/")),
      `sensitive directory name must be withheld from find: ${JSON.stringify(found.lines)}`,
    );
    assert.ok(found.lines.includes("ordinary"), `ordinary directories still appear: ${JSON.stringify(found.lines)}`);

    const grepped = await controlledGrep(snapshot, {
      pattern: "host key",
      ignoreCase: false,
      literal: true,
      context: 0,
      limit: 100,
    });
    assert.ok(
      !grepped.lines.some((line) => line.includes("known_hosts")),
      `sensitive directory subtree must not be searched: ${JSON.stringify(grepped.lines)}`,
    );
  } finally {
    await destroyFixture(fixture);
  }
});

test("grep regex with a malformed pattern matches nothing and performs no content effects", async () => {
  const fixture = await createFixture();
  try {
    const target = path.join(fixture.workspace, "target");
    await mkdir(target);
    await writeFile(path.join(target, "a.txt"), "x\n");
    const { snapshot } = await snapshotFor(fixture);
    const result = await controlledGrep(snapshot, {
      pattern: "(unclosed",
      ignoreCase: false,
      literal: false,
      context: 0,
      limit: 100,
    });
    assert.equal(result.lines.length, 0);
    assert.equal(result.matchLimitReached, false);
  } finally {
    await destroyFixture(fixture);
  }
});
