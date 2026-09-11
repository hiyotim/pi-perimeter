import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  evaluateWritePath,
  type WritePathDecision,
  type WritePathDenyReason,
} from "../src/policy/decisions.ts";
import {
  PathCanonicalizationError,
  resolveWorkspacePath,
  type ResolvedPath,
} from "../src/policy/paths.ts";

interface WriteDecisionFixture {
  readonly root: string;
  readonly workspace: string;
  readonly outside: string;
  resolve(requestedPath: string): Promise<ResolvedPath>;
  evaluate(requestedPath: string): Promise<WritePathDecision>;
}

const WORKSPACE_FILES = [
  "ordinary.txt",
  "src/index.ts",
  ".env",
  ".env.example",
  ".env.production",
  ".env.production.example",
  ".env.production.key",
  ".env.example.key",
  ".aws/credentials",
  ".aws/sso/cache/.env.production.example",
  ".ssh/config",
  ".npmrc",
  ".git-credentials",
  "private.key",
  "private.p12",
  "certificate.pem",
  "keys/id_rsa",
  "vault.p12",
  "signing.key",
] as const;

async function withFixture(
  run: (fixture: WriteDecisionFixture) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-warden-write-decisions-"));
  const workspace = path.join(root, "project");
  const outside = path.join(root, "outside");

  try {
    await mkdir(workspace, { recursive: true });
    await mkdir(outside, { recursive: true });

    for (const relativePath of WORKSPACE_FILES) {
      const filePath = path.join(workspace, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "fake fixture");
    }

    for (const relativePath of ["ordinary.txt", ".env", "private.key"]) {
      await writeFile(path.join(outside, relativePath), "fake fixture");
    }

    await mkdir(path.join(workspace, "lexical-secret"));
    await mkdir(path.join(workspace, "empty-dir"));

    await symlink(
      path.join(outside, "ordinary.txt"),
      path.join(workspace, "escape.txt"),
    );
    await symlink(
      path.join(workspace, ".env"),
      path.join(workspace, "innocent-link"),
    );
    await symlink(
      path.join(workspace, "keys", "id_rsa"),
      path.join(workspace, "secret-alias.txt"),
    );
    await symlink(
      path.join(workspace, ".env.production.example"),
      path.join(workspace, "template-alias.txt"),
    );
    await symlink(
      path.join(outside, "ordinary.txt"),
      path.join(workspace, "lexical-secret", ".env"),
    );
    await symlink(
      path.join(outside, "ordinary.txt"),
      path.join(workspace, "looks-like.key"),
    );
    await symlink(
      path.join(workspace, "vault.p12"),
      path.join(workspace, "vault.key"),
    );
    await symlink(
      path.join(workspace, "signing.key"),
      path.join(workspace, "signing.p12"),
    );
    await symlink(
      path.join(workspace, "ordinary.txt"),
      path.join(outside, "into-workspace.txt"),
    );
    await symlink(outside, path.join(workspace, "escape-dir"));
    await symlink(workspace, path.join(outside, "into-dir"));

    const resolve = (requestedPath: string) =>
      resolveWorkspacePath(workspace, requestedPath);

    await run({
      root,
      workspace,
      outside,
      resolve,
      evaluate: async (requestedPath) =>
        evaluateWritePath("write", await resolve(requestedPath)),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("emits the complete selected result for every table row and overlap", async () => {
  await withFixture(async ({ outside, evaluate }) => {
    const cases: readonly {
      readonly path: string;
      readonly expected: WritePathDecision;
    }[] = [
      {
        path: "ordinary.txt",
        expected: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
      },
      {
        path: "src",
        expected: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
      },
      {
        path: "src/index.ts",
        expected: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
      },
      {
        path: "empty-dir",
        expected: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
      },
      {
        path: "missing.txt",
        expected: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
      },
      {
        path: "missing/nested/new.txt",
        expected: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
      },
      {
        path: path.join(outside, "into-workspace.txt"),
        expected: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
      },
      {
        path: path.join(outside, "into-dir/ordinary.txt"),
        expected: { decision: "ALLOW", reason: "WORKSPACE_WRITE" },
      },
      {
        path: path.join(outside, "ordinary.txt"),
        expected: { decision: "ASK", reason: "EXTERNAL_WRITE" },
      },
      {
        path: "escape.txt",
        expected: { decision: "ASK", reason: "EXTERNAL_WRITE" },
      },
      {
        path: "escape-dir/ordinary.txt",
        expected: { decision: "ASK", reason: "EXTERNAL_WRITE" },
      },
      {
        path: path.join(outside, "missing.txt"),
        expected: { decision: "ASK", reason: "EXTERNAL_WRITE" },
      },
      {
        path: path.join(outside, "missing/nested/new.txt"),
        expected: { decision: "ASK", reason: "EXTERNAL_WRITE" },
      },
      {
        path: ".env",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: path.join(outside, ".env"),
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: ".env.production",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: "missing-secret/.env.production",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: path.join(outside, "missing/.env"),
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: ".env.production.key",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: "innocent-link",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: "secret-alias.txt",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: "lexical-secret/.env",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: ".aws/credentials",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: ".aws/sso/cache/.env.production.example",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: ".git-credentials",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: "keys/id_rsa",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: "private.p12",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: "vault.key",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: "signing.p12",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: ".env.example",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: ".env.production.example",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: ".env.example.key",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: "template-alias.txt",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: "looks-like.key",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: "private.key",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: path.join(outside, "private.key"),
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: "certificate.pem",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: ".ssh",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: ".npmrc",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: "missing.key",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
      {
        path: path.join(outside, "missing.pem"),
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
    ];

    for (const { path: requestedPath, expected } of cases) {
      assert.deepEqual(await evaluate(requestedPath), expected, requestedPath);
    }
  });
});

test("keeps missing and existing ordinary targets on the canonical membership rule", async () => {
  await withFixture(async ({ outside, resolve }) => {
    const insideExisting = await resolve("ordinary.txt");
    const insideMissing = await resolve("new-file.txt");
    const insideNestedMissing = await resolve("new/nested/file.txt");
    const externalExisting = await resolve(path.join(outside, "ordinary.txt"));
    const externalMissing = await resolve(path.join(outside, "new-file.txt"));

    assert.equal(insideExisting.targetExists, true);
    assert.equal(insideExisting.insideWorkspace, true);
    assert.equal(insideMissing.targetExists, false);
    assert.equal(insideMissing.insideWorkspace, true);
    assert.equal(insideNestedMissing.targetExists, false);
    assert.equal(insideNestedMissing.insideWorkspace, true);
    assert.equal(externalExisting.targetExists, true);
    assert.equal(externalExisting.insideWorkspace, false);
    assert.equal(externalMissing.targetExists, false);
    assert.equal(externalMissing.insideWorkspace, false);

    assert.deepEqual(evaluateWritePath("write", insideExisting), {
      decision: "ALLOW",
      reason: "WORKSPACE_WRITE",
    });
    assert.deepEqual(evaluateWritePath("write", insideMissing), {
      decision: "ALLOW",
      reason: "WORKSPACE_WRITE",
    });
    assert.deepEqual(evaluateWritePath("write", insideNestedMissing), {
      decision: "ALLOW",
      reason: "WORKSPACE_WRITE",
    });
    assert.deepEqual(evaluateWritePath("write", externalExisting), {
      decision: "ASK",
      reason: "EXTERNAL_WRITE",
    });
    assert.deepEqual(evaluateWritePath("write", externalMissing), {
      decision: "ASK",
      reason: "EXTERNAL_WRITE",
    });
  });
});

test("denies unsupported operations before classification and never allows or asks", async () => {
  await withFixture(async ({ outside, resolve }) => {
    const ordinary = await resolve("ordinary.txt");
    const secret = await resolve(".env");
    const external = await resolve(path.join(outside, "ordinary.txt"));

    const unsupported: readonly unknown[] = [
      "read",
      "edit",
      "delete",
      "bash",
      "Write",
      "WRITE",
      "write ",
      " write",
      "write\u0000",
      "",
      undefined,
      null,
      0,
      1,
      true,
      false,
      {},
      [],
      Symbol("write"),
      10n,
    ];

    for (const [index, operation] of unsupported.entries()) {
      for (const [label, resource] of [
        ["workspace", ordinary],
        ["secret", secret],
        ["external", external],
      ] as const) {
        assert.deepEqual(
          evaluateWritePath(operation as unknown as "write", resource),
          { decision: "DENY", reason: "UNSUPPORTED_OPERATION" },
          `operation[${index}] on ${label}`,
        );
      }
    }

    const coercingOperation = {
      toString() {
        throw new Error("operation was coerced to a string");
      },
      valueOf() {
        throw new Error("operation was coerced to a primitive");
      },
      [Symbol.toPrimitive]() {
        throw new Error("operation was coerced with Symbol.toPrimitive");
      },
    };

    assert.deepEqual(
      evaluateWritePath(coercingOperation as unknown as "write", ordinary),
      { decision: "DENY", reason: "UNSUPPORTED_OPERATION" },
    );
  });
});

test("requires genuine resolver issuance before any resource property access", async () => {
  await withFixture(async ({ workspace, resolve }) => {
    const genuine = await resolve("ordinary.txt");

    assert.deepEqual(evaluateWritePath("write", genuine), {
      decision: "ALLOW",
      reason: "WORKSPACE_WRITE",
    });

    const ordinaryPath = path.join(workspace, "ordinary.txt");
    const claimed = {
      requestedPath: "ordinary.txt",
      absolutePath: ordinaryPath,
      canonicalPath: ordinaryPath,
      workspaceRoot: workspace,
      targetExists: true,
      insideWorkspace: true,
    };

    const brand = Object.getOwnPropertySymbols(genuine)[0];
    assert.equal(typeof brand, "symbol");
    const brandDescriptor = Object.getOwnPropertyDescriptor(genuine, brand);
    assert.ok(brandDescriptor);

    const throwingAccessors: Record<string, unknown> = {};
    for (const field of [
      "requestedPath",
      "absolutePath",
      "canonicalPath",
      "workspaceRoot",
      "targetExists",
      "insideWorkspace",
    ]) {
      Object.defineProperty(throwingAccessors, field, {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error(`resource property ${field} was accessed`);
        },
      });
    }

    let proxyTraps = 0;
    const countingProxy = new Proxy(genuine, {
      get() {
        proxyTraps += 1;
        throw new Error("resource property was read through a proxy");
      },
      getOwnPropertyDescriptor() {
        proxyTraps += 1;
        throw new Error("resource descriptor was read through a proxy");
      },
      has() {
        proxyTraps += 1;
        throw new Error("resource containment was tested through a proxy");
      },
    });

    const forged: readonly (readonly [string, unknown])[] = [
      ["claimed structural object", claimed],
      [
        "claimed inside and missing flags",
        { ...claimed, insideWorkspace: false, targetExists: false },
      ],
      ["spread copy", { ...genuine }],
      ["spread copy with copied brand symbol", { ...genuine, [brand]: true }],
      ["Object.assign copy", Object.assign({}, genuine)],
      [
        "copied descriptors including brand symbol",
        Object.defineProperties({}, Object.getOwnPropertyDescriptors(genuine)),
      ],
      ["prototype inheritance", Object.create(genuine)],
      [
        "descriptor copy onto inherited prototype",
        Object.create(
          Object.getPrototypeOf(genuine),
          Object.getOwnPropertyDescriptors(genuine),
        ),
      ],
      [
        "brand descriptor copied onto structural object",
        Object.defineProperty({ ...claimed }, brand, brandDescriptor),
      ],
      ["JSON round trip", JSON.parse(JSON.stringify(genuine))],
      ["throwing accessors", throwingAccessors],
      ["counting proxy over genuine result", countingProxy],
      [
        "throwing proxy over structural object",
        new Proxy(claimed, {
          get() {
            throw new Error("structural resource property was accessed");
          },
        }),
      ],
    ];

    for (const [label, candidate] of forged) {
      assert.deepEqual(
        evaluateWritePath("write", candidate as ResolvedPath),
        { decision: "DENY", reason: "INVALID_RESOURCE" },
        label,
      );
    }

    assert.deepEqual(
      evaluateWritePath(
        "read" as unknown as "write",
        countingProxy as unknown as ResolvedPath,
      ),
      { decision: "DENY", reason: "INVALID_RESOURCE" },
    );

    assert.deepEqual(
      evaluateWritePath(
        "read" as unknown as "write",
        claimed as unknown as ResolvedPath,
      ),
      { decision: "DENY", reason: "INVALID_RESOURCE" },
    );

    assert.equal(proxyTraps, 0);
  });
});

test("denies non-object and malformed resources without throwing", () => {
  const inputs: readonly unknown[] = [
    null,
    undefined,
    "ordinary.txt",
    "",
    123,
    true,
    Symbol("resource"),
    10n,
    () => undefined,
    [],
    {},
    new String("ordinary.txt"),
    Object.create(null),
  ];

  for (const [index, candidate] of inputs.entries()) {
    assert.deepEqual(
      evaluateWritePath("write", candidate as ResolvedPath),
      { decision: "DENY", reason: "INVALID_RESOURCE" },
      `input[${index}]`,
    );
  }
});

test("returns exactly the decision and reason fields synchronously", async () => {
  await withFixture(async ({ outside, resolve }) => {
    const results: readonly WritePathDecision[] = [
      evaluateWritePath("write", await resolve("ordinary.txt")),
      evaluateWritePath("write", await resolve(path.join(outside, "ordinary.txt"))),
      evaluateWritePath("write", await resolve(".env")),
      evaluateWritePath("write", await resolve("missing.key")),
      evaluateWritePath("read" as unknown as "write", await resolve("ordinary.txt")),
      evaluateWritePath("write", {} as unknown as ResolvedPath),
    ];

    for (const [index, result] of results.entries()) {
      assert.deepEqual(
        Object.keys(result).sort(),
        ["decision", "reason"],
        `result[${index}]`,
      );
      assert.equal(
        typeof (result as unknown as { readonly then?: unknown }).then,
        "undefined",
        `result[${index}]`,
      );
    }
  });
});

test("does not invoke the decision after a broken-link resolution failure", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await symlink(
      path.join(outside, "missing-target.txt"),
      path.join(workspace, "broken-link"),
    );
    let decisionEvaluated = false;

    await assert.rejects(
      resolveWorkspacePath(workspace, "broken-link").then((resolved) => {
        decisionEvaluated = true;
        return evaluateWritePath("write", resolved);
      }),
      (error: unknown) =>
        error instanceof PathCanonicalizationError &&
        error.code === "PATH_RESOLUTION_FAILED",
    );

    assert.equal(decisionEvaluated, false);
  });
});

test("does not invoke the decision after an ENOTDIR resolution failure", async () => {
  await withFixture(async ({ workspace }) => {
    await writeFile(path.join(workspace, "plain-file"), "fake fixture");
    let decisionEvaluated = false;

    await assert.rejects(
      resolveWorkspacePath(workspace, "plain-file/child.txt").then(
        (resolved) => {
          decisionEvaluated = true;
          return evaluateWritePath("write", resolved);
        },
      ),
      (error: unknown) =>
        error instanceof PathCanonicalizationError &&
        error.code === "ANCESTOR_NOT_DIRECTORY",
    );

    assert.equal(decisionEvaluated, false);
  });
});

test("rejects non-write operations, structural resources, and invalid combinations at compile time", () => {
  if (false) {
    const resource = null as unknown as ResolvedPath;
    const decision = null as unknown as WritePathDecision;
    const structural = {
      requestedPath: "ordinary.txt",
      absolutePath: "/tmp/ordinary.txt",
      canonicalPath: "/tmp/ordinary.txt",
      workspaceRoot: "/tmp",
      targetExists: true,
      insideWorkspace: true,
    };

    const allow: WritePathDecision = {
      decision: "ALLOW",
      reason: "WORKSPACE_WRITE",
    };
    const ask: WritePathDecision = {
      decision: "ASK",
      reason: "EXTERNAL_WRITE",
    };
    const denyInvalid: WritePathDecision = {
      decision: "DENY",
      reason: "INVALID_RESOURCE",
    };
    const denyUnsupported: WritePathDecision = {
      decision: "DENY",
      reason: "UNSUPPORTED_OPERATION",
    };
    const denySecret: WritePathDecision = {
      decision: "DENY",
      reason: "SECRET_RESOURCE",
    };
    const denySensitive: WritePathDecision = {
      decision: "DENY",
      reason: "SENSITIVE_RESOURCE",
    };
    const denyReasons: readonly WritePathDenyReason[] = [
      "INVALID_RESOURCE",
      "UNSUPPORTED_OPERATION",
      "SECRET_RESOURCE",
      "SENSITIVE_RESOURCE",
    ];

    // @ts-expect-error only the exact write operation is admitted
    evaluateWritePath("read", resource);
    // @ts-expect-error edit is not the write operation
    evaluateWritePath("edit", resource);
    // @ts-expect-error delete is not the write operation
    evaluateWritePath("delete", resource);
    // @ts-expect-error shell operations are not the write operation
    evaluateWritePath("bash", resource);
    // @ts-expect-error case variants are not the exact write operation
    evaluateWritePath("Write", resource);
    // @ts-expect-error absent runtime values are not admitted
    evaluateWritePath(undefined, resource);
    // @ts-expect-error structural resources cannot satisfy resolver issuance
    evaluateWritePath("write", structural);

    // @ts-expect-error result fields are readonly
    decision.decision = "ALLOW";
    // @ts-expect-error result fields are readonly
    decision.reason = "WORKSPACE_WRITE";

    // @ts-expect-error ALLOW only pairs with WORKSPACE_WRITE
    const invalidAllow: WritePathDecision = { decision: "ALLOW", reason: "EXTERNAL_WRITE" };
    // @ts-expect-error ASK only pairs with EXTERNAL_WRITE
    const invalidAsk: WritePathDecision = { decision: "ASK", reason: "WORKSPACE_WRITE" };
    // @ts-expect-error DENY cannot carry WORKSPACE_WRITE
    const invalidDeny: WritePathDecision = { decision: "DENY", reason: "WORKSPACE_WRITE" };
    // @ts-expect-error read-only reasons are not part of the write contract
    const readReason: WritePathDecision = { decision: "DENY", reason: "READ_TARGET_MISSING" };
    // @ts-expect-error no SANDBOX outcome is part of the contract
    const sandbox: WritePathDecision = { decision: "SANDBOX", reason: "WORKSPACE_WRITE" };
    // @ts-expect-error the result has exactly decision and reason
    const extra: WritePathDecision = { decision: "ALLOW", reason: "WORKSPACE_WRITE", extra: true };

    void allow;
    void ask;
    void denyInvalid;
    void denyUnsupported;
    void denySecret;
    void denySensitive;
    void denyReasons;
    void invalidAllow;
    void invalidAsk;
    void invalidDeny;
    void readReason;
    void sandbox;
    void extra;
  }
});
