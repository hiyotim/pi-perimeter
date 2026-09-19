/**
 * Process-tree quiescence and projection stability.
 *
 * Before any host effect, the invocation must be proven finished. Three
 * independent conditions are established, and the export step refuses unless
 * all of them hold:
 *
 * 1. the invocation's process group is empty after a SIGKILL (the group leader
 *    is created with `setsid`, so it is the session leader too);
 * 2. the process group does not gain a member while the invariant is measured
 *    (a fork from a surviving member would show up here);
 * 3. the projection does not change while the invariant is measured: the
 *    projection is the only writable data root the contained process ever had,
 *    so an active writer *inside* the invocation is observable as a change to
 *    it after the entry process exited.
 *
 * A change observed in the projection after the entry process exited is
 * treated as evidence of a surviving writer and refuses the export outright;
 * the tree is never exported in a state that was still being written.
 *
 * What this does *not* prove (declared, not converted into a residual): a
 * descendant that both escapes the process group (for example by calling
 * `setsid` itself) and stays silent during the measurement window is not
 * observable by this mechanism, because macOS exposes no unprivileged session
 * or descendant handle for it (`kinfo_proc.kp_eproc.e_sess` is zero on the
 * declared target). Such a descendant can still write to the projection after
 * the measurement, which is why the export additionally reads every source
 * object once, seals those bytes, and applies exactly those bytes: a later
 * write cannot change what is written to the host, and the projection is
 * deleted after the invocation. This boundary is specific to child-controlled
 * survivors and is *not* the same-user host-writer boundary.
 */

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { ShellRefusal } from "./errors.ts";
import { runMeasurement, type FreezeArmedRecord } from "./helper.ts";

export const QUIESCENCE_LIMITS = Object.freeze({
  /** How long the process group is given to die after SIGKILL. */
  killTimeoutMs: 5_000,
  /** Length of one quiet measurement. */
  quietWindowMs: 250,
  /** Consecutive quiet measurements required before quiescence is claimed. */
  quietRounds: 2,
  /** Bounds for the stability walk; exports beyond these refuse anyway. */
  maxEntries: 200_000,
  maxDepth: 64,
});

export interface ProjectionSnapshotEntry {
  readonly relativePath: string;
  readonly kind: "file" | "directory" | "symlink";
  readonly size: number;
  readonly mode: number;
  readonly mtimeMs: number;
  readonly device: string;
  readonly inode: string;
  readonly linkText: string | null;
}

export interface ProjectionSnapshot {
  readonly entries: readonly ProjectionSnapshotEntry[];
  readonly sha256: string;
}

function entryKey(entry: ProjectionSnapshotEntry): string {
  return [
    entry.relativePath,
    entry.kind,
    String(entry.size),
    (entry.mode & 0o7777).toString(8),
    String(entry.mtimeMs),
    entry.device,
    entry.inode,
    entry.linkText === null ? "-" : JSON.stringify(entry.linkText),
  ].join("\u0000");
}

export interface RootIdentity {
  readonly device: string;
  readonly inode: string;
}

export interface SnapshotOptions {
  readonly stagingRoot: string;
  /** The native helper performs the whole descriptor-bound walk. */
  readonly helperPath: string;
  /** Recorded staging-root identity; when present, the root object is verified. */
  readonly expectedRoot?: RootIdentity;
  /** Overridable bounds, used by tests to exercise the refusal paths. */
  readonly limits?: Partial<QuiescenceLimits>;
  /** Test-only deterministic interleave: the walker pauses on this entry. */
  readonly pauseName?: string;
  /** Test-only callback that runs while the walker is paused, before release. */
  readonly onPause?: (armed: FreezeArmedRecord) => Promise<void>;
  readonly timeoutMs?: number;
}

/**
 * Structural + metadata snapshot of the projection. Content is not hashed
 * here: the export step reads and seals every exported object itself, so this
 * snapshot exists to detect *writes* (including ones that only add, remove or
 * relink entries) and to re-verify the tree immediately before effects.
 *
 * The walk is descriptor-bound at every step: the host opens the projection
 * root without following symlinks (a real directory, and — when a recorded
 * identity is supplied — the object recorded at import), and the audited
 * native helper re-verifies that descriptor before walking. Every name
 * lookup during the measurement is a single component resolved against a held
 * directory descriptor, so no swap of a path component can redirect a
 * directory open between the identity measurement and the access: directory
 * descent opens with `O_NOFOLLOW` and re-checks the opened object's identity
 * against the just-measured entry, so a directory swapped in the measure→open
 * window is refused at access time, never followed, and a directory outside
 * the projection can never be enumerated into the snapshot. Symlink entries
 * contribute only their link text, read relative to the held descriptor; a
 * link swapped for another link is caught by the next window or the scan's
 * manifest comparison. A partial measurement is never used: any refusal or
 * timeout fails the whole snapshot.
 */
export async function snapshotProjection(options: SnapshotOptions): Promise<ProjectionSnapshot> {
  const limits = { ...QUIESCENCE_LIMITS, ...(options.limits ?? {}) };
  const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
  const root = await open(options.stagingRoot, directoryFlags).catch((error: unknown) => {
    throw new ShellRefusal(
      "EXPORT_FAILED",
      `measured root could not be opened: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  try {
    const identity = await root.stat({ bigint: true });
    if (!identity.isDirectory()) {
      throw new ShellRefusal("EXPORT_FAILED", "the measured root is not a real directory");
    }
    if (
      options.expectedRoot !== undefined &&
      (identity.dev.toString() !== options.expectedRoot.device ||
        identity.ino.toString() !== options.expectedRoot.inode)
    ) {
      throw new ShellRefusal("EXPORT_FAILED", "the measured root identity changed since import");
    }
    const measured = await runMeasurement({
      helperPath: options.helperPath,
      rootFd: root.fd,
      rootDevice: identity.dev.toString(),
      rootInode: identity.ino.toString(),
      limits: { maxEntries: limits.maxEntries, maxDepth: limits.maxDepth },
      pauseName: options.pauseName,
      onPause: options.onPause,
      timeoutMs: options.timeoutMs ?? 120_000,
    });
    const entries: ProjectionSnapshotEntry[] = measured.entries.map((entry) => {
      const kind: ProjectionSnapshotEntry["kind"] =
        (entry.mode & 0o170000) === 0o120000
          ? "symlink"
          : (entry.mode & 0o170000) === 0o040000
            ? "directory"
            : "file";
      return Object.freeze({
        relativePath: entry.relativePath,
        kind,
        size: entry.size,
        mode: entry.mode,
        mtimeMs: Number(entry.mtimeSec) * 1000 + Number(entry.mtimeNsec) / 1e6,
        device: entry.device,
        inode: entry.inode,
        linkText: entry.linkText,
      });
    });
    entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    const hash = createHash("sha256");
    for (const entry of entries) hash.update(entryKey(entry)).update("\n");
    return Object.freeze({ entries: Object.freeze(entries), sha256: hash.digest("hex") });
  } finally {
    await root.close().catch(() => undefined);
  }
}

/**
 * Differences between the tree that was measured and the tree present now.
 * An empty result means every entry matches (identity, type, size, mode,
 * mtime and link text).
 */
export function snapshotDeviation(
  expected: ProjectionSnapshot,
  actual: ProjectionSnapshot,
): readonly string[] {
  if (expected.sha256 === actual.sha256) return Object.freeze([]);
  const deviations: string[] = [];
  const expectedMap = new Map(expected.entries.map((entry) => [entry.relativePath, entry]));
  const actualMap = new Map(actual.entries.map((entry) => [entry.relativePath, entry]));
  for (const [relativePath, entry] of expectedMap) {
    const current = actualMap.get(relativePath);
    if (current === undefined) {
      deviations.push(`${relativePath}: removed`);
      continue;
    }
    if (entryKey(entry) !== entryKey(current)) deviations.push(`${relativePath}: changed`);
  }
  for (const relativePath of actualMap.keys()) {
    if (!expectedMap.has(relativePath)) deviations.push(`${relativePath}: added`);
  }
  deviations.sort();
  return Object.freeze(deviations.slice(0, 32));
}

export type QuiescenceLimits = {
  -readonly [Key in keyof typeof QUIESCENCE_LIMITS]: number;
};

export interface QuiescenceOptions {
  readonly stagingRoot: string;
  /** The native helper performs every projection measurement. */
  readonly helperPath: string;
  /** Recorded staging-root identity; when present, every measurement verifies the root object. */
  readonly rootIdentity?: RootIdentity;
  readonly processGroupHasMembers: (groupId: number) => Promise<boolean>;
  readonly killGroup: () => void;
  /**
   * Processes attributed to the invocation that are still alive. Any survivor
   * refuses the export; the caller may also kill them before this is read.
   */
  readonly survivors: () => Promise<readonly { readonly pid: number }[]>;
  /** Best-effort kill of attributed survivors, attempted before each window. */
  readonly killSurvivors?: (records: readonly { readonly pid: number }[]) => void;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly limits?: Partial<QuiescenceLimits>;
}

export interface QuiescenceResult {
  readonly quiescent: boolean;
  readonly detail: string;
  readonly groupEmpty: boolean;
  readonly stableRounds: number;
  readonly deviations: readonly string[];
  readonly survivors: readonly number[];
  /** Present only when quiescence was established. */
  readonly snapshot: ProjectionSnapshot | undefined;
}

/**
 * Establishes that the invocation is finished *and* that nothing is still
 * writing to its projection. Refusal is the only other outcome; there is no
 * "probably finished" state.
 */
export async function establishTreeQuiescence(options: QuiescenceOptions): Promise<QuiescenceResult> {
  const limits = { ...QUIESCENCE_LIMITS, ...(options.limits ?? {}) };
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  options.killGroup();
  const deadline = Date.now() + limits.killTimeoutMs;
  for (;;) {
    if (!(await options.processGroupHasMembers(-1))) break;
    if (Date.now() >= deadline) {
      return Object.freeze({
        quiescent: false,
        detail: "process group still has members after SIGKILL",
        groupEmpty: false,
        stableRounds: 0,
        deviations: Object.freeze([]),
        survivors: Object.freeze([]),
        snapshot: undefined,
      });
    }
    await sleep(25);
  }

  let previous = await snapshotProjection({
    stagingRoot: options.stagingRoot,
    helperPath: options.helperPath,
    expectedRoot: options.rootIdentity,
    limits,
  });
  let stableRounds = 0;
  for (let round = 0; round < limits.quietRounds; round += 1) {
    await sleep(limits.quietWindowMs);
    if (await options.processGroupHasMembers(-1)) {
      return Object.freeze({
        quiescent: false,
        detail: "the process group gained a member after the kill",
        groupEmpty: false,
        stableRounds,
        deviations: Object.freeze([]),
        survivors: Object.freeze([]),
        snapshot: undefined,
      });
    }
    const survivors = await options.survivors();
    if (survivors.length > 0) {
      options.killSurvivors?.(survivors);
      return Object.freeze({
        quiescent: false,
        detail: `an attributed invocation process survived the entry process (pids ${survivors
          .slice(0, 8)
          .map((record) => record.pid)
          .join(", ")})`,
        groupEmpty: true,
        stableRounds,
        deviations: Object.freeze([]),
        survivors: Object.freeze(survivors.slice(0, 32).map((record) => record.pid)),
        snapshot: undefined,
      });
    }
    const current = await snapshotProjection({
      stagingRoot: options.stagingRoot,
      helperPath: options.helperPath,
      expectedRoot: options.rootIdentity,
      limits,
    });
    if (current.sha256 !== previous.sha256) {
      const deviations = snapshotDeviation(previous, current);
      return Object.freeze({
        quiescent: false,
        detail: `the projection changed after the entry process exited (a surviving writer is active): ${deviations.join(", ") || "entry set changed"}`,
        groupEmpty: true,
        stableRounds,
        deviations,
        survivors: Object.freeze([]),
        snapshot: undefined,
      });
    }
    previous = current;
    stableRounds += 1;
  }

  return Object.freeze({
    quiescent: true,
    detail: `process group empty, no attributed survivor, and projection stable for ${stableRounds} window(s)`,
    groupEmpty: true,
    stableRounds,
    deviations: Object.freeze([]),
    survivors: Object.freeze([]),
    snapshot: previous,
  });
}
