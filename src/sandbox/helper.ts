/**
 * Native helper client: location, trust verification, build contract, and the
 * protocol invocations (`launch`, `export`, `freeze`).
 *
 * The helper is a mechanism, not an authority: it closes the child descriptor
 * envelope before exec, performs one descriptor-relative host effect per
 * export call, and captures the frozen export source with descriptor-bound
 * traversal. This module never lets the workspace, the model, or the child
 * choose the helper path, and it refuses to run an unverifiable binary.
 */

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ShellRefusal } from "./errors.ts";

export const HELPER_PROTOCOL_VERSION = 2;

export interface HelperIdentity {
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
  readonly buildManifestPath: string;
  readonly builtBy: string;
}

export interface HelperBuildManifest {
  readonly helperVersion: string;
  readonly protocol: number;
  readonly arch: string;
  readonly sourcePath: string;
  readonly sourceSha256: string;
  readonly compiler: string;
  readonly compilerVersion: string;
  readonly flags: readonly string[];
  readonly outputPath: string;
  readonly outputSha256: string;
  readonly outputSize: number;
  readonly builtAt: string;
}

/** Absolute package root, derived from this module's own location. */
export function packageRootFromModule(moduleUrl: string): string {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..", "..");
}

export function defaultHelperPath(packageRoot: string): string {
  return path.join(packageRoot, "native", "piwarden-helper");
}

export function defaultBuildManifestPath(packageRoot: string): string {
  return path.join(packageRoot, "native", "build-manifest.json");
}

async function sha256File(target: string): Promise<{ hash: string; size: number }> {
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let size = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      size += bytesRead;
      hash.update(buffer.subarray(0, bytesRead));
    }
    return { hash: hash.digest("hex"), size };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/**
 * Verifies the helper binary and its recorded build identity. Any failure is a
 * refusal with an actionable reason; there is no "best effort" helper.
 */
export async function verifyHelper(
  helperPath: string,
  buildManifestPath: string,
): Promise<HelperIdentity> {
  let metadata;
  try {
    metadata = await lstat(helperPath);
  } catch {
    throw new ShellRefusal(
      "HELPER_MISSING",
      `native helper not found at ${helperPath}; build it with "npm run build:native"`,
    );
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new ShellRefusal("HELPER_UNTRUSTED", "native helper is not a regular file");
  }
  if (metadata.nlink !== 1) {
    throw new ShellRefusal("HELPER_UNTRUSTED", "native helper has nlink != 1");
  }
  if ((metadata.mode & 0o022) !== 0) {
    throw new ShellRefusal("HELPER_UNTRUSTED", "native helper is group- or world-writable");
  }
  const uid = process.getuid?.();
  if (uid !== undefined && metadata.uid !== uid && metadata.uid !== 0) {
    throw new ShellRefusal("HELPER_UNTRUSTED", "native helper is not owned by the current user or root");
  }

  let manifestText: string;
  try {
    manifestText = await readFile(buildManifestPath, "utf8");
  } catch {
    throw new ShellRefusal(
      "HELPER_UNTRUSTED",
      `native helper build manifest missing at ${buildManifestPath}; rebuild with "npm run build:native"`,
    );
  }
  let manifest: HelperBuildManifest;
  try {
    manifest = JSON.parse(manifestText) as HelperBuildManifest;
  } catch {
    throw new ShellRefusal("HELPER_UNTRUSTED", "native helper build manifest is not valid JSON");
  }
  if (manifest.protocol !== HELPER_PROTOCOL_VERSION) {
    throw new ShellRefusal("HELPER_UNTRUSTED", "native helper build manifest protocol does not match");
  }
  const actual = await sha256File(helperPath);
  if (actual.hash !== manifest.outputSha256 || actual.size !== manifest.outputSize) {
    throw new ShellRefusal(
      "HELPER_UNTRUSTED",
      "native helper bytes do not match the recorded build identity; rebuild with \"npm run build:native\"",
    );
  }
  if (manifest.arch !== process.arch) {
    throw new ShellRefusal("HELPER_UNTRUSTED", `native helper architecture ${manifest.arch} does not match ${process.arch}`);
  }

  return Object.freeze({
    path: helperPath,
    sha256: actual.hash,
    size: actual.size,
    buildManifestPath,
    builtBy: `${manifest.compiler} ${manifest.compilerVersion} ${manifest.flags.join(" ")}`,
  });
}

export interface HelperSelfTest {
  readonly helperVersion: string;
  readonly protocol: number;
  readonly arch: string;
  readonly closeScanLimit: string;
  readonly freezeCaps: Readonly<Record<string, string>>;
}

/** Runs the helper's own identity self-report; any deviation is a refusal. */
export async function runHelperSelfTest(helperPath: string): Promise<HelperSelfTest> {
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(helperPath, ["selftest"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < 8192) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 8192) stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  if (result.code !== 0) {
    throw new ShellRefusal("HELPER_UNTRUSTED", `helper selftest exited with ${result.code}: ${result.stderr.trim()}`);
  }
  const fields = new Map<string, string>();
  for (const line of result.stdout.split("\n")) {
    const separator = line.indexOf(" ");
    if (separator <= 0) continue;
    fields.set(line.slice(0, separator), line.slice(separator + 1).trim());
  }
  const protocol = Number(fields.get("PROTOCOL"));
  if (protocol !== HELPER_PROTOCOL_VERSION) {
    throw new ShellRefusal("HELPER_UNTRUSTED", "helper reports an unsupported protocol version");
  }
  const arch = fields.get("ARCH") ?? "unknown";
  if (arch !== process.arch) {
    throw new ShellRefusal("HELPER_UNTRUSTED", `helper reports architecture ${arch}, expected ${process.arch}`);
  }
  return Object.freeze({
    helperVersion: fields.get("HELPER") ?? "unknown",
    protocol,
    arch,
    closeScanLimit: fields.get("CLOSE_SCAN_LIMIT") ?? "unknown",
    freezeCaps: Object.freeze({
      maxEntries: fields.get("FREEZE_MAX_ENTRIES") ?? "unknown",
      maxFileBytes: fields.get("FREEZE_MAX_FILE_BYTES") ?? "unknown",
      maxTotalBytes: fields.get("FREEZE_MAX_TOTAL_BYTES") ?? "unknown",
      maxDepth: fields.get("FREEZE_MAX_DEPTH") ?? "unknown",
    }),
  });
}

export interface LaunchRequest {
  readonly helperPath: string;
  readonly profilePath: string;
  readonly shellPath: string;
  readonly command: string;
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
}

/**
 * Spawns the launcher in its own process group. The launcher closes every
 * inherited descriptor above stdio and execs sandbox-exec, so the contained
 * process starts with exactly the constructed stdio and environment.
 */
export function spawnContainedProcess(request: LaunchRequest): ReturnType<typeof spawn> {
  const args = [
    "launch",
    "--profile",
    request.profilePath,
    "--",
    request.shellPath,
    "--noprofile",
    "--norc",
    "-c",
    request.command,
  ];
  return spawn(request.helperPath, args, {
    cwd: request.cwd,
    env: { ...request.environment },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

export interface ExportRequest {
  readonly helperPath: string;
  readonly rootFd: number;
  readonly rootDevice: string;
  readonly rootInode: string;
  readonly components: readonly { device: string; inode: string; name: string }[];
  readonly operation: "create" | "mkdir" | "replace";
  readonly leafDevice: string;
  readonly leafInode: string;
  readonly mode: number;
  readonly name: string;
  readonly payload: Buffer;
  readonly timeoutMs: number;
}

export interface ExportResult {
  readonly name: string;
  readonly device: string;
  readonly inode: string;
  readonly nlink: string;
  readonly size: string;
}

function assertSafeName(name: string): void {
  if (name.length === 0 || name === "." || name === "..") {
    throw new ShellRefusal("EXPORT_HELPER_REFUSED", "empty or relative leaf name");
  }
  if (name.includes("/") || name.includes("\0")) {
    throw new ShellRefusal("EXPORT_HELPER_REFUSED", "leaf name contains a path separator");
  }
  for (const character of name) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      throw new ShellRefusal("EXPORT_HELPER_REFUSED", "leaf name contains a control character");
    }
  }
}

/**
 * Performs exactly one export effect through the helper. The request carries
 * the verified identity chain; the helper re-verifies it before the effect and
 * refuses on any mismatch. Payload bytes are the sealed buffer the host read
 * and authorized, never a re-read of staging.
 */
export async function runExportEffect(request: ExportRequest): Promise<ExportResult> {
  for (const component of request.components) assertSafeName(component.name);
  assertSafeName(request.name);

  const header: string[] = [
    `PROTOCOL ${HELPER_PROTOCOL_VERSION}`,
    `ROOT ${request.rootDevice} ${request.rootInode}`,
  ];
  for (const component of request.components) {
    header.push(`COMP ${component.device} ${component.inode} ${component.name}`);
  }
  header.push(`OP ${request.operation}`);
  header.push(`LEAF ${request.leafDevice} ${request.leafInode} ${request.mode} ${request.name}`);
  header.push(`SIZE ${request.payload.length}`);

  return await new Promise<ExportResult>((resolve, reject) => {
    const child = spawn(request.helperPath, ["export", "--root-fd", "3"], {
      stdio: ["pipe", "pipe", "pipe", request.rootFd],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(() => reject(new ShellRefusal("EXPORT_HELPER_REFUSED", "helper export timed out")));
    }, request.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length < 16_384) stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 16_384) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      settle(() => reject(new ShellRefusal("EXPORT_HELPER_REFUSED", `helper could not be spawned: ${error.message}`)));
    });
    // A helper that refuses early closes its stdin while the payload is still
    // being written; without this handler the host process would die on EPIPE.
    child.stdin?.on("error", () => undefined);
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        const reason = stderr.trim().split("\n").pop() ?? `exit ${code}`;
        settle(() => reject(new ShellRefusal("EXPORT_HELPER_REFUSED", reason)));
        return;
      }
      const line = stdout.trim().split("\n").pop() ?? "";
      const fields = new Map<string, string>();
      const parts = line.split(" ");
      for (const part of parts) {
        const separator = part.indexOf("=");
        if (separator > 0) fields.set(part.slice(0, separator), part.slice(separator + 1));
      }
      if (!line.startsWith("RESULT ") || !fields.has("dev") || !fields.has("ino")) {
        settle(() => reject(new ShellRefusal("EXPORT_HELPER_REFUSED", "helper returned no verifiable result")));
        return;
      }
      settle(() => resolve(
        Object.freeze({
          name: fields.get("name") ?? request.name,
          device: fields.get("dev") ?? "",
          inode: fields.get("ino") ?? "",
          nlink: fields.get("nlink") ?? "",
          size: fields.get("size") ?? "",
        }),
      ));
    });
    if (child.stdin === null) {
      settle(() => reject(new ShellRefusal("EXPORT_HELPER_REFUSED", "helper stdin was not created")));
      return;
    }
    // A refused or killed helper closes the pipe; the write must not throw.
    try {
      child.stdin.write(header.join("\n") + "\n");
      child.stdin.end(request.payload);
    } catch (error) {
      settle(() =>
        reject(
          new ShellRefusal(
            "EXPORT_HELPER_REFUSED",
            `helper request could not be delivered: ${error instanceof Error ? error.message : String(error)}`,
          ),
        ),
      );
    }
  });
}

export interface MeasurementRequest {
  readonly helperPath: string;
  /** The verified projection-root descriptor; the helper re-verifies it. */
  readonly rootFd: number;
  readonly rootDevice: string;
  readonly rootInode: string;
  readonly limits: { readonly maxEntries: number; readonly maxDepth: number };
  /** Test-only deterministic interleave: the walker pauses on this entry. */
  readonly pauseName?: string;
  /** Test-only callback that runs while the walker is paused, before release. */
  readonly onPause?: (armed: FreezeArmedRecord) => Promise<void>;
  readonly timeoutMs: number;
}

export interface MeasuredEntry {
  readonly relativePath: string;
  /** Full st_mode including type bits. */
  readonly mode: number;
  readonly device: string;
  readonly inode: string;
  readonly size: number;
  readonly mtimeSec: string;
  readonly mtimeNsec: string;
  readonly linkText: string | null;
}

export interface MeasurementResult {
  readonly entries: readonly MeasuredEntry[];
}

function decodeHexField(value: string, field: string): string {
  if (value.length % 2 !== 0 || value.length === 0 || /[^0-9a-f]/.test(value)) {
    throw new ShellRefusal("EXPORT_FAILED", `the measurement protocol carried an invalid ${field} field`);
  }
  return Buffer.from(value, "hex").toString("utf8");
}

function parse_entry_line(line: string): MeasuredEntry {
  const fields = new Map<string, string>();
  for (const part of line.split(" ")) {
    const separator = part.indexOf("=");
    if (separator > 0) fields.set(part.slice(0, separator), part.slice(separator + 1));
  }
  const mode = Number.parseInt(fields.get("mode") ?? "", 8);
  const size = Number.parseInt(fields.get("size") ?? "", 10);
  const linkField = fields.get("link");
  if (
    !fields.has("rel") ||
    !Number.isFinite(mode) ||
    !fields.has("dev") ||
    !fields.has("ino") ||
    !fields.has("nlink") ||
    !Number.isFinite(size) ||
    !fields.has("mtimesec") ||
    !fields.has("mtimensec") ||
    linkField === undefined
  ) {
    throw new ShellRefusal("EXPORT_FAILED", "the measurement protocol returned an incomplete entry");
  }
  const linkText = linkField === "-" ? null : decodeHexField(linkField, "link");
  return Object.freeze({
    relativePath: decodeHexField(fields.get("rel") ?? "", "relative path"),
    mode,
    device: fields.get("dev") ?? "",
    inode: fields.get("ino") ?? "",
    size,
    mtimeSec: fields.get("mtimesec") ?? "",
    mtimeNsec: fields.get("mtimensec") ?? "",
    linkText,
  });
}

/**
 * Measures the projection with descriptor-bound traversal: the trusted host
 * opened and identity-verified the root descriptor; the helper re-verifies it
 * and walks the tree with single-component lookups against held directory
 * descriptors, never following a swapped component. Any refusal or truncation
 * aborts the whole measurement: a partial measurement is never used.
 */
export async function runMeasurement(request: MeasurementRequest): Promise<MeasurementResult> {
  if (request.pauseName !== undefined) {
    if (request.pauseName.length === 0 || request.pauseName.startsWith("/") || request.pauseName.includes("\0")) {
      throw new ShellRefusal("EXPORT_FAILED", "invalid measurement pause name");
    }
  }

  const header: string[] = [
    `PROTOCOL ${HELPER_PROTOCOL_VERSION}`,
    `ROOT ${request.rootDevice} ${request.rootInode}`,
    `LIMITS ${request.limits.maxEntries} ${request.limits.maxDepth}`,
    `GO`,
  ];

  return await new Promise<MeasurementResult>((resolve, reject) => {
    const args = ["measure", "--root-fd", "3"];
    if (request.pauseName !== undefined) args.push("--pause-name", request.pauseName);
    const child = spawn(request.helperPath, args, {
      stdio: ["pipe", "pipe", "pipe", request.rootFd],
    });
    let stdout = "";
    let stderr = "";
    let buffer = "";
    let resultLine = "";
    const entries: MeasuredEntry[] = [];
    let pauseChain: Promise<void> = Promise.resolve();
    let settled = false;
    const settle = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the projection measurement timed out")));
    }, request.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.startsWith("ENTRY ")) {
          try {
            entries.push(parse_entry_line(line));
          } catch (error) {
            settle(() => reject(error instanceof ShellRefusal ? error : new ShellRefusal("EXPORT_FAILED", "unusable measurement entry")));
            return;
          }
        } else if (line.startsWith("ARMED ")) {
          if (request.onPause === undefined) {
            settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the measurement paused without a release hook")));
            return;
          }
          const armed = parse_armed_fields(line);
          pauseChain = pauseChain
            .then(() => request.onPause?.(armed))
            .then(() => {
              if (settled) return;
              child.stdin?.write("GO\n");
            })
            .catch((error: unknown) => {
              settle(() => {
                child.kill("SIGKILL");
                reject(
                  new ShellRefusal(
                    "EXPORT_FAILED",
                    `the measurement release hook failed: ${error instanceof Error ? error.message : String(error)}`,
                  ),
                );
              });
            });
        }
        if (line.startsWith("RESULT ") || line.startsWith("ENTRY ") || line.startsWith("ARMED ")) {
          resultLine = line;
        }
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 16_384) stderr += chunk.toString("utf8");
    });
    child.stdin?.on("error", () => undefined);
    child.on("error", (error) => {
      settle(() => reject(new ShellRefusal("EXPORT_FAILED", `the measurement helper could not be spawned: ${error.message}`)));
    });
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        const reason = stderr.trim().split("\n").pop() ?? `exit ${code}`;
        settle(() => reject(new ShellRefusal("EXPORT_FAILED", `the projection could not be measured: ${reason}`)));
        return;
      }
      const match = /^RESULT entries=([0-9]+)$/.exec(resultLine);
      if (match === null) {
        settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the measurement helper returned no verifiable result")));
        return;
      }
      if (Number(match[1]) !== entries.length) {
        settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the measurement helper result does not match the reported entries")));
        return;
      }
      settle(() => resolve(Object.freeze({ entries: Object.freeze([...entries]) })));
    });
    if (child.stdin === null) {
      settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the measurement helper stdin was not created")));
      return;
    }
    try {
      child.stdin.write(header.join("\n") + "\n");
    } catch (error) {
      settle(() =>
        reject(
          new ShellRefusal(
            "EXPORT_FAILED",
            `measurement request could not be delivered: ${error instanceof Error ? error.message : String(error)}`,
          ),
        ),
      );
    }
  });
}

export interface FreezeArmedRecord {
  readonly relativePath: string;
  readonly device: string;
  readonly inode: string;
  readonly mode: number;
  readonly size: string;
  readonly mtimeSec: string;
  readonly mtimeNsec: string;
  readonly nlink: string;
}

export interface FreezeCopyRequest {
  readonly helperPath: string;
  readonly sourceFd: number;
  readonly targetFd: number;
  readonly stagingDevice: string;
  readonly stagingInode: string;
  readonly frozenDevice: string;
  readonly frozenInode: string;
  readonly limits: { readonly maxEntries: number; readonly maxFileBytes: number; readonly maxTotalBytes: number; readonly maxDepth: number };
  /** Test-only deterministic interleave: the helper pauses on this entry. */
  readonly pauseName?: string;
  /** Test-only callback that runs while the helper is paused, before release. */
  readonly onPause?: (armed: FreezeArmedRecord) => Promise<void>;
  readonly timeoutMs: number;
}

export interface FreezeCopyResult {
  readonly entries: number;
  readonly bytes: number;
}

function parse_armed_fields(line: string): FreezeArmedRecord {
  const fields = new Map<string, string>();
  for (const part of line.split(" ")) {
    const separator = part.indexOf("=");
    if (separator > 0) fields.set(part.slice(0, separator), part.slice(separator + 1));
  }
  return Object.freeze({
    relativePath: fields.get("rel") ?? "",
    device: fields.get("dev") ?? "",
    inode: fields.get("ino") ?? "",
    mode: Number.parseInt(fields.get("mode") ?? "0", 8),
    size: fields.get("size") ?? "",
    mtimeSec: fields.get("mtimesec") ?? "",
    mtimeNsec: fields.get("mtimensec") ?? "",
    nlink: fields.get("nlink") ?? "",
  });
}

/**
 * Captures the frozen export source with descriptor-bound traversal. Both root
 * descriptors were opened and identity-verified by the trusted host; the
 * helper re-verifies them, walks the source with single-component lookups
 * against held directory descriptors, never follows a symlink during descent,
 * and re-checks every regular file after its bytes are read. Any refusal
 * aborts the whole copy: a partial frozen source is never used.
 */
export async function runFreezeCopy(request: FreezeCopyRequest): Promise<FreezeCopyResult> {
  if (request.pauseName !== undefined) {
    if (request.pauseName.length === 0 || request.pauseName.startsWith("/") || request.pauseName.includes("\0")) {
      throw new ShellRefusal("EXPORT_FAILED", "invalid freeze pause name");
    }
  }

  const header: string[] = [
    `PROTOCOL ${HELPER_PROTOCOL_VERSION}`,
    `SOURCE ${request.stagingDevice} ${request.stagingInode}`,
    `TARGET ${request.frozenDevice} ${request.frozenInode}`,
    `LIMITS ${request.limits.maxEntries} ${request.limits.maxFileBytes} ${request.limits.maxTotalBytes} ${request.limits.maxDepth}`,
    `GO`,
  ];

  return await new Promise<FreezeCopyResult>((resolve, reject) => {
    const args = ["freeze", "--source-fd", "3", "--target-fd", "4"];
    if (request.pauseName !== undefined) args.push("--pause-name", request.pauseName);
    const child = spawn(request.helperPath, args, {
      stdio: ["pipe", "pipe", "pipe", request.sourceFd, request.targetFd],
    });
    let stdout = "";
    let stderr = "";
    let buffer = "";
    let pauseChain: Promise<void> = Promise.resolve();
    let settled = false;
    const settle = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the export source could not be frozen (helper timed out)")));
    }, request.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.startsWith("ARMED ")) {
          const armed = parse_armed_fields(line);
          if (request.onPause === undefined) {
            settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the frozen capture paused without a release hook")));
            return;
          }
          pauseChain = pauseChain
            .then(() => request.onPause?.(armed))
            .then(() => {
              if (settled) return;
              child.stdin?.write("GO\n");
            })
            .catch((error: unknown) => {
              settle(() => {
                child.kill("SIGKILL");
                reject(
                  new ShellRefusal(
                    "EXPORT_FAILED",
                    `the frozen-source release hook failed: ${error instanceof Error ? error.message : String(error)}`,
                  ),
                );
              });
            });
        }
        if (stdout.length < 16_384) stdout += `${line}\n`;
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 16_384) stderr += chunk.toString("utf8");
    });
    child.stdin?.on("error", () => undefined);
    child.on("error", (error) => {
      settle(() => reject(new ShellRefusal("EXPORT_FAILED", `the freeze helper could not be spawned: ${error.message}`)));
    });
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        const reason = stderr.trim().split("\n").pop() ?? `exit ${code}`;
        settle(() => reject(new ShellRefusal("EXPORT_FAILED", `the export source could not be frozen: ${reason}`)));
        return;
      }
      const line = stdout.trim().split("\n").pop() ?? "";
      if (!line.startsWith("RESULT ")) {
        settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the freeze helper returned no verifiable result")));
        return;
      }
      const entries = Number.parseInt(line.replace(/^RESULT entries=/, "").split(" ")[0] ?? "", 10);
      const bytes = Number.parseInt(line.replace(/^RESULT entries=[0-9]+ bytes=/, "").trim() ?? "", 10);
      if (!Number.isFinite(entries) || !Number.isFinite(bytes)) {
        settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the freeze helper result is unreadable")));
        return;
      }
      settle(() => resolve(Object.freeze({ entries, bytes })));
    });
    if (child.stdin === null) {
      settle(() => reject(new ShellRefusal("EXPORT_FAILED", "the freeze helper stdin was not created")));
      return;
    }
    try {
      child.stdin.write(header.join("\n") + "\n");
    } catch (error) {
      settle(() =>
        reject(
          new ShellRefusal(
            "EXPORT_FAILED",
            `freeze request could not be delivered: ${error instanceof Error ? error.message : String(error)}`,
          ),
        ),
      );
    }
  });
}
