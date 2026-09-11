import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  canonicalizeWorkspace,
  isResolvedPath,
  PathCanonicalizationError,
  resolveWorkspacePath,
  type ResolvedPath,
} from "../src/policy/paths.ts";

interface Fixture {
  root: string;
  workspace: string;
  outside: string;
  sibling: string;
}

async function withFixture(run: (fixture: Fixture) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-warden-paths-"));
  const fixture = {
    root,
    workspace: path.join(root, "project"),
    outside: path.join(root, "outside"),
    sibling: path.join(root, "project-evil"),
  };

  try {
    await Promise.all([
      mkdir(fixture.workspace),
      mkdir(fixture.outside),
      mkdir(fixture.sibling),
    ]);
    await run(fixture);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function assertPathError(
  operation: Promise<unknown>,
  code: PathCanonicalizationError["code"],
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof PathCanonicalizationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("canonicalizes the workspace root", async () => {
  await withFixture(async ({ workspace }) => {
    assert.equal(await canonicalizeWorkspace(workspace), await realpath(workspace));
  });
});

test("classifies the workspace root as inside", async () => {
  await withFixture(async ({ workspace }) => {
    const result = await resolveWorkspacePath(workspace, ".");
    assert.equal(result.insideWorkspace, true);
    assert.equal(result.targetExists, true);
    assert.equal(result.canonicalPath, result.workspaceRoot);
  });
});

test("classifies an existing direct child as inside", async () => {
  await withFixture(async ({ workspace }) => {
    await writeFile(path.join(workspace, "file.txt"), "fixture");
    const result = await resolveWorkspacePath(workspace, "file.txt");
    assert.equal(result.insideWorkspace, true);
    assert.equal(result.targetExists, true);
  });
});

test("classifies a deeply nested child as inside", async () => {
  await withFixture(async ({ workspace }) => {
    await mkdir(path.join(workspace, "a", "b"), { recursive: true });
    await writeFile(path.join(workspace, "a", "b", "file.txt"), "fixture");
    const result = await resolveWorkspacePath(workspace, "a/b/file.txt");
    assert.equal(result.insideWorkspace, true);
  });
});

test("normalizes a leading dot component", async () => {
  await withFixture(async ({ workspace }) => {
    await writeFile(path.join(workspace, "file.txt"), "fixture");
    const result = await resolveWorkspacePath(workspace, "./file.txt");
    assert.equal(result.canonicalPath, await realpath(path.join(workspace, "file.txt")));
    assert.equal(result.insideWorkspace, true);
  });
});

test("normalizes internal parent components", async () => {
  await withFixture(async ({ workspace }) => {
    await mkdir(path.join(workspace, "foo"));
    await writeFile(path.join(workspace, "bar.txt"), "fixture");
    const result = await resolveWorkspacePath(workspace, "foo/../bar.txt");
    assert.equal(result.canonicalPath, await realpath(path.join(workspace, "bar.txt")));
    assert.equal(result.insideWorkspace, true);
  });
});

test("rejects a sibling whose name shares the workspace prefix", async () => {
  await withFixture(async ({ workspace, sibling }) => {
    await writeFile(path.join(sibling, "file.txt"), "fixture");
    const result = await resolveWorkspacePath(workspace, path.join(sibling, "file.txt"));
    assert.equal(result.insideWorkspace, false);
  });
});

test("classifies one-level traversal as outside", async () => {
  await withFixture(async ({ workspace, root }) => {
    await writeFile(path.join(root, "secret.txt"), "fixture");
    const result = await resolveWorkspacePath(workspace, "../secret.txt");
    assert.equal(result.insideWorkspace, false);
  });
});

test("classifies multi-level traversal as outside", async () => {
  await withFixture(async ({ workspace }) => {
    const result = await resolveWorkspacePath(workspace, "../../missing-secret.txt");
    assert.equal(result.insideWorkspace, false);
    assert.equal(result.targetExists, false);
  });
});

test("classifies traversal after nested segments as outside", async () => {
  await withFixture(async ({ workspace }) => {
    const result = await resolveWorkspacePath(workspace, "src/../../../secret.txt");
    assert.equal(result.insideWorkspace, false);
  });
});

test("accepts an absolute path inside the workspace", async () => {
  await withFixture(async ({ workspace }) => {
    const target = path.join(workspace, "absolute.txt");
    await writeFile(target, "fixture");
    const result = await resolveWorkspacePath(workspace, target);
    assert.equal(result.insideWorkspace, true);
  });
});

test("classifies an absolute path outside the workspace as outside", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const target = path.join(outside, "absolute.txt");
    await writeFile(target, "fixture");
    const result = await resolveWorkspacePath(workspace, target);
    assert.equal(result.insideWorkspace, false);
  });
});

test("keeps a symlink to an internal directory inside", async () => {
  await withFixture(async ({ workspace }) => {
    const realDirectory = path.join(workspace, "real");
    await mkdir(realDirectory);
    await writeFile(path.join(realDirectory, "file.txt"), "fixture");
    await symlink(realDirectory, path.join(workspace, "link"));
    const result = await resolveWorkspacePath(workspace, "link/file.txt");
    assert.equal(result.insideWorkspace, true);
    assert.equal(result.canonicalPath, await realpath(path.join(realDirectory, "file.txt")));
  });
});

test("classifies a direct symlink escape as outside", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await writeFile(path.join(outside, "file.txt"), "fixture");
    await symlink(outside, path.join(workspace, "link"));
    const result = await resolveWorkspacePath(workspace, "link/file.txt");
    assert.equal(result.insideWorkspace, false);
  });
});

test("classifies a nested symlink escape as outside", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await mkdir(path.join(workspace, "a", "b"), { recursive: true });
    await writeFile(path.join(outside, "file.txt"), "fixture");
    await symlink(outside, path.join(workspace, "a", "b", "link"));
    const result = await resolveWorkspacePath(workspace, "a/b/link/file.txt");
    assert.equal(result.insideWorkspace, false);
  });
});

test("classifies a chained symlink escape as outside", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await writeFile(path.join(outside, "file.txt"), "fixture");
    await symlink(outside, path.join(workspace, "link2"));
    await symlink(path.join(workspace, "link2"), path.join(workspace, "link1"));
    const result = await resolveWorkspacePath(workspace, "link1/file.txt");
    assert.equal(result.insideWorkspace, false);
  });
});

test("keeps a symlink to the workspace itself inside", async () => {
  await withFixture(async ({ workspace }) => {
    await writeFile(path.join(workspace, "file.txt"), "fixture");
    await symlink(workspace, path.join(workspace, "self"));
    const result = await resolveWorkspacePath(workspace, "self/file.txt");
    assert.equal(result.insideWorkspace, true);
  });
});

test("canonicalizes a workspace supplied through a symlink", async () => {
  await withFixture(async ({ root, workspace }) => {
    const linkedWorkspace = path.join(root, "workspace-link");
    await symlink(workspace, linkedWorkspace);
    const result = await resolveWorkspacePath(linkedWorkspace, "new.txt");
    assert.equal(result.workspaceRoot, await realpath(workspace));
    assert.equal(result.insideWorkspace, true);
  });
});

test("canonicalizes a nonexistent file inside the workspace", async () => {
  await withFixture(async ({ workspace }) => {
    const result = await resolveWorkspacePath(workspace, "new.txt");
    assert.equal(result.insideWorkspace, true);
    assert.equal(result.targetExists, false);
    assert.equal(result.canonicalPath, path.join(await realpath(workspace), "new.txt"));
  });
});

test("canonicalizes nonexistent nested directories inside the workspace", async () => {
  await withFixture(async ({ workspace }) => {
    const result = await resolveWorkspacePath(workspace, "new/deep/file.txt");
    assert.equal(result.insideWorkspace, true);
    assert.equal(result.targetExists, false);
    assert.equal(
      result.canonicalPath,
      path.join(await realpath(workspace), "new", "deep", "file.txt"),
    );
  });
});

test("resolves a nonexistent target below an external symlink parent", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await symlink(outside, path.join(workspace, "link"));
    const result = await resolveWorkspacePath(workspace, "link/new/deep/file.txt");
    assert.equal(result.insideWorkspace, false);
    assert.equal(result.targetExists, false);
    assert.equal(
      result.canonicalPath,
      path.join(await realpath(outside), "new", "deep", "file.txt"),
    );
  });
});

test("resolves a symlink reached after a missing component and parent traversal", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await symlink(outside, path.join(workspace, "link"));
    const result = await resolveWorkspacePath(
      workspace,
      "missing/../link/new-file.txt",
    );
    assert.equal(result.insideWorkspace, false);
    assert.equal(result.targetExists, false);
    assert.equal(
      result.canonicalPath,
      path.join(await realpath(outside), "new-file.txt"),
    );
  });
});

test("fails closed for a broken final symlink", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await symlink(path.join(outside, "missing"), path.join(workspace, "broken"));
    await assertPathError(
      resolveWorkspacePath(workspace, "broken"),
      "PATH_RESOLUTION_FAILED",
    );
  });
});

test("fails closed below a broken symlink parent", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await symlink(path.join(outside, "missing"), path.join(workspace, "broken"));
    await assertPathError(
      resolveWorkspacePath(workspace, "broken/new.txt"),
      "PATH_RESOLUTION_FAILED",
    );
  });
});

test("fails closed for a symlink loop", async () => {
  await withFixture(async ({ workspace }) => {
    await symlink(path.join(workspace, "loop2"), path.join(workspace, "loop1"));
    await symlink(path.join(workspace, "loop1"), path.join(workspace, "loop2"));
    await assertPathError(
      resolveWorkspacePath(workspace, "loop1/file.txt"),
      "PATH_RESOLUTION_FAILED",
    );
  });
});

test("fails closed when the existing ancestor is not a directory", async () => {
  await withFixture(async ({ workspace }) => {
    await writeFile(path.join(workspace, "file.txt"), "fixture");
    await assertPathError(
      resolveWorkspacePath(workspace, "file.txt/child.txt"),
      "ANCESTOR_NOT_DIRECTORY",
    );
  });
});

test("fails closed when a trailing separator requires a file to be a directory", async () => {
  await withFixture(async ({ workspace }) => {
    await writeFile(path.join(workspace, "file.txt"), "fixture");
    await assertPathError(
      resolveWorkspacePath(workspace, `file.txt${path.sep}`),
      "ANCESTOR_NOT_DIRECTORY",
    );
  });
});

test("preserves native symlink traversal before a parent component", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const externalDirectory = path.join(outside, "directory");
    await mkdir(externalDirectory);
    await writeFile(path.join(outside, "secret.txt"), "fixture");
    await symlink(externalDirectory, path.join(workspace, "link"));
    const result = await resolveWorkspacePath(workspace, "link/../secret.txt");
    assert.equal(result.canonicalPath, await realpath(path.join(outside, "secret.txt")));
    assert.equal(result.insideWorkspace, false);
  });
});

test("handles spaces, Unicode, and non-traversal dots as ordinary names", async () => {
  await withFixture(async ({ workspace }) => {
    const names = ["space name.txt", "日本語.txt", "..config", "foo..bar"];
    for (const name of names) {
      await writeFile(path.join(workspace, name), "fixture");
      const result = await resolveWorkspacePath(workspace, name);
      assert.equal(result.insideWorkspace, true, name);
      assert.equal(result.targetExists, true, name);
    }
  });
});

test("rejects an empty requested path", async () => {
  await withFixture(async ({ workspace }) => {
    await assertPathError(resolveWorkspacePath(workspace, ""), "INVALID_PATH");
  });
});

test("rejects a requested path containing a null byte", async () => {
  await withFixture(async ({ workspace }) => {
    await assertPathError(resolveWorkspacePath(workspace, "bad\0path"), "INVALID_PATH");
  });
});

test("rejects a missing workspace", async () => {
  await withFixture(async ({ root }) => {
    await assertPathError(
      canonicalizeWorkspace(path.join(root, "missing-workspace")),
      "WORKSPACE_NOT_FOUND",
    );
  });
});

test("rejects a workspace root that is not a directory", async () => {
  await withFixture(async ({ root }) => {
    const file = path.join(root, "not-a-directory");
    await writeFile(file, "fixture");
    await assertPathError(canonicalizeWorkspace(file), "WORKSPACE_NOT_DIRECTORY");
  });
});

test("isResolvedPath recognizes a genuine resolver result", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, "file.txt");
    assert.equal(isResolvedPath(resolved), true);
  });
});

test("isResolvedPath rejects non-object inputs", () => {
  for (const input of [null, undefined, "string", 123, true, Symbol("test")]) {
    assert.equal(isResolvedPath(input), false);
  }
});

test("isResolvedPath rejects a plain object", async () => {
  await withFixture(async ({ workspace }) => {
    assert.equal(
      isResolvedPath({
        requestedPath: "file.txt",
        absolutePath: path.join(workspace, "file.txt"),
        canonicalPath: path.join(workspace, "file.txt"),
        workspaceRoot: workspace,
        targetExists: true,
        insideWorkspace: true,
      }),
      false,
    );
  });
});

test("isResolvedPath rejects a spread copy of a genuine result", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, "file.txt");
    assert.equal(isResolvedPath({ ...resolved }), false);
  });
});

test("isResolvedPath rejects an Object.assign copy of a genuine result", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, "file.txt");
    assert.equal(isResolvedPath(Object.assign({}, resolved)), false);
  });
});

test("isResolvedPath rejects an object inheriting from a genuine result", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, "file.txt");
    assert.equal(isResolvedPath(Object.create(resolved)), false);
  });
});

test("isResolvedPath rejects a descriptor copy of a genuine result", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, "file.txt");
    const descriptors = Object.getOwnPropertyDescriptors(resolved);
    const copy = Object.create(Object.getPrototypeOf(resolved), descriptors);
    assert.equal(isResolvedPath(copy), false);
  });
});

test("a genuine resolver result is immutable", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, "file.txt");
    const original = resolved.canonicalPath;
    const replacement = path.join(workspace, "other.txt");

    assert.throws(
      () => {
        (resolved as unknown as Record<string, string>).canonicalPath = replacement;
      },
      (error: unknown) => error instanceof TypeError,
    );

    assert.throws(
      () => Object.assign(resolved, { canonicalPath: replacement }),
      (error: unknown) => error instanceof TypeError,
    );

    assert.throws(
      () =>
        Object.defineProperty(resolved, "canonicalPath", {
          value: replacement,
        }),
      (error: unknown) => error instanceof TypeError,
    );

    assert.equal(resolved.canonicalPath, original);
    assert.equal(isResolvedPath(resolved), true);
  });
});

test("compile-time nominal typing rejects a complete structural resolver result", async () => {
  await withFixture(async ({ workspace }) => {
    // @ts-expect-error ResolvedPath requires the module-owned nominal brand.
    const structural: ResolvedPath = {
      requestedPath: "file.txt",
      absolutePath: path.join(workspace, "file.txt"),
      canonicalPath: path.join(workspace, "file.txt"),
      workspaceRoot: workspace,
      targetExists: true,
      insideWorkspace: true,
    };

    assert.equal(isResolvedPath(structural), false);
  });
});

// Type-only negative checks: direct assignment to every resolver result field
// must be rejected at compile time. This function is intentionally never called
// so the assignments do not execute during node tests.
function _assertResolvedPathReadonly(result: ResolvedPath): void {
  // @ts-expect-error requestedPath is readonly on ResolvedPath.
  result.requestedPath = "other";
  // @ts-expect-error absolutePath is readonly on ResolvedPath.
  result.absolutePath = "/other";
  // @ts-expect-error canonicalPath is readonly on ResolvedPath.
  result.canonicalPath = "/other";
  // @ts-expect-error workspaceRoot is readonly on ResolvedPath.
  result.workspaceRoot = "/other";
  // @ts-expect-error targetExists is readonly on ResolvedPath.
  result.targetExists = false;
  // @ts-expect-error insideWorkspace is readonly on ResolvedPath.
  result.insideWorkspace = false;
}
