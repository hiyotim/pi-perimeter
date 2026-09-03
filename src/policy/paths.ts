import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";

export type PathCanonicalizationErrorCode =
  | "INVALID_PATH"
  | "WORKSPACE_NOT_FOUND"
  | "WORKSPACE_NOT_DIRECTORY"
  | "PATH_RESOLUTION_FAILED"
  | "ANCESTOR_NOT_DIRECTORY";

export class PathCanonicalizationError extends Error {
  readonly code: PathCanonicalizationErrorCode;
  readonly inputPath: string;

  constructor(
    code: PathCanonicalizationErrorCode,
    message: string,
    inputPath: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PathCanonicalizationError";
    this.code = code;
    this.inputPath = inputPath;
  }
}

export interface CanonicalPathResult {
  requestedPath: string;
  absolutePath: string;
  canonicalPath: string;
  workspaceRoot: string;
  targetExists: boolean;
  insideWorkspace: boolean;
}

function assertValidPath(input: string, label: string): void {
  if (typeof input !== "string" || input.length === 0 || input.includes("\0")) {
    throw new PathCanonicalizationError(
      "INVALID_PATH",
      `${label} must be a non-empty path without null bytes`,
      typeof input === "string" ? input : String(input),
    );
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isMissingPathError(error: unknown): boolean {
  return isNodeError(error) && error.code === "ENOENT";
}

function containsPath(workspaceRoot: string, target: string): boolean {
  const relative = path.relative(workspaceRoot, target);

  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function resolutionError(input: string, error: unknown): PathCanonicalizationError {
  return new PathCanonicalizationError(
    "PATH_RESOLUTION_FAILED",
    `Could not safely canonicalize path: ${input}`,
    input,
    { cause: error },
  );
}

/**
 * Resolves a workspace root to an absolute, canonical directory path.
 */
export async function canonicalizeWorkspace(root: string): Promise<string> {
  assertValidPath(root, "Workspace root");
  const absoluteRoot = path.resolve(root);

  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(absoluteRoot);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new PathCanonicalizationError(
        "WORKSPACE_NOT_FOUND",
        `Workspace root does not exist: ${root}`,
        root,
        { cause: error },
      );
    }

    throw resolutionError(root, error);
  }

  let rootStat;
  try {
    rootStat = await stat(canonicalRoot);
  } catch (error) {
    throw resolutionError(root, error);
  }

  if (!rootStat.isDirectory()) {
    throw new PathCanonicalizationError(
      "WORKSPACE_NOT_DIRECTORY",
      `Workspace root is not a directory: ${root}`,
      root,
    );
  }

  return canonicalRoot;
}

async function canonicalizeTargetOnce(absolutePath: string): Promise<{
  canonicalPath: string;
  targetExists: boolean;
}> {
  let candidate = absolutePath;
  const missingTail: string[] = [];

  while (true) {
    try {
      await lstat(candidate);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOTDIR") {
        throw new PathCanonicalizationError(
          "ANCESTOR_NOT_DIRECTORY",
          `Existing path ancestor is not a directory: ${candidate}`,
          absolutePath,
          { cause: error },
        );
      }

      if (!isMissingPathError(error)) {
        throw resolutionError(absolutePath, error);
      }

      const parent = path.dirname(candidate);
      if (parent === candidate) {
        throw resolutionError(absolutePath, error);
      }

      missingTail.push(path.basename(candidate));
      candidate = parent;
      continue;
    }

    let canonicalAncestor: string;
    try {
      canonicalAncestor = await realpath(candidate);
    } catch (error) {
      // lstat succeeded, so ENOENT here can mean a broken symlink or a race.
      // Neither condition is safe to reinterpret as a missing ordinary path.
      throw resolutionError(absolutePath, error);
    }

    if (missingTail.length === 0) {
      return { canonicalPath: canonicalAncestor, targetExists: true };
    }

    let ancestorStat;
    try {
      ancestorStat = await stat(canonicalAncestor);
    } catch (error) {
      throw resolutionError(absolutePath, error);
    }

    if (!ancestorStat.isDirectory()) {
      throw new PathCanonicalizationError(
        "ANCESTOR_NOT_DIRECTORY",
        `Existing path ancestor is not a directory: ${candidate}`,
        absolutePath,
      );
    }

    return {
      canonicalPath: path.resolve(canonicalAncestor, ...missingTail.reverse()),
      targetExists: false,
    };
  }
}

async function canonicalizeTarget(absolutePath: string): Promise<{
  canonicalPath: string;
  targetExists: boolean;
}> {
  let candidate = absolutePath;
  let targetExists = true;

  for (let pass = 0; pass < 64; pass += 1) {
    const resolved = await canonicalizeTargetOnce(candidate);
    targetExists &&= resolved.targetExists;

    if (resolved.targetExists || resolved.canonicalPath === candidate) {
      return { canonicalPath: resolved.canonicalPath, targetExists };
    }

    // A missing tail can contain parent components that lead back to an
    // existing symlink. Resolve the rebuilt path again until it is stable.
    candidate = resolved.canonicalPath;
  }

  throw new PathCanonicalizationError(
    "PATH_RESOLUTION_FAILED",
    `Could not safely canonicalize path after repeated resolution: ${absolutePath}`,
    absolutePath,
  );
}

/**
 * Resolves a model-facing path relative to the supplied workspace and returns
 * its canonical identity plus a component-aware workspace relationship.
 *
 * This function does not make an authorization decision. Callers must treat
 * every thrown error as a failed security check.
 */
export async function resolveWorkspacePath(
  workspace: string,
  requestedPath: string,
): Promise<CanonicalPathResult> {
  assertValidPath(requestedPath, "Requested path");
  const workspaceRoot = await canonicalizeWorkspace(workspace);
  const absolutePath = path.resolve(workspaceRoot, requestedPath);

  // Preserve dot components until the existing prefix is resolved. Native
  // path traversal follows a symlink before applying a subsequent "..".
  const filesystemPath = path.isAbsolute(requestedPath)
    ? requestedPath
    : `${workspaceRoot}${path.sep}${requestedPath}`;
  const resolved = await canonicalizeTarget(filesystemPath);

  return {
    requestedPath,
    absolutePath,
    canonicalPath: resolved.canonicalPath,
    workspaceRoot,
    targetExists: resolved.targetExists,
    insideWorkspace: containsPath(workspaceRoot, resolved.canonicalPath),
  };
}
