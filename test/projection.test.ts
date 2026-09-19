import assert from "node:assert/strict";
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createProtectedZone } from "../src/policy/control-plane.ts";
import { loadOperationPolicySources } from "../src/policy/config-loader.ts";
import { resolveWorkspacePath } from "../src/policy/paths.ts";
import { importWorkspace, lexicalResolve, type ProjectionManifest } from "../src/sandbox/projection.ts";
import { ShellRefusal } from "../src/sandbox/errors.ts";

interface Fixture {
  readonly root: string;
  readonly workspace: string;
  readonly staging: string;
  readonly userRoot: string;
  readonly outside: string;
  readonly cleanup: () => Promise<void>;
}

async function fixture(projectPolicy: string | undefined = undefined): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "piw-projection-"));
  const workspace = path.join(root, "workspace");
  const staging = path.join(root, "staging");
  const userRoot = path.join(root, "user");
  const outside = path.join(root, "outside");
  await mkdir(workspace);
  await mkdir(userRoot);
  await mkdir(outside);
  await writeFile(path.join(outside, "secret.txt"), "OUTSIDE-SECRET-VALUE\n");
  if (projectPolicy !== undefined) {
    await mkdir(path.join(workspace, ".pi-warden"));
    await writeFile(path.join(workspace, ".pi-warden", "policy.json"), projectPolicy);
  }
  return { root, workspace, staging, userRoot, outside, cleanup: () => rm(root, { recursive: true, force: true }) };
}

async function importFixture(
  value: Fixture,
  options: { limits?: Record<string, number>; zones?: readonly string[] } = {},
): Promise<ProjectionManifest> {
  const resolved = await resolveWorkspacePath(value.workspace, ".");
  const loaded = await loadOperationPolicySources(resolved, value.userRoot);
  return await importWorkspace({
    workspaceRoot: value.workspace,
    stagingRoot: value.staging,
    loaded,
    protectedZones: (options.zones ?? []).map((zone) => createProtectedZone("pi-warden-user-config", zone)).filter(
      (zone) => zone !== undefined,
    ),
    excludedDirectoryNames: [".git"],
    excludedRelativeRoots: [".pi-warden"],
    ...(options.limits !== undefined ? { limits: options.limits } : {}),
  });
}

async function populate(value: Fixture): Promise<void> {
  await mkdir(path.join(value.workspace, "src"));
  await mkdir(path.join(value.workspace, "config"));
  await writeFile(path.join(value.workspace, "src", "main.js"), "export const value = 1;\n");
  await chmod(path.join(value.workspace, "src", "main.js"), 0o755);
  await writeFile(path.join(value.workspace, "README.md"), "# fixture\n");
  await writeFile(path.join(value.workspace, ".env"), "FAKE_TOKEN=synthetic-token\n");
  await writeFile(path.join(value.workspace, ".env.example"), "FAKE_TOKEN=\n");
  await writeFile(path.join(value.workspace, "id_rsa"), "SYNTHETIC-KEY\n");
  await writeFile(path.join(value.workspace, "notes.txt"), "innocent name\n");
  await link(path.join(value.workspace, ".env"), path.join(value.workspace, "hardlink-alias.txt"));
  await symlink(path.join(value.outside, "secret.txt"), path.join(value.workspace, "outside-link.txt"));
  await symlink("../src/main.js", path.join(value.workspace, "config", "internal-link.js"));
  await mkdir(path.join(value.workspace, ".git", "hooks"), { recursive: true });
  await writeFile(path.join(value.workspace, ".git", "config"), "[core]\n");
  await writeFile(path.join(value.workspace, ".git", "hooks", "pre-commit"), "#!/bin/sh\n");
}

test("the projection excludes protected, sensitive and project-controlled objects", async () => {
  const value = await fixture();
  try {
    await populate(value);
    const manifest = await importFixture(value);
    const stagingRoot = value.staging;
    const reasonFor = (relativePath: string) =>
      manifest.refusals.find((refusal) => refusal.relativePath === relativePath)?.reason ?? "NOT REFUSED";

    assert.match(reasonFor(".env"), /classified secret/);
    assert.match(reasonFor(".env.example"), /classified sensitive/);
    assert.match(reasonFor("id_rsa"), /classified secret/);
    assert.match(reasonFor("hardlink-alias.txt"), /nlink != 1/);
    assert.match(reasonFor("outside-link.txt"), /outside the workspace/);
    assert.match(reasonFor(".git"), /excluded by project decision/);
    assert.ok(
      !manifest.entries.some((entry) => entry.relativePath.startsWith(".git")),
      "an excluded directory is refused without descending into it",
    );

    // Nothing excluded exists in the projection, including hidden names.
    const rootEntries = await readdir(stagingRoot);
    assert.deepEqual(rootEntries.sort(), ["README.md", "config", "notes.txt", "src"]);
    await assert.rejects(() => lstat(path.join(stagingRoot, ".env")));
    await assert.rejects(() => lstat(path.join(stagingRoot, "hardlink-alias.txt")));
    await assert.rejects(() => lstat(path.join(stagingRoot, "outside-link.txt")));

    // Hard-link laundering is impossible: the alias is refused before any copy.
    const staged = await readdir(stagingRoot, { recursive: true });
    assert.ok(!staged.some((entry) => String(entry).includes("hardlink")));
  } finally {
    await value.cleanup();
  }
});

test("no excluded content reaches the projection", async () => {
  const value = await fixture();
  try {
    await populate(value);
    await importFixture(value);
    const walk = async (directory: string): Promise<string[]> => {
      const results: string[] = [];
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) results.push(...(await walk(target)));
        else if (entry.isFile()) results.push(await readFile(target, "utf8"));
      }
      return results;
    };
    const contents = (await walk(value.staging)).join("\n");
    assert.ok(!contents.includes("FAKE_TOKEN"), "no environment content may be projected");
    assert.ok(!contents.includes("SYNTHETIC-KEY"), "no private key content may be projected");
    assert.ok(!contents.includes("OUTSIDE-SECRET-VALUE"), "no external content may be projected");
  } finally {
    await value.cleanup();
  }
});

test("projected objects keep identity, mode and content bindings", async () => {
  const value = await fixture();
  try {
    await populate(value);
    const manifest = await importFixture(value);
    const mainEntry = manifest.entries.find((entry) => entry.relativePath === "src/main.js");
    assert.ok(mainEntry !== undefined);
    assert.equal(mainEntry.kind, "file");
    assert.equal(mainEntry.nlink, 1);
    assert.equal(mainEntry.mode & 0o777, 0o755, "executable bit is preserved");
    assert.equal(await readFile(path.join(value.staging, "src", "main.js"), "utf8"), "export const value = 1;\n");
    assert.equal(manifest.rootDevice, manifest.entries[0]?.device ?? manifest.rootDevice);
    const staged = await lstat(path.join(value.staging, "src", "main.js"));
    assert.equal(staged.mode & 0o777, 0o755);
    const linkEntry = manifest.entries.find((entry) => entry.relativePath === "config/internal-link.js");
    assert.ok(linkEntry !== undefined && linkEntry.kind === "symlink");
    assert.equal(await readlink(path.join(value.staging, "config", "internal-link.js")), "../src/main.js");
  } finally {
    await value.cleanup();
  }
});

test("symlink policy is explicit: internal single-hop allowed, everything else refused", async () => {
  const value = await fixture();
  try {
    await populate(value);
    // A chained symlink (link to a link) resolves ambiguously and is refused.
    await symlink("internal-link.js", path.join(value.workspace, "config", "chained.js"));
    // A link to an excluded object is refused (broken in the projection).
    await symlink("../.env", path.join(value.workspace, "config", "to-secret.js"));
    // An absolute in-workspace link is refused as an unconfined path.
    await symlink(path.join(value.workspace, "README.md"), path.join(value.workspace, "absolute-link.md"));
    const manifest = await importFixture(value);
    const refusedPaths = manifest.refusals.map((refusal) => refusal.relativePath);
    assert.ok(refusedPaths.includes("config/to-secret.js"), "links to excluded objects are refused");
    assert.ok(refusedPaths.includes("absolute-link.md"), "absolute links are refused");
    const chained = refusedPaths.includes("config/chained.js");
    assert.ok(chained, "chained links are outside the supported subset");
    assert.equal(lexicalResolve("config", "../src/main.js"), "src/main.js");
    assert.equal(lexicalResolve("", "../x"), undefined);
  } finally {
    await value.cleanup();
  }
});

test("a protected control-plane zone is never projected", async () => {
  const value = await fixture();
  try {
    await populate(value);
    const manifest = await importFixture(value, { zones: [path.join(value.workspace, "config")] });
    const protectedRefusal = manifest.refusals.find((refusal) => refusal.relativePath === "config");
    assert.ok(protectedRefusal !== undefined);
    assert.match(protectedRefusal.reason, /protected control-plane/);
    await assert.rejects(() => lstat(path.join(value.staging, "config")));
  } finally {
    await value.cleanup();
  }
});

test("invalid policy configuration refuses the whole projection (fail closed)", async () => {
  const value = await fixture("{ this is not policy }\n");
  try {
    await populate(value);
    const manifest = await importFixture(value);
    assert.equal(manifest.files, 0);
    assert.equal(manifest.directories, 0);
    assert.ok(manifest.refusals.some((refusal) => /policy denies read/.test(refusal.reason)));
  } finally {
    await value.cleanup();
  }
});

test("import limits refuse instead of silently truncating", async () => {
  const value = await fixture();
  try {
    await mkdir(path.join(value.workspace, "many"));
    for (let index = 0; index < 20; index += 1) {
      await writeFile(path.join(value.workspace, "many", `f${index}.txt`), `${index}\n`);
    }
    await assert.rejects(
      () => importFixture(value, { limits: { maxEntries: 5 } }),
      (error: unknown) => error instanceof ShellRefusal && error.code === "PROJECTION_LIMIT_EXCEEDED",
    );
    const sizeLimited = await fixture();
    try {
      await writeFile(path.join(sizeLimited.workspace, "big.txt"), "x".repeat(4096));
      await assert.rejects(
        () => importFixture(sizeLimited, { limits: { maxFileBytes: 1024 } }),
        (error: unknown) => error instanceof ShellRefusal && error.code === "PROJECTION_LIMIT_EXCEEDED",
      );
    } finally {
      await sizeLimited.cleanup();
    }
  } finally {
    await value.cleanup();
  }
});

test("a sensitive directory is refused without descending into it", async () => {
  const value = await fixture();
  try {
    await mkdir(path.join(value.workspace, ".ssh"));
    await writeFile(path.join(value.workspace, ".ssh", "config"), "Host *\n");
    await writeFile(path.join(value.workspace, ".ssh", "known_hosts"), "host key\n");
    const manifest = await importFixture(value);
    const refusal = manifest.refusals.find((entry) => entry.relativePath === ".ssh");
    assert.ok(refusal !== undefined);
    assert.match(refusal.reason, /classified sensitive/);
    assert.ok(
      !manifest.refusals.some((entry) => entry.relativePath.startsWith(".ssh/")),
      "a refused directory must not be traversed",
    );
    await assert.rejects(() => lstat(path.join(value.staging, ".ssh")));
  } finally {
    await value.cleanup();
  }
});

test("case aliases of classified families are refused exactly like their base names", async () => {
  // Each spelling gets its own workspace: on a case-insensitive filesystem two
  // spellings of one name are the same object, so they cannot coexist.
  for (const name of [".ENV", "ID_RSA", "CREDENTIALS.PEM", "Token.Key"]) {
    const value = await fixture();
    try {
      await writeFile(path.join(value.workspace, name), "synthetic\n");
      const manifest = await importFixture(value);
      const refusal = manifest.refusals.find((entry) => entry.relativePath === name);
      assert.ok(refusal !== undefined, `${name} must be refused`);
      assert.match(refusal.reason, /classified (secret|sensitive)/);
      await assert.rejects(() => lstat(path.join(value.staging, name)));
    } finally {
      await value.cleanup();
    }
  }
});

test("lexical resolution never escapes the projection root", () => {
  assert.equal(lexicalResolve("", "a/b"), "a/b");
  assert.equal(lexicalResolve("a", "./b/../c"), "a/c");
  assert.equal(lexicalResolve("", ".."), undefined);
  assert.equal(lexicalResolve("a", "../../b"), undefined);
  assert.equal(lexicalResolve("", "/abs"), undefined);
  assert.equal(lexicalResolve("a", ""), undefined);
});
