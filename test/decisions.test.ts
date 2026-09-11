import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  evaluateReadPath,
  type ReadPathDecision,
} from "../src/policy/decisions.ts";
import {
  PathCanonicalizationError,
  resolveWorkspacePath,
  type ResolvedPath,
} from "../src/policy/paths.ts";

interface DecisionFixture {
  readonly root: string;
  readonly workspace: string;
  readonly outside: string;
  resolve(requestedPath: string): Promise<ResolvedPath>;
  evaluate(requestedPath: string): Promise<ReadPathDecision>;
}

async function withFixture(
  run: (fixture: DecisionFixture) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-warden-decisions-"));
  const workspace = path.join(root, "project");
  const outside = path.join(root, "outside");

  try {
    await mkdir(workspace, { recursive: true });
    await mkdir(outside, { recursive: true });

    for (const relativePath of [
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
      "private.key",
      "private.p12",
      "keys/id_rsa",
      "vault.p12",
      "signing.key",
    ]) {
      const filePath = path.join(workspace, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "fake fixture");
    }

    for (const relativePath of ["ordinary.txt", ".env", "private.key"]) {
      await writeFile(path.join(outside, relativePath), "fake fixture");
    }

    await mkdir(path.join(workspace, "lexical-secret"));

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

    const resolve = (requestedPath: string) =>
      resolveWorkspacePath(workspace, requestedPath);

    await run({
      root,
      workspace,
      outside,
      resolve,
      evaluate: async (requestedPath) =>
        evaluateReadPath("read", await resolve(requestedPath)),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("emits the complete selected result for every table row and overlap", async () => {
  await withFixture(async ({ outside, evaluate }) => {
    const cases: readonly {
      readonly path: string;
      readonly expected: ReadPathDecision;
    }[] = [
      {
        path: "ordinary.txt",
        expected: { decision: "ALLOW", reason: "WORKSPACE_READ" },
      },
      {
        path: "src",
        expected: { decision: "ALLOW", reason: "WORKSPACE_READ" },
      },
      {
        path: "src/index.ts",
        expected: { decision: "ALLOW", reason: "WORKSPACE_READ" },
      },
      {
        path: path.join(outside, "into-workspace.txt"),
        expected: { decision: "ALLOW", reason: "WORKSPACE_READ" },
      },
      {
        path: path.join(outside, "ordinary.txt"),
        expected: { decision: "ASK", reason: "EXTERNAL_READ" },
      },
      {
        path: "escape.txt",
        expected: { decision: "ASK", reason: "EXTERNAL_READ" },
      },
      {
        path: "missing.txt",
        expected: { decision: "DENY", reason: "READ_TARGET_MISSING" },
      },
      {
        path: path.join(outside, "missing.txt"),
        expected: { decision: "DENY", reason: "READ_TARGET_MISSING" },
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
        path: ".aws/sso/cache/.env.production.example",
        expected: { decision: "DENY", reason: "SECRET_RESOURCE" },
      },
      {
        path: ".env.production.key",
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
        path: "missing.key",
        expected: { decision: "DENY", reason: "SENSITIVE_RESOURCE" },
      },
    ];

    for (const { path: requestedPath, expected } of cases) {
      assert.deepEqual(await evaluate(requestedPath), expected, requestedPath);
    }
  });
});

test("denies unsupported operations before classification and never allows or asks", async () => {
  await withFixture(async ({ outside, resolve }) => {
    const ordinary = await resolve("ordinary.txt");
    const secret = await resolve(".env");
    const external = await resolve(path.join(outside, "ordinary.txt"));

    const unsupported: readonly unknown[] = [
      "write",
      "edit",
      "delete",
      "bash",
      "Read",
      "READ",
      "read ",
      " read",
      "read\u0000",
      "",
      undefined,
      null,
      0,
      1,
      true,
      false,
      {},
      [],
      Symbol("read"),
      10n,
    ];

    for (const [index, operation] of unsupported.entries()) {
      for (const [label, resource] of [
        ["workspace", ordinary],
        ["secret", secret],
        ["external", external],
      ] as const) {
        assert.deepEqual(
          evaluateReadPath(operation as unknown as "read", resource),
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
      evaluateReadPath(coercingOperation as unknown as "read", ordinary),
      { decision: "DENY", reason: "UNSUPPORTED_OPERATION" },
    );
  });
});

test("requires genuine resolver issuance before any resource property access", async () => {
  await withFixture(async ({ workspace, resolve }) => {
    const genuine = await resolve("ordinary.txt");

    assert.deepEqual(evaluateReadPath("read", genuine), {
      decision: "ALLOW",
      reason: "WORKSPACE_READ",
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

    const forged: readonly unknown[] = [
      claimed,
      { ...claimed, [brand]: true },
      Object.defineProperty({ ...claimed }, brand, brandDescriptor),
      { ...genuine },
      Object.assign({}, genuine),
      Object.create(genuine),
      Object.create(
        Object.getPrototypeOf(genuine),
        Object.getOwnPropertyDescriptors(genuine),
      ),
      JSON.parse(JSON.stringify(genuine)),
      throwingAccessors,
      countingProxy,
      new Proxy(claimed, {
        get() {
          throw new Error("structural resource property was accessed");
        },
      }),
    ];

    for (const [index, candidate] of forged.entries()) {
      assert.deepEqual(
        evaluateReadPath("read", candidate as ResolvedPath),
        { decision: "DENY", reason: "INVALID_RESOURCE" },
        `forged[${index}]`,
      );
    }

    assert.equal(proxyTraps, 0);

    assert.deepEqual(
      evaluateReadPath(
        "write" as unknown as "read",
        claimed as unknown as ResolvedPath,
      ),
      { decision: "DENY", reason: "INVALID_RESOURCE" },
    );
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
      evaluateReadPath("read", candidate as ResolvedPath),
      { decision: "DENY", reason: "INVALID_RESOURCE" },
      `input[${index}]`,
    );
  }
});

test("returns exactly the decision and reason fields synchronously", async () => {
  await withFixture(async ({ outside, evaluate }) => {
    for (const requestedPath of [
      "ordinary.txt",
      path.join(outside, "ordinary.txt"),
      "missing.txt",
      ".env",
      "private.key",
    ]) {
      const result = await evaluate(requestedPath);
      assert.deepEqual(
        Object.keys(result).sort(),
        ["decision", "reason"],
        requestedPath,
      );
      assert.equal(
        typeof (result as unknown as { readonly then?: unknown }).then,
        "undefined",
        requestedPath,
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
        return evaluateReadPath("read", resolved);
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
          return evaluateReadPath("read", resolved);
        },
      ),
      (error: unknown) =>
        error instanceof PathCanonicalizationError &&
        error.code === "ANCESTOR_NOT_DIRECTORY",
    );

    assert.equal(decisionEvaluated, false);
  });
});

test("rejects non-read operations, structural resources, and invalid combinations at compile time", () => {
  if (false) {
    const resource = null as unknown as ResolvedPath;
    const decision = null as unknown as ReadPathDecision;
    const structural = {
      requestedPath: "ordinary.txt",
      absolutePath: "/tmp/ordinary.txt",
      canonicalPath: "/tmp/ordinary.txt",
      workspaceRoot: "/tmp",
      targetExists: true,
      insideWorkspace: true,
    };

    const allow: ReadPathDecision = {
      decision: "ALLOW",
      reason: "WORKSPACE_READ",
    };
    const ask: ReadPathDecision = {
      decision: "ASK",
      reason: "EXTERNAL_READ",
    };
    const denyInvalid: ReadPathDecision = {
      decision: "DENY",
      reason: "INVALID_RESOURCE",
    };
    const denyUnsupported: ReadPathDecision = {
      decision: "DENY",
      reason: "UNSUPPORTED_OPERATION",
    };
    const denySecret: ReadPathDecision = {
      decision: "DENY",
      reason: "SECRET_RESOURCE",
    };
    const denySensitive: ReadPathDecision = {
      decision: "DENY",
      reason: "SENSITIVE_RESOURCE",
    };
    const denyMissing: ReadPathDecision = {
      decision: "DENY",
      reason: "READ_TARGET_MISSING",
    };

    // @ts-expect-error only the exact read operation is admitted
    evaluateReadPath("write", resource);
    // @ts-expect-error case variants are not the exact read operation
    evaluateReadPath("Read", resource);
    // @ts-expect-error absent runtime values are not admitted
    evaluateReadPath(undefined, resource);
    // @ts-expect-error structural resources cannot satisfy resolver issuance
    evaluateReadPath("read", structural);

    // @ts-expect-error result fields are readonly
    decision.decision = "ALLOW";
    // @ts-expect-error result fields are readonly
    decision.reason = "WORKSPACE_READ";

    // @ts-expect-error ALLOW only pairs with WORKSPACE_READ
    const invalidAllow: ReadPathDecision = { decision: "ALLOW", reason: "EXTERNAL_READ" };
    // @ts-expect-error ASK only pairs with EXTERNAL_READ
    const invalidAsk: ReadPathDecision = { decision: "ASK", reason: "WORKSPACE_READ" };
    // @ts-expect-error DENY cannot carry WORKSPACE_READ
    const invalidDeny: ReadPathDecision = { decision: "DENY", reason: "WORKSPACE_READ" };
    // @ts-expect-error no SANDBOX outcome is part of the contract
    const sandbox: ReadPathDecision = { decision: "SANDBOX", reason: "WORKSPACE_READ" };
    // @ts-expect-error the result has exactly decision and reason
    const extra: ReadPathDecision = { decision: "ALLOW", reason: "WORKSPACE_READ", extra: true };

    void allow;
    void ask;
    void denyInvalid;
    void denyUnsupported;
    void denySecret;
    void denySensitive;
    void denyMissing;
    void invalidAllow;
    void invalidAsk;
    void invalidDeny;
    void sandbox;
    void extra;
  }
});
