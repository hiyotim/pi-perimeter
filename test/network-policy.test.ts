/**
 * Pure network policy evidence for Goal 4
 * (`20260919-restricted-networking-e2e-evidence`): destination validation,
 * trusted/project composition monotonicity, representable-target extraction
 * and approval-scope derivation. No filesystem, network, process, or Pi work.
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  composeNetworkScope,
  extractNetworkTargets,
  isValidNetworkHost,
  isValidNetworkPort,
  scopeCoversTarget,
  unapprovedNetworkTargets,
  validateNetworkPolicyValue,
} from "../src/policy/network.ts";
import { loadOperationPolicySources } from "../src/policy/config-loader.ts";
import { resolveWorkspacePath } from "../src/policy/paths.ts";
import { parseOperationPolicy } from "../src/policy/configuration.ts";

function goodEntry(host: string, ports: readonly number[]) {
  return { host, ports };
}

test("a canonical hostname is accepted and everything else refuses", () => {
  for (const good of ["registry.npmjs.org", "github.com", "a-b.example.org", "123.npmjs.org"]) {
    assert.equal(isValidNetworkHost(good), true, good);
  }
  for (const bad of [
    "",
    "HTTPS://x",
    "192.0.2.1",
    "localhost",
    "a",
    "UPPER.example.com",
    "example.com.",
    "exa_mple.com",
    "-example.com",
    "example-.com",
    "*",
    "*.example.com",
    "example.com:443",
    "https://example.com",
    `${"a".repeat(64)}.example.com`,
    `${"a".repeat(250)}.example.com`,
    "exa mple.com",
    "exämple.com",
    null,
    42,
  ]) {
    assert.equal(isValidNetworkHost(bad), false, JSON.stringify(bad));
  }
});

test("ports must be explicit distinct integers in range", () => {
  for (const good of [1, 443, 65535]) assert.equal(isValidNetworkPort(good), true);
  for (const bad of [0, -1, 65536, 1.5, Number.NaN, "443", null]) {
    assert.equal(isValidNetworkPort(bad), false, JSON.stringify(bad));
  }
});

test("the network policy value accepts exactly the documented shape", () => {
  const valid = validateNetworkPolicyValue({
    destinations: [{ host: "registry.npmjs.org", ports: [443] }],
  });
  assert.equal(valid.ok, true);
  if (!valid.ok) throw new Error("unreachable");
  assert.deepEqual(valid.value.destinations, [{ host: "registry.npmjs.org", ports: [443] }]);

  const emptyClosed = validateNetworkPolicyValue({ destinations: [] });
  assert.equal(emptyClosed.ok, true, "an explicitly empty destination list closes the route");

  for (const bad of [
    {},
    { destination: [] },
    { destinations: [{ host: "registry.npmjs.org" }] },
    { destinations: [{ host: "registry.npmjs.org", ports: [] }] },
    { destinations: [{ host: "registry.npmjs.org", ports: [443, 443] }] },
    { destinations: [{ host: "registry.npmjs.org", ports: [443], extra: 1 }] },
    { destinations: [{ host: "Bad.example.com", ports: [443] }] },
    { destinations: [{ host: "registry.npmjs.org", ports: [0] }] },
    { destinations: [{ host: "registry.npmjs.org", ports: [443] }, { host: "registry.npmjs.org", ports: [8443] }] },
    { destinations: new Array(33).fill(0).map((_, index) => ({ host: `h${index}.example.com`, ports: [443] })) },
    { destinations: [{ host: "a.example.com", ports: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] }] },
    null,
    "destinations",
    5,
  ]) {
    const result = validateNetworkPolicyValue(bad);
    assert.equal(result.ok, false, JSON.stringify(bad));
    if (!result.ok) assert.equal(result.code, "INVALID_SCHEMA");
  }
});

interface PolicyFixture {
  readonly status: "absent" | "valid" | "invalid";
  readonly document?: string;
}

/** Loads real policy sources from isolated fixtures, then removes them. */
async function withSources(
  user: PolicyFixture,
  project: PolicyFixture,
  run: (loaded: Awaited<ReturnType<typeof loadOperationPolicySources>>) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "piw-netpolicy-"));
  try {
    const userRoot = path.join(root, "user", "pi-warden");
    const workspace = path.join(root, "ws", ".pi-warden");
    await mkdir(userRoot, { recursive: true });
    await mkdir(workspace, { recursive: true });
    if (user.status !== "absent") {
      await writeFile(path.join(userRoot, "policy.json"), user.document ?? "{}");
    }
    if (project.status !== "absent") {
      await writeFile(path.join(workspace, "policy.json"), project.document ?? "{}");
    }
    const resolved = await resolveWorkspacePath(path.join(root, "ws"), ".");
    const loaded = await loadOperationPolicySources(resolved, path.join(root, "user"));
    await run(loaded);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("project configuration can only restrict the trusted scope, never widen it", async () => {
  const userDocument = JSON.stringify({
    version: 1,
    operations: { read: "ALLOW" },
    network: {
      destinations: [{ host: "registry.npmjs.org", ports: [443, 8443] }, { host: "github.com", ports: [443] }],
    },
  });

  await withSources(
    { status: "valid", document: userDocument },
    { status: "absent" },
    async (loaded) => {
      assert.equal(loaded.project.status, "absent");
      const plainScope = composeNetworkScope(loaded.user, loaded.project);
      assert.equal(plainScope.status, "open");
      if (plainScope.status !== "open") throw new Error("unreachable");
      assert.deepEqual(
        plainScope.entries,
        [goodEntry("registry.npmjs.org", [443, 8443]), goodEntry("github.com", [443])],
      );
    },
  );

  // The project narrows the port set; an unrelated project host adds nothing.
  await withSources(
    { status: "valid", document: userDocument },
    {
      status: "valid",
      document: JSON.stringify({
        version: 1,
        operations: {},
        network: { destinations: [{ host: "registry.npmjs.org", ports: [443] }, { host: "evil.example", ports: [443] }] },
      }),
    },
    async (loaded) => {
      const restrictedScope = composeNetworkScope(loaded.user, loaded.project);
      assert.equal(restrictedScope.status, "open");
      if (restrictedScope.status !== "open") throw new Error("unreachable");
      assert.deepEqual(
        restrictedScope.entries,
        [goodEntry("registry.npmjs.org", [443]), goodEntry("github.com", [443])],
      );
    },
  );

  // The project removes every port of a host: the entry disappears.
  await withSources(
    { status: "valid", document: userDocument },
    {
      status: "valid",
      document: JSON.stringify({
        version: 1,
        operations: {},
        network: { destinations: [{ host: "registry.npmjs.org", ports: [8080] }] },
      }),
    },
    async (loaded) => {
      const removedScope = composeNetworkScope(loaded.user, loaded.project);
      assert.equal(removedScope.status, "open");
      if (removedScope.status !== "open") throw new Error("unreachable");
      assert.deepEqual(removedScope.entries, [goodEntry("github.com", [443])]);
    },
  );

  // A project network section without trusted entries can never open the route.
  await withSources(
    { status: "absent" },
    {
      status: "valid",
      document: JSON.stringify({
        version: 1,
        operations: {},
        network: { destinations: [{ host: "registry.npmjs.org", ports: [443] }] },
      }),
    },
    async (loaded) => {
      assert.deepEqual(composeNetworkScope(loaded.user, loaded.project), { status: "closed" });
    },
  );

  // An invalid project source denies the scope outright.
  await withSources(
    { status: "valid", document: userDocument },
    { status: "valid", document: "{ version: 1," },
    async (loaded) => {
      const invalidScope = composeNetworkScope(loaded.user, loaded.project);
      assert.equal(invalidScope.status, "invalid");
    },
  );
});

test("a malformed network section makes the whole document invalid", () => {
  const parsed = parseOperationPolicy(
    JSON.stringify({
      version: 1,
      operations: {},
      network: { destinations: [{ host: "ok.example.com", ports: [443] }, { host: "bad", ports: [443] }] },
    }),
  );
  assert.equal(parsed.status, "invalid");
  if (parsed.status === "invalid") assert.equal(parsed.code, "INVALID_SCHEMA");

  const extraKey = parseOperationPolicy(
    JSON.stringify({ version: 1, operations: {}, network: { destinations: [] }, something: 1 }),
  );
  assert.equal(extraKey.status, "invalid");
});

test("https URLs in network-class commands are representable; other forms are not", () => {
  const targets = extractNetworkTargets([
    "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
    "https://GitHub.com/owner/repo",
    "https://github.com:8443/x",
    "https://user:pass@example.com/x",
    "https://example.com",
    "https://example.com/",
  ]);
  assert.deepEqual(
    targets.map((target) => `${target.host}:${target.port}`),
    ["registry.npmjs.org:443", "github.com:443", "github.com:8443", "example.com:443"],
  );

  for (const notRepresentable of [
    "http://example.com/",
    "example.com",
    "example.com:443",
    "ftp://example.com/",
    "ssh://git@github.com/owner/repo",
    "https://192.0.2.1/x",
    "https://127.0.0.1/x",
    "https://[::1]:443/x",
    "https://localhost:443/x",
    "https://localhost/x",
    "https://BÜCHER.example.com/",
    "https://example.com:0/",
    "https://example.com:99999/",
    "https://user@host/x",
  ]) {
    assert.deepEqual(extractNetworkTargets([notRepresentable]), [], JSON.stringify(notRepresentable));
  }
});

test("approval scope derives from exact host and port coverage", () => {
  const userPolicy = parseOperationPolicyOrThrow({
    version: 1,
    operations: {},
    network: { destinations: [{ host: "registry.npmjs.org", ports: [443, 8443] }] },
  });
  const scope = composeNetworkScope(
    { status: "valid", policy: userPolicy },
    { status: "absent" },
  );
  assert.ok(scope.status === "open");
  if (scope.status !== "open") throw new Error("unreachable");
  const covered = extractNetworkTargets(["https://registry.npmjs.org/x"]);
  assert.deepEqual(unapprovedNetworkTargets(scope, covered), []);
  const differentPort = extractNetworkTargets(["https://registry.npmjs.org:8080/x"]);
  const unapproved = unapprovedNetworkTargets(scope, differentPort);
  assert.deepEqual(
    unapproved.map((target) => `${target.host}:${target.port}`),
    ["registry.npmjs.org:8080"],
  );
  const otherHost = extractNetworkTargets(["https://example.com/x"]);
  assert.deepEqual(
    unapprovedNetworkTargets(scope, otherHost).map((target) => `${target.host}:${target.port}`),
    ["example.com:443"],
  );
  assert.equal(scopeCoversTarget(scope, { scheme: "https", host: "registry.npmjs.org", port: 443 }), true);
  assert.equal(scopeCoversTarget(scope, { scheme: "https", host: "example.com", port: 443 }), false);
  assert.equal(scopeCoversTarget({ status: "closed" }, { scheme: "https", host: "registry.npmjs.org", port: 443 }), false);
});

function parseOperationPolicyOrThrow(value: unknown) {
  const parsed = parseOperationPolicy(JSON.stringify(value));
  if (parsed.status !== "valid") throw new Error(`fixture policy invalid: ${JSON.stringify(value)}`);
  return parsed.policy;
}
