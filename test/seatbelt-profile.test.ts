import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ancestorLiterals,
  deriveToolchainRoot,
  generateSeatbeltProfile,
  missingResourceFamilies,
  type SeatbeltRoots,
} from "../src/sandbox/seatbelt.ts";
import { RESOURCE_RULE_REASONS } from "../src/policy/resources.ts";

const darwin = process.platform === "darwin";

function roots(overrides: Partial<SeatbeltRoots> = {}): SeatbeltRoots {
  return {
    stagingRoot: "/private/tmp/piw-test/invocation/staging",
    homeRoot: "/private/tmp/piw-test/invocation/home",
    tmpRoot: "/private/tmp/piw-test/invocation/tmp",
    sealedRoot: "/private/tmp/piw-test/invocation/sealed",
    toolchainRoot: "/opt/toolchain/node",
    workspaceRoot: "/Users/example/project",
    projectPolicyRoot: "/Users/example/project/.pi-warden",
    protectedZones: [{ name: "pi-warden-agent-dir", canonicalRoot: "/Users/example/.pi" }],
    ...overrides,
  };
}

test("coverage: every classifier family has a rendered rule", () => {
  assert.deepEqual(missingResourceFamilies(RESOURCE_RULE_REASONS), []);
  assert.deepEqual(missingResourceFamilies(["env-file"]).sort(), RESOURCE_RULE_REASONS.filter((r) => r !== "env-file").sort());
});

test("unsupported platforms are refused rather than approximated", { skip: darwin ? "declared target only" : false }, () => {
  const result = generateSeatbeltProfile(roots());
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "UNSUPPORTED_PLATFORM");
});

test("paths that cannot be rendered exactly are refused", { skip: !darwin }, () => {
  for (const bad of [
    '/Users/example/pro"ject',
    "/Users/example/pro\\ject",
    "/Users/example/pro\u0001ject",
    "/Users/example/project/../other",
    "relative/path",
  ]) {
    const result = generateSeatbeltProfile(roots({ workspaceRoot: bad }));
    assert.equal(result.ok, false, `path ${JSON.stringify(bad)} must be refused`);
    if (result.ok) throw new Error("unreachable");
    assert.equal(result.code, "UNSAFE_PROFILE_PATH");
  }
  const zoneFailure = generateSeatbeltProfile(roots({ protectedZones: [{ name: "x", canonicalRoot: '"/bad' }] }));
  assert.equal(zoneFailure.ok, false);
});

test("the generated profile denies by default, with no network or Mach rule", { skip: !darwin }, () => {
  const result = generateSeatbeltProfile(roots());
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const text = result.profile.text;
  assert.ok(text.startsWith("(version 1)\n(deny default)\n"));
  assert.ok(!/network/i.test(text), "no network rule may appear");
  assert.ok(!/mach-lookup/.test(text), "no Mach rule may appear");
  assert.ok(!/\(allow file-read\* \(subpath "\/Users\/example\/project"\)/.test(text), "the workspace is never a read root");
  assert.ok(!text.includes('(allow file-write* (subpath "/Users/example/project")'), "the workspace is never a write root");
  assert.ok(!text.includes("(allow default)"));
  for (const zone of ["/Users/example/.pi"]) {
    assert.ok(text.includes(`(deny file-read* (subpath "${zone}"))`), `zone read denial for ${zone}`);
    assert.ok(text.includes(`(deny file-write* (subpath "${zone}"))`), `zone write denial for ${zone}`);
  }
  assert.ok(text.includes('(deny file-read* (subpath "/Users/example/project/.pi-warden"))'));
  assert.ok(text.includes('(deny file-write* (subpath "/Users/example/project/.pi-warden"))'));
  assert.ok(text.includes('(deny file-write* (subpath "/private/tmp/piw-test/invocation/staging/.git"))'));
  assert.ok(text.includes('(allow file-write*'));
  assert.ok(text.includes('(literal "/dev/null")'));
  assert.deepEqual(result.profile.renderedFamilies.length, new Set(RESOURCE_RULE_REASONS).size);
});

test("a non-empty network scope adds exactly one rule: the broker endpoint", { skip: !darwin }, () => {
  const scoped = generateSeatbeltProfile(roots({ networkBrokerPort: 43117 }));
  assert.equal(scoped.ok, true);
  if (!scoped.ok) throw new Error("unreachable");
  const text = scoped.profile.text;
  const networkRules = text.split("\n").filter((line) => /network/.test(line));
  assert.deepEqual(networkRules, ['(allow network-outbound (remote tcp "localhost:43117"))']);
  assert.ok(!/mach-lookup/.test(text), "no Mach rule may appear even with a scope");
  // The rule is the profile's only network allowance; no bind, listen, UDP,
  // unix or wildcard-destination allowance exists.
  assert.ok(!text.includes('":*"'), "no wildcard port may appear");
  assert.ok(!text.includes('(remote ip "localhost:'), "only the tcp broker rule is emitted");
  // Without a scope the same trusted inputs produce a profile with no network
  // rule at all, byte-identical in structure to Goal 3.
  const closed = generateSeatbeltProfile(roots());
  if (!closed.ok) throw new Error("unreachable");
  assert.ok(!/network/i.test(closed.profile.text), "the closed scope must produce no network rule");
});

test("an invalid broker port refuses profile generation", { skip: !darwin }, () => {
  for (const port of [0, -1, 65536, 1.5, Number.NaN]) {
    const result = generateSeatbeltProfile(roots({ networkBrokerPort: port }));
    assert.equal(result.ok, false, `port ${String(port)} must refuse`);
    if (result.ok) throw new Error("unreachable");
    assert.equal(result.code, "UNSAFE_PROFILE_PATH");
  }
});

test("ancestor metadata is literal-only, so listing is never granted", { skip: !darwin }, () => {
  const result = generateSeatbeltProfile(roots());
  if (!result.ok) throw new Error("unreachable");
  const text = result.profile.text;
  // The metadata block must contain the ancestors as literals ...
  const metadataBlock = text.slice(text.indexOf("(allow file-read-metadata"), text.indexOf("(allow file-read*"));
  for (const ancestor of ["/Users", "/Users/example", "/private/tmp/piw-test"]) {
    assert.ok(metadataBlock.includes(`(literal "${ancestor}")`), `${ancestor} must be a metadata literal`);
    assert.ok(!metadataBlock.includes(`(subpath "${ancestor}")`), `${ancestor} must not be a metadata subtree`);
  }
  // ... and no ancestor of the projection may appear as a data-read subtree.
  const readBlock = text.slice(text.indexOf("(allow file-read*"), text.indexOf("(allow file-write*"));
  assert.ok(!readBlock.includes('(subpath "/private/tmp/piw-test")'), "the runtime parent must not be a data root");
  assert.ok(readBlock.includes('(subpath "/private/tmp/piw-test/invocation/staging")'));
});

test("the toolchain root is derived from the executable and never a home directory", () => {
  assert.equal(deriveToolchainRoot("/opt/toolchain/node/bin/node", "/Users/example"), "/opt/toolchain/node");
  assert.equal(deriveToolchainRoot("/usr/local/bin/node", "/Users/example"), "/usr/local");
  assert.equal(deriveToolchainRoot("/Users/example/node", "/Users/example"), undefined, "a home directory is never a toolchain root");
  assert.equal(deriveToolchainRoot("relative/bin/node", "/Users/example"), undefined);
  assert.equal(deriveToolchainRoot("/bin/node", "/Users/example"), undefined, "the filesystem root is never a toolchain root");
  assert.equal(deriveToolchainRoot("/", "/Users/example"), undefined);
});

test("ancestor literals list every component from the root down", () => {
  assert.deepEqual(ancestorLiterals("/a/b/c"), ["/", "/a", "/a/b", "/a/b/c"]);
  assert.deepEqual(ancestorLiterals("/"), ["/"]);
});

test("generation is deterministic for identical trusted inputs", { skip: !darwin }, () => {
  const first = generateSeatbeltProfile(roots());
  const second = generateSeatbeltProfile(roots());
  if (!first.ok || !second.ok) throw new Error("unreachable");
  assert.equal(first.profile.sha256, second.profile.sha256);
  const changed = generateSeatbeltProfile(roots({ tmpRoot: "/private/tmp/piw-test/invocation/tmp2" }));
  if (!changed.ok) throw new Error("unreachable");
  assert.notEqual(first.profile.sha256, changed.profile.sha256);
});
