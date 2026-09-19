/**
 * Workspace projection (import).
 *
 * Builds the private staging tree a contained command may read and write. The
 * original workspace is never exposed to the child: every object is classified
 * and authorized as an *original* object first, then opened without following
 * symlinks, verified through the descriptor the bytes come from, and only then
 * copied and named in staging.
 *
 * The projection is also the export source, so the manifest recorded here is
 * the identity baseline every later export effect is checked against.
 */

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, readdir, readlink, symlink } from "node:fs/promises";
import path from "node:path";

import { protectedDenialFor, type ProtectedZone } from "../policy/control-plane.ts";
import type { LoadedPolicySources } from "../policy/config-loader.ts";
import { evaluateEffectivePath } from "../policy/effective.ts";
import { resolveWorkspacePath, type ResolvedPath } from "../policy/paths.ts";
import { classifyPathResource } from "../policy/resources.ts";
import { ShellRefusal } from "./errors.ts";

export const IMPORT_LIMITS = Object.freeze({
  maxEntries: 200_000,
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
  maxFileBytes: 256 * 1024 * 1024,
  maxDepth: 64,
  maxSymlinks: 10_000,
  copyBufferBytes: 64 * 1024,
});

export interface ProjectionEntry {
  /** Projection-relative path with `/` separators; never empty inside entries. */
  readonly relativePath: string;
  readonly kind: "file" | "directory" | "symlink";
  readonly device: string;
  readonly inode: string;
  readonly size: number;
  readonly mode: number;
  readonly nlink: number;
  readonly sha256: string | null;
  readonly linkText: string | null;
}

export interface ProjectionRefusalRecord {
  readonly relativePath: string;
  readonly reason: string;
}

export interface ProjectionManifest {
  readonly rootRelativePath: string;
  readonly rootDevice: string;
  readonly rootInode: string;
  /** Recorded identity of the staging root this projection was built into. */
  readonly stagingDevice: string;
  readonly stagingInode: string;
  readonly entries: readonly ProjectionEntry[];
  readonly refusals: readonly ProjectionRefusalRecord[];
  readonly files: number;
  readonly directories: number;
  readonly symlinks: number;
  readonly bytes: number;
  readonly elapsedMs: number;
}

export type ImportLimits = typeof IMPORT_LIMITS;

export interface ProjectionOptions {
  readonly workspaceRoot: string;
  readonly stagingRoot: string;
  readonly loaded: LoadedPolicySources;
  readonly protectedZones: readonly ProtectedZone[];
  /** Directory names refused at any depth, by project decision. */
  readonly excludedDirectoryNames?: readonly string[];
  /** Workspace-relative directories whose subtrees are refused. */
  readonly excludedRelativeRoots?: readonly string[];
  /** Overridable bounds, used by tests to exercise the refusal paths. */
  readonly limits?: Partial<ImportLimits>;
}

interface DeferredSymlink {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly device: string;
  readonly inode: string;
  readonly nlink: number;
  readonly linkText: string;
  readonly canonicalTarget: string;
}

interface ImportState {
  readonly options: ProjectionOptions;
  readonly limits: ImportLimits;
  readonly entries: ProjectionEntry[];
  readonly refusals: ProjectionRefusalRecord[];
  readonly imported: Set<string>;
  readonly deferred: DeferredSymlink[];
  files: number;
  directories: number;
  symlinks: number;
  bytes: number;
  rootDevice: string;
  rootInode: string;
  stagingDevice: string;
  stagingInode: string;
}

function refuseImport(state: ImportState, relativePath: string, reason: string): void {
  if (state.refusals.length < 4096) {
    state.refusals.push(Object.freeze({ relativePath, reason }));
  }
}

function limitExceeded(detail: string): never {
  throw new ShellRefusal("PROJECTION_LIMIT_EXCEEDED", detail);
}

async function stagingPathFor(stagingRoot: string, relativePath: string): Promise<string> {
  return relativePath.length === 0 ? stagingRoot : path.join(stagingRoot, relativePath);
}

function isExcludedRelative(relativePath: string, excluded: readonly string[]): boolean {
  if (relativePath.length === 0) return false;
  for (const value of excluded) {
    if (relativePath === value || relativePath.startsWith(`${value}/`)) return true;
  }
  return false;
}

/**
 * Decides whether one original object may be projected. Returns a refusal
 * reason or undefined. Uses the accepted resolver, classifier and effective
 * policy evaluation: no projection-specific classification exists.
 */
function authorizeOriginal(
  state: ImportState,
  resolved: ResolvedPath,
): string | undefined {
  if (!resolved.targetExists) return "original object is missing";
  if (!resolved.insideWorkspace) return "original object resolves outside the workspace";

  const protectedDenial = protectedDenialFor(resolved.canonicalPath, state.options.protectedZones);
  if (protectedDenial !== undefined) return `protected control-plane resource (${protectedDenial.zone})`;

  let classification;
  try {
    classification = classifyPathResource(resolved);
  } catch {
    return "classification failed";
  }
  if (classification.sensitivity !== "ordinary") {
    const reasons = classification.matches.map((match) => match.reason).join(",");
    return `classified ${classification.sensitivity} (${reasons})`;
  }

  try {
    const effective = evaluateEffectivePath("read", resolved, state.options.loaded);
    if (effective.decision === "DENY") return `policy denies read (${effective.reason})`;
  } catch {
    return "effective policy evaluation failed";
  }
  return undefined;
}

async function copyRegularFile(
  state: ImportState,
  resolved: ResolvedPath,
  relativePath: string,
  device: string,
  inode: string,
  mode: number,
  expectedMtimeMs: number,
  expectedSize: number,
): Promise<void> {
  const source = await open(resolved.canonicalPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await source.stat({ bigint: true });
    if (!opened.isFile()) throw new ShellRefusal("IMPORT_OBJECT_REFUSED", "object is not a regular file");
    if (opened.nlink !== 1n) throw new ShellRefusal("IMPORT_OBJECT_REFUSED", "object has nlink != 1");
    if (opened.dev.toString() !== device || opened.ino.toString() !== inode) {
      throw new ShellRefusal("IMPORT_OBJECT_REFUSED", "object identity changed between check and open");
    }
    if (Number(opened.size) !== expectedSize || Number(opened.mtimeMs) !== expectedMtimeMs) {
      throw new ShellRefusal("IMPORT_OBJECT_REFUSED", "object changed between check and open");
    }

    const targetPath = await stagingPathFor(state.options.stagingRoot, relativePath);
    const target = await open(
      targetPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    const hash = createHash("sha256");
    let total = 0;
    try {
      const buffer = Buffer.allocUnsafe(state.limits.copyBufferBytes);
      for (;;) {
        const { bytesRead } = await source.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) break;
        total += bytesRead;
        if (total > state.limits.maxFileBytes) {
          limitExceeded(`file ${relativePath} exceeds the per-file import limit`);
        }
        if (state.bytes + total > state.limits.maxTotalBytes) {
          limitExceeded("projection exceeds the total byte limit");
        }
        hash.update(buffer.subarray(0, bytesRead));
        let written = 0;
        while (written < bytesRead) {
          const result = await target.write(buffer, written, bytesRead - written, null);
          written += result.bytesWritten;
        }
      }
      await target.chmod(mode & 0o777);
    } finally {
      await target.close().catch(() => undefined);
    }

    const after = await source.stat({ bigint: true });
    if (
      after.dev.toString() !== device ||
      after.ino.toString() !== inode ||
      after.nlink !== 1n ||
      Number(after.size) !== expectedSize ||
      Number(after.mtimeMs) !== expectedMtimeMs
    ) {
      throw new ShellRefusal("IMPORT_OBJECT_REFUSED", "object changed while it was read");
    }

    state.bytes += total;
    state.files += 1;
    state.entries.push(
      Object.freeze({
        relativePath,
        kind: "file" as const,
        device,
        inode,
        size: total,
        mode: mode & 0o777,
        nlink: 1,
        sha256: hash.digest("hex"),
        linkText: null,
      }),
    );
  } finally {
    await source.close().catch(() => undefined);
  }
}

async function importDirectory(
  state: ImportState,
  resolved: ResolvedPath,
  relativePath: string,
  device: string,
  inode: string,
  mode: number,
  depth: number,
): Promise<void> {
  const targetPath = await stagingPathFor(state.options.stagingRoot, relativePath);
  if (relativePath.length > 0) {
    await mkdir(targetPath, { mode: 0o700 });
    await chmod(targetPath, mode & 0o777);
    state.directories += 1;
    state.entries.push(
      Object.freeze({
        relativePath,
        kind: "directory" as const,
        device,
        inode,
        size: 0,
        mode: mode & 0o777,
        nlink: 1,
        sha256: null,
        linkText: null,
      }),
    );
  }
  state.imported.add(relativePath);

  if (depth >= state.limits.maxDepth) {
    limitExceeded(`directory depth limit reached below ${relativePath || "."}`);
  }

  let children;
  try {
    children = await readdir(resolved.canonicalPath, { withFileTypes: true });
  } catch {
    refuseImport(state, relativePath, "directory could not be read");
    return;
  }
  const names = children.map((entry) => entry.name).sort();
  for (const name of names) {
    if (state.entries.length + state.deferred.length > state.limits.maxEntries) {
      limitExceeded("projection exceeds the entry limit");
    }
    await importEntry(state, relativePath.length === 0 ? name : `${relativePath}/${name}`, depth + 1);
  }
}

async function importEntry(state: ImportState, relativePath: string, depth: number): Promise<void> {
  const options = state.options;
  const excludedNames = options.excludedDirectoryNames ?? [];
  const segments = relativePath.split("/");
  for (const segment of segments) {
    if (excludedNames.includes(segment)) {
      refuseImport(state, relativePath, `excluded by project decision (${segment})`);
      return;
    }
  }
  if (isExcludedRelative(relativePath, options.excludedRelativeRoots ?? [])) {
    refuseImport(state, relativePath, "excluded project-controlled configuration subtree");
    return;
  }

  let resolved: ResolvedPath;
  try {
    resolved = await resolveWorkspacePath(options.workspaceRoot, relativePath);
  } catch {
    refuseImport(state, relativePath, "path resolution failed");
    return;
  }

  let metadata;
  try {
    metadata = await lstat(resolved.absolutePath, { bigint: true });
  } catch {
    refuseImport(state, relativePath, "original object could not be inspected");
    return;
  }

  const device = metadata.dev.toString();
  const inode = metadata.ino.toString();
  const mode = Number(metadata.mode);
  const nlink = Number(metadata.nlink);

  if (device !== state.rootDevice) {
    refuseImport(state, relativePath, "object is on a different device (mount boundary)");
    return;
  }

  if (metadata.isSymbolicLink()) {
    if (state.symlinks + state.deferred.length > state.limits.maxSymlinks) {
      limitExceeded("projection exceeds the symlink limit");
    }
    if (nlink !== 1) {
      refuseImport(state, relativePath, "symlink has nlink != 1");
      return;
    }
    const authorization = authorizeOriginal(state, resolved);
    if (authorization !== undefined) {
      refuseImport(state, relativePath, authorization);
      return;
    }
    let linkText: string;
    try {
      linkText = await readlink(resolved.absolutePath, { encoding: "utf8" });
    } catch {
      refuseImport(state, relativePath, "symlink target could not be read");
      return;
    }
    if (linkText.includes("\0")) {
      refuseImport(state, relativePath, "symlink target contains a NUL byte");
      return;
    }
    state.symlinks += 1;
    state.deferred.push(
      Object.freeze({
        relativePath,
        absolutePath: resolved.absolutePath,
        device,
        inode,
        nlink,
        linkText,
        canonicalTarget: resolved.canonicalPath,
      }),
    );
    return;
  }

  const authorization = authorizeOriginal(state, resolved);
  if (authorization !== undefined) {
    refuseImport(state, relativePath, authorization);
    return;
  }

  if (metadata.isDirectory()) {
    await importDirectory(state, resolved, relativePath, device, inode, mode, depth);
    return;
  }

  if (!metadata.isFile()) {
    refuseImport(state, relativePath, "object is neither a regular file, directory nor symlink");
    return;
  }
  if (nlink !== 1) {
    refuseImport(state, relativePath, "regular file has nlink != 1 (hard-link alias)");
    return;
  }
  if (Number(metadata.size) > state.limits.maxFileBytes) {
    limitExceeded(`file ${relativePath} exceeds the per-file import limit`);
  }

  try {
    await copyRegularFile(
      state,
      resolved,
      relativePath,
      device,
      inode,
      mode,
      Number(metadata.mtimeMs),
      Number(metadata.size),
    );
    state.imported.add(relativePath);
  } catch (error) {
    if (error instanceof ShellRefusal && error.code === "PROJECTION_LIMIT_EXCEEDED") throw error;
    refuseImport(
      state,
      relativePath,
      error instanceof ShellRefusal ? error.detail : "object could not be copied",
    );
  }
}

/**
 * Second pass: recreate only the symlinks whose text resolves, by lexical
 * resolution inside the projection, to an entry imported by this same
 * invocation and whose lexical resolution agrees with the object's real
 * canonical target. Everything else stays refused.
 */
async function importSymlinks(state: ImportState): Promise<void> {
  const ordered = [...state.deferred].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const index = new Map(state.entries.map((entry) => [entry.relativePath, entry]));
  for (const link of ordered) {
    const directory = path.posix.dirname(link.relativePath);
    const lexical = lexicalResolve(directory === "." ? "" : directory, link.linkText);
    if (lexical === undefined) {
      refuseImport(state, link.relativePath, "symlink target is not a confined relative path");
      continue;
    }
    if (!state.imported.has(lexical)) {
      refuseImport(state, link.relativePath, "symlink target was not imported in this invocation");
      continue;
    }
    if (lexical !== "" && !state.imported.has(lexical.split("/").slice(0, -1).join("/"))) {
      refuseImport(state, link.relativePath, "symlink target parent was not imported");
      continue;
    }
    let realTarget: ResolvedPath;
    try {
      realTarget = await resolveWorkspacePath(state.options.workspaceRoot, lexical);
    } catch {
      refuseImport(state, link.relativePath, "symlink target could not be resolved");
      continue;
    }
    if (realTarget.canonicalPath !== link.canonicalTarget) {
      refuseImport(state, link.relativePath, "symlink resolution is ambiguous");
      continue;
    }
    if (!realTarget.targetExists || !realTarget.insideWorkspace) {
      refuseImport(state, link.relativePath, "symlink target is missing or outside the workspace");
      continue;
    }
    const entry = index.get(lexical);
    if (entry === undefined || entry.kind === "symlink") {
      refuseImport(state, link.relativePath, "symlink target is not an imported file or directory");
      continue;
    }
    const targetPath = await stagingPathFor(state.options.stagingRoot, link.relativePath);
    try {
      await symlink(link.linkText, targetPath);
    } catch {
      refuseImport(state, link.relativePath, "symlink could not be created in the projection");
      continue;
    }
    state.entries.push(
      Object.freeze({
        relativePath: link.relativePath,
        kind: "symlink" as const,
        device: link.device,
        inode: link.inode,
        size: Buffer.byteLength(link.linkText, "utf8"),
        mode: 0o777,
        nlink: link.nlink,
        sha256: null,
        linkText: link.linkText,
      }),
    );
  }
}

/** Lexical resolution of a link target inside the projection root. */
export function lexicalResolve(directory: string, linkText: string): string | undefined {
  if (linkText.length === 0 || linkText.includes("\0")) return undefined;
  if (linkText.startsWith("/")) return undefined;
  const stack = directory === "" ? [] : directory.split("/");
  for (const segment of linkText.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return undefined;
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return stack.join("/");
}

/**
 * Builds the projection. Throws ShellRefusal on a hard failure (limits,
 * staging problems); individual object refusals are recorded, not thrown.
 */
export async function importWorkspace(options: ProjectionOptions): Promise<ProjectionManifest> {
  const startedAt = Date.now();
  await mkdir(options.stagingRoot, { mode: 0o700, recursive: false }).catch((error: unknown) => {
    throw new ShellRefusal(
      "RUNTIME_DIRECTORY_FAILED",
      `staging directory could not be created: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  const rootResolved = await resolveWorkspacePath(options.workspaceRoot, ".");
  let rootMetadata;
  try {
    rootMetadata = await lstat(options.workspaceRoot, { bigint: true });
  } catch (error) {
    throw new ShellRefusal(
      "PROJECTION_FAILED",
      `workspace root could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new ShellRefusal("PROJECTION_FAILED", "workspace root is not a real directory");
  }
  let stagingMetadata;
  try {
    stagingMetadata = await lstat(options.stagingRoot, { bigint: true });
  } catch (error) {
    throw new ShellRefusal(
      "PROJECTION_FAILED",
      `staging root could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!stagingMetadata.isDirectory() || stagingMetadata.isSymbolicLink()) {
    throw new ShellRefusal("PROJECTION_FAILED", "staging root is not a real directory");
  }

  const state: ImportState = {
    options,
    limits: { ...IMPORT_LIMITS, ...(options.limits ?? {}) },
    entries: [],
    refusals: [],
    imported: new Set<string>(),
    deferred: [],
    files: 0,
    directories: 0,
    symlinks: 0,
    bytes: 0,
    rootDevice: rootMetadata.dev.toString(),
    rootInode: rootMetadata.ino.toString(),
    stagingDevice: stagingMetadata.dev.toString(),
    stagingInode: stagingMetadata.ino.toString(),
  };

  await importDirectory(
    state,
    rootResolved,
    "",
    state.rootDevice,
    state.rootInode,
    Number(rootMetadata.mode),
    0,
  );
  await importSymlinks(state);

  return Object.freeze({
    rootRelativePath: "",
    rootDevice: state.rootDevice,
    rootInode: state.rootInode,
    stagingDevice: state.stagingDevice,
    stagingInode: state.stagingInode,
    entries: Object.freeze([...state.entries]),
    refusals: Object.freeze([...state.refusals]),
    files: state.files,
    directories: state.directories,
    symlinks: state.symlinks,
    bytes: state.bytes,
    elapsedMs: Date.now() - startedAt,
  });
}
