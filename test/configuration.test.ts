import assert from "node:assert/strict";
import { link, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadOperationPolicySources } from "../src/policy/config-loader.ts";
import { parseOperationPolicy } from "../src/policy/configuration.ts";
import { evaluateEffectivePath } from "../src/policy/effective.ts";
import { resolveWorkspacePath } from "../src/policy/paths.ts";

async function fixture(t: test.TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-warden-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, "workspace");
  const external = path.join(root, "external");
  const userConfig = path.join(root, "user-config");
  await mkdir(workspace);
  await mkdir(external);
  await mkdir(userConfig);
  await writeFile(path.join(workspace, "ordinary.txt"), "ordinary fixture\n");
  await writeFile(path.join(external, "ordinary.txt"), "external fixture\n");
  await writeFile(path.join(workspace, ".env"), "FAKE_TOKEN=fixture-only\n");
  return { root, workspace, external, userConfig };
}

async function writePolicy(root: string, relativeDirectory: string, value: string) {
  const directory = path.join(root, relativeDirectory);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "policy.json"), value);
}

const validEmpty = '{"version":1,"operations":{}}';

test("parses only the exact v1 schema and returns immutable issued policy", () => {
  const parsed = parseOperationPolicy(
    '{"version":1,"operations":{"read":"ALLOW","write":"ASK","edit":"DENY"}}',
  );
  assert.equal(parsed.status, "valid");
  if (parsed.status !== "valid") return;
  assert.deepEqual({ ...parsed.policy.operations }, {
    read: "ALLOW",
    write: "ASK",
    edit: "DENY",
  });
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.policy), true);
  assert.equal(Object.isFrozen(parsed.policy.operations), true);
  assert.throws(() => {
    (parsed.policy.operations as { read?: string }).read = "DENY";
  }, TypeError);
  assert.equal(parsed.policy.operations.read, "ALLOW");
});

test("rejects malformed, duplicate, unknown, missing, coerced, and oversized input exactly", () => {
  const invalidCases: readonly [unknown, string][] = [
    [null, "INVALID_INPUT"],
    [new String(validEmpty), "INVALID_INPUT"],
    ["", "MALFORMED_JSON"],
    ["{}", "INVALID_SCHEMA"],
    ['{"version":1}', "INVALID_SCHEMA"],
    ['{"operations":{}}', "INVALID_SCHEMA"],
    ['{"version":2,"operations":{}}', "INVALID_SCHEMA"],
    ['{"version":"1","operations":{}}', "INVALID_SCHEMA"],
    ['{"version":1,"operations":{},"extra":true}', "INVALID_SCHEMA"],
    ['{"version":1,"operations":[]}', "INVALID_SCHEMA"],
    ['{"version":1,"operations":{"Read":"ALLOW"}}', "INVALID_SCHEMA"],
    ['{"version":1,"operations":{"read":"allow"}}', "INVALID_SCHEMA"],
    ['{"version":1,"operations":{"read":"SANDBOX"}}', "INVALID_SCHEMA"],
    ['{"version":1,"operations":{"delete":"DENY"}}', "INVALID_SCHEMA"],
    ['{"version":1,"operations":{"read":null}}', "INVALID_SCHEMA"],
    ['{"version":1,"version":1,"operations":{}}', "DUPLICATE_KEY"],
    ['{"version":1,"operations":{"read":"ALLOW","r\\u0065ad":"DENY"}}', "DUPLICATE_KEY"],
    ['{"version":1,"operations":{"read":"ALLOW",}}', "MALFORMED_JSON"],
    ["\u00a0" + validEmpty, "MALFORMED_JSON"],
    [" ".repeat(65_537), "DOCUMENT_TOO_LARGE"],
  ];

  for (const [input, code] of invalidCases) {
    assert.deepEqual(parseOperationPolicy(input), { status: "invalid", code });
  }
});

test("hostile runtime values are rejected without getters, proxy traps, or coercion", () => {
  let calls = 0;
  const hostile = new Proxy(Object.create(null), {
    get() { calls += 1; throw new Error("get trap"); },
    getPrototypeOf() { calls += 1; throw new Error("prototype trap"); },
    ownKeys() { calls += 1; throw new Error("keys trap"); },
  });
  assert.deepEqual(parseOperationPolicy(hostile), {
    status: "invalid",
    code: "INVALID_INPUT",
  });
  assert.equal(calls, 0);
});

test("loads absent fixed sources and preserves all workspace baselines", async (t) => {
  const { workspace, userConfig } = await fixture(t);
  const resource = await resolveWorkspacePath(workspace, "ordinary.txt");
  const loaded = await loadOperationPolicySources(resource, userConfig);
  assert.deepEqual(loaded, { user: { status: "absent" }, project: { status: "absent" } });

  for (const operation of ["read", "write", "edit"] as const) {
    const result = evaluateEffectivePath(operation, resource, loaded);
    assert.equal(result.decision, "ALLOW", operation);
    assert.equal(result.reason, `WORKSPACE_${operation.toUpperCase()}`, operation);
  }
});

test("loads both roles and produces complete literal effective results for read/write/edit", async (t) => {
  const { workspace, userConfig } = await fixture(t);
  await writePolicy(userConfig, "pi-warden", '{"version":1,"operations":{"read":"ASK","write":"ALLOW","edit":"DENY"}}');
  await writePolicy(workspace, ".pi-warden", '{"version":1,"operations":{"read":"ALLOW","write":"DENY","edit":"ASK"}}');
  const resource = await resolveWorkspacePath(workspace, "ordinary.txt");
  const loaded = await loadOperationPolicySources(resource, userConfig);

  assert.deepEqual(evaluateEffectivePath("read", resource, loaded), {
    operation: "read",
    decision: "ASK",
    reason: "CONFIGURATION_RESTRICTION",
    baseline: { decision: "ALLOW", reason: "WORKSPACE_READ" },
    sources: [
      { source: "user", status: "valid", contribution: "ASK" },
      { source: "project", status: "valid", contribution: "ALLOW" },
    ],
  });
  assert.deepEqual(evaluateEffectivePath("write", resource, loaded), {
    operation: "write",
    decision: "DENY",
    reason: "CONFIGURATION_RESTRICTION",
    baseline: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
    sources: [
      { source: "user", status: "valid", contribution: "ALLOW" },
      { source: "project", status: "valid", contribution: "DENY" },
    ],
  });
  assert.deepEqual(evaluateEffectivePath("edit", resource, loaded), {
    operation: "edit",
    decision: "DENY",
    reason: "CONFIGURATION_RESTRICTION",
    baseline: { decision: "ALLOW", reason: "WORKSPACE_EDIT" },
    sources: [
      { source: "user", status: "valid", contribution: "DENY" },
      { source: "project", status: "valid", contribution: "ASK" },
    ],
  });
});

test("valid restrictions are exact-operation only and cannot weaken ASK or DENY baselines", async (t) => {
  const { workspace, external, userConfig } = await fixture(t);
  await writePolicy(workspace, ".pi-warden", '{"version":1,"operations":{"edit":"DENY","read":"ALLOW","write":"ALLOW"}}');
  const externalResource = await resolveWorkspacePath(workspace, path.join(external, "ordinary.txt"));
  const externalLoaded = await loadOperationPolicySources(externalResource, userConfig);
  assert.equal(evaluateEffectivePath("read", externalResource, externalLoaded).decision, "ASK");
  assert.equal(evaluateEffectivePath("write", externalResource, externalLoaded).decision, "ASK");
  assert.equal(evaluateEffectivePath("edit", externalResource, externalLoaded).decision, "DENY");

  const secret = await resolveWorkspacePath(workspace, ".env");
  const secretLoaded = await loadOperationPolicySources(secret, userConfig);
  const result = evaluateEffectivePath("read", secret, secretLoaded);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "SECRET_RESOURCE");
  assert.equal(result.sources[1]?.status, "valid");
});

test("one invalid source denies every operation without salvaging valid entries", async (t) => {
  const { workspace, userConfig } = await fixture(t);
  await writePolicy(userConfig, "pi-warden", validEmpty);
  await writePolicy(workspace, ".pi-warden", '{"version":1,"operations":{"read":"ALLOW","delete":"DENY"}}');
  const resource = await resolveWorkspacePath(workspace, "ordinary.txt");
  const loaded = await loadOperationPolicySources(resource, userConfig);

  for (const operation of ["read", "write", "edit"] as const) {
    const result = evaluateEffectivePath(operation, resource, loaded);
    assert.equal(result.decision, "DENY", operation);
    assert.equal(result.reason, "CONFIGURATION_INVALID", operation);
    assert.deepEqual(result.sources[1], {
      source: "project",
      status: "invalid",
      code: "INVALID_SCHEMA",
    });
  }
});

test("rejects symlinked source files, directories, aliased user roots, and role labels", async (t) => {
  const { root, workspace, userConfig } = await fixture(t);
  const outside = path.join(root, "outside-policy.json");
  await writeFile(outside, validEmpty);
  await mkdir(path.join(workspace, ".pi-warden"));
  await symlink(outside, path.join(workspace, ".pi-warden", "policy.json"));
  const resource = await resolveWorkspacePath(workspace, "ordinary.txt");
  let loaded = await loadOperationPolicySources(resource, userConfig);
  assert.deepEqual(loaded.project, { status: "invalid", code: "UNSAFE_SOURCE_PATH" });

  await rm(path.join(workspace, ".pi-warden"), { recursive: true });
  await symlink(path.dirname(outside), path.join(workspace, ".pi-warden"));
  loaded = await loadOperationPolicySources(resource, userConfig);
  assert.deepEqual(loaded.project, { status: "invalid", code: "UNSAFE_SOURCE_PATH" });

  const alias = path.join(root, "user-alias");
  await symlink(userConfig, alias);
  loaded = await loadOperationPolicySources(resource, alias);
  assert.deepEqual(loaded.user, { status: "invalid", code: "INVALID_LOADING_CONTEXT" });

  await rm(path.join(workspace, ".pi-warden"));
  await writePolicy(workspace, ".pi-warden", '{"version":1,"operations":{},"source":"user"}');
  loaded = await loadOperationPolicySources(resource, userConfig);
  assert.deepEqual(loaded.project, { status: "invalid", code: "INVALID_SCHEMA" });
});

test("rejects hard-linked policy aliases and oversized files before parsing", async (t) => {
  const { root, workspace, userConfig } = await fixture(t);
  const outside = path.join(root, "outside-policy.json");
  await writeFile(outside, validEmpty);
  await mkdir(path.join(workspace, ".pi-warden"));
  await link(outside, path.join(workspace, ".pi-warden", "policy.json"));
  const resource = await resolveWorkspacePath(workspace, "ordinary.txt");
  let loaded = await loadOperationPolicySources(resource, userConfig);
  assert.deepEqual(loaded.project, { status: "invalid", code: "UNSAFE_SOURCE_PATH" });

  await rm(path.join(workspace, ".pi-warden", "policy.json"));
  await writeFile(path.join(workspace, ".pi-warden", "policy.json"), " ".repeat(65_537));
  loaded = await loadOperationPolicySources(resource, userConfig);
  assert.deepEqual(loaded.project, { status: "invalid", code: "DOCUMENT_TOO_LARGE" });

  await writeFile(path.join(workspace, ".pi-warden", "policy.json"), Buffer.from([0xff]));
  loaded = await loadOperationPolicySources(resource, userConfig);
  assert.deepEqual(loaded.project, { status: "invalid", code: "MALFORMED_JSON" });
});

test("forged source sets and loading contexts fail closed without proxy inspection", async (t) => {
  const { workspace, userConfig } = await fixture(t);
  const resource = await resolveWorkspacePath(workspace, "ordinary.txt");
  let calls = 0;
  const hostile = new Proxy({}, { get() { calls += 1; throw new Error("get trap"); } });
  const result = evaluateEffectivePath("read", resource, hostile as never);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "INVALID_POLICY_SOURCES");
  assert.equal(calls, 0);

  const invalidContext = await loadOperationPolicySources(hostile as never, userConfig);
  assert.deepEqual(invalidContext, {
    user: { status: "invalid", code: "INVALID_LOADING_CONTEXT" },
    project: { status: "invalid", code: "INVALID_LOADING_CONTEXT" },
  });
  assert.equal(calls, 0);
});

test("rejects substitution of an issued project snapshot across genuine workspaces", async (t) => {
  const { root, workspace, userConfig } = await fixture(t);
  const otherWorkspace = path.join(root, "other-workspace");
  await mkdir(otherWorkspace);
  await writeFile(path.join(otherWorkspace, "ordinary.txt"), "other workspace\n");
  await writePolicy(workspace, ".pi-warden", '{"version":1,"operations":{"read":"DENY"}}');

  const firstResource = await resolveWorkspacePath(workspace, "ordinary.txt");
  const otherResource = await resolveWorkspacePath(otherWorkspace, "ordinary.txt");
  const firstSources = await loadOperationPolicySources(firstResource, userConfig);
  assert.equal(
    evaluateEffectivePath("read", firstResource, firstSources).reason,
    "CONFIGURATION_RESTRICTION",
  );

  assert.deepEqual(evaluateEffectivePath("read", otherResource, firstSources), {
    operation: "read",
    decision: "DENY",
    reason: "INVALID_POLICY_SOURCES",
    baseline: { decision: "ALLOW", reason: "WORKSPACE_READ" },
    sources: [
      { source: "user", status: "invalid", code: "INVALID_POLICY_SOURCES" },
      { source: "project", status: "invalid", code: "INVALID_POLICY_SOURCES" },
    ],
  });
});
