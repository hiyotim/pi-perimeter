import assert from "node:assert/strict";
import test from "node:test";

import {
  joinAuthorizationOutcomes,
  type AuthorizationOutcome,
} from "../src/policy/authority.ts";
import { mergeAuthorizationOutcomes } from "../src/policy/merge.ts";

const OUTCOMES: readonly AuthorizationOutcome[] = ["ALLOW", "ASK", "DENY"];

function foldJoin(
  baseline: AuthorizationOutcome,
  contributions: readonly AuthorizationOutcome[],
): AuthorizationOutcome {
  let current = baseline;
  for (const contribution of contributions) {
    current = joinAuthorizationOutcomes(current, contribution);
  }
  return current;
}

test("returns the validated baseline unchanged with zero contributions", () => {
  for (const baseline of OUTCOMES) {
    assert.equal(mergeAuthorizationOutcomes(baseline), baseline, baseline);
  }
  // No implicit lattice identity: absent contributions never become ALLOW or
  // DENY on their own.
  assert.equal(mergeAuthorizationOutcomes("ALLOW"), "ALLOW");
  assert.equal(mergeAuthorizationOutcomes("ASK"), "ASK");
  assert.equal(mergeAuthorizationOutcomes("DENY"), "DENY");
});

test("merges one contribution for every valid pair", () => {
  const table: readonly (readonly [
    AuthorizationOutcome,
    AuthorizationOutcome,
    AuthorizationOutcome,
  ])[] = [
    ["ALLOW", "ALLOW", "ALLOW"],
    ["ALLOW", "ASK", "ASK"],
    ["ALLOW", "DENY", "DENY"],
    ["ASK", "ALLOW", "ASK"],
    ["ASK", "ASK", "ASK"],
    ["ASK", "DENY", "DENY"],
    ["DENY", "ALLOW", "DENY"],
    ["DENY", "ASK", "DENY"],
    ["DENY", "DENY", "DENY"],
  ];

  assert.equal(table.length, 9);

  for (const [baseline, contribution, expected] of table) {
    assert.equal(
      mergeAuthorizationOutcomes(baseline, contribution),
      expected,
      `merge(${baseline}, ${contribution})`,
    );
    assert.equal(
      mergeAuthorizationOutcomes(baseline, contribution),
      foldJoin(baseline, [contribution]),
      `fold(${baseline}, ${contribution})`,
    );
  }
});

test("matches the pairwise fold for representative two- and three-contribution combinations", () => {
  const combinations: readonly (readonly [
    AuthorizationOutcome,
    readonly AuthorizationOutcome[],
  ])[] = [
    ["ALLOW", ["ALLOW", "ALLOW"]],
    ["ALLOW", ["ASK", "ALLOW"]],
    ["ALLOW", ["ALLOW", "DENY"]],
    ["ASK", ["ASK", "ASK"]],
    ["ASK", ["ALLOW", "DENY"]],
    ["ALLOW", ["ASK", "ASK", "ALLOW"]],
    ["DENY", ["ALLOW", "ASK"]],
    ["DENY", ["ALLOW", "ALLOW", "DENY", "ASK"]],
    ["ALLOW", ["ALLOW", "ASK", "ASK", "DENY"]],
  ];

  for (const [baseline, contributions] of combinations) {
    const expected = foldJoin(baseline, contributions);
    assert.equal(
      mergeAuthorizationOutcomes(baseline, ...contributions),
      expected,
      `merge(${baseline}, [${contributions.join(", ")}])`,
    );
  }
});

test("equals the accepted pairwise fold for all 27 valid triples", () => {
  let triples = 0;
  for (const baseline of OUTCOMES) {
    for (const first of OUTCOMES) {
      for (const second of OUTCOMES) {
        triples += 1;
        assert.equal(
          mergeAuthorizationOutcomes(baseline, first, second),
          foldJoin(baseline, [first, second]),
          `fold(${baseline}, [${first}, ${second}])`,
        );
      }
    }
  }
  assert.equal(triples, 27);
});

test("is independent of contribution order and grouping", () => {
  const permutations: readonly (readonly AuthorizationOutcome[])[] = [
    ["ALLOW", "ASK", "DENY"],
    ["ALLOW", "DENY", "ASK"],
    ["ASK", "ALLOW", "DENY"],
    ["ASK", "DENY", "ALLOW"],
    ["DENY", "ALLOW", "ASK"],
    ["DENY", "ASK", "ALLOW"],
  ];

  const expected = foldJoin("ASK", ["ALLOW", "ASK", "DENY"]);
  for (const order of permutations) {
    assert.equal(
      mergeAuthorizationOutcomes("ASK", ...order),
      expected,
      `permutation [${order.join(", ")}]`,
    );
  }

  // Grouping: merging sub-joins differs from the API shape only through
  // joinAuthorizationOutcomes, so verify flattened results against grouped
  // pairwise folds.
  assert.equal(
    mergeAuthorizationOutcomes("ALLOW", "ASK", "DENY"),
    joinAuthorizationOutcomes(
      mergeAuthorizationOutcomes("ALLOW", "ASK"),
      "DENY",
    ),
  );
  assert.equal(
    mergeAuthorizationOutcomes("ALLOW", "ASK", "DENY"),
    joinAuthorizationOutcomes(
      "ALLOW",
      mergeAuthorizationOutcomes("ASK", "DENY"),
    ),
  );

  // Every four-contribution multiset behaves identically under permutation.
  const multiset: readonly AuthorizationOutcome[] = ["ASK", "ALLOW", "DENY"];
  for (const first of multiset) {
    for (const second of multiset) {
      for (const third of multiset) {
        for (const fourth of multiset) {
          assert.equal(
            mergeAuthorizationOutcomes("ALLOW", first, second, third, fourth),
            foldJoin("ALLOW", [first, second, third, fourth]),
            `multiset [${[first, second, third, fourth].join(", ")}]`,
          );
        }
      }
    }
  }
});

test("fails closed to DENY for every invalid runtime value without coercion", () => {
  const throwingCoercion = {
    toString() {
      throw new Error("toString was invoked");
    },
    valueOf() {
      throw new Error("valueOf was invoked");
    },
    [Symbol.toPrimitive]() {
      throw new Error("Symbol.toPrimitive was invoked");
    },
  };

  const throwingGetter = Object.defineProperty({}, "outcome", {
    enumerable: true,
    get() {
      throw new Error("a getter was invoked");
    },
  });

  const revoked = Proxy.revocable({}, {});
  revoked.revoke();

  const invalid: readonly unknown[] = [
    undefined,
    null,
    true,
    false,
    0,
    1,
    -1,
    NaN,
    Infinity,
    0n,
    1n,
    Symbol("ALLOW"),
    "",
    " ",
    "ALLOW ",
    " ALLOW",
    "allow",
    "Ask",
    "deny",
    "MAYBE",
    "SANDBOX",
    [],
    ["ALLOW"],
    {},
    { outcome: "ALLOW" },
    { decision: "ALLOW" },
    { decision: "ASK", reason: "EXTERNAL_READ" },
    { decision: "SANDBOX" },
    new String("ALLOW"),
    () => "ALLOW",
    function allow() {},
    /ALLOW/,
    new Map([["outcome", "ALLOW"]]),
    new Set(["ALLOW"]),
    Object.create(null),
    throwingCoercion,
    throwingGetter,
    revoked.proxy,
  ];

  // Baseline position.
  for (const [index, candidate] of invalid.entries()) {
    assert.equal(
      mergeAuthorizationOutcomes(
        candidate as AuthorizationOutcome,
        "ALLOW",
        "DENY",
      ),
      "DENY",
      `invalid baseline[${index}]`,
    );
  }

  // Each contribution position.
  for (const [index, candidate] of invalid.entries()) {
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", candidate as AuthorizationOutcome),
      "DENY",
      `invalid first[${index}]`,
    );
    assert.equal(
      mergeAuthorizationOutcomes(
        "ALLOW",
        "ASK",
        candidate as AuthorizationOutcome,
        "ASK",
      ),
      "DENY",
      `invalid middle[${index}]`,
    );
    assert.equal(
      mergeAuthorizationOutcomes(
        "ALLOW",
        "ASK",
        "DENY",
        candidate as AuthorizationOutcome,
      ),
      "DENY",
      `invalid last[${index}]`,
    );
  }

  // Combination of invalid values.
  assert.equal(
    mergeAuthorizationOutcomes(
      invalid[13] as AuthorizationOutcome,
      invalid[21] as AuthorizationOutcome,
      "ALLOW",
      invalid[27] as AuthorizationOutcome,
    ),
    "DENY",
  );
});

test("does not invoke proxy traps or attacker-controlled callbacks", () => {
  let trapCalls = 0;
  const trapCounts: Record<string, number> = {
    baseline: 0,
    first: 0,
    middle: 0,
    last: 0,
    baselineWithValid: 0,
  };

  const makeGuarded = () =>
    new Proxy(
      {
        toString() {
          throw new Error("toString was invoked");
        },
        valueOf() {
          throw new Error("valueOf was invoked");
        },
        [Symbol.toPrimitive]() {
          throw new Error("Symbol.toPrimitive was invoked");
        },
      },
      {
        get() {
          trapCalls += 1;
          throw new Error("get trap invoked");
        },
        getOwnPropertyDescriptor() {
          trapCalls += 1;
          throw new Error("getOwnPropertyDescriptor trap invoked");
        },
        getPrototypeOf() {
          trapCalls += 1;
          throw new Error("getPrototypeOf trap invoked");
        },
        has() {
          trapCalls += 1;
          throw new Error("has trap invoked");
        },
        ownKeys() {
          trapCalls += 1;
          throw new Error("ownKeys trap invoked");
        },
        apply() {
          trapCalls += 1;
          throw new Error("apply trap invoked");
        },
        construct() {
          trapCalls += 1;
          throw new Error("construct trap invoked");
        },
      },
    );

  const callableGuarded = new Proxy(function allow() {}, {
    apply() {
      trapCalls += 1;
      throw new Error("apply trap invoked on a callable");
    },
  });

  const phase = <T>(key: keyof typeof trapCounts, fn: () => T): T => {
    trapCounts[key] = trapCalls;
    const result = fn();
    trapCounts[key] = trapCalls - trapCounts[key];
    return result;
  };

  const guarded = makeGuarded();

  phase("baseline", () =>
    assert.equal(
      mergeAuthorizationOutcomes(
        guarded as unknown as AuthorizationOutcome,
        "ALLOW",
        "ASK",
      ),
      "DENY",
    ),
  );
  phase("first", () =>
    assert.equal(
      mergeAuthorizationOutcomes(
        "ALLOW",
        makeGuarded() as unknown as AuthorizationOutcome,
        "ASK",
      ),
      "DENY",
    ),
  );
  phase("middle", () =>
    assert.equal(
      mergeAuthorizationOutcomes(
        "ALLOW",
        "ASK",
        makeGuarded() as unknown as AuthorizationOutcome,
        "DENY",
      ),
      "DENY",
    ),
  );
  phase("last", () =>
    assert.equal(
      mergeAuthorizationOutcomes("ASK", "ASK", makeGuarded() as unknown as AuthorizationOutcome),
      "DENY",
    ),
  );
  phase("baselineWithValid", () =>
    assert.equal(
      mergeAuthorizationOutcomes(
        callableGuarded as unknown as AuthorizationOutcome,
        "ASK",
        "ALLOW",
      ),
      "DENY",
    ),
  );

  for (const [position, calls] of Object.entries(trapCounts)) {
    assert.equal(calls, 0, `traps invoked in ${position} phase`);
  }
});

test("does not invoke Array.prototype[Symbol.iterator] when it is replaced", () => {
  const original = Object.getOwnPropertyDescriptor(
    Array.prototype,
    Symbol.iterator,
  );
  assert.ok(original, "Array.prototype[Symbol.iterator] has a descriptor");

  let calls = 0;
  try {
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      configurable: true,
      writable: true,
      value: function hostileIterator() {
        calls += 1;
        throw new Error("Array.prototype[Symbol.iterator] was invoked");
      },
    });

    // Literal arguments only: no spread, no array iteration in the window.

    // Zero contributions for every baseline.
    assert.equal(mergeAuthorizationOutcomes("ALLOW"), "ALLOW");
    assert.equal(mergeAuthorizationOutcomes("ASK"), "ASK");
    assert.equal(mergeAuthorizationOutcomes("DENY"), "DENY");

    // Valid contributions.
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "ASK", "ASK", "ALLOW"),
      "ASK",
    );
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "ALLOW", "DENY"),
      "DENY",
    );
    assert.equal(
      mergeAuthorizationOutcomes("DENY", "ALLOW", "ASK"),
      "DENY",
    );

    // Invalid values in first, middle, and last contribution positions.
    const hostile = { toString: undefined };
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", hostile as never, "ASK"),
      "DENY",
    );
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "ASK", undefined as never, "ASK"),
      "DENY",
    );
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "ASK", "ASK", "MAYBE" as never),
      "DENY",
    );
    assert.equal(
      mergeAuthorizationOutcomes(hostile as never, "ALLOW"),
      "DENY",
    );
  } finally {
    Object.defineProperty(Array.prototype, Symbol.iterator, original);
  }

  assert.equal(calls, 0, "the hostile iterator was not invoked");
});

test("does not invoke an adversarial Symbol.iterator getter on Array.prototype", () => {
  const original = Object.getOwnPropertyDescriptor(
    Array.prototype,
    Symbol.iterator,
  );
  assert.ok(original, "Array.prototype[Symbol.iterator] has a descriptor");

  let getterCalls = 0;
  try {
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      configurable: true,
      get: function hostileGetter() {
        getterCalls += 1;
        throw new Error("the Symbol.iterator getter was invoked");
      },
    });

    assert.equal(mergeAuthorizationOutcomes("ASK"), "ASK");
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "ASK", "ASK"),
      "ASK",
    );
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "ASK", null as never, "DENY"),
      "DENY",
    );
    assert.equal(
      mergeAuthorizationOutcomes(NaN as never, "ALLOW"),
      "DENY",
    );
  } finally {
    Object.defineProperty(Array.prototype, Symbol.iterator, original);
  }

  assert.equal(getterCalls, 0, "the hostile getter was not invoked");
});

test("does not need Array.prototype[Symbol.iterator] after it is deleted", () => {
  const original = Object.getOwnPropertyDescriptor(
    Array.prototype,
    Symbol.iterator,
  );
  assert.ok(original, "Array.prototype[Symbol.iterator] has a descriptor");

  try {
    const prototype = Array.prototype as unknown as Record<symbol, unknown>;
    delete prototype[Symbol.iterator];
    assert.equal(
      Symbol.iterator in Array.prototype,
      false,
      "the iterator was deleted in the hostile window",
    );

    assert.equal(mergeAuthorizationOutcomes("DENY"), "DENY");
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "DENY"),
      "DENY",
    );
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "ALLOW", "ALLOW"),
      "ALLOW",
    );
    assert.equal(
      mergeAuthorizationOutcomes("ALLOW", "ASK", 0 as never, "ALLOW"),
      "DENY",
    );
  } finally {
    Object.defineProperty(Array.prototype, Symbol.iterator, original);
  }

  assert.equal(Symbol.iterator in Array.prototype, true);
});

test("never throws for any runtime input", () => {
  const neverThrows: readonly unknown[] = [
    undefined,
    null,
    NaN,
    Symbol("x"),
    () => {
      throw new Error("never invoked");
    },
    new Proxy({}, {
      get() {
        throw new Error("get trap invoked");
      },
    }),
    Object.defineProperty({}, "v", {
      get() {
        throw new Error("getter invoked");
      },
    }),
  ];

  assert.doesNotThrow(() => {
    assert.equal(
      mergeAuthorizationOutcomes(
        neverThrows[0] as AuthorizationOutcome,
        neverThrows[1] as AuthorizationOutcome,
        neverThrows[2] as AuthorizationOutcome,
        neverThrows[3] as AuthorizationOutcome,
        neverThrows[4] as AuthorizationOutcome,
        neverThrows[5] as AuthorizationOutcome,
        neverThrows[6] as AuthorizationOutcome,
      ),
      "DENY",
    );

    for (const baseline of [undefined, null, "MAYBE", "allow", {}] as readonly unknown[]) {
      assert.equal(
        mergeAuthorizationOutcomes(
          baseline as AuthorizationOutcome,
          "ALLOW",
          "ALLOW",
        ),
        "DENY",
      );
    }
  });
});

test("does not mutate argument objects", () => {
  const baselineArgument = { outcome: "ALLOW", nested: { stable: true } };
  const contributionArgument = { outcome: "DENY" };
  const baselineSnapshot = structuredClone(baselineArgument);
  const contributionSnapshot = structuredClone(contributionArgument);

  assert.equal(
    mergeAuthorizationOutcomes(
      baselineArgument as unknown as AuthorizationOutcome,
      contributionArgument as unknown as AuthorizationOutcome,
    ),
    "DENY",
  );
  assert.deepEqual(baselineArgument, baselineSnapshot);
  assert.deepEqual(contributionArgument, contributionSnapshot);
});

test("returns only a primitive valid outcome, with no added structure", () => {
  // Representative valid and invalid inputs across all positions.
  const samples: readonly (readonly AuthorizationOutcome[])[] = [
    ["ALLOW", "ASK"],
    ["ASK", "DENY", "ALLOW"],
    ["DENY"],
    ["ALLOW", "ALLOW", "ALLOW"],
  ];

  for (const [baseline, ...contributions] of samples) {
    const result = mergeAuthorizationOutcomes(baseline, ...contributions);
    assert.equal(typeof result, "string");
    assert.ok(
      OUTCOMES.includes(result),
      `merge(${baseline}, [${contributions.join(", ")}]) returned an unsupported outcome`,
    );
  }

  const invalidResult = mergeAuthorizationOutcomes(
    "MAYBE" as AuthorizationOutcome,
    "ALLOW",
  );
  assert.equal(typeof invalidResult, "string");
  assert.equal(invalidResult, "DENY");
});

test("fails closed for runtime casts of compile-time-rejected values", () => {
  const unsupported = "MAYBE" as AuthorizationOutcome;
  const sandbox = "SANDBOX" as AuthorizationOutcome;
  const lowercase = "allow" as AuthorizationOutcome;
  const decision = { decision: "ALLOW" } as unknown as AuthorizationOutcome;

  assert.equal(mergeAuthorizationOutcomes(unsupported, "ALLOW"), "DENY");
  assert.equal(mergeAuthorizationOutcomes("ASK", sandbox, "ALLOW"), "DENY");
  assert.equal(mergeAuthorizationOutcomes("ALLOW", lowercase), "DENY");
  assert.equal(mergeAuthorizationOutcomes(decision, "DENY"), "DENY");
  assert.equal(mergeAuthorizationOutcomes("ALLOW", "ASK", decision), "DENY");
});

test("enforces the merge API contract at compile time", () => {
  if (false) {
    const baseline: AuthorizationOutcome = "ALLOW";
    const ask: AuthorizationOutcome = "ASK";
    const deny: AuthorizationOutcome = "DENY";

    const merged: AuthorizationOutcome = mergeAuthorizationOutcomes(
      baseline,
      ask,
      deny,
    );
    const mergedLiteral: AuthorizationOutcome = mergeAuthorizationOutcomes(
      "ASK",
      "DENY",
      "ALLOW",
    );
    const zeroContributions: AuthorizationOutcome =
      mergeAuthorizationOutcomes(baseline);

    const outcomes: readonly AuthorizationOutcome[] = ["ALLOW", "ASK", "DENY"];
    const spread: AuthorizationOutcome = mergeAuthorizationOutcomes(
      "ALLOW",
      ...outcomes,
    );
    const asArray: readonly AuthorizationOutcome[] = [merged, spread];

    // @ts-expect-error unsupported strings are rejected as the baseline
    mergeAuthorizationOutcomes("MAYBE", "ALLOW");
    // @ts-expect-error SANDBOX is a containment axis, not an authorization outcome
    mergeAuthorizationOutcomes("ALLOW", "SANDBOX");
    // @ts-expect-error lowercase variants are rejected as contributions
    mergeAuthorizationOutcomes("ALLOW", "ask");
    // @ts-expect-error structured decision objects are rejected as the baseline
    mergeAuthorizationOutcomes({ decision: "DENY" }, "ALLOW");
    // @ts-expect-error structured decision objects are rejected as contributions
    mergeAuthorizationOutcomes("ALLOW", { decision: "DENY" });
    // Invalid non-outcome arrays are rejected as spread contributions.
    const invalidSpread: readonly string[] = ["ALLOW", "MAYBE"];
    // @ts-expect-error non-outcome strings cannot be spread as contributions
    mergeAuthorizationOutcomes("ALLOW", ...invalidSpread);
    // @ts-expect-error too-few arguments are rejected
    mergeAuthorizationOutcomes();
    // @ts-expect-error undefined is rejected as the baseline
    mergeAuthorizationOutcomes(undefined, "ALLOW");
    // @ts-expect-error the result is the outcome union, not a decision object
    const asDecision: { decision: "ALLOW" } = mergeAuthorizationOutcomes(
      "ALLOW",
      "ALLOW",
    );

    void ask;
    void deny;
    void merged;
    void mergedLiteral;
    void zeroContributions;
    void asArray;
    void asDecision;
  }

  // The rest-properties API shape: baseline is required and contributions are
  // variadic.
  assert.equal(mergeAuthorizationOutcomes.length, 1);
});

test("keeps the accepted authority sources byte-identical and records the merge fingerprints", async (t) => {
  const { createHash } = await import("node:crypto");
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");

  const sha256 = async (relativePath: string): Promise<string> => {
    const contents = await readFile(
      fileURLToPath(new URL(relativePath, import.meta.url)),
    );
    return createHash("sha256").update(contents).digest("hex");
  };

  // Acceptance criterion: the accepted authority sources remain
  // byte-identical to the baselines fixed by the implementation handoff.
  assert.equal(
    await sha256("../src/policy/authority.ts"),
    "21c3df092f48c84d23f8b8ce90b1fee03143d5b5282f3b1377742b67df088cfb",
    "authority.ts drifted from the accepted baseline",
  );
  assert.equal(
    await sha256("../test/authority.test.ts"),
    "75dfef5bcadc6c25b223bc81c8e4992d8adda45b212a4dc4648e01454f0d27e5",
    "authority.test.ts drifted from the accepted baseline",
  );

  // Record the current fingerprints of the two new merge files.
  t.diagnostic(
    `merge.ts sha256: ${await sha256("../src/policy/merge.ts")}`,
  );
  t.diagnostic(
    `merge.test.ts sha256: ${await sha256("../test/merge.test.ts")}`,
  );
});
