/**
 * Controlled traversal/effects for the `grep`, `find`, and `ls` file tools.
 *
 * Pi's built-in `grep` and `find` spawn helper processes (ripgrep/fd) that read
 * every matching file under the search root without per-file authorization;
 * the built-in `ls` reveals entry names without per-entry classification.
 * pi-warden replaces all three with the controlled implementations here:
 *
 * - The search root must already be authorized through the central authorizer
 *   (including the user approval flow for an ASK root).
 * - Every candidate is classified per entry, before any content is read,
 *   through the same resolver/classifier/configuration snapshot as the root.
 *   Entries classified `secret` or `sensitive` — including directory entries
 *   whose names carry that evidence — entries resolving into a protected
 *   control-plane zone, and symlink targets whose canonical identity escapes
 *   the authorized root are excluded from results and never read.
 * - A directory entry that is excluded is neither emitted nor descended into:
 *   its subtree is withheld and no enumeration read touches it.
 * - Symlinked directories are never descended into (matching rg/fd default
 *   no-follow behavior). Included file symlinks appear in `ls`/`find` results
 *   after per-entry classification but are not content-searched (`grep`
 *   matches rg's no-follow default). Broken symlinks fail closed and are never
 *   reinterpreted as ordinary missing paths.
 *
 * A denied resource is therefore never read first and filtered later:
 * classification happens before any read, and excluded entries contribute
 * nothing except an aggregate exclusion notice. There is no read-then-filter.
 */

import type { Dirent } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import {
  isLoadedPolicySources,
  policySourcesApplyToResource,
  type LoadedPolicySources,
} from "../policy/config-loader.ts";
import { protectedDenialFor } from "../policy/control-plane.ts";
import { resolveWorkspacePath, type ResolvedPath } from "../policy/paths.ts";
import { classifyPathResource } from "../policy/resources.ts";
import type { GateServices } from "./authorizer.ts";
import { readBoundFileContent } from "./bound-execution.ts";

export const MAX_ENTRIES = 50_000;
export const MAX_OUTPUT_BYTES = 50 * 1024;

export type ExcludeReason =
  | "RESOLUTION_FAILED"
  | "PROTECTED_RESOURCE"
  | "SECRET_RESOURCE"
  | "SENSITIVE_RESOURCE"
  | "EXTERNAL_TARGET"
  | "HARD_LINKED"
  | "INVALID_POLICY_SOURCES";

export interface EvaluatedFileIdentity {
  readonly dev: number;
  readonly ino: number;
  readonly nlink: number;
}

export type EntryVerdict =
  | { readonly status: "include"; readonly resolved: ResolvedPath; readonly expected: EvaluatedFileIdentity | undefined }
  | { readonly status: "exclude"; readonly reason: ExcludeReason };

export interface TraversalSnapshot {
  readonly services: GateServices;
  readonly loaded: LoadedPolicySources;
  /** The trusted cwd supplied by Pi's tool-call context. */
  readonly workspace: string;
  readonly authorizedRoot: ResolvedPath;
}

function rootPath(snapshot: TraversalSnapshot): string {
  return snapshot.authorizedRoot.canonicalPath;
}

function pathInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function relFromRoot(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join("/");
}

/**
 * Per-entry decision for one candidate, resolved from the trusted workspace.
 * Verdicts cannot be constructed outside this module.
 */
export async function evaluateEntry(
  snapshot: TraversalSnapshot,
  ...relativeComponents: readonly string[]
): Promise<EntryVerdict> {
  if (!isLoadedPolicySources(snapshot.loaded)) {
    return { status: "exclude", reason: "INVALID_POLICY_SOURCES" };
  }
  if (!policySourcesApplyToResource(snapshot.loaded, snapshot.authorizedRoot)) {
    return { status: "exclude", reason: "INVALID_POLICY_SOURCES" };
  }

  let resolved: ResolvedPath;
  try {
    // Entries are names relative to the authorized root; the resolver expects
    // workspace-relative input, so the canonical root offset is applied first.
    const rootWithinWorkspace = path.relative(
      snapshot.authorizedRoot.workspaceRoot,
      rootPath(snapshot),
    );
    resolved = await resolveWorkspacePath(
      snapshot.workspace,
      path.join(rootWithinWorkspace, ...relativeComponents),
    );
  } catch {
    return { status: "exclude", reason: "RESOLUTION_FAILED" };
  }

  const denial = protectedDenialFor(resolved.canonicalPath, snapshot.services.protectedZones);
  if (denial) return { status: "exclude", reason: "PROTECTED_RESOURCE" };

  if (!pathInside(rootPath(snapshot), resolved.canonicalPath)) {
    return { status: "exclude", reason: "EXTERNAL_TARGET" };
  }

  const sensitivity = classifyPathResource(resolved).sensitivity;
  if (sensitivity === "secret") return { status: "exclude", reason: "SECRET_RESOURCE" };
  if (sensitivity === "sensitive") return { status: "exclude", reason: "SENSITIVE_RESOURCE" };

  // Capture the trusted one-time identity immediately at evaluation so the
  // content read never recaptures the current path identity (a substitution
  // between evaluation and effect is refused by comparison, not re-checked).
  let expected: EvaluatedFileIdentity | undefined;
  try {
    const metadata = await lstat(resolved.canonicalPath);
    expected = Object.freeze({ dev: metadata.dev, ino: metadata.ino, nlink: metadata.nlink });
    // Conservative hard-link rule: a regular-file entry that is multiply
    // linked (a hard-link alias of a denied resource, e.g. a fake secret)
    // is withheld from results and never read, before any effect.
    if (metadata.isFile() && metadata.nlink !== 1) {
      return { status: "exclude", reason: "HARD_LINKED" };
    }
  } catch {
    return { status: "exclude", reason: "RESOLUTION_FAILED" };
  }

  return { status: "include", resolved, expected };
}

/* --------------------------------- glob ---------------------------------- */

function globToRegExp(pattern: string, basenameOnly: boolean): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        source += ".*";
        index += 1;
        continue;
      }
      source += "[^/]*";
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      continue;
    }
    if ("\\^$.|+()[]{}".includes(character)) {
      source += `\\${character}`;
      continue;
    }
    source += character;
  }
  return new RegExp(basenameOnly ? `${source}$` : `^${source}$`, "s");
}

function matchPathPattern(pattern: string, relativePath: string): boolean {
  if (!pattern.includes("/")) {
    const basename = relativePath.split("/").pop() ?? relativePath;
    return globToRegExp(pattern, true).test(basename);
  }
  return globToRegExp(pattern, false).test(relativePath);
}

/* ---------------------------------- ls ----------------------------------- */

export interface LsResult {
  readonly lines: readonly string[];
  readonly excludedCount: number;
}

export async function controlledLs(snapshot: TraversalSnapshot, limit: number): Promise<LsResult> {
  const root = rootPath(snapshot);
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return { lines: [], excludedCount: 0 };
  }
  entries = entries.slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const collected: string[] = [];
  let excludedCount = 0;
  const effectiveLimit = limit >= 1 ? limit : 500;

  for (const entry of entries) {
    if (collected.length >= effectiveLimit) break;
    if (collected.length >= MAX_OUTPUT_BYTES) break;

    const verdict = await evaluateEntry(snapshot, entry.name);
    if (verdict.status !== "include") {
      if (verdict.reason !== "RESOLUTION_FAILED") excludedCount += 1;
      continue;
    }

    let displayName = entry.name;
    try {
      const metadata = await lstat(path.join(root, entry.name));
      if (metadata.isDirectory()) displayName = `${entry.name}/`;
    } catch {
      continue;
    }
    collected.push(displayName);
  }
  return { lines: collected, excludedCount };
}

/* --------------------------------- finding ------------------------------- */

export interface FindResult {
  readonly lines: readonly string[];
  readonly excludedCount: number;
  readonly resultLimitReached: boolean;
}

/**
 * Walks every includable entry (files and directories) below the authorized
 * root. Symlinked directories are never descended; a symlink that resolves
 * safely inside the root is treated as an includable file-like entry.
 */
async function walkIncludableEntries(
  snapshot: TraversalSnapshot,
): Promise<{ matches: readonly string[]; excludedCount: number }> {
  const root = rootPath(snapshot);
  const matches: string[] = [];
  let excludedCount = 0;
  let traversed = 0;

  const queue: string[] = [root];
  while (queue.length > 0 && traversed < MAX_ENTRIES) {
    const dir = queue.shift();
    if (dir === undefined) break;
    traversed += 1;

    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (traversed >= MAX_ENTRIES) break;
      const absolute = path.join(dir, entry.name);
      const relative = relFromRoot(root, absolute);

      if (entry.isSymbolicLink()) {
        const verdict = await evaluateEntry(snapshot, relative);
        if (verdict.status !== "include") {
          // Broken symlinks and denied aliases are witheld from results and
          // never followed; every excluded symlink is counted.
          excludedCount += 1;
          continue;
        }
        matches.push(relative);
        continue;
      }

      if (entry.isDirectory()) {
        // Directory names are classified before they are emitted; an excluded
        // directory (secret/sensitive/protected/escaping) is withheld and its
        // subtree is not enumerated.
        const verdict = await evaluateEntry(snapshot, relative);
        if (verdict.status !== "include") {
          excludedCount += 1;
          continue;
        }
        matches.push(relative);
        queue.push(absolute);
        continue;
      }
      if (entry.isFile()) {
        // Regular-file entries are evaluated (including the hard-link rule)
        // before any name is exposed, so a hard-link alias of a denied
        // resource cannot reach the result list either.
        const verdict = await evaluateEntry(snapshot, relative);
        if (verdict.status !== "include") {
          excludedCount += 1;
          continue;
        }
        matches.push(relative);
      }
    }
  }
  return { matches, excludedCount };
}

export async function controlledFind(
  snapshot: TraversalSnapshot,
  pattern: string,
  limit: number,
): Promise<FindResult> {
  const matched = await walkIncludableEntries(snapshot);
  const lines: string[] = [];
  let resultLimitReached = false;
  const effectiveLimit = limit >= 1 ? limit : 1000;

  for (const relative of matched.matches) {
    if (lines.length >= effectiveLimit) {
      resultLimitReached = true;
      break;
    }
    if (matchPathPattern(pattern, relative)) lines.push(relative);
  }
  return { lines, excludedCount: matched.excludedCount, resultLimitReached };
}

/* --------------------------------- grep ---------------------------------- */

export interface GrepOptions {
  readonly pattern: string;
  readonly glob?: string;
  readonly ignoreCase?: boolean;
  readonly literal?: boolean;
  readonly context: number;
  readonly limit: number;
}

export interface GrepResult {
  readonly lines: readonly string[];
  readonly excludedCount: number;
  readonly matchLimitReached: boolean;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildContentRegexp(options: GrepOptions): RegExp | undefined {
  const source = options.literal === true ? escapeRegExp(options.pattern) : options.pattern;
  try {
    return new RegExp(source, options.ignoreCase === true ? "i" : "");
  } catch {
    // Malformed regex patterns match nothing and perform no effects.
    return undefined;
  }
}

interface AuthorizedFile {
  readonly path: string;
  /** Identity captured at evaluation time and passed to the bound read. */
  readonly expected: EvaluatedFileIdentity | undefined;
}

async function collectAuthorizedFiles(snapshot: TraversalSnapshot): Promise<{
  files: readonly AuthorizedFile[];
  excludedCount: number;
}> {
  const root = rootPath(snapshot);

  let rootMetadata;
  try {
    rootMetadata = await lstat(root);
  } catch {
    return { files: [], excludedCount: 0 };
  }
  if (rootMetadata.isFile()) {
    const rootVerdict = await evaluateEntry(snapshot, ".");
    if (rootVerdict.status === "include" && rootVerdict.expected !== undefined) {
      return { files: [{ path: root, expected: rootVerdict.expected }], excludedCount: 0 };
    }
    return { files: [], excludedCount: 0 };
  }

  const files: AuthorizedFile[] = [];
  let excludedCount = 0;
  let traversed = 0;

  const queue: string[] = [root];
  while (queue.length > 0 && traversed < MAX_ENTRIES) {
    const dir = queue.shift();
    if (dir === undefined) break;
    traversed += 1;

    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (traversed >= MAX_ENTRIES) break;
      const absolute = path.join(dir, entry.name);
      const relative = relFromRoot(root, absolute);

      if (entry.isSymbolicLink()) {
        const verdict = await evaluateEntry(snapshot, relative);
        if (verdict.status !== "include") {
          // Excluded (denied, protected, external, or broken) symlinks are
          // withheld from content search and never followed.
          excludedCount += 1;
        }
        // Included symlinks are not content-searched (rg no-follow default)
        // and symlinked directories are never descended into.
        continue;
      }
      if (entry.isDirectory()) {
        // A directory is classified before its subtree is enumerated: an
        // excluded directory is withheld and is not descended into, so its
        // names and files are never read or searched.
        const verdict = await evaluateEntry(snapshot, relative);
        if (verdict.status !== "include") {
          excludedCount += 1;
          continue;
        }
        queue.push(absolute);
        continue;
      }
      if (entry.isFile()) {
        // The hard-link rule applies here before any content read: a hard
        // link alias never enters the authorized file collection.
        const verdict = await evaluateEntry(snapshot, relative);
        if (verdict.status !== "include") {
          excludedCount += 1;
          continue;
        }
        files.push({ path: absolute, expected: verdict.expected });
      }
    }
  }
  return { files, excludedCount };
}

export async function controlledGrep(
  snapshot: TraversalSnapshot,
  options: GrepOptions,
): Promise<GrepResult> {
  const root = rootPath(snapshot);
  const scanned = await collectAuthorizedFiles(snapshot);
  const regexp = buildContentRegexp(options);
  const globRegexp = options.glob === undefined ? undefined : globToRegExp(options.glob, !options.glob.includes("/"));

  const lines: string[] = [];
  let excludedCount: number = scanned.excludedCount;
  let matchCount = 0;
  let matchLimitReached = false;
  let outputBytes = 0;

  if (regexp === undefined) {
    return { lines: [], excludedCount, matchLimitReached: false };
  }

  for (const candidate of scanned.files) {
    if (matchCount >= options.limit && options.limit >= 1) {
      matchLimitReached = true;
      break;
    }
    if (outputBytes >= MAX_OUTPUT_BYTES) break;

    const relative = relFromRoot(root, candidate.path);
    if (globRegexp && !globRegexp.test(relative) && !globRegexp.test(path.basename(relative))) continue;

    // The content read is bound to the object identity that was CLASSIFIED
    // (captured before the read by collectAuthorizedFiles), never recaptured
    // after a possible substitution. The read goes through an O_NOFOLLOW
    // descriptor whose fstat identity — including a strict nlink === 1
    // hard-link rule — is compared against the evaluated object before any
    // content is returned; refusal is pre-effect, not filtering post-read.
    let content: string;
    try {
      content = await readBoundFileContent(candidate.path, candidate.expected);
    } catch {
      continue;
    }

    const sourceLines = content.split(/\r?\n/);
    for (let index = 0; index < sourceLines.length; index += 1) {
      if (matchCount >= options.limit && options.limit >= 1) {
        matchLimitReached = true;
        break;
      }
      if (outputBytes >= MAX_OUTPUT_BYTES) break;

      const line = sourceLines[index];
      if (!regexp.test(line)) continue;
      const display = line.length > 2000 ? `${line.slice(0, 2000)}…` : line;
      outputBytes += outputLinesBytes(line, display);
      lines.push(`${relative}:${index + 1}: ${display}`);
      matchCount += 1;
    }
  }
  return { lines, excludedCount, matchLimitReached };
}

function outputLinesBytes(source: string, display: string): number {
  return Math.min(display.length, source.length) + 1;
}
