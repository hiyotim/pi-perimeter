/**
 * Frozen export source.
 *
 * The export never reads the live projection: the host copies it into a
 * directory that the contained process — and any descendant that survives it —
 * cannot write, rename, unlink or even read, because the generated profile
 * grants writes only to `staging/`, `home/` and `tmp/` and those grants are
 * fixed for the life of the containment.
 *
 * The copy is descriptor-bound at every step. The host opens the projection
 * root without following symlinks, verifies its identity against the recorded
 * import identity of the staging tree, and hands both root descriptors to the
 * audited native helper. Every name lookup during the copy is a single
 * component resolved against a held directory descriptor of the projection, so
 * no swap of a path component — ancestor or leaf — can redirect a read: the
 * object that is opened is the one the directory-relative identity measurement
 * named, and a regular file is re-checked (identity, link count, size,
 * modification time at nanosecond precision) after its bytes are read.
 * Directory descent opens with `O_NOFOLLOW`: a directory that was swapped for
 * a symlink is refused, never followed.
 *
 * The copy is NOT an atomic snapshot of the tree: a write whose content
 * changes while preserving the size and the exact nanosecond modification
 * time is not detectable, and the frozen bytes are then the writer's bytes —
 * child-controlled output that still passes per-target re-authorization.
 * That residual is declared in the contract (§11) and demonstrated
 * deterministically by the adversarial regressions.
 */

import { constants } from "node:fs";
import { mkdir, open } from "node:fs/promises";

import { ShellRefusal } from "./errors.ts";
import { runFreezeCopy, type FreezeArmedRecord } from "./helper.ts";

export const FREEZE_LIMITS = Object.freeze({
  maxEntries: 200_000,
  maxFileBytes: 256 * 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
  maxDepth: 64,
});

export interface FreezeResult {
  readonly entries: number;
  readonly bytes: number;
}

export interface FreezePauseRecord extends FreezeArmedRecord {}

export interface FreezeOptions {
  readonly helperPath: string;
  /** The projection (staging) root path; opened without following symlinks. */
  readonly sourceRoot: string;
  /** The frozen target; must not exist yet and must live outside every writable root. */
  readonly frozenRoot: string;
  /** Recorded staging-root identity from the import step; re-verified here. */
  readonly stagingDevice: string;
  readonly stagingInode: string;
  /** Test-only deterministic interleave: the helper pauses on this entry. */
  readonly pauseName?: string;
  /** Test-only callback that runs while the helper is paused, before release. */
  readonly onPause?: (armed: FreezePauseRecord) => Promise<void>;
  readonly timeoutMs?: number;
}

/**
 * Copies the projection into `frozenRoot` (which must not exist yet and must
 * live outside every writable root of the containment). Throws ShellRefusal on
 * any inconsistency — a wrong root identity, an unreadable entry, an unsafe
 * object or a write racing the copy: a partial frozen source is never used.
 */
export async function freezeProjection(options: FreezeOptions): Promise<FreezeResult> {
  await mkdir(options.frozenRoot, { mode: 0o700, recursive: false }).catch((error: unknown) => {
    throw new ShellRefusal(
      "EXPORT_FAILED",
      `frozen export source could not be created: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  const source = await open(
    options.sourceRoot,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  ).catch((error: unknown) => {
    throw new ShellRefusal(
      "EXPORT_FAILED",
      `projection root could not be opened for freezing: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  try {
    const identity = await source.stat({ bigint: true });
    if (!identity.isDirectory()) {
      throw new ShellRefusal("EXPORT_FAILED", "the projection root is not a directory");
    }
    if (identity.dev.toString() !== options.stagingDevice || identity.ino.toString() !== options.stagingInode) {
      throw new ShellRefusal("EXPORT_FAILED", "the projection root identity changed since import");
    }
    const target = await open(
      options.frozenRoot,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    ).catch((error: unknown) => {
      throw new ShellRefusal(
        "EXPORT_FAILED",
        `frozen export root could not be opened: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    try {
      const targetIdentity = await target.stat({ bigint: true });
      if (!targetIdentity.isDirectory()) {
        throw new ShellRefusal("EXPORT_FAILED", "the frozen export root is not a directory");
      }
      return await runFreezeCopy({
        helperPath: options.helperPath,
        sourceFd: source.fd,
        targetFd: target.fd,
        stagingDevice: identity.dev.toString(),
        stagingInode: identity.ino.toString(),
        frozenDevice: targetIdentity.dev.toString(),
        frozenInode: targetIdentity.ino.toString(),
        limits: {
          maxEntries: FREEZE_LIMITS.maxEntries,
          maxFileBytes: FREEZE_LIMITS.maxFileBytes,
          maxTotalBytes: FREEZE_LIMITS.maxTotalBytes,
          maxDepth: FREEZE_LIMITS.maxDepth,
        },
        pauseName: options.pauseName,
        onPause: options.onPause,
        timeoutMs: options.timeoutMs ?? 120_000,
      });
    } finally {
      await target.close().catch(() => undefined);
    }
  } finally {
    await source.close().catch(() => undefined);
  }
}
