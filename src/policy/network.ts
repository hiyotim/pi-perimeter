/**
 * Pure network policy: destination validation, trusted/project composition,
 * representable-target extraction and approval-scope derivation.
 *
 * This module performs no filesystem, network, process, or Pi work. It reads
 * no configuration itself: the caller supplies validated policy objects. Its
 * decisions are inputs to the shell policy join; the enforcement boundary is
 * the Seatbelt profile plus the per-invocation network broker
 * ([docs/NETWORK-GATE.md](../../docs/NETWORK-GATE.md)).
 *
 * Monotonicity: the effective scope is composed only from trusted-configuration
 * entries; project configuration can remove a destination or narrow a port set
 * and can never add either. Repository, model, session, or tool-output data
 * cannot widen the scope or produce authority.
 */

import type { OperationPolicy } from "./configuration.ts";

export interface NetworkDestinationEntry {
  /** Canonical ASCII hostname (validated by `isValidNetworkHost`). */
  readonly host: string;
  /** Explicit TCP ports; no ranges, no defaults. */
  readonly ports: readonly number[];
}

export type ComposedNetworkScope =
  | { readonly status: "closed" }
  | { readonly status: "open"; readonly entries: readonly NetworkDestinationEntry[] }
  | { readonly status: "invalid"; readonly code: string };

export interface ShellNetworkTarget {
  /** Only https URLs are representable; the route tunnels CONNECT only. */
  readonly scheme: "https";
  readonly host: string;
  readonly port: number;
}

export const NETWORK_LIMITS = Object.freeze({
  maxEntries: 32,
  maxPortsPerEntry: 16,
  maxHostLength: 253,
  maxLabelLength: 63,
  maxTargets: 64,
});

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_ALL_NUMERIC = /^[0-9.]+$/;

/** True for a canonical ASCII hostname this contract accepts as an entry. */
export function isValidNetworkHost(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > NETWORK_LIMITS.maxHostLength) return false;
  if (value !== value.toLowerCase()) return false;
  if (value.endsWith(".")) return false;
  const labels = value.split(".");
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!HOST_LABEL.test(label)) return false;
  }
  // A host made only of digits and dots is an address literal, not a name.
  if (IPV4_ALL_NUMERIC.test(value)) return false;
  if (value.includes(":")) return false;
  return true;
}

/** True for a single valid explicit port value. */
export function isValidNetworkPort(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535;
}

export interface NetworkPolicyValue {
  readonly destinations: readonly NetworkDestinationEntry[];
}

/**
 * Validates the trusted `network` section of one policy document. Pure and
 * exact: anything unrepresentable refuses the document (fail closed). Both
 * plain objects and the parser's Map nodes are accepted; unknown keys refuse.
 */
export function validateNetworkPolicyValue(value: unknown): { ok: true; value: NetworkPolicyValue } | { ok: false; code: "INVALID_SCHEMA" } {
  const record = fieldsOf(value);
  if (record === undefined) return { ok: false, code: "INVALID_SCHEMA" };
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== "destinations") return { ok: false, code: "INVALID_SCHEMA" };
  const rawDestinations = record["destinations"];
  if (!Array.isArray(rawDestinations)) return { ok: false, code: "INVALID_SCHEMA" };
  if (rawDestinations.length > NETWORK_LIMITS.maxEntries) return { ok: false, code: "INVALID_SCHEMA" };
  const seenHosts = new Set<string>();
  const destinations: NetworkDestinationEntry[] = [];
  for (const rawEntry of rawDestinations) {
    const entry = fieldsOf(rawEntry);
    if (entry === undefined) return { ok: false, code: "INVALID_SCHEMA" };
    const entryKeys = Object.keys(entry);
    if (entryKeys.length !== 2 || !entryKeys.includes("host") || !entryKeys.includes("ports")) {
      return { ok: false, code: "INVALID_SCHEMA" };
    }
    const host = entry["host"];
    if (!isValidNetworkHost(host)) return { ok: false, code: "INVALID_SCHEMA" };
    if (seenHosts.has(host)) return { ok: false, code: "INVALID_SCHEMA" };
    seenHosts.add(host);
    const rawPorts = entry["ports"];
    if (!Array.isArray(rawPorts)) return { ok: false, code: "INVALID_SCHEMA" };
    if (rawPorts.length === 0 || rawPorts.length > NETWORK_LIMITS.maxPortsPerEntry) {
      return { ok: false, code: "INVALID_SCHEMA" };
    }
    const seenPorts = new Set<number>();
    const ports: number[] = [];
    for (const rawPort of rawPorts) {
      if (!isValidNetworkPort(rawPort)) return { ok: false, code: "INVALID_SCHEMA" };
      if (seenPorts.has(rawPort)) return { ok: false, code: "INVALID_SCHEMA" };
      seenPorts.add(rawPort);
      ports.push(rawPort);
    }
    destinations.push(Object.freeze({ host, ports: Object.freeze(ports) }));
  }
  return { ok: true, value: Object.freeze({ destinations: Object.freeze(destinations) }) };
}

/**
 * Joins the trusted and project scopes. Absent trusted policy means closed:
 * project data alone can never open the route. A valid project `network`
 * section filters the trusted entries per host and intersects port sets.
 */
export function composeNetworkScope(
  user: { readonly status: "absent" | "invalid" } | { readonly status: "valid"; readonly policy: OperationPolicy },
  project: { readonly status: "absent" | "invalid" } | { readonly status: "valid"; readonly policy: OperationPolicy },
): ComposedNetworkScope {
  if (user.status === "invalid" || project.status === "invalid") {
    return Object.freeze({ status: "invalid", code: "INVALID_SCHEMA" });
  }
  if (user.status !== "valid") {
    // No trusted allowlist: the route stays closed. Project data cannot open it.
    return Object.freeze({ status: "closed" });
  }
  const projectNetwork = networkSectionOf(project.status === "valid" ? project.policy : undefined);
  const entries: NetworkDestinationEntry[] = [];
  for (const entry of userEntriesOf(user.policy)) {
    let ports = entry.ports;
    if (projectNetwork !== undefined) {
      const projectEntry = projectNetwork.destinations.find((candidate) => candidate.host === entry.host);
      // The project filters any host it mentions; an unmentioned host passes.
      if (projectEntry !== undefined) {
        ports = entry.ports.filter((port) => projectEntry.ports.includes(port));
      }
    }
    if (ports.length > 0) entries.push(Object.freeze({ host: entry.host, ports: Object.freeze(ports) }));
  }
  if (entries.length === 0) return Object.freeze({ status: "closed" });
  return Object.freeze({ status: "open", entries: Object.freeze(entries) });
}

function userEntriesOf(policy: OperationPolicy): readonly NetworkDestinationEntry[] {
  const section = networkSectionOf(policy);
  return section === undefined ? [] : section.destinations;
}

/**
 * Reads one parser node as plain fields. The policy JSON reader builds Map
 * nodes; tests and documents may also supply plain objects. Arrays and
 * primitives have no fields.
 */
function fieldsOf(value: unknown): Record<string, unknown> | undefined {
  if (value instanceof Map) {
    const record: Record<string, unknown> = Object.create(null);
    for (const [key, entry] of value) {
      if (typeof key !== "string") return undefined;
      record[key] = entry;
    }
    return record;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/**
 * Reads the branded network section of a validated policy. Returns undefined
 * when the policy carries no network section or is not a genuine policy.
 */
export function networkSectionOf(policy: OperationPolicy | undefined): NetworkPolicyValue | undefined {
  if (policy === undefined) return undefined;
  const section = (policy as { readonly network?: unknown }).network;
  if (section === undefined) return undefined;
  const validated = validateNetworkPolicyValue(section);
  return validated.ok ? validated.value : undefined;
}

/**
 * Extracts representable destinations from post-parse command words. Only
 * `https://host[:port][/…]` words are representable; everything else (plain
 * host words, `http://`, IP literals, non-ASCII or punycode-decoded names,
 * malformed ports) is deliberately not representable and simply stays
 * unreachable — the route fails closed without inventing authority. The
 * extraction is one-directional: a destination hidden from these words (from
 * a config file, a script, or the environment) is unrepresentable too.
 */
export function extractNetworkTargets(words: readonly string[]): readonly ShellNetworkTarget[] {
  const targets: ShellNetworkTarget[] = [];
  for (const word of words) {
    if (word.length === 0 || word.length > 2048) continue;
    if (!/^[Hh][Tt][Tt][Pp][Ss]:\/\//.test(word)) continue;
    const authority = authorityOf(word.slice("https://".length));
    if (authority === undefined) continue;
    const rawHost = hostOfAuthority(authority);
    // The enforced identity is the canonical lowercase host: the broker
    // matches CONNECT targets case-folded, so the displayed destination is
    // exactly the identity that will be enforced.
    const host = rawHost.toLowerCase();
    const parsedPort = authorityPort(authority);
    // A written port that is not a valid explicit value makes the word
    // unrepresentable (fail closed); absence falls back to the scheme default.
    if (parsedPort.present && parsedPort.value === undefined) continue;
    const port = parsedPort.value ?? 443;
    if (!isValidNetworkHost(host)) continue;
    if (targets.some((target) => target.host === host && target.port === port)) continue;
    if (targets.length >= NETWORK_LIMITS.maxTargets) break;
    targets.push(Object.freeze({ scheme: "https" as const, host, port }));
  }
  return Object.freeze(targets);
}

function authorityOf(rest: string): string | undefined {
  const end = rest.search(/[/?#]/);
  const authority = end === -1 ? rest : rest.slice(0, end);
  return authority.length === 0 ? undefined : authority;
}

/** Strips an optional userinfo and port; only the host component is a name. */
function hostOfAuthority(authority: string): string {
  const at = authority.lastIndexOf("@");
  const hostPort = at === -1 ? authority : authority.slice(at + 1);
  if (hostPort.startsWith("[")) {
    const end = hostPort.indexOf("]");
    return end === -1 ? hostPort : hostPort.slice(1, end);
  }
  const colon = hostPort.lastIndexOf(":");
  return colon === -1 ? hostPort : hostPort.slice(0, colon);
}

/**
 * Reads the authority's port component. `present` is true only when a port is
 * written; `value` is defined only for a valid explicit port.
 */
function authorityPort(authority: string): { readonly present: boolean; readonly value: number | undefined } {
  const at = authority.lastIndexOf("@");
  const hostPort = at === -1 ? authority : authority.slice(at + 1);
  if (hostPort.startsWith("[")) return { present: false, value: undefined };
  const colon = hostPort.lastIndexOf(":");
  if (colon === -1) return { present: false, value: undefined };
  const digits = hostPort.slice(colon + 1);
  if (!/^[0-9]{1,5}$/.test(digits)) return { present: true, value: undefined };
  const port = Number(digits);
  return { present: true, value: isValidNetworkPort(port) ? port : undefined };
}

/** Canonical non-secret representation used in approvals and reports. */
export function describeNetworkTarget(target: ShellNetworkTarget): string {
  return `https://${target.host}:${target.port}`;
}

/** True when the effective scope already covers this exact destination. */
export function scopeCoversTarget(
  scope: ComposedNetworkScope,
  target: ShellNetworkTarget,
): boolean {
  if (scope.status !== "open") return false;
  return scope.entries.some(
    (entry) => entry.host === target.host && entry.ports.includes(target.port),
  );
}

/** The representable destinations the current scope does not cover. */
export function unapprovedNetworkTargets(
  scope: ComposedNetworkScope,
  targets: readonly ShellNetworkTarget[],
): readonly ShellNetworkTarget[] {
  return Object.freeze(targets.filter((target) => !scopeCoversTarget(scope, target)));
}
