/**
 * One contained shell invocation: runtime directories, projection, profile,
 * launch, quiescence, export and cleanup.
 *
 * This module owns the lifecycle. Policy, approvals and classification are
 * decided before it is called; the native helper and the Seatbelt profile are
 * the enforcement boundary while the child runs. Nothing here can fall back to
 * an uncontained process: every failure ends in a refusal.
 */

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import { release as osRelease, tmpdir, version as osVersion } from "node:os";
import path from "node:path";

import type { LoadedPolicySources } from "../policy/config-loader.ts";
import type { ProtectedZone } from "../policy/control-plane.ts";
import { ShellRefusal } from "./errors.ts";
import { applyExportChanges, openBoundRoot, scanProjection, type AppliedEffect, type EffectAuthorization, type ExportRefusal } from "./export.ts";
import { runHelperSelfTest, spawnContainedProcess, verifyHelper, type HelperIdentity, type HelperSelfTest } from "./helper.ts";
import { importWorkspace, type ProjectionManifest } from "./projection.ts";
import { sampleProcessTable, startCensusWatch, survivingInvocationProcesses } from "./census.ts";
import { freezeProjection } from "./freeze.ts";
import { establishTreeQuiescence, snapshotDeviation, snapshotProjection } from "./quiescence.ts";
import { applySealedEdits, buildShellPlan, shellQuoteLiteral } from "../policy/shell-plan.ts";
import { deriveToolchainRoot, generateSeatbeltProfile, type SeatbeltProfile } from "./seatbelt.ts";
import {
  NETWORK_BROKER_LIMITS,
  openNetworkBroker,
  pinDestination,
  type NetworkBroker,
  type NetworkBrokerScope,
  type PinnedDestination,
} from "./network-broker.ts";

/** Pinned identity of the containment mechanism for the declared target. */
const SANDBOX_EXEC_PATH = "/usr/bin/sandbox-exec";
const SANDBOX_EXEC_SHA256 = "58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8";
const SUPPORTED_DARWIN_MAJOR = 27;

export const SHELL_LIMITS = Object.freeze({
  maxStreamedOutputBytes: 8 * 1024 * 1024,
  maxSealedInputBytes: 8 * 1024 * 1024,
  quiescenceTimeoutMs: 5_000,
  defaultTimeoutMs: 120_000,
  maxTimeoutMs: 600_000,
  importTimeoutMs: 120_000,
});

/** A composed destination entry the host must pin before spawn. */
export interface NetworkScopeEntry {
  readonly host: string;
  readonly ports: readonly number[];
}

/**
 * The prepared network route: pinned addresses (resolved once, host-side, at
 * preparation), the broker endpoint, and its non-secret scope description.
 */
export interface PreparedNetworkScope {
  readonly brokerPort: number;
  readonly entries: readonly {
    readonly host: string;
    readonly ports: readonly number[];
    readonly addressCount: number;
    readonly families: readonly string[];
  }[];
  /** Enables tunnel service; called only when the invocation starts. */
  arm(): void;
  stats(): { readonly tunnelsOpened: number; readonly tunnelsRefused: number; readonly tunnelsFailed: number; readonly bytesRelayed: number };
}

export interface PlatformIdentity {
  readonly platform: string;
  readonly arch: string;
  readonly darwinMajor: number;
  readonly osVersion: string;
  readonly sandboxExecSha256: string;
  readonly helper: HelperIdentity;
  readonly helperSelfTest: HelperSelfTest;
}

async function sha256File(target: string): Promise<string> {
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
    return hash.digest("hex");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/**
 * Verifies the declared platform target and the containment mechanism. Any
 * deviation blocks the shell route: passing this check never extends support
 * to another OS version, architecture, or `sandbox-exec` build.
 */
export async function verifyPlatform(helperPath: string, buildManifestPath: string): Promise<PlatformIdentity> {
  if (process.platform !== "darwin") {
    throw new ShellRefusal("PLATFORM_UNSUPPORTED", `platform ${process.platform} is not supported`);
  }
  if (process.arch !== "arm64") {
    throw new ShellRefusal("PLATFORM_UNSUPPORTED", `architecture ${process.arch} is not supported`);
  }
  const kernelRelease = osRelease();
  const darwinMajor = Number(kernelRelease.split(".")[0] ?? "0");
  if (!Number.isInteger(darwinMajor) || darwinMajor !== SUPPORTED_DARWIN_MAJOR) {
    throw new ShellRefusal(
      "PLATFORM_UNSUPPORTED",
      `Darwin ${kernelRelease} is outside the declared target (major ${SUPPORTED_DARWIN_MAJOR})`,
    );
  }

  let metadata;
  try {
    metadata = await lstat(SANDBOX_EXEC_PATH);
  } catch {
    throw new ShellRefusal("SANDBOX_EXEC_UNTRUSTED", `${SANDBOX_EXEC_PATH} is missing`);
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    throw new ShellRefusal("SANDBOX_EXEC_UNTRUSTED", `${SANDBOX_EXEC_PATH} is not a singly-linked regular file`);
  }
  if (metadata.uid !== 0 || metadata.gid !== 0 || (metadata.mode & 0o777) !== 0o755) {
    throw new ShellRefusal("SANDBOX_EXEC_UNTRUSTED", `${SANDBOX_EXEC_PATH} ownership or mode is unexpected`);
  }
  const sandboxExecSha256 = await sha256File(SANDBOX_EXEC_PATH);
  if (sandboxExecSha256 !== SANDBOX_EXEC_SHA256) {
    throw new ShellRefusal(
      "SANDBOX_EXEC_UNTRUSTED",
      `${SANDBOX_EXEC_PATH} identity does not match the recorded target build; the shell route stays blocked until it is re-verified`,
    );
  }

  const helper = await verifyHelper(helperPath, buildManifestPath);
  const helperSelfTest = await runHelperSelfTest(helperPath);
  return Object.freeze({
    platform: process.platform,
    arch: process.arch,
    darwinMajor,
    osVersion: osVersion(),
    sandboxExecSha256,
    helper,
    helperSelfTest,
  });
}

export interface ContainmentPaths {
  readonly base: string;
  readonly control: string;
  readonly staging: string;
  readonly home: string;
  readonly tmp: string;
  readonly sealed: string;
  readonly profilePath: string;
}

/** Removes one invocation tree without following symlinks anywhere. */
export async function removeInvocationArtifacts(base: string): Promise<void> {
  const stripReadOnly = async (target: string, depth: number): Promise<void> => {
    if (depth > 128) return;
    let entries;
    try {
      await chmod(target, 0o700);
      entries = await readdir(target, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childPath = path.join(target, entry.name);
      if (entry.isSymbolicLink() || entry.isFile()) {
        await unlink(childPath).catch(() => undefined);
        continue;
      }
      if (entry.isDirectory()) {
        await stripReadOnly(childPath, depth + 1);
        await rmdir(childPath).catch(() => undefined);
      }
    }
  };
  await stripReadOnly(base, 0);
  await rmdir(base).catch(() => undefined);
  await rm(base, { recursive: true, force: true }).catch(() => undefined);
}


function buildEnvironment(
  toolchainRoot: string,
  homeRoot: string,
  tmpRoot: string,
  brokerPort: number | undefined,
): Record<string, string> {
  const environment: Record<string, string> = {
    PATH: `${path.join(toolchainRoot, "bin")}:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: homeRoot,
    TMPDIR: tmpRoot,
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
    SHELL: "/bin/bash",
  };
  if (brokerPort === undefined) return environment;
  // The one network route: the per-invocation broker on IPv4 loopback.
  // Constructed values (never inherited); their exact bytes are part of the
  // environment hash in the approval binding.
  const proxy = `http://127.0.0.1:${brokerPort}`;
  for (const key of [
    "HTTP_PROXY",
    "http_proxy",
    "HTTPS_PROXY",
    "https_proxy",
    "ALL_PROXY",
    "all_proxy",
  ]) {
    environment[key] = proxy;
  }
  environment["NO_PROXY"] = "";
  environment["no_proxy"] = "";
  environment["npm_config_proxy"] = proxy;
  environment["npm_config_https_proxy"] = proxy;
  return environment;
}

async function createContainmentPaths(base: string): Promise<ContainmentPaths> {
  const root = path.join(base, "invocation");
  await mkdir(root, { mode: 0o700 });
  const control = path.join(root, "control");
  const staging = path.join(root, "staging");
  const home = path.join(root, "home");
  const tmp = path.join(root, "tmp");
  const sealed = path.join(root, "sealed");
  await mkdir(control, { mode: 0o700 });
  await mkdir(home, { mode: 0o700 });
  await mkdir(tmp, { mode: 0o700 });
  await mkdir(sealed, { mode: 0o700 });
  return {
    base: root,
    control,
    staging,
    home,
    tmp,
    sealed,
    profilePath: path.join(control, "profile.sbpl"),
  };
}

export interface SealedInputRecord {
  readonly logicalPath: string;
  readonly sealedPath: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface PrepareContainedOptions {
  readonly command: string;
  readonly workspaceRoot: string;
  readonly loaded: LoadedPolicySources;
  readonly protectedZones: readonly ProtectedZone[];
  readonly trustedUserConfigRoot: string;
  readonly helperPath: string;
  readonly buildManifestPath: string;
  /** Logical projection paths whose bytes must be bound before execution. */
  readonly sealedInputs: readonly string[];
  /**
   * The composed network scope. Absent or empty: the invocation has no
   * network route at all. Non-empty: the host pins every entry (resolution
   * failures refuse the invocation), opens the broker, and the profile gains
   * exactly its endpoint.
   */
  readonly networkScope?: readonly NetworkScopeEntry[];
  readonly runtimeBaseDirectory?: string;
}

export interface PreparedContainedInvocation {
  readonly paths: ContainmentPaths;
  readonly profile: SeatbeltProfile;
  readonly manifest: ProjectionManifest;
  readonly platform: PlatformIdentity;
  readonly workspaceRoot: string;
  readonly protectedZones: readonly ProtectedZone[];
  readonly helperPath: string;
  readonly buildManifestPath: string;
  readonly toolchainRoot: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly sealedInputs: readonly SealedInputRecord[];
  /** The prepared network route; undefined when the invocation has none. */
  readonly network: PreparedNetworkScope | undefined;
  /** Entry text after sealed-input rewriting; the exact executed command. */
  readonly command: string;
  readonly rootFd: number;
  dispose(): Promise<void>;
}

async function sealInputs(
  paths: ContainmentPaths,
  logicalPaths: readonly string[],
): Promise<{ records: SealedInputRecord[]; replacements: string[] }> {
  const records: SealedInputRecord[] = [];
  const replacements: string[] = [];
  let index = 0;
  for (const logicalPath of logicalPaths) {
    const sourcePath = path.join(paths.staging, logicalPath);
    let handle;
    try {
      handle = await open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch {
      throw new ShellRefusal("IMPORT_OBJECT_REFUSED", `bound script input ${logicalPath} is not readable in the projection`);
    }
    try {
      const before = await handle.stat({ bigint: true });
      if (!before.isFile()) {
        throw new ShellRefusal("IMPORT_OBJECT_REFUSED", `bound script input ${logicalPath} is not a regular file`);
      }
      if (before.nlink !== 1n) {
        throw new ShellRefusal("IMPORT_OBJECT_REFUSED", `bound script input ${logicalPath} has nlink != 1`);
      }
      if (Number(before.size) > SHELL_LIMITS.maxSealedInputBytes) {
        throw new ShellRefusal("IMPORT_OBJECT_REFUSED", `bound script input ${logicalPath} exceeds the sealed input limit`);
      }
      const payload = Buffer.alloc(Number(before.size));
      let offset = 0;
      while (offset < payload.length) {
        const { bytesRead } = await handle.read(payload, offset, payload.length - offset, null);
        if (bytesRead === 0) break;
        offset += bytesRead;
      }
      if (offset !== payload.length) {
        throw new ShellRefusal("IMPORT_OBJECT_REFUSED", `bound script input ${logicalPath} changed while it was read`);
      }
      const after = await handle.stat({ bigint: true });
      if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
        throw new ShellRefusal("IMPORT_OBJECT_REFUSED", `bound script input ${logicalPath} changed while it was read`);
      }
      const sha256 = createHash("sha256").update(payload).digest("hex");
      const sealedPath = path.join(paths.sealed, `${sha256.slice(0, 32)}-${index}.sh`);
      await writeFile(sealedPath, payload, { mode: 0o400, flag: "wx" });
      records.push(
        Object.freeze({ logicalPath, sealedPath, sha256, bytes: payload.length }),
      );
      replacements.push(shellQuoteLiteral(sealedPath));
      index += 1;
    } finally {
      await handle.close().catch(() => undefined);
    }
  }
  return { records, replacements };
}

/**
 * Prepares one invocation without executing anything: platform and helper
 * verification, profile generation, projection, bound root descriptor and
 * sealed inputs. The caller may present an approval between preparation and
 * execution; the prepared state is private host state with no child process.
 */
export async function prepareContainedInvocation(
  options: PrepareContainedOptions,
): Promise<PreparedContainedInvocation> {
  const platform = await verifyPlatform(options.helperPath, options.buildManifestPath);

  const toolchainRoot = deriveToolchainRoot(process.execPath, process.env["HOME"]);
  if (toolchainRoot === undefined) {
    throw new ShellRefusal("PROFILE_GENERATION_FAILED", "toolchain root could not be derived from the runtime executable");
  }
  try {
    const toolchainMetadata = await lstat(path.join(toolchainRoot, "lib"));
    if (!toolchainMetadata.isDirectory()) {
      throw new ShellRefusal("PROFILE_GENERATION_FAILED", "toolchain root does not contain a lib directory");
    }
  } catch (error) {
    if (error instanceof ShellRefusal) throw error;
    throw new ShellRefusal("PROFILE_GENERATION_FAILED", "toolchain root does not contain a lib directory");
  }

  /*
   * The runtime base must be canonical: on macOS the platform temporary
   * directory is reached through /var, a symlink to /private/var, and profile
   * path rules match the resolved path the kernel uses.
   */
  const base = await realpath(await mkdtemp(path.join(options.runtimeBaseDirectory ?? tmpdir(), "piwarden-")));
  await chmod(base, 0o700);
  const paths = await createContainmentPaths(base);

  let rootHandle: Awaited<ReturnType<typeof open>> | undefined;
  let broker: NetworkBroker | undefined;
  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    if (broker !== undefined) await broker.close().catch(() => undefined);
    await rootHandle?.close().catch(() => undefined);
    await removeInvocationArtifacts(base);
  };

  try {
    /*
     * The network scope is pinned first: resolution happens host-side, once,
     * before anything else. An unresolvable or non-public destination refuses
     * the invocation (fail closed); a pinned scope is immutable for the run.
     */
    const scopeEntries = options.networkScope ?? [];
    let network: PreparedNetworkScope | undefined;
    if (scopeEntries.length > 0) {
      const pinned: PinnedDestination[] = [];
      for (const entry of scopeEntries) {
        pinned.push(await pinDestination(entry.host, entry.ports));
      }
      broker = await openNetworkBroker(pinned);
      network = Object.freeze({
        brokerPort: broker.port,
        entries: pinned.map((destination) =>
          Object.freeze({
            host: destination.host,
            ports: destination.ports,
            addressCount: destination.addresses.length,
            families: Object.freeze([...new Set(destination.addresses.map((address) => address.family))].sort()),
          }),
        ),
        arm: () => broker?.arm(),
        stats: () =>
          broker?.stats() ?? Object.freeze({ tunnelsOpened: 0, tunnelsRefused: 0, tunnelsFailed: 0, bytesRelayed: 0 }),
      });
    }

    const profileResult = generateSeatbeltProfile({
      stagingRoot: paths.staging,
      homeRoot: paths.home,
      tmpRoot: paths.tmp,
      sealedRoot: paths.sealed,
      toolchainRoot,
      workspaceRoot: options.workspaceRoot,
      projectPolicyRoot: path.join(options.workspaceRoot, ".pi-warden"),
      protectedZones: options.protectedZones,
      ...(network !== undefined ? { networkBrokerPort: network.brokerPort } : {}),
    });
    if (!profileResult.ok) {
      throw new ShellRefusal("PROFILE_GENERATION_FAILED", `${profileResult.code}: ${profileResult.detail}`);
    }
    const profile: SeatbeltProfile = profileResult.profile;
    await writeFile(paths.profilePath, profile.text, { mode: 0o600, flag: "wx" });

    const manifest: ProjectionManifest = await importWorkspace({
      workspaceRoot: options.workspaceRoot,
      stagingRoot: paths.staging,
      loaded: options.loaded,
      protectedZones: options.protectedZones,
      excludedDirectoryNames: [".git"],
      excludedRelativeRoots: [".pi-warden"],
    });

    rootHandle = await openBoundRoot(options.workspaceRoot, manifest);

    const sealed = await sealInputs(paths, options.sealedInputs);
    if (sealed.records.length > 0) await chmod(paths.sealed, 0o500);
    let command = options.command;
    if (sealed.replacements.length > 0) {
      const plan = buildShellPlan(options.command);
      if (!plan.ok) {
        throw new ShellRefusal("IMPORT_OBJECT_REFUSED", `entry command could not be re-planned for sealing (${plan.code})`);
      }
      const rewritten = applySealedEdits(options.command, plan.plan.sealedEdits, sealed.replacements);
      if (rewritten === undefined) {
        throw new ShellRefusal("IMPORT_OBJECT_REFUSED", "sealed input rewriting produced an inconsistent command");
      }
      command = rewritten;
    }
    return {
      paths,
      profile,
      manifest,
      platform,
      workspaceRoot: options.workspaceRoot,
      protectedZones: options.protectedZones,
      helperPath: options.helperPath,
      buildManifestPath: options.buildManifestPath,
      toolchainRoot,
      environment: Object.freeze(
        buildEnvironment(
          toolchainRoot,
          paths.home,
          paths.tmp,
          network !== undefined ? network.brokerPort : undefined,
        ),
      ),
      sealedInputs: Object.freeze(sealed.records),
      network,
      command,
      rootFd: rootHandle.fd,
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export interface ExecuteContainedOptions {
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly onOutput: (chunk: Buffer) => void;
  readonly authorizeExport: (change: {
    readonly relativePath: string;
    readonly kind: "create" | "mkdir" | "replace";
  }) => Promise<EffectAuthorization>;
}

export interface ContainedRunResult {
  readonly exitCode: number | null;
  readonly cancelled: boolean;
  readonly timedOut: boolean;
  readonly quiescent: boolean;
  readonly outputBytes: number;
  readonly outputTruncated: boolean;
  readonly profileSha256: string;
  readonly platform: PlatformIdentity;
  readonly projection: {
    readonly files: number;
    readonly directories: number;
    readonly symlinks: number;
    readonly bytes: number;
    readonly refusals: number;
    readonly elapsedMs: number;
  };
  readonly projectionRefusals: readonly { readonly relativePath: string; readonly reason: string }[];
  readonly sealedInputs: readonly SealedInputRecord[];
  readonly export: {
    readonly applied: readonly AppliedEffect[];
    readonly refusals: readonly ExportRefusal[];
    readonly removedInProjection: readonly string[];
    readonly ignored: readonly ExportRefusal[];
    readonly exported: boolean;
  };
  readonly report: string;
}

/**
 * Runs a prepared invocation. The child is spawned in its own process group
 * with the constructed environment and the prepared command text; export runs
 * only after quiescence is established.
 */
export async function executePreparedInvocation(
  prepared: PreparedContainedInvocation,
  options: ExecuteContainedOptions,
): Promise<ContainedRunResult> {
  const started = Date.now();
  const timeoutMs = Math.min(
    Math.max(options.timeoutMs ?? SHELL_LIMITS.defaultTimeoutMs, 1_000),
    SHELL_LIMITS.maxTimeoutMs,
  );
  const manifest = prepared.manifest;
  // The broker starts refusing until the invocation's authority is settled;
  // arming it here (the grant has been consumed before this call) is the only
  // moment a tunnel can open.
  prepared.network?.arm();

  let censusWatch: ReturnType<typeof startCensusWatch> | undefined;
  const child = spawnContainedProcess({
    helperPath: prepared.helperPath,
    profilePath: prepared.paths.profilePath,
    shellPath: "/bin/bash",
    command: prepared.command,
    cwd: prepared.paths.staging,
    environment: prepared.environment,
  });
  const groupId = child.pid ?? 0;
  if (groupId > 0) {
    censusWatch = startCensusWatch({ helperPath: prepared.helperPath, entryPid: groupId, processGroupId: groupId });
  }
  let outputBytes = 0;
  let outputTruncated = false;
  let timedOut = false;
  let cancelled = false;

  const killGroup = (): void => {
    if (groupId > 0) {
      try {
        process.kill(-groupId, "SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }
    }
  };

  const timer = setTimeout(() => {
    timedOut = true;
    killGroup();
  }, timeoutMs);
  const onAbort = (): void => {
    cancelled = true;
    killGroup();
  };
  if (options.signal !== undefined) {
    if (options.signal.aborted) onAbort();
    else options.signal.addEventListener("abort", onAbort, { once: true });
  }

  const forward = (chunk: Buffer): void => {
    outputBytes += chunk.length;
    if (outputBytes <= SHELL_LIMITS.maxStreamedOutputBytes) options.onOutput(chunk);
    else outputTruncated = true;
  };
  child.stdout?.on("data", forward);
  child.stderr?.on("data", forward);

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", (error) =>
      reject(new ShellRefusal("CONTAINMENT_FAILED", `contained process failed to start: ${error.message}`)),
    );
    child.on("close", (code) => resolve(code));
  });
  clearTimeout(timer);
  options.signal?.removeEventListener("abort", onAbort);

  censusWatch?.stop();
  const quiescence = await establishTreeQuiescence({
    stagingRoot: prepared.paths.staging,
    helperPath: prepared.helperPath,
    rootIdentity: {
      device: prepared.manifest.stagingDevice,
      inode: prepared.manifest.stagingInode,
    },
    survivors: async () => {
      const watch = censusWatch;
      if (watch === undefined) return Object.freeze([]);
      const table = await sampleProcessTable(prepared.helperPath);
      for (const [pid, record] of [...watch.recorded]) {
        const current = table.get(pid);
        if (current === undefined || current.startSec !== record.startSec || current.startUsec !== record.startUsec) {
          watch.recorded.delete(pid);
        }
      }
      return survivingInvocationProcesses(watch.recorded.values(), table);
    },
    killSurvivors: (records) => {
      for (const record of records) {
        try {
          process.kill(record.pid, "SIGKILL");
        } catch {
          /* already gone */
        }
      }
    },
    killGroup: () => {
      if (groupId > 0) {
        try {
          process.kill(-groupId, "SIGKILL");
        } catch {
          /* the group may already be gone */
        }
      }
    },
    processGroupHasMembers: async () => {
      if (groupId <= 0) return false;
      try {
        process.kill(-groupId, 0);
        return true;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code !== "ESRCH";
      }
    },
  });

  let exportApplied: readonly AppliedEffect[] = Object.freeze([]);
  let exportRefusals: readonly ExportRefusal[] = Object.freeze([]);
  const ignored: ExportRefusal[] = [];
  let exported = false;
  let removedInProjection: readonly string[] = Object.freeze([]);

  let frozenRoot: string | undefined;
  let skipReason: string | undefined;
  if (quiescence.quiescent) {
    frozenRoot = path.join(prepared.paths.base, "frozen");
    try {
      await freezeProjection({
        helperPath: prepared.helperPath,
        sourceRoot: prepared.paths.staging,
        frozenRoot,
        stagingDevice: prepared.manifest.stagingDevice,
        stagingInode: prepared.manifest.stagingInode,
      });
    } catch (error) {
      skipReason = `export skipped: the export source could not be frozen (${error instanceof Error ? error.message : String(error)})`;
      frozenRoot = undefined;
    }
  } else {
    skipReason = `export skipped: ${quiescence.detail}`;
  }

  /*
   * The scan runs only against a successfully frozen export source. When no
   * frozen source exists — quiescence refused, or the freeze refused — the
   * export ends with the already-known refusal reason, and the live
   * projection is never walked, never read and never diffed: a scan of a
   * tree a surviving writer may still be modifying has no trustworthy output,
   * whatever later steps would do with it.
   */
  if (skipReason !== undefined || frozenRoot === undefined) {
    ignored.push(
      Object.freeze({ relativePath: "", kind: "export", reason: skipReason ?? "export skipped" }),
    );
  } else {
    const scan = await scanProjection({
      stagingRoot: frozenRoot,
      manifest,
      excludedDirectoryNames: [".git"],
      excludedRelativeRoots: [".pi-warden"],
      protectedZones: prepared.protectedZones,
      workspaceRoot: prepared.workspaceRoot,
    });
    for (const removed of scan.removedInProjection) {
      ignored.push(
        Object.freeze({
          relativePath: removed,
          kind: "delete-or-rename",
          reason: "deletion and rename have no host effect in this Goal",
        }),
      );
    }
    exportRefusals = scan.refusals;
    removedInProjection = scan.removedInProjection;

    if (scan.changes.length === 0) {
      exported = true;
    } else {
    // The tree that was measured as stable must still be the tree on disk
    // immediately before the first host effect: a change here means a writer
    // appeared after the measurement, so the export is refused outright.
    let deviation: readonly string[] = Object.freeze([]);
    if (quiescence.snapshot === undefined) {
      deviation = Object.freeze(["a quiescent result carried no measured snapshot"]);
      } else {
        try {
          deviation = snapshotDeviation(
            quiescence.snapshot,
            await snapshotProjection({
              stagingRoot: prepared.paths.staging,
              helperPath: prepared.helperPath,
              expectedRoot: {
                device: prepared.manifest.stagingDevice,
                inode: prepared.manifest.stagingInode,
              },
            }),
          );
        } catch (error) {
          deviation = Object.freeze([
            error instanceof Error ? error.message : "the projection could not be re-measured before the export",
          ]);
        }
      }
    if (deviation.length > 0) {
      exportRefusals = Object.freeze([
        ...exportRefusals,
        Object.freeze({
          relativePath: "",
          kind: "export",
          reason: `export refused: the projection changed after it was measured as stable (${deviation.join(", ")})`,
        }),
      ]);
      for (const change of scan.changes) {
        ignored.push(
          Object.freeze({
            relativePath: change.relativePath,
            kind: change.kind,
            reason: "no host effect: the projection was not stable at export time",
          }),
        );
      }
    } else {
    const applied = await applyExportChanges({
      helperPath: prepared.helperPath,
      rootFd: prepared.rootFd,
      workspaceRoot: prepared.workspaceRoot,
      manifest,
      changes: scan.changes,
      authorize: options.authorizeExport,
    });
    exportApplied = applied.applied;
    exportRefusals = Object.freeze([...exportRefusals, ...applied.refusals]);
    exported = true;
    }
  }
  }

  const lines: string[] = [];
  lines.push(
    `pi-warden: contained run finished (exit ${exitCode ?? "unknown"}) on ${prepared.platform.platform}/${prepared.platform.arch}, sandbox-exec ${prepared.platform.sandboxExecSha256.slice(0, 12)}, profile ${prepared.profile.sha256.slice(0, 12)}`,
  );
  lines.push(
    `pi-warden: projection ${manifest.files} files, ${manifest.directories} directories, ${manifest.symlinks} symlinks (${manifest.refusals.length} refused) in ${manifest.elapsedMs} ms`,
  );
  lines.push(
    `pi-warden: export ${exportApplied.length} effect(s) applied, ${exportRefusals.length} refused, ${removedInProjection.length} deletion/rename ignored after ${Date.now() - started} ms`,
  );
  if (prepared.network === undefined) {
    lines.push("pi-warden: network closed (no destination scope)");
  } else {
    const stats = prepared.network.stats();
    const scope = prepared.network.entries
      .map(
        (entry) =>
          `${entry.host} (ports ${entry.ports.join("/")} -> ${entry.addressCount} pinned address(es), ${entry.families.join("+") || "none"})`,
      )
      .join(", ");
    lines.push(
      `pi-warden: network scope enforced via broker port ${prepared.network.brokerPort}: ${scope}; tunnels ${stats.tunnelsOpened} opened, ${stats.tunnelsRefused} refused, ${stats.tunnelsFailed} failed, ${stats.bytesRelayed} bytes relayed`,
    );
  }
  if (!quiescence.quiescent) lines.push(`pi-warden: export refused: ${quiescence.detail}`);
  for (const refusal of exportRefusals.slice(0, 20)) {
    lines.push(`pi-warden: export refused ${refusal.relativePath} (${refusal.kind}): ${refusal.reason}`);
  }
  if (outputTruncated) lines.push("pi-warden: output was truncated at the streaming cap");
  if (timedOut) lines.push("pi-warden: command timed out inside containment");
  if (cancelled) lines.push("pi-warden: command was cancelled");

  return Object.freeze({
    exitCode,
    cancelled,
    timedOut,
    quiescent: quiescence.quiescent,
    outputBytes,
    outputTruncated,
    profileSha256: prepared.profile.sha256,
    platform: prepared.platform,
    projection: Object.freeze({
      files: manifest.files,
      directories: manifest.directories,
      symlinks: manifest.symlinks,
      bytes: manifest.bytes,
      refusals: manifest.refusals.length,
      elapsedMs: manifest.elapsedMs,
    }),
    projectionRefusals: Object.freeze(manifest.refusals.map((entry) => ({ ...entry }))),
    sealedInputs: prepared.sealedInputs,
    export: Object.freeze({
      applied: exportApplied,
      refusals: exportRefusals,
      removedInProjection,
      ignored: Object.freeze(ignored),
      exported,
    }),
    report: lines.join("\n"),
  });
}

/** Prepares, runs and disposes one invocation in a single call. */
export async function runContainedShellCommand(
  options: PrepareContainedOptions & ExecuteContainedOptions,
): Promise<ContainedRunResult> {
  const prepared = await prepareContainedInvocation(options);
  try {
    return await executePreparedInvocation(prepared, options);
  } finally {
    await prepared.dispose();
  }
}
