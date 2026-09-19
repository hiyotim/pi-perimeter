/**
 * Controlled export: turns the post-run projection into individually
 * authorized host effects.
 *
 * Rules (contract §11):
 * - the projection is the only export source, and every effect is re-authorized
 *   against current effective policy with a fresh `write` decision;
 * - nothing is deleted or renamed on the host;
 * - existing files are replaced through a descriptor verified against the
 *   import manifest; new files and directories are created by the native
 *   helper relative to a held root descriptor;
 * - child-created or changed symlinks, hard links, non-regular objects,
 *   type changes and host conflicts are refused;
 * - the bytes applied are the sealed buffer read once for this effect.
 */

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, readlink } from "node:fs/promises";
import path from "node:path";

import type { ProtectedZone } from "../policy/control-plane.ts";
import { isInsideProtectedZone } from "../policy/control-plane.ts";
import { ShellRefusal } from "./errors.ts";
import { runExportEffect, type ExportResult } from "./helper.ts";
import type { ProjectionEntry, ProjectionManifest } from "./projection.ts";

export const EXPORT_LIMITS = Object.freeze({
  maxEffects: 20_000,
  /** At or below the helper's buffered payload bound (64 MiB). */
  maxFileBytes: 64 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
  maxDepth: 64,
  effectTimeoutMs: 60_000,
});

export interface ScannedChange {
  readonly relativePath: string;
  readonly kind: "create" | "mkdir" | "replace";
  readonly payload: Buffer;
  readonly sha256: string | null;
  readonly mode: number;
  readonly manifestEntry: ProjectionEntry | undefined;
}

export interface ExportRefusal {
  readonly relativePath: string;
  readonly kind: string;
  readonly reason: string;
}

export interface ProjectionScan {
  readonly changes: readonly ScannedChange[];
  readonly removedInProjection: readonly string[];
  readonly refusals: readonly ExportRefusal[];
  readonly unchanged: number;
}

export interface ScanOptions {
  readonly stagingRoot: string;
  readonly manifest: ProjectionManifest;
  readonly excludedDirectoryNames: readonly string[];
  readonly excludedRelativeRoots: readonly string[];
  readonly protectedZones: readonly ProtectedZone[];
  readonly workspaceRoot: string;
}

async function readSealedBuffer(target: string): Promise<{ payload: Buffer; sha256: string; mode: number }> {
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) throw new ShellRefusal("IMPORT_OBJECT_REFUSED", "projection object is not a regular file");
    if (before.nlink !== 1n) throw new ShellRefusal("EXPORT_CONFLICT", "projection file has nlink != 1");
    if (Number(before.size) > EXPORT_LIMITS.maxFileBytes) {
      throw new ShellRefusal("EXPORT_LIMIT_EXCEEDED", "projection file exceeds the export size limit");
    }
    const payload = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < payload.length) {
      const { bytesRead } = await handle.read(payload, offset, payload.length - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== payload.length) {
      throw new ShellRefusal("EXPORT_CONFLICT", "projection file changed while it was read");
    }
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.nlink !== 1n
    ) {
      throw new ShellRefusal("EXPORT_CONFLICT", "projection file changed while it was read");
    }
    return {
      payload,
      sha256: createHash("sha256").update(payload).digest("hex"),
      mode: Number(before.mode) & 0o777,
    };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function isExcluded(relativePath: string, names: readonly string[], roots: readonly string[]): boolean {
  for (const segment of relativePath.split("/")) {
    if (names.includes(segment)) return true;
  }
  for (const root of roots) {
    if (relativePath === root || relativePath.startsWith(`${root}/`)) return true;
  }
  return false;
}

/**
 * Walks the projection after the command ran and computes the candidate
 * effects. No host effect happens here, and no payload is used before the
 * caller authorizes it.
 */
export async function scanProjection(options: ScanOptions): Promise<ProjectionScan> {
  const manifestFiles = new Map<string, ProjectionEntry>();
  for (const entry of options.manifest.entries) {
    if (entry.relativePath.length > 0) manifestFiles.set(entry.relativePath, entry);
  }
  const seen = new Set<string>();
  const changes: ScannedChange[] = [];
  const refusals: ExportRefusal[] = [];
  let unchanged = 0;
  let totalBytes = 0;

  const refuse = (relativePath: string, kind: string, reason: string): void => {
    if (refusals.length < 4096) refusals.push(Object.freeze({ relativePath, kind, reason }));
  };

  const walk = async (relativeDirectory: string, depth: number): Promise<void> => {
    const absoluteDirectory =
      relativeDirectory === "" ? options.stagingRoot : path.join(options.stagingRoot, relativeDirectory);
    if (depth > EXPORT_LIMITS.maxDepth) {
      refuse(relativeDirectory, "directory", "projection depth limit reached");
      return;
    }
    let children;
    try {
      children = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch {
      refuse(relativeDirectory, "directory", "projection directory could not be read");
      return;
    }
    const names = children.map((entry) => entry.name).sort();
    for (const name of names) {
      const relativePath = relativeDirectory === "" ? name : `${relativeDirectory}/${name}`;
      if (seen.has(relativePath)) {
        refuse(relativePath, "entry", "duplicate projection entry");
        continue;
      }
      seen.add(relativePath);
      if (changes.length + refusals.length > EXPORT_LIMITS.maxEffects) {
        throw new ShellRefusal("EXPORT_LIMIT_EXCEEDED", "projection exceeds the effect limit");
      }
      if (isExcluded(relativePath, options.excludedDirectoryNames, options.excludedRelativeRoots)) {
        refuse(relativePath, "entry", "path is excluded from export by project decision");
        continue;
      }
      const hostPath = path.join(options.workspaceRoot, relativePath);
      if (options.protectedZones.some((zone) => isInsideProtectedZone(hostPath, zone))) {
        refuse(relativePath, "entry", "path is a protected control-plane resource");
        continue;
      }

      let metadata;
      try {
        metadata = await lstat(path.join(absoluteDirectory, name), { bigint: true });
      } catch {
        refuse(relativePath, "entry", "projection entry could not be inspected");
        continue;
      }

      const manifestEntry = manifestFiles.get(relativePath);

      if (metadata.isSymbolicLink()) {
        if (manifestEntry === undefined || manifestEntry.kind !== "symlink") {
          refuse(relativePath, "symlink", "symlinks created in the projection are never exported");
          continue;
        }
        let linkText: string;
        try {
          linkText = await readlink(path.join(absoluteDirectory, name), { encoding: "utf8" });
        } catch {
          refuse(relativePath, "symlink", "projection symlink could not be read");
          continue;
        }
        if (linkText !== manifestEntry.linkText) {
          refuse(relativePath, "symlink", "projection symlink target changed since import");
          continue;
        }
        unchanged += 1;
        continue;
      }

      if (metadata.isDirectory()) {
        if (manifestEntry !== undefined && manifestEntry.kind !== "directory") {
          refuse(relativePath, "directory", "projection entry changed type since import");
          continue;
        }
        if (manifestEntry === undefined) {
          changes.push(
            Object.freeze({
              relativePath,
              kind: "mkdir" as const,
              payload: Buffer.alloc(0),
              sha256: null,
              mode: Number(metadata.mode) & 0o777,
              manifestEntry: undefined,
            }),
          );
        }
        await walk(relativePath, depth + 1);
        continue;
      }

      if (!metadata.isFile()) {
        refuse(relativePath, "entry", "projection entry is not a regular file or directory");
        continue;
      }
      if (metadata.nlink !== 1n) {
        refuse(relativePath, "file", "projection file has nlink != 1");
        continue;
      }
      if (manifestEntry !== undefined && manifestEntry.kind !== "file") {
        refuse(relativePath, "file", "projection entry changed type since import");
        continue;
      }

      let sealed;
      try {
        sealed = await readSealedBuffer(path.join(absoluteDirectory, name));
      } catch (error) {
        refuse(
          relativePath,
          "file",
          error instanceof ShellRefusal ? `${error.code}: ${error.detail}` : "projection file could not be read",
        );
        continue;
      }

      if (
        manifestEntry !== undefined &&
        manifestEntry.sha256 === sealed.sha256 &&
        manifestEntry.mode === sealed.mode
      ) {
        unchanged += 1;
        continue;
      }
      totalBytes += sealed.payload.length;
      if (totalBytes > EXPORT_LIMITS.maxTotalBytes) {
        throw new ShellRefusal("EXPORT_LIMIT_EXCEEDED", "projection exceeds the total export byte limit");
      }
      changes.push(
        Object.freeze({
          relativePath,
          kind: manifestEntry === undefined ? ("create" as const) : ("replace" as const),
          payload: sealed.payload,
          sha256: sealed.sha256,
          mode: sealed.mode,
          manifestEntry,
        }),
      );
    }
  };

  await walk("", 0);

  const removedInProjection: string[] = [];
  for (const entry of options.manifest.entries) {
    if (entry.relativePath.length === 0) continue;
    if (!seen.has(entry.relativePath)) removedInProjection.push(entry.relativePath);
  }

  changes.sort((left, right) => {
    const leftDepth = left.relativePath.split("/").length;
    const rightDepth = right.relativePath.split("/").length;
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;
    return left.relativePath.localeCompare(right.relativePath);
  });

  return Object.freeze({
    changes: Object.freeze(changes),
    removedInProjection: Object.freeze(removedInProjection),
    refusals: Object.freeze(refusals),
    unchanged,
  });
}

export interface EffectAuthorization {
  readonly decision: "ALLOW" | "ASK" | "DENY";
  readonly reason: string;
}

export interface AppliedEffect {
  readonly relativePath: string;
  readonly kind: "create" | "mkdir" | "replace";
  readonly sha256: string | null;
  readonly bytes: number;
  readonly device: string;
  readonly inode: string;
  readonly authorization: string;
}

export interface ApplyOptions {
  readonly helperPath: string;
  readonly rootFd: number;
  readonly workspaceRoot: string;
  readonly manifest: ProjectionManifest;
  readonly changes: readonly ScannedChange[];
  readonly authorize: (change: ScannedChange) => Promise<EffectAuthorization>;
}

export interface ApplyResult {
  readonly applied: readonly AppliedEffect[];
  readonly refusals: readonly ExportRefusal[];
}

/**
 * Applies the authorized changes. Directory identities created during this
 * call are tracked so that later children bind to the created directories.
 */
export async function applyExportChanges(options: ApplyOptions): Promise<ApplyResult> {
  const identities = new Map<string, { device: string; inode: string }>();
  for (const entry of options.manifest.entries) {
    if (entry.relativePath.length === 0) continue;
    identities.set(entry.relativePath, { device: entry.device, inode: entry.inode });
  }

  const applied: AppliedEffect[] = [];
  const refusals: ExportRefusal[] = [];

  for (const change of options.changes) {
    const segments = change.relativePath.split("/");
    const name = segments[segments.length - 1];
    const ancestors = segments.slice(0, -1);

    const components: { device: string; inode: string; name: string }[] = [];
    let missingAncestor: string | undefined;
    for (let index = 0; index < ancestors.length; index += 1) {
      const partial = ancestors.slice(0, index + 1).join("/");
      const identity = identities.get(partial);
      if (identity === undefined) {
        missingAncestor = partial;
        break;
      }
      components.push({ device: identity.device, inode: identity.inode, name: ancestors[index] });
    }
    if (missingAncestor !== undefined) {
      refusals.push(
        Object.freeze({
          relativePath: change.relativePath,
          kind: change.kind,
          reason: `ancestor ${missingAncestor} is not a bound object (no manifest identity or created descriptor)`,
        }),
      );
      continue;
    }

    const authorization = await options.authorize(change);
    if (authorization.decision !== "ALLOW") {
      refusals.push(
        Object.freeze({
          relativePath: change.relativePath,
          kind: change.kind,
          reason: `${authorization.decision}: ${authorization.reason}`,
        }),
      );
      continue;
    }

    let result: ExportResult;
    try {
      result = await runExportEffect({
        helperPath: options.helperPath,
        rootFd: options.rootFd,
        rootDevice: options.manifest.rootDevice,
        rootInode: options.manifest.rootInode,
        components,
        operation: change.kind,
        leafDevice: change.manifestEntry?.device ?? "0",
        leafInode: change.manifestEntry?.inode ?? "0",
        mode: change.mode,
        name,
        payload: change.payload,
        timeoutMs: EXPORT_LIMITS.effectTimeoutMs,
      });
    } catch (error) {
      refusals.push(
        Object.freeze({
          relativePath: change.relativePath,
          kind: change.kind,
          reason: error instanceof ShellRefusal ? `${error.code}: ${error.detail}` : "export effect failed",
        }),
      );
      continue;
    }

    identities.set(change.relativePath, { device: result.device, inode: result.inode });
    applied.push(
      Object.freeze({
        relativePath: change.relativePath,
        kind: change.kind,
        sha256: change.sha256,
        bytes: change.payload.length,
        device: result.device,
        inode: result.inode,
        authorization: authorization.reason,
      }),
    );
  }

  return Object.freeze({ applied: Object.freeze(applied), refusals: Object.freeze(refusals) });
}

/** Opens and verifies the workspace root descriptor used for export binding. */
export async function openBoundRoot(
  workspaceRoot: string,
  manifest: Pick<ProjectionManifest, "rootDevice" | "rootInode">,
): Promise<Awaited<ReturnType<typeof open>>> {
  const handle = await open(workspaceRoot, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat({ bigint: true });
    if (!metadata.isDirectory()) throw new ShellRefusal("EXPORT_FAILED", "workspace root is not a directory");
    if (metadata.dev.toString() !== manifest.rootDevice || metadata.ino.toString() !== manifest.rootInode) {
      throw new ShellRefusal("EXPORT_FAILED", "workspace root identity changed since import");
    }
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
  return handle;
}
