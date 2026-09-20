/**
 * The per-invocation network broker: the only network route a contained
 * invocation can reach. The Seatbelt profile grants exactly this listener's
 * endpoint — one TCP port on local addresses — and nothing else, so every
 * outbound development connection is enforced here, at tunnel-open time,
 * against the pinned scope frozen at preparation
 * ([docs/NETWORK-GATE.md](../../docs/NETWORK-GATE.md)).
 *
 * The broker performs no resolution at tunnel time: a CONNECT target must
 * match one pinned destination exactly (host string and port), and the
 * outbound socket goes to the addresses pinned during preparation — never a
 * fresh lookup, never a redirect target, never a proxy service. Everything
 * else is refused. The broker takes no policy decision beyond that exact
 * match and exposes no operation the child could widen.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";

import { ShellRefusal } from "./errors.ts";

export const NETWORK_BROKER_LIMITS = Object.freeze({
  maxConnectRequestBytes: 8 * 1024,
  maxConcurrentTunnels: 16,
  maxTunnelBytes: 256 * 1024 * 1024,
  maxInvocationBytes: 1024 * 1024 * 1024,
  connectIdleTimeoutMs: 60_000,
  tunnelIdleTimeoutMs: 60_000,
});

export interface PinnedAddress {
  readonly family: "IPv4" | "IPv6";
  readonly address: string;
}

export interface PinnedDestination {
  readonly host: string;
  readonly ports: readonly number[];
  readonly addresses: readonly PinnedAddress[];
}

export interface NetworkBrokerScope {
  /** Canonical, non-secret scope description for status surfaces. */
  readonly entries: readonly {
    readonly host: string;
    readonly portCount: number;
    readonly addressCount: number;
  }[];
}

export interface NetworkBrokerStats {
  readonly tunnelsOpened: number;
  readonly tunnelsRefused: number;
  readonly tunnelsFailed: number;
  readonly bytesRelayed: number;
}

export interface NetworkBroker {
  readonly port: number;
  readonly scope: NetworkBrokerScope;
  /**
   * Enables tunnel service. The listener exists from preparation (the profile
   * needs its port) but refuses every request until the invocation is
   * actually authorized and about to start, so the pre-approval window has no
   * reachable route.
   */
  arm(): void;
  stats(): NetworkBrokerStats;
  close(): Promise<void>;
}

/**
 * Resolves and pins one destination entry: every pinned address must be
 * public (loopback, private, link-local, metadata and other non-global
 * ranges are excluded), and at least one public address must exist — an
 * unresolvable or non-public destination refuses the invocation (fail
 * closed). The lookup is injectable so the refusal paths have deterministic
 * regression tests; production always uses the real host resolver.
 */
export async function pinDestination(
  host: string,
  ports: readonly number[],
  lookupHost: (host: string) => Promise<{ readonly family: number; readonly address: string }[]> = realLookup,
): Promise<PinnedDestination> {
  let answers;
  try {
    answers = await lookupHost(host);
  } catch (error) {
    throw new ShellRefusal(
      "NETWORK_DESTINATION_UNRESOLVABLE",
      `destination ${host} could not be resolved (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const addresses: PinnedAddress[] = [];
  for (const answer of answers) {
    const family = answer.family === 6 ? "IPv6" : "IPv4";
    if (!isPublicAddress(family, answer.address)) continue;
    if (addresses.some((pinned) => pinned.family === family && pinned.address === answer.address)) continue;
    addresses.push(Object.freeze({ family, address: answer.address }));
  }
  if (addresses.length === 0) {
    throw new ShellRefusal(
      "NETWORK_DESTINATION_NOT_PUBLIC",
      `destination ${host} resolved to no public address; the route stays closed`,
    );
  }
  return Object.freeze({ host, ports: Object.freeze([...ports]), addresses: Object.freeze(addresses) });
}

async function realLookup(host: string): Promise<{ readonly family: number; readonly address: string }[]> {
  return lookup(host, { all: true, verbatim: true });
}

/** True for globally reachable addresses this contract may pin. */
export function isPublicAddress(family: "IPv4" | "IPv6", address: string): boolean {
  return family === "IPv4" ? isPublicIPv4(address) : isPublicIPv6(address);
}

function isPublicIPv4(address: string): boolean {
  const parts = address.split(".");
  if (parts.length !== 4) return false;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const value = Number(part);
    if (value > 255) return false;
    octets.push(value);
  }
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false; // this-network, private, loopback
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF protocol assignments, TEST-1
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay anycast 192.88.99.0/24
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // TEST-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-3
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

/**
 * Classifies one IPv6 answer by its numeric 16-bit groups, so no textual
 * spelling (compressed, expanded, dotted, uppercase, leading zeros) can skip
 * a range check. Returns false for anything that does not expand to exactly
 * eight groups (fail closed).
 */
function isPublicIPv6(address: string): boolean {
  const groups = expandIPv6(address);
  if (groups === undefined) return false;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const allZero = groups.every((group) => group === 0);
  if (allZero) return false; // unspecified ::
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1) {
    return false; // loopback ::1
  }
  if ((g0 & 0xfe00) === 0xfc00) return false; // ULA fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((g0 & 0xffc0) === 0xfec0) return false; // deprecated site-local fec0::/10
  if ((g0 & 0xff00) === 0xff00) return false; // multicast ff00::/8
  if (g0 === 0x3fff && (g1 & 0xf000) === 0) return false; // documentation 3fff::/20
  if (g0 === 0x5f00) return false; // SRv6 SIDs 5f00::/16
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return false; // discard-only 100::/64
  // 2001::/23 IETF protocol assignments (Teredo, benchmarking, ORCHID, …) and
  // the documentation block 2001:db8::/32.
  if (g0 === 0x2001 && (g1 < 0x0200 || g1 === 0x0db8)) return false;
  // IPv4-mapped ::ffff:0:0/96, IPv4-translated ::ffff:0:0:0/96 and the
  // deprecated IPv4-compatible ::/96 carry the embedded IPv4 in the last 32
  // bits; NAT64 64:ff9b::/96 likewise; 6to4 2002::/16 carries it in groups
  // 1–2. Classify the embedded address.
  const lastEmbedded =
    groups.slice(0, 6).every((group) => group === 0) ||
    (groups.slice(0, 5).every((group) => group === 0) && g5 === 0xffff) ||
    (groups.slice(0, 4).every((group) => group === 0) && g4 === 0xffff && g5 === 0);
  if (lastEmbedded || (g0 === 0x0064 && g1 === 0xff9b)) {
    return isPublicIPv4(`${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`);
  }
  if (g0 === 0x2002) {
    return isPublicIPv4(`${g1 >> 8}.${g1 & 0xff}.${g2 >> 8}.${g2 & 0xff}`);
  }
  // The zero prefix is reserved space; every embedded form it defines was
  // handled above, so anything left here is not globally reachable.
  if (g0 === 0) return false;
  return true;
}

/**
 * Expands an IPv6 literal (with an optional trailing dotted IPv4) into exactly
 * eight 16-bit groups. Undefined for malformed input: bad hex, more than one
 * `::`, more than eight groups, empty groups outside a `::`, or a malformed
 * trailing IPv4.
 */
function expandIPv6(address: string): number[] | undefined {
  const value = address.trim().toLowerCase();
  if (value.length === 0 || value.length > 64) return undefined;
  let text = value;
  const groups: number[] = [];
  // A trailing dotted IPv4 contributes the last two groups.
  const dotted = /^(.*:)((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))$/.exec(text);
  let trailing: number[] = [];
  if (dotted !== null) {
    // Drop the separator colon the dotted group replaced, so `::ffff:` becomes
    // `::ffff` instead of leaving an empty group.
    text = dotted[1].replace(/:$/, "");
    const octets = dotted[2].split(".").map((part) => Number(part));
    trailing = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
  }
  const parseGroups = (part: string): number[] | undefined => {
    if (part.length === 0) return [];
    const values: number[] = [];
    for (const group of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return undefined;
      values.push(Number.parseInt(group, 16));
    }
    return values;
  };
  const halves = text.split("::");
  if (halves.length > 2) return undefined;
  if (halves.length === 2) {
    const head = parseGroups(halves[0]);
    const tail = parseGroups(halves[1]);
    if (head === undefined || tail === undefined) return undefined;
    const fill = 8 - head.length - tail.length - trailing.length;
    if (fill < 1) return undefined;
    groups.push(...head, ...new Array(fill).fill(0), ...tail);
  } else {
    const head = parseGroups(text);
    if (head === undefined) return undefined;
    groups.push(...head);
  }
  groups.push(...trailing);
  if (groups.length !== 8) return undefined;
  return groups;
}

/** Dials the pinned addresses in order; the first connect wins. */
function dialPinned(
  destination: PinnedDestination,
  port: number,
  index: number,
  done: (outbound: net.Socket | undefined, error: Error | undefined) => void,
): void {
  if (index >= destination.addresses.length) {
    done(undefined, new Error("no pinned address accepted the connection"));
    return;
  }
  const pinned = destination.addresses[index];
  const outbound = net.connect({ host: pinned.address, port, family: pinned.family === "IPv4" ? 4 : 6 });
  const onError = (error: Error): void => {
    outbound.destroy();
    dialPinned(destination, port, index + 1, done);
  };
  outbound.once("error", onError);
  outbound.once("connect", () => {
    outbound.removeListener("error", onError);
    done(outbound, undefined);
  });
}

interface Tunnel {
  readonly client: net.Socket;
  readonly outbound: net.Socket;
}

/**
 * Opens the broker for a pinned scope. The listener binds 127.0.0.1 on an
 * ephemeral port; that port is the profile's only network allowance.
 */
export function openNetworkBroker(pinned: readonly PinnedDestination[]): Promise<NetworkBroker> {
  if (pinned.length === 0) {
    return Promise.reject(new ShellRefusal("NETWORK_SCOPE_EMPTY", "the network scope is empty"));
  }
  const byHost = new Map<string, PinnedDestination>();
  for (const destination of pinned) {
    // Defensive per-host merge: a duplicate host entry extends the enforced
    // port set instead of replacing it (the only caller already merges; this
    // keeps the enforcement boundary safe on its own).
    const existing = byHost.get(destination.host);
    if (existing === undefined) {
      byHost.set(destination.host, destination);
      continue;
    }
    const ports = [...new Set([...existing.ports, ...destination.ports])].sort((left, right) => left - right);
    const addresses = [...existing.addresses];
    for (const address of destination.addresses) {
      if (!addresses.some((candidate) => candidate.family === address.family && candidate.address === address.address)) {
        addresses.push(address);
      }
    }
    byHost.set(
      destination.host,
      Object.freeze({ host: destination.host, ports: Object.freeze(ports), addresses: Object.freeze(addresses) }),
    );
  }
  let tunnelsOpened = 0;
  let tunnelsRefused = 0;
  let tunnelsFailed = 0;
  let bytesRelayed = 0;
  let breached = false;
  let armed = false;
  const tunnels = new Set<Tunnel>();
  let server: net.Server | undefined;

  const serverReady = new Promise<net.Server>((resolve, reject) => {
    server = net.createServer((client) => {
      client.setNoDelay(true);
      client.setTimeout(NETWORK_BROKER_LIMITS.connectIdleTimeoutMs);
      let header = Buffer.alloc(0);
      let handled = false;
      client.on("timeout", () => client.destroy());
      client.on("data", function onData(chunk: Buffer): void {
        if (handled) return;
        header = Buffer.concat([header, chunk]);
        if (header.length > NETWORK_BROKER_LIMITS.maxConnectRequestBytes) {
          handled = true;
          tunnelsRefused += 1;
          client.destroy();
          return;
        }
        const eol = header.indexOf("\r\n\r\n");
        if (eol === -1) return;
        handled = true;
        const firstLine = header.subarray(0, header.indexOf("\r\n")).toString("latin1");
        const match = /^CONNECT\s+(\S+)\s+HTTP\/1\.[01]$/.exec(firstLine);
        if (match === null) {
          tunnelsRefused += 1;
          client.end("HTTP/1.1 405 Method Not Allowed\r\n\r\n");
          return;
        }
        const target = match[1];
        const colon = target.lastIndexOf(":");
        if (colon <= 0 || colon === target.length - 1 || target.includes("[")) {
          tunnelsRefused += 1;
          client.end("HTTP/1.1 400 Bad Request\r\n\r\n");
          return;
        }
        const host = target.slice(0, colon).toLowerCase();
        const digits = target.slice(colon + 1);
        const port = /^\d{1,5}$/.test(digits) ? Number(digits) : NaN;
        const destination = Number.isInteger(port) ? byHost.get(host) : undefined;
        if (destination === undefined || !destination.ports.includes(port)) {
          tunnelsRefused += 1;
          client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
          return;
        }
        if (!armed) {
          // Preparation only reserves the endpoint; no tunnel is served until
          // the invocation's authority is consumed and the child is about to
          // start.
          tunnelsRefused += 1;
          client.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
          return;
        }
        if (breached || tunnels.size >= NETWORK_BROKER_LIMITS.maxConcurrentTunnels) {
          tunnelsRefused += 1;
          client.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
          return;
        }
        dialPinned(destination, port, 0, (outbound, error) => {
          if (error !== undefined || outbound === undefined) {
            tunnelsFailed += 1;
            client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
            return;
          }
          tunnelsOpened += 1;
          outbound.setNoDelay(true);
          outbound.setTimeout(NETWORK_BROKER_LIMITS.tunnelIdleTimeoutMs, () => outbound.destroy());
          const postHeader = header.subarray(eol + 4);
          if (postHeader.length > 0) outbound.write(postHeader);
          const tunnel: Tunnel = { client, outbound };
          tunnels.add(tunnel);
          client.write("HTTP/1.1 200 Connection established\r\n\r\n");

          const pipe = (source: net.Socket, sink: net.Socket): void => {
            let tunnelBytes = 0;
            source.on("data", (chunk: Buffer) => {
              bytesRelayed += chunk.length;
              tunnelBytes += chunk.length;
              if (bytesRelayed > NETWORK_BROKER_LIMITS.maxInvocationBytes) {
                breached = true;
                for (const open of [...tunnels]) {
                  open.client.destroy();
                  open.outbound.destroy();
                }
                tunnels.clear();
                return;
              }
              if (tunnelBytes > NETWORK_BROKER_LIMITS.maxTunnelBytes) {
                tunnelsFailed += 1;
                client.destroy();
                outbound.destroy();
                return;
              }
              if (!sink.write(chunk)) {
                source.pause();
                sink.once("drain", () => source.resume());
              }
            });
          };
          pipe(client, outbound);
          pipe(outbound, client);

          const teardown = (): void => {
            tunnels.delete(tunnel);
            client.destroy();
            outbound.destroy();
          };
          client.on("close", teardown);
          outbound.on("close", teardown);
          client.on("error", () => outbound.destroy());
          outbound.on("error", () => client.destroy());
        });
      });
      client.on("error", () => undefined);
    });
    server.on("error", (error) =>
      reject(new ShellRefusal("NETWORK_BROKER_FAILED", `network broker failed: ${error.message}`)),
    );
    server.listen(0, "127.0.0.1", () => resolve(server as net.Server));
  });

  return serverReady.then((listening) => {
    const address = listening.address();
    if (address === null || typeof address !== "object" || address.family !== "IPv4") {
      throw new ShellRefusal("NETWORK_BROKER_FAILED", "network broker did not bind an IPv4 loopback endpoint");
    }
    return Object.freeze({
      port: address.port,
      scope: Object.freeze({
        entries: Object.freeze(
          pinned.map((destination) =>
            Object.freeze({
              host: destination.host,
              portCount: destination.ports.length,
              addressCount: destination.addresses.length,
            }),
          ),
        ),
      }),
      arm: (): void => {
        armed = true;
      },
      stats: () => Object.freeze({ tunnelsOpened, tunnelsRefused, tunnelsFailed, bytesRelayed }),
      close: async (): Promise<void> => {
        for (const tunnel of [...tunnels]) {
          tunnel.client.destroy();
          tunnel.outbound.destroy();
        }
        tunnels.clear();
        const target = server;
        await new Promise<void>((resolve) => {
          if (target === undefined) return resolve();
          target.close(() => resolve());
        });
      },
    });
  });
}
