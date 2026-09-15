/**
 * Protected control-plane resources.
 *
 * Some resources are critical to authorization itself even where the generic
 * path classifier would report them as ordinary: the Pi agent directory
 * (`getAgentDir()`, which holds auth.json, sessions, models.json, settings,
 * downloaded tools), and the trusted pi-warden user configuration root, whose
 * policy.json is authoritative configuration.
 *
 * Zones are created from trusted host inputs only: trusted caller-provided
 * roots, never repository, model, session, or tool-output data. Zone roots are
 * canonicalized once by the trusted caller through the same resolver the rest
 * of this module uses. A zone denies every resource at or below its canonical
 * root, and the denial overrides a workspace allowance, configuration
 * outcomes, and any approval.
 */

import path from "node:path";

export type ProtectedZoneName = "pi-warden-agent-dir" | "pi-warden-user-config";

export interface ProtectedZone {
  readonly name: ProtectedZoneName;
  readonly canonicalRoot: string;
}

export type ProtectedDenialReason = "PROTECTED_RESOURCE";

export interface ProtectedDenial {
  readonly decision: "DENY";
  readonly reason: ProtectedDenialReason;
  readonly zone: ProtectedZoneName;
}

const zoneBrand = Symbol("pi-warden.protectedZoneBrand");
const issuedZones = new WeakSet<object>();

export interface IssuedProtectedZone extends ProtectedZone {
  readonly [zoneBrand]: true;
}

function isCanonicalAbsoluteDirectoryLike(root: unknown): boolean {
  return (
    typeof root === "string" &&
    root.length > 0 &&
    root.includes("\0") === false &&
    path.isAbsolute(root) &&
    path.normalize(root) === root
  );
}

/**
 * Issues a protected zone from a trusted canonical root. The root must
 * already be canonical (realpath-resolved) — issuing does not follow
 * symlinks, because the trusted caller resolved it beforehand. Forged or
 * non-canonical values fail closed by refusing to issue.
 */
export function createProtectedZone(
  name: ProtectedZoneName,
  canonicalRoot: unknown,
): IssuedProtectedZone | undefined {
  if (!isCanonicalAbsoluteDirectoryLike(canonicalRoot)) return undefined;
  const canonicalValue: string = canonicalRoot as string;
  if (canonicalValue === path.dirname(canonicalValue)) return undefined;
  const zone: IssuedProtectedZone = Object.freeze({
    name,
    canonicalRoot: canonicalValue,
    [zoneBrand]: true as const,
  });
  issuedZones.add(zone);
  return zone;
}

export function isProtectedZone(value: unknown): value is IssuedProtectedZone {
  return typeof value === "object" && value !== null && issuedZones.has(value);
}

/**
 * True when the trusted path is the zone root itself or lies below it.
 * Membership is a component-aware prefix check, not a string-prefix check.
 */
export function isInsideProtectedZone(resource: string, zone: ProtectedZone): boolean {
  const relative = path.relative(zone.canonicalRoot, resource);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/** Synchronous structural denial check over issued zones. */
export function protectedDenialFor(
  canonicalPath: unknown,
  zones: readonly ProtectedZone[],
): ProtectedDenial | undefined {
  if (typeof canonicalPath !== "string") return undefined;
  for (const zone of zones) {
    if (isInsideProtectedZone(canonicalPath, zone)) {
      return Object.freeze({ decision: "DENY", reason: "PROTECTED_RESOURCE" as const, zone: zone.name });
    }
  }
  return undefined;
}
