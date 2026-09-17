/**
 * Bound execution for the controlled `read`, `write`, and `edit` tools.
 *
 * Canonical-path pinning alone does not bind an effect to a filesystem
 * object: a concurrent local process can replace the pinned path with a
 * symlink to another file, or plant a symlinked directory at a missing
 * creation-parent path so that a path-based create/write lands outside the
 * authorized location (owner-reported write escape reproduced on the previous
 * implementation). This module therefore binds effects to verified objects,
 * with two explicit platform classes:
 *
 * Class 1 — descriptor-relative chain execution (preferred; Linux
 * `/proc/self/fd`):
 *
 * - The gate (trusted host code) captures an execution plan immediately after
 *   authorization and before any approval: the dev/ino identity of the
 *   anchor directory (workspace root for workspace targets, `/` for approved
 *   external targets), the target object (or absence for creation), and every
 *   on-path directory component with its identity (or a marker that the
 *   component was missing at plan time).
 * - At execution the chain is walked with directory file descriptors: the
 *   anchor and every existing component are opened with
 *   `O_RDONLY|O_DIRECTORY|O_NOFOLLOW` and their fstat dev/ino must match the
 *   plan. Missing components are created *relative to the currently verified
 *   parent descriptor* (`/proc/self/fd/<fd>/<name>`, probed per process), and
 *   a component that was planned missing must still be missing — any planted
 *   symlink or directory at that name refuses before any effect.
 * - The final leaf is opened/created relative to the verified parent
 *   descriptor with `O_NOFOLLOW` (`O_CREAT|O_EXCL` for creation) and is
 *   fstat-verified (regular file, `nlink === 1`, and for existing targets the
 *   plan's dev/ino plus size/timestamp) before any content is read/written.
 *   `plan.canonicalPath` is never used to resolve a creation effect.
 *
 * Class 2 — verified direct leaf bind (fallback; platforms where
 * descriptor-relative opens are unavailable, e.g. macOS):
 *
 * - Creation is refused outright: a new leaf cannot be bound without
 *   descriptor-relative creation, and a narrowed path race is not accepted as
 *   a substitute. Missing creation parents are refused for the same reason.
 * - For an existing target the leaf is opened from `plan.canonicalPath` with
 *   `O_NOFOLLOW` and fstat-verified against the plan's dev/ino plus the
 *   pre-approval size/timestamp and the `nlink === 1` rule before the effect.
 *   An ancestor swap can therefore only select a *different* object, which
 *   the identity comparison refuses; the effect itself is performed on the
 *   verified descriptor. Inode reuse by a substitute that reproduces the
 *   authorized dev/ino and metadata remains the declared residual of this
 *   class (the same class of residual as controlled search reads).
 *
 * For an existing target the descriptor stays on the verified inode for the
 * whole effect, so later directory-entry swaps cannot redirect it. Support
 * for descriptor-relative opens is probed at runtime. The original
 * unprotected Pi builtins are never used as a fallback: any verification
 * failure throws before a read or write effect.
 */

import { constants } from "node:fs";
import { lstat, open, mkdir, mkdtemp, rm } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const BOUND_EXECUTION_REFUSED_PREFIX = "pi-warden: bound execution refused";

/** Descriptor-level identity of a directory. Directories may be multiply linked. */
export interface ObjectIdentity {
  readonly dev: number;
  readonly ino: number;
}

/**
 * Descriptor-level identity of a regular file target. `nlink` is part of the
 * rule: a regular-file effect only applies to a singly linked file, so a
 * hard-link alias of a secret (or any later additional link) refuses before
 * any effect. `size`/`mtimeMs` additionally pin inode reuse for the direct
 * descriptor-bound plans: a substitute object that happens to reuse the
 * authorized inode number must still match the original size and timestamp
 * captured before approval. Controlled search reads carry only dev/ino/nlink
 * and never claim size/mtime protection. This is a conservative fail-closed
 * POSIX/policy rule, not an inode-isolation claim.
 */
export interface BaseFileIdentity extends ObjectIdentity {
  readonly nlink: number;
}

export interface FileIdentity extends BaseFileIdentity {
  readonly size: number;
  readonly mtimeMs: number;
  readonly isRegular: boolean;
}

/** One verified-chain step: an anchor-relative directory component. */
export interface AncestorStep {
  /** Component name relative to the previous chain step ("" for the anchor). */
  readonly name: string;
  /** Full canonical path of the component at plan time (for reasons only). */
  readonly canonicalPath: string;
  /** Identity at plan capture; `undefined` marks a component that was missing. */
  readonly identity: ObjectIdentity | undefined;
}

export interface ExecutionPlan {
  readonly tool: "read" | "write" | "edit";
  readonly canonicalPath: string;
  /** Basename of the target; effects open this name under the verified parent fd. */
  readonly leafName: string;
  readonly workspaceRoot: string;
  readonly workspaceIdentity: ObjectIdentity;
  readonly targetExists: boolean;
  readonly targetIdentity: FileIdentity | undefined;
  readonly parentPath: string;
  readonly parentIdentity: ObjectIdentity | undefined;
  /**
   * Verified directory chain. First entry is the anchor (workspace root for
   * workspace targets, `/` for approved external targets); later entries walk
   * every directory component from the anchor down to the construction parent,
   * with `identity === undefined` marking components that were missing at
   * plan time (creation-only).
   */
  readonly chain: readonly AncestorStep[];
}

const fdRelativeMountPrefix = "/proc/self/fd";

interface VerifiedDir {
  readonly handle: FileHandle;
  readonly identity: ObjectIdentity;
}

let fdRelativeSupport: Promise<boolean> | undefined;

function isPosixNofollowAvailable(): boolean {
  return (
    constants.O_NOFOLLOW !== undefined &&
    constants.O_DIRECTORY !== undefined
  );
}

export function requirePosixBindingSupport(): void {
  if (!isPosixNofollowAvailable()) {
    throw new Error(`${BOUND_EXECUTION_REFUSED_PREFIX}: O_NOFOLLOW/O_DIRECTORY binding is unavailable on this platform`);
  }
}

/**
 * Probes once per process whether descriptor-relative opens work on this
 * platform: a directory fd is opened with O_NOFOLLOW|O_DIRECTORY and a child
 * is created, re-opened, and read strictly through
 * `/proc/self/fd/<dirfd>/<name>`. The probe never touches anything outside an
 * isolated temporary fixture and fails closed for every effect when
 * unavailable.
 */
function ensureFdRelativeSupport(): Promise<boolean> {
  if (fdRelativeSupport === undefined) {
    fdRelativeSupport = (async () => {
      let parent: FileHandle | undefined;
      let created: FileHandle | undefined;
      let childDir: FileHandle | undefined;
      let fixture: string | undefined;
      try {
        fixture = await mkdtemp(path.join(tmpdir(), "pi-warden-fdprobe-"));
        parent = await open(fixture, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        const probeName = `.pi-warden-probe-${process.pid}`;
        const probePath = path.join(fdRelativeMountPrefix, String(parent.fd), probeName);
        created = await open(probePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW);
        const metadata = await created.stat();
        if (!metadata.isFile() || metadata.nlink !== 1) return false;
        await closeQuietly(created);
        created = undefined;
        // The created file must be readable strictly through the parent fd.
        const probeHandle = await open(probePath, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const stats = await probeHandle.stat();
          if (!stats.isFile()) return false;
        } finally {
          await closeQuietly(probeHandle);
        }
        // Directory creation must also work relative to the descriptor.
        const nestedName = `${probeName}-dir`;
        const nestedPath = path.join(fdRelativeMountPrefix, String(parent.fd), nestedName);
        await mkdir(nestedPath, { mode: 0o700 });
        childDir = await open(nestedPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        const childStats = await childDir.stat();
        if (!childStats.isDirectory()) return false;
        return true;
      } catch {
        return false;
      } finally {
        await closeQuietly(childDir);
        await closeQuietly(created);
        await closeQuietly(parent);
        if (fixture !== undefined) {
          await rm(fixture, { recursive: true, force: true }).catch(() => undefined);
        }
      }
    })();
  }
  return fdRelativeSupport;
}

/**
 * Reports whether descriptor-relative (Class 1) execution is available on
 * this platform. The probe runs once per process and never touches anything
 * outside an isolated temporary fixture. A false result selects the Class 2
 * verified direct leaf bind for existing targets; creation refuses.
 */
export async function descriptorRelativeExecutionAvailable(): Promise<boolean> {
  return (await ensureFdRelativeSupport()) === true;
}

async function requireFdRelativeSupport(): Promise<void> {
  if ((await ensureFdRelativeSupport()) !== true) {
    throw new Error(
      `${BOUND_EXECUTION_REFUSED_PREFIX}: descriptor-relative execution is unavailable on this platform`,
    );
  }
}

async function identityOf(absolutePath: string): Promise<ObjectIdentity> {
  const metadata = await lstat(absolutePath);
  return Object.freeze({ dev: metadata.dev, ino: metadata.ino });
}

async function identityOrMissing(absolutePath: string): Promise<ObjectIdentity | undefined> {
  try {
    return await identityOf(absolutePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

function insideDirectory(workspaceRoot: string, canonicalPath: string): boolean {
  const relative = path.relative(workspaceRoot, canonicalPath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function parentComponents(anchorPath: string, parentPath: string): string[] {
  const relativeParent = path.relative(anchorPath, parentPath);
  if (relativeParent === "" || relativeParent === ".") return [];
  return relativeParent.split(path.sep).filter((part) => part !== "" && part !== ".");
}

/**
 * Captures the execution plan from trusted host code immediately after
 * authorization and before any approval interaction. The plan contains only
 * primitive numbers/strings; it is validated against opened descriptors at
 * execution time and can never cause an effect by itself.
 */
export async function buildExecutionPlan(
  tool: "read" | "write" | "edit",
  resolved: {
    readonly canonicalPath: string;
    readonly workspaceRoot: string;
    readonly targetExists: boolean;
  },
): Promise<ExecutionPlan> {
  requirePosixBindingSupport();

  const workspaceIdentity = await identityOf(resolved.workspaceRoot);
  const leafName = path.basename(resolved.canonicalPath);
  const parentPath = path.dirname(resolved.canonicalPath);
  const parentMetadata = parentPath === resolved.canonicalPath ? undefined : await identityOrMissing(parentPath);
  const parentIdentity = parentMetadata;

  const workspaceTarget = insideDirectory(resolved.workspaceRoot, resolved.canonicalPath);
  const anchorPath = workspaceTarget ? resolved.workspaceRoot : path.sep;
  const anchorIdentity = workspaceTarget ? workspaceIdentity : await identityOf(path.sep);
  const chain: AncestorStep[] = [
    { name: "", canonicalPath: anchorPath, identity: anchorIdentity },
  ];
  let cursor = anchorPath;
  for (const part of parentComponents(anchorPath, parentPath)) {
    const candidate = path.join(cursor, part);
    chain.push({ name: part, canonicalPath: candidate, identity: await identityOrMissing(candidate) });
    cursor = candidate;
  }

  const targetMetadata = resolved.targetExists ? await lstat(resolved.canonicalPath) : undefined;
  let targetIdentity;
  let targetNotRegular = false;
  if (targetMetadata === undefined) {
    targetIdentity = undefined;
  } else {
    targetIdentity = Object.freeze({
      dev: targetMetadata.dev,
      ino: targetMetadata.ino,
      nlink: targetMetadata.nlink,
      size: targetMetadata.size,
      mtimeMs: Math.round(targetMetadata.mtimeMs),
      isRegular: targetMetadata.isFile(),
    });
    if (!targetMetadata.isFile()) targetNotRegular = true;
    if (targetMetadata.nlink !== 1) {
      // Conservative fail-closed rule: a regular-file effect refuses any
      // multiply linked target, including a hard-link alias of a secret.
      throw new Error(`${BOUND_EXECUTION_REFUSED_PREFIX}: target is hard-linked (nlink ${targetMetadata.nlink})`);
    }
  }
  if (targetNotRegular) {
    throw new Error(`${BOUND_EXECUTION_REFUSED_PREFIX}: target exists but is not a regular file`);
  }

  return {
    tool,
    canonicalPath: resolved.canonicalPath,
    leafName,
    workspaceRoot: resolved.workspaceRoot,
    workspaceIdentity,
    targetExists: resolved.targetExists,
    targetIdentity,
    parentPath,
    parentIdentity,
    chain: Object.freeze(chain),
  };
}

function refusal(detail: string): Error {
  return new Error(`${BOUND_EXECUTION_REFUSED_PREFIX}: ${detail}`);
}

async function closeQuietly(handle: FileHandle | undefined): Promise<void> {
  if (handle !== undefined) {
    await handle.close().catch(() => undefined);
  }
}

function matchesIdentity(flags: { dev: number; ino: number }, expected: ObjectIdentity | undefined): boolean {
  return expected !== undefined && flags.dev === expected.dev && flags.ino === expected.ino;
}

function fdRelativeChild(parent: VerifiedDir, name: string): string {
  return path.join(fdRelativeMountPrefix, String(parent.handle.fd), name);
}

/** Opens the verified anchor directory (workspace root / external root entry). */
async function openVerifiedAnchor(step: AncestorStep): Promise<VerifiedDir> {
  if (step.identity === undefined) throw refusal("execution anchor has no verified identity");
  let handle;
  try {
    handle = await open(step.canonicalPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  } catch {
    throw refusal("anchor could not be opened as a verified directory (possible substitution)");
  }
  try {
    const stats = await handle.stat();
    if (!matchesIdentity(stats, step.identity) || !stats.isDirectory()) {
      throw refusal("anchor identity does not match the authorized plan");
    }
    return { handle, identity: step.identity };
  } catch (error) {
    await closeQuietly(handle);
    throw error;
  }
}

/**
 * Opens/creates the next chain component strictly relative to the verified
 * parent descriptor. Existing components must still be directories with the
 * plan identity; a component planned missing must still be missing, and any
 * planted entry at that name refuses. Creation is performed only through the
 * verified parent descriptor (no path-based mkdir).
 */
async function openOrPrepareChainStep(
  parent: VerifiedDir,
  step: AncestorStep,
  allowCreate: boolean,
): Promise<VerifiedDir> {
  const childPath = path.join(fdRelativeMountPrefix, String(parent.handle.fd), step.name);
  if (step.identity === undefined) {
    if (!allowCreate) {
      throw refusal(`${step.canonicalPath} was missing at authorization and must exist for this effect`);
    }
    let probe;
    try {
      probe = await lstat(childPath);
    } catch (error) {
      if (
        !(typeof error === "object" && error !== null && "code" in error) ||
        (error as { code?: unknown }).code !== "ENOENT"
      ) {
        throw refusal(`${step.canonicalPath} could not be checked before creation`);
      }
      probe = undefined;
    }
    if (probe !== undefined) {
      // The component was planned missing but now exists (e.g. a planted
      // symlinked directory): refuse before creating anything under it.
      throw refusal(`${step.canonicalPath} was missing at authorization but is substituted now`);
    }
    try {
      await mkdir(childPath, { mode: 0o700 });
    } catch {
      throw refusal(`${step.canonicalPath} could not be created relative to the verified parent`);
    }
    // Bind the freshly created directory by opening it relative to the same
    // verified parent descriptor.
    let created;
    try {
      created = await open(childPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    } catch {
      throw refusal(`${step.canonicalPath} could not be opened after creation`);
    }
    try {
      const stats = await created.stat();
      if (!stats.isDirectory()) {
        throw refusal(`${step.canonicalPath} is not a directory after creation`);
      }
      return { handle: created, identity: { dev: stats.dev, ino: stats.ino } };
    } catch (error) {
      await closeQuietly(created);
      throw error;
    }
  }

  // Existing component: must still be that exact directory object.
  let handle;
  try {
    handle = await open(childPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  } catch {
    throw refusal(`${step.canonicalPath} could not be opened as a verified ancestor (possible substitution)`);
  }
  try {
    const stats = await handle.stat();
    if (!matchesIdentity(stats, step.identity) || !stats.isDirectory()) {
      throw refusal(`${step.canonicalPath} identity does not match the authorized ancestor`);
    }
    return { handle, identity: step.identity };
  } catch (error) {
    await closeQuietly(handle);
    throw error;
  }
}

interface ChainWalk {
  readonly parent: VerifiedDir;
  readonly release: () => Promise<void>;
}

/**
 * Walks the planned chain from the verified anchor down to the construction
 * parent, holding verified directory descriptors the whole way. Creation of
 * missing components (write paths only) is strictly fd-relative; any planted
 * symlink, replaced directory, or identity mismatch refuses before any effect.
 */
async function verifiedParentDir(plan: ExecutionPlan, allowCreate: boolean): Promise<ChainWalk> {
  await requireFdRelativeSupport();
  const opened: FileHandle[] = [];
  let current = await openVerifiedAnchor(plan.chain[0]);
  opened.push(current.handle);
  for (let index = 1; index < plan.chain.length; index += 1) {
    const next = await openOrPrepareChainStep(current, plan.chain[index], allowCreate);
    opened.push(next.handle);
    current = next;
  }
  return {
    parent: current,
    release: async () => {
      for (const handle of opened) await closeQuietly(handle);
    },
  };
}

/**
 * Verifies an opened leaf descriptor against the captured plan before any
 * effect. Creation plans require a fresh singly linked regular file; existing
 * plans require the exact dev/ino plus the pre-approval size/timestamp and a
 * link count of exactly 1.
 */
async function verifyPlannedLeaf(handle: FileHandle, plan: ExecutionPlan): Promise<void> {
  const stats = await handle.stat();
  if (plan.targetIdentity === undefined) {
    // Freshly created (O_CREAT|O_EXCL) leaf: must be a singly linked file.
    if (!stats.isFile()) throw refusal("created target is not a regular file");
    if (stats.nlink !== 1) throw refusal("created target reports a hard-linked identity");
    return;
  }
  if (!matchesIdentity(stats, plan.targetIdentity)) {
    throw refusal("target identity does not match the authorized object");
  }
  if (!plan.targetIdentity.isRegular) {
    throw refusal("authorized target is not a regular file");
  }
  if (stats.size !== plan.targetIdentity.size || Math.round(stats.mtimeMs) !== plan.targetIdentity.mtimeMs) {
    // Inode-number reuse by a substitute object is still refused because
    // the original size/timestamp captured pre-approval do not match.
    throw refusal("target identity does not match the authorized object (size/timestamp)");
  }
  if (stats.nlink !== plan.targetIdentity.nlink) {
    // An additional link added after the plan must refuse before any effect.
    throw refusal("target link count changed since authorization");
  }
  if (stats.nlink !== 1) {
    // Conservative hard-link rule: regular-file effects only apply to
    // singly linked files, so a hard-link alias of a secret never executes.
    throw refusal("target is hard-linked (nlink must be 1)");
  }
  if (!stats.isFile()) {
    throw refusal("authorized target is not a regular file");
  }
}

/** Opens the planned leaf strictly relative to a verified parent directory fd. */
async function openLeafFromParent(
  parent: VerifiedDir,
  plan: ExecutionPlan,
  flags: number,
): Promise<FileHandle> {
  const leafPath = path.join(fdRelativeMountPrefix, String(parent.handle.fd), plan.leafName);
  let handle;
  try {
    handle = await open(leafPath, flags | constants.O_NOFOLLOW);
  } catch {
    throw refusal("target could not be safely opened relative to the verified parent (possible substitution)");
  }
  try {
    await verifyPlannedLeaf(handle, plan);
    return handle;
  } catch (error) {
    await closeQuietly(handle);
    throw error;
  }
}

function hasMissingPlannedComponent(plan: ExecutionPlan): boolean {
  return plan.chain.some((step) => step.identity === undefined);
}

/**
 * Class 2 (fallback) binding for an existing target on platforms without
 * descriptor-relative execution: open the planned canonical path with
 * `O_NOFOLLOW` and require the opened object to match the plan's identity and
 * pre-approval metadata. Creation — a missing leaf or any component that was
 * missing at authorization — refuses outright; a path-based create is never
 * attempted.
 */
async function openVerifiedLeafDirect(plan: ExecutionPlan, flags: number): Promise<FileHandle> {
  if (!plan.targetExists || plan.targetIdentity === undefined || hasMissingPlannedComponent(plan)) {
    throw refusal(
      "creation requires descriptor-relative execution support, which is unavailable on this platform; the create variant is refused instead of using a path-based create",
    );
  }
  let handle;
  try {
    handle = await open(plan.canonicalPath, flags | constants.O_NOFOLLOW);
  } catch {
    throw refusal("target could not be safely opened with O_NOFOLLOW on this platform (possible substitution)");
  }
  try {
    await verifyPlannedLeaf(handle, plan);
    return handle;
  } catch (error) {
    await closeQuietly(handle);
    throw error;
  }
}

/** Applies one edit with exact, unique oldText matching; ambiguity refuses. */
function applyExactEdits(content: string, edits: readonly { oldText: string; newText: string }[]): string {
  let current = content;
  for (const edit of edits) {
    const first = current.indexOf(edit["oldText"]);
    if (first === -1) {
      throw new Error("pi-warden: controlled edit requires an exact unique oldText match");
    }
    const second = current.indexOf(edit["oldText"], first + 1);
    if (second !== -1) {
      throw new Error("pi-warden: controlled edit refuses ambiguous (multiple) oldText matches");
    }
    current = current.slice(0, first) + edit["newText"] + current.slice(first + edit["oldText"].length);
  }
  return current;
}

/** Reads the authorized object through the verified descriptor chain. */
export async function executeBoundRead(
  plan: ExecutionPlan,
  options: { offset?: number; limit?: number },
): Promise<{ text: string; truncated: boolean }> {
  requirePosixBindingSupport();
  const relativeExecution = await descriptorRelativeExecutionAvailable();
  let parent, handle;
  try {
    if (relativeExecution) {
      parent = await verifiedParentDir(plan, false);
      handle = await openLeafFromParent(parent.parent, plan, constants.O_RDONLY);
    } else {
      handle = await openVerifiedLeafDirect(plan, constants.O_RDONLY);
    }
    const raw = await handle.readFile("utf-8");
    const allLines = raw.split("\n");
    const totalFileLines = allLines.length;
    const startLine = options.offset ? Math.max(0, options.offset - 1) : 0;
    if (startLine >= allLines.length) {
      throw new Error(`pi-warden: offset ${options.offset} is beyond end of file (${totalFileLines} lines total)`);
    }
    const selected =
      options.limit !== undefined
        ? allLines.slice(startLine, Math.min(startLine + options.limit, allLines.length))
        : allLines.slice(startLine);
    let text = selected.join("\n");
    let truncated = false;
    if (selected.length > 2000) {
      text = selected.slice(0, 2000).join("\n");
      truncated = true;
    }
    if (Buffer.byteLength(text, "utf-8") > 50 * 1024) {
      text = text.slice(0, 50 * 1024);
      truncated = true;
    }
    if (truncated) {
      text += `\n[pi-warden: truncated controlled read; continue with offset]`;
    }
    return { text, truncated };
  } finally {
    await closeQuietly(handle);
    if (parent !== undefined) await parent.release();
  }
}

/** Overwrites the authorized object through its verified descriptor, or creates it. */
export async function executeBoundWrite(plan: ExecutionPlan, content: string): Promise<void> {
  requirePosixBindingSupport();
  const relativeExecution = await descriptorRelativeExecutionAvailable();
  let parent;
  let handle;
  try {
    if (relativeExecution) {
      parent = await verifiedParentDir(plan, true);
      handle = plan.targetExists
        ? await openLeafFromParent(parent.parent, plan, constants.O_WRONLY)
        : await openCreatableLeafFromParent(parent.parent, plan);
    } else {
      handle = await openVerifiedLeafDirect(plan, constants.O_WRONLY);
    }
    try {
      if (plan.targetExists) {
        await handle.truncate(0);
        await handle.write(content, 0, "utf-8");
      } else {
        const stats = await handle.stat();
        if (!stats.isFile() || stats.nlink !== 1) {
          throw refusal("created target must be a singly linked regular file");
        }
        await handle.write(content, 0, "utf-8");
      }
    } finally {
      await closeQuietly(handle);
    }
  } finally {
    if (parent !== undefined) await parent.release();
  }
}

/** Creates the leaf exclusively through a verified parent directory fd. */
async function openCreatableLeafFromParent(
  parent: VerifiedDir,
  plan: ExecutionPlan,
): Promise<FileHandle> {
  const leafPath = path.join(fdRelativeMountPrefix, String(parent.handle.fd), plan.leafName);
  // The leaf must still be missing under the verified parent: any planted
  // entry (symlink/file/dir) refuses before creation.
  let probe;
  try {
    probe = await lstat(leafPath);
  } catch (error) {
    if (
      !(typeof error === "object" && error !== null && "code" in error) ||
      (error as { code?: unknown }).code !== "ENOENT"
    ) {
      throw refusal("target state could not be checked before creation");
    }
    probe = undefined;
  }
  if (probe !== undefined) {
    throw refusal("target substituted after authorization (no longer missing)");
  }
  let handle;
  try {
    handle = await open(leafPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW);
  } catch {
    throw refusal("target creation failed relative to the verified parent (possible concurrent substitution)");
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.nlink !== 1) {
      throw refusal("created target must be a singly linked regular file");
    }
    return handle;
  } catch (error) {
    await closeQuietly(handle);
    throw error;
  }
}

/** Edits the authorized object through its verified descriptor. */
export async function executeBoundEdit(
  plan: ExecutionPlan,
  edits: readonly { oldText: string; newText: string }[],
): Promise<string> {
  requirePosixBindingSupport();
  const relativeExecution = await descriptorRelativeExecutionAvailable();
  if (edits.length === 0) {
    throw new Error("pi-warden: controlled edit requires at least one edit");
  }
  let parent, handle;
  try {
    if (relativeExecution) {
      parent = await verifiedParentDir(plan, false);
      handle = await openLeafFromParent(parent.parent, plan, constants.O_RDWR);
    } else {
      handle = await openVerifiedLeafDirect(plan, constants.O_RDWR);
    }
    const content = await handle.readFile("utf-8");
    const updated = applyExactEdits(content, edits);
    await handle.truncate(0);
    await handle.write(updated, 0, "utf-8");
    return updated;
  } finally {
    await closeQuietly(handle);
    if (parent !== undefined) await parent.release();
  }
}

/**
 * Reads one authorized file through a verified descriptor for search tools.
 * The expected identity (dev/ino/nlink) is captured from trusted host code at
 * entry evaluation — BEFORE the read — and is passed in; this function never
 * recaptures the current path identity after a possible substitution. A
 * different inode, symlink swap, or hard-linked alias after evaluation is
 * refused before any content effect. Bounded residual for search: only
 * dev/ino/nlink are verified (no size/mtime capture for search reads).
 */
export async function readBoundFileContent(canonicalPath: string): Promise<string>;
export async function readBoundFileContent(canonicalPath: string, expectedIdentity?: BaseFileIdentity): Promise<string>;
export async function readBoundFileContent(
  canonicalPath: string,
  expectedIdentity?: BaseFileIdentity,
): Promise<string> {
  if (!isPosixNofollowAvailable()) {
    throw refusal("O_NOFOLLOW binding is unavailable on this platform");
  }
  if (expectedIdentity !== undefined) {
    if (expectedIdentity.nlink !== 1) {
      // Conservative hard-link rule: never read a multiply linked object.
      throw refusal("candidate is hard-linked (nlink must be 1)");
    }
  }
  let handle;
  try {
    handle = await open(canonicalPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw refusal("candidate could not be safely opened with O_NOFOLLOW");
  }
  try {
    const stats = await handle.stat();
    if (!matchesIdentity(stats, expectedIdentity ?? undefined) || !stats.isFile()) {
      throw refusal("candidate identity changed between check and open");
    }
    if (stats.nlink !== 1) {
      // Refuse a link added after the check before any content is returned.
      throw refusal("candidate is hard-linked (nlink must be 1)");
    }
    return await handle.readFile("utf-8");
  } finally {
    await closeQuietly(handle);
  }
}
