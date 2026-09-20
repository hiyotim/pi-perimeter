/**
 * Contained-route network evidence suite (declared target: macOS 26A428, arm64).
 *
 * The child runs under the real generated profile with the per-invocation
 * network broker and probes the route from inside containment. Refusal cases
 * are hermetic (they need no external network). The pinned-tunnel positive
 * control needs the authorized destination to be reachable from the host; when
 * the environment cannot reach it, the route must fail closed with the
 * broker's bad-gateway answer instead of succeeding.
 */

import assert from "node:assert/strict";
import { lookup as dnsLookup } from "node:dns/promises";
import { existsSync } from "node:fs";
import { connect as netConnect, createConnection, createServer } from "node:net";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadOperationPolicySources } from "../src/policy/config-loader.ts";
import { resolveWorkspacePath } from "../src/policy/paths.ts";
import { createProtectedZone } from "../src/policy/control-plane.ts";
import { composeNetworkScope } from "../src/policy/network.ts";
import { parseOperationPolicy } from "../src/policy/configuration.ts";
import { networkStateOf } from "../src/gate/shell-runtime.ts";
import { prepareContainedInvocation, runContainedShellCommand } from "../src/sandbox/containment.ts";
import { ShellRefusal } from "../src/sandbox/errors.ts";
import { isPublicAddress, pinDestination } from "../src/sandbox/network-broker.ts";
import { defaultBuildManifestPath, defaultHelperPath } from "../src/sandbox/helper.ts";

function parseOperationPolicyOrThrow(value: unknown) {
  const parsed = parseOperationPolicy(JSON.stringify(value));
  if (parsed.status !== "valid") throw new Error(`fixture policy invalid: ${JSON.stringify(value)}`);
  return parsed.policy;
}

const darwin = process.platform === "darwin";
const skip = darwin ? false : "declared macOS target only";
const packageRoot = process.cwd();
const helperPath = defaultHelperPath(packageRoot);
const buildManifestPath = defaultBuildManifestPath(packageRoot);

/** The authorized development destination used across this suite. */
const AUTHORIZED_HOST = "registry.npmjs.org";

interface Fixture {
  readonly root: string;
  readonly workspace: string;
  readonly userRoot: string;
  cleanup: () => Promise<void>;
}

async function fixture(name: string): Promise<Fixture> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), `piw-net-${name}-`)));
  const workspace = path.join(root, "workspace");
  const userRoot = path.join(root, "user");
  await mkdir(workspace);
  await mkdir(userRoot);
  return { root, workspace, userRoot, cleanup: () => rm(root, { recursive: true, force: true }) };
}

async function runContained(
  value: Fixture,
  command: string,
  options: { readonly scope: boolean } = { scope: false },
): Promise<{ output: string; result: Awaited<ReturnType<typeof runContainedShellCommand>> }> {
  const resolved = await resolveWorkspacePath(value.workspace, ".");
  const userRoot = path.join(value.userRoot, "pi-warden");
  await mkdir(userRoot, { recursive: true });
  await writeFile(
    path.join(userRoot, "policy.json"),
    JSON.stringify({
      version: 1,
      operations: { read: "ALLOW", write: "ALLOW", edit: "ALLOW" },
      ...(options.scope
        ? { network: { destinations: [{ host: AUTHORIZED_HOST, ports: [443] }] } }
        : {}),
    }),
  );
  const loaded = await loadOperationPolicySources(resolved, value.userRoot);
  let output = "";
  const result = await runContainedShellCommand({
    command,
    workspaceRoot: value.workspace,
    loaded,
    protectedZones: [createProtectedZone("pi-warden-user-config", value.userRoot)].filter(
      (zone) => zone !== undefined,
    ),
    trustedUserConfigRoot: value.userRoot,
    helperPath,
    buildManifestPath,
    sealedInputs: [],
    timeoutMs: 60_000,
    signal: undefined,
    onOutput: (chunk) => {
      output += chunk.toString("utf8");
    },
    authorizeExport: async () => ({ decision: "ALLOW", reason: "evidence-allow" }),
    ...(options.scope
      ? { networkScope: [{ host: AUTHORIZED_HOST, ports: [443] }] }
      : {}),
  });
  return { output, result };
}

test("declared target prerequisites are present", { skip }, async () => {
  assert.ok(existsSync(helperPath), "the native helper is required on the declared target");
});

test("with an empty scope the child reaches nothing, exactly as in Goal 3", { skip, timeout: 180_000 }, async () => {
  const value = await fixture("closed");
  try {
    const { output, result } = await runContained(
      value,
      [
        "node -e 'const s=require(\"net\").connect(443,\"198.18.0.1\");s.on(\"connect\",()=>{console.log(\"direct-connected\");process.exit(0)});s.on(\"error\",(e)=>{console.log(\"direct-denied\",e.code);process.exit(0)})'",
        "node -e 'require(\"dgram\").createSocket(\"udp4\").bind(0,()=>{console.log(\"udp-bound\");process.exit(0)}).on(\"error\",(e)=>{console.log(\"udp-denied\",e.code);process.exit(0)})'",
        "node -e 'require(\"dns\").lookup(\"registry.npmjs.org\",(e)=>{console.log(e?\"dns-denied\":\"dns-resolved\");process.exit(0)})'",
      ].join("\n"),
      { scope: false },
    );
    assert.equal(result.exitCode, 0, `${output}\n${result.report}`);
    assert.ok(output.includes("direct-denied"), `direct connect must be denied:\n${output}`);
    assert.ok(output.includes("udp-denied"), `UDP must be denied:\n${output}`);
    assert.ok(output.includes("dns-denied"), `DNS must not resolve:\n${output}`);
    for (const marker of ["direct-connected", "udp-bound", "dns-resolved"]) {
      assert.ok(!output.includes(marker), `the contained run must not report ${marker}`);
    }
    assert.match(result.report, /network closed \(no destination scope\)/);
  } finally {
    await value.cleanup();
  }
});

/*
 * The host-side positive control: the authorized destination must be reachable
 * from the host before a contained tunnel may be expected to open.
 */
async function hostReachable(): Promise<boolean> {
  try {
    const addresses = await dnsLookup(AUTHORIZED_HOST, { all: true });
    if (addresses.length === 0) return false;
    return await new Promise<boolean>((resolve) => {
      const socket = netConnect(443, addresses[0].address);
      socket.setTimeout(8000);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => resolve(false));
    });
  } catch {
    return false;
  }
}

/*
 * One child script probes the whole enforcement matrix inside ONE contained
 * run. It learns the broker endpoint from the constructed HTTPS_PROXY value.
 * Refusal cases need no external network; the pinned tunnel dials the pinned
 * addresses through the broker and is asserted against the host-side control.
 */
const PROBE_SCRIPT = `
const net = require("net");
const dgram = require("dgram");
const dns = require("dns");
const proxy = new URL(process.env.HTTPS_PROXY);
const brokerPort = Number(proxy.port);
const brokerHost = proxy.hostname;
function brokerLine(request) {
  return new Promise((resolve) => {
    const s = net.connect(brokerPort, brokerHost);
    let data = "";
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(data.split("\\r\\n")[0] || value); } };
    s.on("connect", () => s.write(request + "\\r\\n\\r\\n"));
    s.on("data", (c) => { data += c; });
    s.on("close", () => finish(data.length === 0 ? "closed" : "line"));
    s.on("error", () => finish("error"));
    s.setTimeout(8000, () => { s.destroy(); finish("timeout"); });
  });
}
function direct(ip, port) {
  return new Promise((resolve) => {
    const s = net.connect(port, ip);
    s.on("connect", () => { s.destroy(); resolve("direct-connected"); });
    s.on("error", (e) => resolve("direct-denied:" + e.code));
    s.setTimeout(6000, () => { s.destroy(); resolve("direct-timeout"); });
  });
}
(async () => {
  console.log("pinned-tunnel:", await brokerLine("CONNECT registry.npmjs.org:443 HTTP/1.1"));
  console.log("substitution:", await brokerLine("CONNECT example.com:443 HTTP/1.1"));
  console.log("redirect-target:", await brokerLine("CONNECT www.example.org:443 HTTP/1.1"));
  console.log("wrong-port:", await brokerLine("CONNECT registry.npmjs.org:8080 HTTP/1.1"));
  console.log("loopback-target:", await brokerLine("CONNECT 127.0.0.1:443 HTTP/1.1"));
  console.log("metadata-target:", await brokerLine("CONNECT 169.254.169.254:80 HTTP/1.1"));
  console.log("no-port:", await brokerLine("CONNECT registry.npmjs.org HTTP/1.1"));
  console.log("bracket-target:", await brokerLine("CONNECT [::1]:443 HTTP/1.1"));
  console.log("not-connect:", await brokerLine("GET / HTTP/1.1"));
  console.log("lowercase-connect:", await brokerLine("connect registry.npmjs.org:443 http/1.1"));
  console.log("broker-neighbor-port:", await direct("127.0.0.1", brokerPort + 1));
  console.log("udp-broker-port:", await new Promise((resolve) => {
    const s = dgram.createSocket("udp4");
    s.on("error", (e) => { resolve("udp-denied:" + e.code); });
    s.send(Buffer.from("probe"), brokerPort, "127.0.0.1", () => { s.close(); resolve("udp-sent"); });
  }));
  console.log("listen:", await new Promise((resolve) => {
    const srv = net.createServer();
    srv.on("error", (e) => resolve("listen-denied:" + e.code));
    srv.listen(0, "127.0.0.1", () => { srv.close(); resolve("listen-ok"); });
  }));
  console.log("resolver:", await new Promise((resolve) => {
    dns.lookup("registry.npmjs.org", (error) => resolve(error ? "dns-denied" : "dns-resolved"));
  }));
  // A proxy override inside the command points at a neighbour loopback port;
  // the profile's port-exact rule must deny the connection outright.
  const overridePort = brokerPort + 1;
  process.env.HTTPS_PROXY = "http://127.0.0.1:" + overridePort;
  console.log("proxy-override:", await new Promise((resolve) => {
    const s = net.connect(overridePort, "127.0.0.1");
    s.on("connect", () => { s.destroy(); resolve("override-connected"); });
    s.on("error", (e) => resolve("override-denied:" + e.code));
    s.setTimeout(6000, () => { s.destroy(); resolve("override-timeout"); });
  }));
})().catch((error) => { console.log("script-error:", error.message); });
`;

test("the route enforces destination identity at tunnel-open time and everything else stays closed", { skip, timeout: 300_000 }, async () => {
  const value = await fixture("scoped");
  try {
    // The positive control runs first: without it only the refusals are asserted.
    const reachable = await hostReachable();
    const { output, result } = await runContained(
      value,
      `node -e '${PROBE_SCRIPT.replace(/'/g, "")}'`,
      { scope: true },
    );
    assert.equal(result.exitCode, 0, `${output}\n${result.report}`);
    assert.match(result.report, /network scope enforced via broker port \d+/);
    assert.match(result.report, new RegExp(`${AUTHORIZED_HOST} \\(ports 443 -> \\d+ pinned address`));
    // The broker's own refusals, all before any outbound socket is created.
    assert.ok(output.includes("substitution: HTTP/1.1 403"), `destination substitution must be refused:\n${output}`);
    assert.ok(output.includes("redirect-target: HTTP/1.1 403"), `a redirect target must be refused:\n${output}`);
    assert.ok(output.includes("proxy-override: override-denied:EPERM"), `a proxy override must be kernel-denied:\n${output}`);
    assert.ok(output.includes("wrong-port: HTTP/1.1 403"), `a wrong port must be refused:\n${output}`);
    assert.ok(output.includes("loopback-target: HTTP/1.1 403"), `a loopback literal must be refused:\n${output}`);
    assert.ok(output.includes("metadata-target: HTTP/1.1 403"), `a metadata address must be refused:\n${output}`);
    assert.ok(output.includes("no-port: HTTP/1.1 400"), `a missing port must be refused:\n${output}`);
    assert.ok(output.includes("bracket-target: HTTP/1.1 400"), `a bracketed literal must be refused:\n${output}`);
    assert.ok(output.includes("not-connect: HTTP/1.1 405"), `a non-CONNECT request must be refused:\n${output}`);
    assert.ok(
      output.includes("lowercase-connect: HTTP/1.1 405"),
      `the request line is case-sensitive and a lowercase method must be refused:\n${output}`,
    );
    // The kernel boundary around the one permitted endpoint.
    assert.ok(output.includes("broker-neighbor-port: direct-denied:EPERM"), `the neighbour port must be kernel-denied:\n${output}`);
    assert.ok(output.includes("udp-broker-port: udp-denied:EPERM"), `UDP must be kernel-denied:\n${output}`);
    assert.ok(output.includes("listen-denied:EPERM"), `listening must be kernel-denied:\n${output}`);
    assert.ok(output.includes("resolver: dns-denied"), `the child resolver must stay closed:\n${output}`);
    // The positive control: the pinned tunnel opens only when the host can
    // reach the destination, and fails closed otherwise.
    if (reachable) {
      assert.ok(output.includes("pinned-tunnel: HTTP/1.1 200"), `the pinned tunnel must open:\n${output}`);
    } else {
      assert.ok(
        output.includes("pinned-tunnel: HTTP/1.1 502") || output.includes("pinned-tunnel: closed") || output.includes("pinned-tunnel: timeout"),
        `without host reachability the route must fail closed, never succeed:\n${output}`,
      );
    }
  } finally {
    await value.cleanup();
  }
});

test("the constructed environment carries only the loopback proxy values; the control plane stays closed", { skip, timeout: 180_000 }, async () => {
  const value = await fixture("envelope");
  try {
    const { output, result } = await runContained(
      value,
      [
        "node -e 'console.log(\"proxy-value\", process.env.HTTPS_PROXY, \"no_proxy\", JSON.stringify(process.env.NO_PROXY))'",
        "node -e 'try{require(\"fs\").statSync(process.env.HOME+\"/../control/profile.sbpl\");console.log(\"profile-readable\")}catch(e){console.log(\"profile-denied\")}'",
      ].join("\n"),
      { scope: true },
    );
    assert.equal(result.exitCode, 0, `${output}\n${result.report}`);
    assert.ok(output.includes("proxy-value http://127.0.0.1:"), `the proxy must point at the loopback broker:\n${output}`);
    assert.ok(output.includes("no_proxy \"\""), `no_proxy must be empty:\n${output}`);
    assert.ok(output.includes("profile-denied"), `the control directory must stay unreadable:\n${output}`);
  } finally {
    await value.cleanup();
  }
});

test("an unresolvable destination refuses pinning before any child exists", { skip, timeout: 120_000 }, async () => {
  const value = await fixture("unresolvable");
  try {
    let refused = false;
    try {
      await pinDestination("definitely-not-resolvable.invalid", [443], async () => {
        const error = new Error("getaddrinfo ENOTFOUND");
        (error as NodeJS.ErrnoException).code = "ENOTFOUND";
        throw error;
      });
    } catch (error) {
      assert.ok(error instanceof ShellRefusal, `pinning must refuse: ${String(error)}`);
      if (error instanceof ShellRefusal) {
        assert.equal(error.code, "NETWORK_DESTINATION_UNRESOLVABLE");
        assert.match(error.detail, /could not be resolved/);
      }
      refused = true;
    }
    assert.equal(refused, true);
  } finally {
    await value.cleanup();
  }
});

test("a destination whose addresses are all non-public refuses pinning (fail closed)", { skip }, async () => {
  const value = await fixture("nonpublic-pin");
  try {
    let refused = false;
    try {
      await pinDestination("metadata.example.internal", [443], async () => [
        { family: 4, address: "169.254.169.254" },
        { family: 4, address: "10.0.0.7" },
        { family: 6, address: "::1" },
      ]);
    } catch (error) {
      assert.ok(error instanceof ShellRefusal, `non-public addresses must refuse: ${String(error)}`);
      if (error instanceof ShellRefusal) {
        assert.equal(error.code, "NETWORK_DESTINATION_NOT_PUBLIC");
        assert.match(error.detail, /no public address/);
      }
      refused = true;
    }
    assert.equal(refused, true);
  } finally {
    await value.cleanup();
  }
});

test("IPv4-mapped and compatible IPv6 forms are classified by their embedded address", { skip }, () => {
  // Non-public in every spelling the resolver can produce, including the
  // expanded, NAT64 and 6to4 spellings raised in review.
  for (const address of [
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:192.168.1.1",
    "::ffff:169.254.169.254",
    "::ffff:172.16.0.1",
    "::127.0.0.1",
    "::10.0.0.1",
    "0000:0000:0000:0000:0000:ffff:7f00:0001",
    "0:0:0:0:0:ffff:0a00:0001",
    "0:0:0:0:0:ffff:a9fe:a9fe",
    "::ffff:0.0.0.0",
    "0:0:0:0:0:0:0:1",
    "0:0:0:0:0:0:0:0",
    "0:0:0:0:0:0:0:2",
    "::ffff:0:7f00:1",
    "64:ff9b::7f00:1",
    "64:ff9b::a9fe:a9fe",
    "64:ff9b::10.0.0.1",
    "2002:7f00:1::",
    "2002:0a00:1::",
    "2001:0db8::1",
    "192.88.99.1",
    // non-routable special-purpose prefixes (round-3 review)
    "fec0::1",
    "100::1",
    "100::",
    "5f00::1",
    "3fff::1",
    "2001:2::1",
    "2001:10::1",
    "2001:20::1",
    "2001:0:1::1",
    "2001:1::1",
    "2001:4:112::1",
    "2001:30::1",
    "0:0:1::1",
    "0:0:0:0:1:ffff:7f00:1",
    // malformed forms refuse
    "::ffff:",
    ":::::",
    ":::",
    ":",
    "1::2::3",
    "1:2:3:4:5:6:7:8:9",
    "12345::1",
    "::ffff:1.2.3.4.5",
    "not-an-address",
  ]) {
    assert.equal(isPublicAddress("IPv6", address), false, `${address} must not be public`);
  }
  // Mapped, compatible, NAT64 and 6to4 forms embedding a public IPv4 classify
  // as public (each exercises its own extraction branch).
  assert.equal(isPublicAddress("IPv6", "::ffff:198.20.0.237"), true);
  assert.equal(isPublicAddress("IPv6", "::c614:00ed"), true);
  assert.equal(isPublicAddress("IPv6", "64:ff9b::c614:00ed"), true);
  assert.equal(isPublicAddress("IPv6", "2002:c614:00ed::"), true);
  // Ordinary public IPv6 remains public, and the strict refusals hold.
  assert.equal(isPublicAddress("IPv6", "2606:4700::1111"), true);
  assert.equal(isPublicAddress("IPv6", "fe80::1"), false);
  assert.equal(isPublicAddress("IPv6", "fc00::1"), false);
  assert.equal(isPublicAddress("IPv6", "ff02::1"), false);
  assert.equal(isPublicAddress("IPv6", "::"), false);
});

test("a non-public embedded IPv4 in an IPv6 answer refuses the pin", { skip }, async () => {
  const value = await fixture("mapped-pin");
  try {
    for (const address of ["::ffff:127.0.0.1", "::ffff:169.254.169.254", "0:0:0:0:0:0:0:1", "64:ff9b::7f00:1"]) {
      let refused = false;
      try {
        await pinDestination("mapped.example.internal", [443], async () => [{ family: 6, address }]);
      } catch (error) {
        assert.ok(error instanceof ShellRefusal, `${address} must refuse: ${String(error)}`);
        if (error instanceof ShellRefusal) assert.equal(error.code, "NETWORK_DESTINATION_NOT_PUBLIC");
        refused = true;
      }
      assert.equal(refused, true, address);
    }
  } finally {
    await value.cleanup();
  }
});

test("the tunnel dials the pinned address, never a fresh resolution of the host", { skip }, async () => {
  const { openNetworkBroker } = await import("../src/sandbox/network-broker.ts");
  // A local sink stands in for the authorized service. The pinned host name
  // does not resolve anywhere: reaching the sink proves the broker dialed the
  // pinned address recorded at preparation (a mid-invocation DNS change or
  // rebinding therefore cannot redirect the tunnel).
  const sink = createServer();
  await new Promise<void>((resolve) => sink.listen(0, "127.0.0.1", resolve));
  const address = sink.address();
  assert.ok(address !== null && typeof address === "object");
  const sinkPort = address.port;
  const received: string[] = [];
  sink.on("connection", (socket) => {
    socket.on("data", (chunk: Buffer) => received.push(chunk.toString("utf8")));
  });
  const broker = await openNetworkBroker([
    {
      host: "rebind.example.invalid",
      ports: [sinkPort],
      addresses: [{ family: "IPv4", address: "127.0.0.1" }],
    },
  ]);
  broker.arm();
  try {
    const status = await new Promise<string>((resolve) => {
      const socket = createConnection(broker.port, "127.0.0.1");
      let data = "";
      socket.on("connect", () => {
        socket.write(`CONNECT rebind.example.invalid:${sinkPort} HTTP/1.1\r\n\r\n`);
        socket.write("pinned-payload");
      });
      socket.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      socket.on("close", () => resolve(data.split("\r\n")[0] ?? ""));
      socket.on("error", () => resolve("error"));
      socket.setTimeout(5000, () => socket.destroy());
    });
    assert.equal(status, "HTTP/1.1 200 Connection established", `the pinned address must be dialed: ${status}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
    assert.ok(
      received.join("").includes("pinned-payload"),
      "the payload must arrive at the pinned address without any hostname lookup",
    );
  } finally {
    await broker.close();
    await new Promise<void>((resolve) => sink.close(() => resolve()));
  }
});

test("a duplicate host in the pinned set merges ports, never replaces them", { skip }, async () => {
  const { openNetworkBroker } = await import("../src/sandbox/network-broker.ts");
  const broker = await openNetworkBroker([
    { host: "dup.example", ports: [443], addresses: [{ family: "IPv4", address: "127.0.0.1" }] },
    { host: "dup.example", ports: [8080], addresses: [{ family: "IPv4", address: "127.0.0.1" }] },
  ]);
  broker.arm();
  const request = (target: string): Promise<string> =>
    new Promise((resolve) => {
      const socket = createConnection(broker.port, "127.0.0.1");
      let data = "";
      socket.on("connect", () => socket.write(`CONNECT ${target} HTTP/1.1\r\n\r\n`));
      socket.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      socket.on("close", () => resolve(data.split("\r\n")[0] ?? ""));
      socket.on("error", () => resolve("error"));
      socket.setTimeout(5000, () => socket.destroy());
    });
  try {
    // Both approved ports must be evaluated (and fail closed against a sink
    // that does not answer a tunnel), while an unapproved port is refused.
    for (const port of [443, 8080]) {
      const outcome = await request(`dup.example:${port}`);
      assert.notEqual(outcome, "HTTP/1.1 403 Forbidden", `port ${port} was authorized and must not be refused as out of scope: ${outcome}`);
      assert.ok(outcome.startsWith("HTTP/1.1 5") || outcome.startsWith("HTTP/1.1 200"), outcome);
    }
    assert.equal(await request("dup.example:9999"), "HTTP/1.1 403 Forbidden");
  } finally {
    await broker.close();
  }
});

test("the broker serves no tunnel before it is armed", { skip }, async () => {
  const { openNetworkBroker } = await import("../src/sandbox/network-broker.ts");
  const broker = await openNetworkBroker([
    {
      host: "pinned.example",
      ports: [443],
      addresses: [{ family: "IPv4", address: "127.0.0.1" }],
    },
  ]);
  const request = (): Promise<string> =>
    new Promise((resolve) => {
      const socket = createConnection(broker.port, "127.0.0.1");
      let data = "";
      socket.on("connect", () => socket.write("CONNECT pinned.example:443 HTTP/1.1\r\n\r\n"));
      socket.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      socket.on("close", () => resolve(data.split("\r\n")[0] ?? ""));
      socket.on("error", () => resolve("error"));
      socket.setTimeout(5000, () => socket.destroy());
    });
  try {
    const beforeArm = await request();
    assert.equal(beforeArm, "HTTP/1.1 503 Service Unavailable", "an unarmed broker must serve nothing");
    broker.arm();
    const afterArm = await request();
    assert.notEqual(afterArm, "HTTP/1.1 503 Service Unavailable", "an armed broker must evaluate the request");
    assert.ok(
      afterArm.startsWith("HTTP/1.1 200") || afterArm.startsWith("HTTP/1.1 502"),
      `an armed broker must dial the pinned address (or fail closed): ${afterArm}`,
    );
  } finally {
    await broker.close();
  }
});

test("an approved port on a trusted host extends that host's port set (no overwrite, no widening)", { skip }, () => {
  const userPolicy = parseOperationPolicyOrThrow({
    version: 1,
    operations: {},
    network: { destinations: [{ host: AUTHORIZED_HOST, ports: [443, 8443] }] },
  });
  const scope = composeNetworkScope({ status: "valid", policy: userPolicy }, { status: "absent" });
  // The plan names an unapproved port on the already-trusted host.
  const targets = [{ scheme: "https" as const, host: AUTHORIZED_HOST, port: 8080 }];
  const { state, scopeEntries } = networkStateOf(scope, targets);
  assert.equal(state.status, "open");
  assert.deepEqual(state.unapprovedTargets, [`${AUTHORIZED_HOST}:8080`]);
  assert.deepEqual(
    scopeEntries.map((entry) => ({ host: entry.host, ports: [...entry.ports] })),
    [{ host: AUTHORIZED_HOST, ports: [443, 8080, 8443] }],
    "the approved port must extend the trusted entry, not replace it",
  );
  // A covered target merges nothing and asks nothing.
  const covered = networkStateOf(scope, [{ scheme: "https" as const, host: AUTHORIZED_HOST, port: 443 }]);
  assert.deepEqual(covered.state.unapprovedTargets, []);
  assert.deepEqual(
    covered.scopeEntries.map((entry) => [...entry.ports]),
    [[443, 8443]],
  );
  // A closed scope pins nothing, whatever the command names.
  const closed = networkStateOf({ status: "closed" }, targets);
  assert.equal(closed.state.status, "closed");
  assert.deepEqual(closed.scopeEntries, []);
});
