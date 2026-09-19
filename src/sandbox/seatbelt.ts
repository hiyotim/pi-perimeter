/**
 * Seatbelt (SBPL) profile generation for the contained shell route.
 *
 * The profile is derived from trusted host inputs only: the canonical
 * workspace root, the per-invocation projection/session directories, the
 * toolchain root derived from `process.execPath`, and the trusted protected
 * roots. No repository, configuration, model, or tool-output value can
 * influence it. Generation refuses rather than approximating: an unrepresentable
 * path character, an unrenderable classifier family, or a missing toolchain
 * root blocks the shell route.
 *
 * The profile is the enforcement boundary for the contained process and all of
 * its descendants. It denies network and Mach access by construction: no rule
 * for either is ever emitted.
 */

import { createHash } from "node:crypto";
import path from "node:path";
import { RESOURCE_RULE_REASONS } from "../policy/resources.ts";

export type SeatbeltRefusalCode =
  | "UNSUPPORTED_PLATFORM"
  | "UNSAFE_PROFILE_PATH"
  | "MISSING_TOOLCHAIN_ROOT"
  | "UNRENDERABLE_RESOURCE_FAMILY"
  | "PROFILE_TOO_LARGE";

export interface SeatbeltRefusal {
  readonly ok: false;
  readonly code: SeatbeltRefusalCode;
  readonly detail: string;
}

export interface SeatbeltRoots {
  /** Projection root: the contained process's cwd and only export source. */
  readonly stagingRoot: string;
  /** Constructed HOME for the contained process. */
  readonly homeRoot: string;
  /** Constructed TMPDIR for the contained process. */
  readonly tmpRoot: string;
  /** Read-only bound copies of sourced/script inputs. */
  readonly sealedRoot: string;
  /** Canonical toolchain installation root (derived from execPath). */
  readonly toolchainRoot: string;
  /** Canonical workspace root. Never granted; used for policy-zone denials. */
  readonly workspaceRoot: string;
  /** Project policy directory inside the workspace. Denied read and write. */
  readonly projectPolicyRoot: string;
  /** Trusted protected control-plane zones. Denied read and write. */
  readonly protectedZones: readonly { readonly name: string; readonly canonicalRoot: string }[];
}

export interface SeatbeltProfile {
  readonly text: string;
  readonly sha256: string;
  readonly byteLength: number;
  /** Families rendered as deny overrides, for the evidence record. */
  readonly renderedFamilies: readonly string[];
}

export type SeatbeltResult = { readonly ok: true; readonly profile: SeatbeltProfile } | SeatbeltRefusal;

/** System read roots that are fixed OS paths, not configuration values. */
const SYSTEM_READ_ROOTS = ["/System", "/usr", "/bin", "/sbin", "/private/etc"] as const;
const SYSTEM_METADATA_LITERALS = [
  "/",
  "/bin",
  "/sbin",
  "/usr",
  "/etc",
  "/private",
  "/private/etc",
  "/private/var",
  "/private/var/db",
  "/private/var/select",
  "/dev",
  "/dev/fd",
] as const;
/** Read roots that are symlinks or single files rather than subtrees. */
const SYSTEM_READ_EXTRA: readonly string[] = Object.freeze(["/private/var/select", "/private/var/db/timezone"]);
const DEVICE_READ_LITERALS = ["/dev/null", "/dev/zero", "/dev/random", "/dev/urandom"] as const;
const DEVICE_WRITE_LITERALS = ["/dev/null"] as const;

/**
 * One rendered deny family per classifier reason. `source` is a full-path,
 * globally anchored regular expression in which every ASCII letter is written
 * as an explicit two-character class, because the classifier folds ASCII case
 * and on-disk names may carry any case.
 */
interface ProfileFamily {
  readonly reason: string;
  readonly pattern: string;
}

/**
 * Rendered families. `letters`/`escape` below build the case-folded,
 * regex-escaped forms; literal fragments here are fixed policy constants that
 * mirror `src/policy/resources.ts`, never repository data.
 */
const PROFILE_FAMILIES: readonly ProfileFamily[] = [
  // environment: basename .env or .env.* (template markers included; the
  // classifier rates .env.example `sensitive`, and sensitive denies).
  { reason: "env-template", pattern: `^(.*/)?${literal(".")}${letters("env")}(${literal(".")}.*)?$` },
  { reason: "env-file", pattern: `^(.*/)?${literal(".")}${letters("env")}(${literal(".")}.*)?$` },
  // ssh-credentials: any path component .ssh
  { reason: "ssh-directory", pattern: `^(.*/)?${literal(".")}${letters("ssh")}(/.*)?$` },
  {
    reason: "ssh-private-key-name",
    pattern: `^(.*/)?(${alternatives([
      compose("id", "_", "rsa"),
      compose("id", "_", "dsa"),
      compose("id", "_", "ecdsa"),
      compose("id", "_", "ed25519"),
    ])})${
      suffixAlternatives(["\\.[bB][aA][kK]", "\\.[bB][aA][cC][kK][uU][pP]", "\\.[oO][lL][dD]", "~"])
    }`,
  },
  // private-key: .pem extension, then .key/.p12/.pfx
  { reason: "pem-file", pattern: `^(.*/)?[^/]*${literal(".")}${letters("pem")}(/.*)?$` },
  {
    reason: "private-key-extension",
    pattern: `^(.*/)?[^/]*${literal(".")}(${alternatives([letters("key"), letters("p12"), letters("pfx")])})(/.*)?$`,
  },
  {
    reason: "aws-credentials",
    pattern: `^(.*/)?${literal(".")}${letters("aws")}/${letters("credentials")}(/.*)?$`,
  },
  {
    reason: "aws-sso-cache",
    pattern: `^(.*/)?${literal(".")}${letters("aws")}/${letters("sso")}/${letters("cache")}(/.*)?$`,
  },
  {
    reason: "gcloud-credentials",
    pattern: `^(.*/)?${literal(".")}${letters("config")}/${letters("gcloud")}/(${
      alternatives([
        `${letters("credentials")}${literal(".")}${letters("db")}`,
        `${letters("access")}_${letters("tokens")}${literal(".")}${letters("db")}`,
        `${letters("application")}_${letters("default")}_${letters("credentials")}${literal(".")}${letters("json")}`,
      ])
    })(/.*)?$`,
  },
  {
    reason: "github-cli-credentials",
    pattern: `^(.*/)?${literal(".")}${letters("config")}/${letters("gh")}/${letters("hosts")}${literal(".")}${letters("yml")}(/.*)?$`,
  },
  {
    reason: "kubeconfig",
    pattern: `^(.*/)?${literal(".")}${letters("kube")}/${letters("config")}(/.*)?$`,
  },
  {
    reason: "docker-auth",
    pattern: `^(.*/)?${literal(".")}${letters("docker")}/${letters("config")}${literal(".")}${letters("json")}(/.*)?$`,
  },
  { reason: "netrc", pattern: `^(.*/)?${literal(".")}${letters("netrc")}(/.*)?$` },
  {
    reason: "package-auth-file",
    pattern: `^(.*/)?${literal(".")}(${alternatives([
      letters("npmrc"),
      letters("pypirc"),
      `${letters("yarnrc")}${literal(".")}${letters("yml")}`,
    ])})(/.*)?$`,
  },
  {
    reason: "git-credential-store",
    pattern: `^(.*/)?${literal(".")}${letters("git")}${literal("-")}${letters("credentials")}(/.*)?$`,
  },
];

/**
 * Classifier reasons with no rendered family. Exported so the "no silent
 * omission" rule is directly testable and so a future rule cannot be lost.
 */
export function missingResourceFamilies(rendered: readonly string[]): string[] {
  const present = new Set(rendered);
  return RESOURCE_RULE_REASONS.filter((reason) => !present.has(reason));
}

/** ASCII letters expanded to explicit two-character case classes (E10). */
function letters(value: string): string {
  let out = "";
  for (const character of value) {
    if (character >= "a" && character <= "z") {
      out += `[${character}${character.toUpperCase()}]`;
    } else if (character >= "A" && character <= "Z") {
      out += `[${character.toLowerCase()}${character}]`;
    } else {
      out += character;
    }
  }
  return out;
}

function literal(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alternatives(values: readonly string[]): string {
  return values.join("|");
}

function suffixAlternatives(values: readonly string[]): string {
  return `(${values.join("|")})?`;
}

function compose(...parts: readonly string[]): string {
  return parts.map((part) => letters(part)).join("");
}

function hasUnsafeProfileCharacter(value: string): boolean {
  if (value.includes("\0")) return true;
  if (value.includes('"') || value.includes("\\")) return true;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function validatePath(value: unknown, label: string): SeatbeltRefusal | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return { ok: false, code: "UNSAFE_PROFILE_PATH", detail: `${label} is empty` };
  }
  if (!path.isAbsolute(value)) {
    return { ok: false, code: "UNSAFE_PROFILE_PATH", detail: `${label} is not absolute` };
  }
  if (path.normalize(value) !== value) {
    return { ok: false, code: "UNSAFE_PROFILE_PATH", detail: `${label} is not normalized` };
  }
  if (hasUnsafeProfileCharacter(value)) {
    return {
      ok: false,
      code: "UNSAFE_PROFILE_PATH",
      detail: `${label} contains a character that cannot be rendered exactly ("\\", control character)`,
    };
  }
  return undefined;
}

/** Every literal ancestor of a path, from the root downward. */
export function ancestorLiterals(value: string): string[] {
  const segments = value.split("/").filter((segment) => segment.length > 0);
  const ancestors: string[] = ["/"];
  let current = "";
  for (const segment of segments) {
    current = `${current}/${segment}`;
    ancestors.push(current);
  }
  return ancestors;
}

function isInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Derives the toolchain root from a trusted executable path. It never walks
 * above a `bin` directory's parent and never returns a home directory.
 */
export function deriveToolchainRoot(execPath: unknown, homeDir: unknown): string | undefined {
  if (typeof execPath !== "string" || !path.isAbsolute(execPath)) return undefined;
  const binaryDirectory = path.dirname(execPath);
  const candidate = path.basename(binaryDirectory) === "bin" ? path.dirname(binaryDirectory) : binaryDirectory;
  if (path.normalize(candidate) !== candidate) return undefined;
  if (candidate === "/" || candidate === "") return undefined;
  if (typeof homeDir === "string" && homeDir.length > 0 && candidate === homeDir) return undefined;
  return candidate;
}

interface ProfileBuilder {
  readonly lines: string[];
}

/*
 * Ancestors receive metadata for the literal path only. They never receive a
 * subtree rule, so the existence of a listed ancestor is observable while its
 * directory contents are not: metadata must not become a listing grant.
 * Data-read subtrees already carry metadata for their own contents.
 */
function emitMetadata(builder: ProfileBuilder, literals: readonly string[]): void {
  const unique = [...new Set(literals)].sort();
  builder.lines.push("(allow file-read-metadata");
  for (const value of unique) builder.lines.push(`  (literal "${value}")`);
  builder.lines.push(")");
}

function emitReads(builder: ProfileBuilder, dataReads: readonly string[]): void {
  builder.lines.push("(allow file-read*");
  builder.lines.push('  (literal "/")');
  for (const value of SYSTEM_READ_ROOTS) builder.lines.push(`  (subpath "${value}")`);
  for (const value of SYSTEM_READ_EXTRA) builder.lines.push(`  (subpath "${value}")`);
  for (const value of [...new Set(dataReads)].sort()) builder.lines.push(`  (subpath "${value}")`);
  for (const value of DEVICE_READ_LITERALS) builder.lines.push(`  (literal "${value}")`);
  builder.lines.push(")");
}

function emitWrites(builder: ProfileBuilder, dataWrites: readonly string[]): void {
  builder.lines.push("(allow file-write*");
  for (const value of [...new Set(dataWrites)].sort()) builder.lines.push(`  (subpath "${value}")`);
  for (const value of DEVICE_WRITE_LITERALS) builder.lines.push(`  (literal "${value}")`);
  builder.lines.push(")");
}

/**
 * Generates the containment profile for one invocation. Refuses (never
 * approximates) when any input path is unrenderable or any classifier family
 * has no rendered form.
 */
export function generateSeatbeltProfile(roots: SeatbeltRoots): SeatbeltResult {
  if (process.platform !== "darwin") {
    return { ok: false, code: "UNSUPPORTED_PLATFORM", detail: `platform ${process.platform} is unsupported` };
  }

  const named: readonly (readonly [string, string])[] = [
    ["stagingRoot", roots.stagingRoot],
    ["homeRoot", roots.homeRoot],
    ["tmpRoot", roots.tmpRoot],
    ["sealedRoot", roots.sealedRoot],
    ["toolchainRoot", roots.toolchainRoot],
    ["workspaceRoot", roots.workspaceRoot],
    ["projectPolicyRoot", roots.projectPolicyRoot],
  ];
  for (const [label, value] of named) {
    const failure = validatePath(value, label);
    if (failure !== undefined) return failure;
  }
  if (roots.toolchainRoot.length === 0) {
    return { ok: false, code: "MISSING_TOOLCHAIN_ROOT", detail: "toolchain root is empty" };
  }
  for (const zone of roots.protectedZones) {
    const failure = validatePath(zone.canonicalRoot, `protectedZone:${zone.name}`);
    if (failure !== undefined) return failure;
  }

  // No silent omission: every classifier reason the accepted classifier can
  // emit must have exactly one rendered family.
  const rendered = new Set(PROFILE_FAMILIES.map((family) => family.reason));
  const missing = RESOURCE_RULE_REASONS.filter((reason) => !rendered.has(reason));
  if (missing.length > 0) {
    return {
      ok: false,
      code: "UNRENDERABLE_RESOURCE_FAMILY",
      detail: `classifier families without a rendered profile rule: ${missing.join(", ")}`,
    };
  }
  const knownReasons: readonly string[] = RESOURCE_RULE_REASONS;
  const unknown = PROFILE_FAMILIES.filter((family) => !knownReasons.includes(family.reason));
  if (unknown.length > 0) {
    return {
      ok: false,
      code: "UNRENDERABLE_RESOURCE_FAMILY",
      detail: `profile rules without a classifier family: ${unknown.map((family) => family.reason).join(", ")}`,
    };
  }

  const dataReads = [
    roots.toolchainRoot,
    roots.stagingRoot,
    roots.homeRoot,
    roots.tmpRoot,
    roots.sealedRoot,
    ...SYSTEM_READ_EXTRA,
  ];
  const dataWrites = [roots.stagingRoot, roots.homeRoot, roots.tmpRoot];
  const metadataLiterals = [
    ...SYSTEM_METADATA_LITERALS,
    ...ancestorLiterals(roots.stagingRoot),
    ...ancestorLiterals(roots.homeRoot),
    ...ancestorLiterals(roots.tmpRoot),
    ...ancestorLiterals(roots.sealedRoot),
    ...ancestorLiterals(roots.toolchainRoot),
    ...roots.protectedZones.flatMap((zone) => ancestorLiterals(zone.canonicalRoot)),
    ...ancestorLiterals(roots.projectPolicyRoot),
  ];

  const builder: ProfileBuilder = { lines: [] };
  builder.lines.push("(version 1)");
  builder.lines.push("(deny default)");
  builder.lines.push("(allow process*)");
  builder.lines.push('(allow sysctl-read (sysctl-name-prefix "hw.") (sysctl-name-prefix "kern."))');
  emitMetadata(builder, metadataLiterals);
  emitReads(builder, dataReads);
  emitWrites(builder, dataWrites);

  // Deny overrides are emitted last: the last matching rule wins.
  for (const zone of roots.protectedZones) {
    builder.lines.push(`(deny file-read* (subpath "${zone.canonicalRoot}"))`);
    builder.lines.push(`(deny file-write* (subpath "${zone.canonicalRoot}"))`);
  }
  builder.lines.push(`(deny file-read* (subpath "${roots.projectPolicyRoot}"))`);
  builder.lines.push(`(deny file-write* (subpath "${roots.projectPolicyRoot}"))`);
  // Workspace control files that would give persistence inside the projection.
  builder.lines.push(`(deny file-write* (subpath "${path.join(roots.stagingRoot, ".git")}"))`);
  // Distinct reasons can share one rendered pattern (the env families do);
  // each reason must be covered, and identical patterns are emitted once.
  for (const pattern of [...new Set(PROFILE_FAMILIES.map((family) => family.pattern))]) {
    builder.lines.push(`(deny file-read* (regex #"${pattern}"))`);
    builder.lines.push(`(deny file-write* (regex #"${pattern}"))`);
  }
  const text = `${builder.lines.join("\n")}\n`;
  if (Buffer.byteLength(text, "utf8") > 256 * 1024) {
    return { ok: false, code: "PROFILE_TOO_LARGE", detail: "generated profile exceeds the supported size" };
  }

  return {
    ok: true,
    profile: Object.freeze({
      text,
      sha256: createHash("sha256").update(text, "utf8").digest("hex"),
      byteLength: Buffer.byteLength(text, "utf8"),
      renderedFamilies: Object.freeze(PROFILE_FAMILIES.map((family) => family.reason)),
    }),
  };
}

/** True when `candidate` is inside `root` (component-aware). */
export function isWithin(candidate: string, root: string): boolean {
  return isInside(candidate, root);
}
