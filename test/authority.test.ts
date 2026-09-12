import assert from "node:assert/strict";
import test from "node:test";

import {
  joinAuthorizationOutcomes,
  type AuthorizationOutcome,
} from "../src/policy/authority.ts";

const OUTCOMES: readonly AuthorizationOutcome[] = ["ALLOW", "ASK", "DENY"];

test("returns the stricter outcome for all nine ordered pairs", () => {
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

  for (const [left, right, expected] of table) {
    assert.equal(
      joinAuthorizationOutcomes(left, right),
      expected,
      `join(${left}, ${right})`,
    );
  }
});

test("is idempotent, commutative, and associative for every valid combination", () => {
  for (const outcome of OUTCOMES) {
    assert.equal(
      joinAuthorizationOutcomes(outcome, outcome),
      outcome,
      `idempotence ${outcome}`,
    );
  }

  for (const left of OUTCOMES) {
    for (const right of OUTCOMES) {
      assert.equal(
        joinAuthorizationOutcomes(left, right),
        joinAuthorizationOutcomes(right, left),
        `commutativity ${left}, ${right}`,
      );
    }
  }

  let triples = 0;
  for (const first of OUTCOMES) {
    for (const second of OUTCOMES) {
      for (const third of OUTCOMES) {
        triples += 1;
        assert.equal(
          joinAuthorizationOutcomes(
            joinAuthorizationOutcomes(first, second),
            third,
          ),
          joinAuthorizationOutcomes(
            first,
            joinAuthorizationOutcomes(second, third),
          ),
          `associativity ${first}, ${second}, ${third}`,
        );
      }
    }
  }
  assert.equal(triples, 27);
});

test("fails closed to DENY for every invalid runtime input without coercion", () => {
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

  for (const [index, candidate] of invalid.entries()) {
    assert.equal(
      joinAuthorizationOutcomes(candidate as AuthorizationOutcome, "ALLOW"),
      "DENY",
      `invalid left[${index}]`,
    );
    assert.equal(
      joinAuthorizationOutcomes("ALLOW", candidate as AuthorizationOutcome),
      "DENY",
      `invalid right[${index}]`,
    );
    assert.equal(
      joinAuthorizationOutcomes(
        candidate as AuthorizationOutcome,
        candidate as AuthorizationOutcome,
      ),
      "DENY",
      `invalid both[${index}]`,
    );
  }
});

test("does not invoke proxy traps or attacker-controlled callbacks", () => {
  let trapCalls = 0;

  const guarded = new Proxy(
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

  assert.equal(
    joinAuthorizationOutcomes(guarded as unknown as AuthorizationOutcome, "ALLOW"),
    "DENY",
  );
  assert.equal(
    joinAuthorizationOutcomes("ALLOW", guarded as unknown as AuthorizationOutcome),
    "DENY",
  );
  assert.equal(
    joinAuthorizationOutcomes(
      callableGuarded as unknown as AuthorizationOutcome,
      "DENY",
    ),
    "DENY",
  );
  assert.equal(trapCalls, 0);
});

test("does not mutate argument objects", () => {
  const leftArgument = { outcome: "ALLOW", nested: { stable: true } };
  const rightArgument = { outcome: "DENY" };
  const leftSnapshot = structuredClone(leftArgument);
  const rightSnapshot = structuredClone(rightArgument);

  assert.equal(
    joinAuthorizationOutcomes(
      leftArgument as unknown as AuthorizationOutcome,
      rightArgument as unknown as AuthorizationOutcome,
    ),
    "DENY",
  );
  assert.deepEqual(leftArgument, leftSnapshot);
  assert.deepEqual(rightArgument, rightSnapshot);
});

test("returns only a primitive valid outcome", () => {
  for (const left of OUTCOMES) {
    for (const right of OUTCOMES) {
      const result = joinAuthorizationOutcomes(left, right);
      assert.equal(typeof result, "string", `typeof join(${left}, ${right})`);
      assert.ok(
        OUTCOMES.includes(result),
        `join(${left}, ${right}) returned an unsupported outcome`,
      );
    }
  }

  assert.equal(
    typeof joinAuthorizationOutcomes(
      "MAYBE" as AuthorizationOutcome,
      "ALLOW",
    ),
    "string",
  );
});

test("fails closed for runtime casts of compile-time-rejected values", () => {
  const unsupported = "MAYBE" as AuthorizationOutcome;
  const sandbox = "SANDBOX" as AuthorizationOutcome;
  const decision = { decision: "ALLOW" } as unknown as AuthorizationOutcome;

  assert.equal(joinAuthorizationOutcomes(unsupported, "ALLOW"), "DENY");
  assert.equal(joinAuthorizationOutcomes("ASK", sandbox), "DENY");
  assert.equal(joinAuthorizationOutcomes(decision, "DENY"), "DENY");
});

test("enforces the outcome union at compile time", () => {
  if (false) {
    const allow: AuthorizationOutcome = "ALLOW";
    const ask: AuthorizationOutcome = "ASK";
    const deny: AuthorizationOutcome = "DENY";

    const joined: AuthorizationOutcome = joinAuthorizationOutcomes(allow, ask);
    const joinedLiteral: AuthorizationOutcome = joinAuthorizationOutcomes(
      "ASK",
      "DENY",
    );

    // @ts-expect-error unsupported strings are not outcomes
    const unsupported: AuthorizationOutcome = "MAYBE";
    // @ts-expect-error SANDBOX is a containment axis, not an authorization outcome
    const sandbox: AuthorizationOutcome = "SANDBOX";
    // @ts-expect-error lowercase variants are not outcomes
    const lowercase: AuthorizationOutcome = "allow";
    // @ts-expect-error decision objects are not authorization outcomes
    const decision: AuthorizationOutcome = {
      decision: "ALLOW",
      reason: "WORKSPACE_READ",
    };

    // @ts-expect-error unsupported strings are rejected as arguments
    joinAuthorizationOutcomes("MAYBE", "ALLOW");
    // @ts-expect-error SANDBOX is rejected as an argument
    joinAuthorizationOutcomes("ALLOW", "SANDBOX");
    // @ts-expect-error decision objects are rejected as arguments
    joinAuthorizationOutcomes({ decision: "ALLOW" }, "ALLOW");
    // @ts-expect-error undefined is rejected as an argument
    joinAuthorizationOutcomes(undefined, "ALLOW");
    // @ts-expect-error the result is the outcome union, not a decision object
    const asDecision: { decision: "ALLOW" } = joinAuthorizationOutcomes(
      "ALLOW",
      "ALLOW",
    );

    void allow;
    void ask;
    void deny;
    void joined;
    void joinedLiteral;
    void unsupported;
    void sandbox;
    void lowercase;
    void decision;
    void asDecision;
  }
});
