import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

/**
 * Behavior of the hosted-CI count assertion (`scripts/assert-test-outcome.mjs`).
 *
 * The hosted check must fail closed when the observed test outcome deviates
 * from the declared budget, so these tests drive the real script through
 * synthetic logs in isolated temporary directories. They cover the tolerated
 * case and every refusal the script documents: a new skip, a skip that
 * disappeared, a failure, a collected set that shrank or grew, a missing or
 * unusable summary, an undeclared platform, and a malformed budget.
 */

const SCRIPT = path.resolve("scripts/assert-test-outcome.mjs");
const LINUX_BUDGET = { linux: { tests: 369, fail: 0, skipped: 54 } };

interface Counts {
  tests: number;
  pass: number;
  fail: number;
  skipped: number;
  todo?: number;
  cancelled?: number;
}

function tapSummary(counts: Counts): string {
  return [
    "TAP version 13",
    "# Subtest: an unrelated test file",
    "ok 1 - an unrelated test file",
    "# tests " + counts.tests,
    "# suites 0",
    "# pass " + counts.pass,
    "# fail " + counts.fail,
    "# cancelled " + (counts.cancelled ?? 0),
    "# skipped " + counts.skipped,
    "# todo " + (counts.todo ?? 0),
    "",
  ].join("\n");
}

function runAssertion(log: string, budget: unknown, platform = "linux") {
  const fixture = mkdtempSync(path.join(tmpdir(), "pi-warden-ci-count-"));
  const logPath = path.join(fixture, "check.log");
  const budgetPath = path.join(fixture, "budget.json");
  writeFileSync(logPath, log);
  writeFileSync(budgetPath, JSON.stringify(budget));
  const result = spawnSync(process.execPath, [SCRIPT, logPath, budgetPath, platform], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("a summary inside the declared budget passes and prints the observed counts", () => {
  const result = runAssertion(tapSummary({ tests: 369, pass: 315, fail: 0, skipped: 54 }), LINUX_BUDGET);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed for linux: tests 369, pass 315, fail 0, skipped 54/);
});

test("todo and cancelled tests are counted in the summary arithmetic", () => {
  const result = runAssertion(
    tapSummary({ tests: 369, pass: 313, fail: 0, skipped: 54, todo: 1, cancelled: 1 }),
    LINUX_BUDGET,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /internally inconsistent/);
  assert.match(result.stdout, /todo 1, cancelled 1/);
});

test("an extra skipped test refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 369, pass: 314, fail: 0, skipped: 55 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected 54 skipped test\(s\) on linux, observed 55/);
});

test("a skipped test that reappears without a budget update also refuses", () => {
  const result = runAssertion(tapSummary({ tests: 369, pass: 316, fail: 0, skipped: 53 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /observed 53/);
});

test("a failing test refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 369, pass: 314, fail: 1, skipped: 54 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected 0 failing test\(s\), observed 1/);
});

test("a suite that stopped being collected refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 200, pass: 146, fail: 0, skipped: 54 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected 369 collected test\(s\) on linux, observed 200/);
});

test("a collected set that grew without a budget update also refuses", () => {
  const result = runAssertion(tapSummary({ tests: 370, pass: 316, fail: 0, skipped: 54 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /observed 370/);
});

test("a log without a complete TAP summary refuses the run", () => {
  const result = runAssertion("TAP version 13\nok 1 - one test\n", LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no complete TAP summary/);
});

test("an internally inconsistent TAP summary refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 300, pass: 315, fail: 0, skipped: 54 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /internally inconsistent/);
});

test("a platform without a declared budget refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 369, pass: 315, fail: 0, skipped: 54 }), LINUX_BUDGET, "darwin");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no declared budget for platform darwin/);
});

test("a budget that is not declared as integers refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 369, pass: 315, fail: 0, skipped: 54 }), {
    linux: { tests: 369, fail: 0, skipped: "54" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must declare an integer skipped/);
});

test("a malformed budget file refuses the run", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "pi-warden-ci-count-"));
  const logPath = path.join(fixture, "check.log");
  const budgetPath = path.join(fixture, "budget.json");
  writeFileSync(logPath, tapSummary({ tests: 369, pass: 315, fail: 0, skipped: 54 }));
  writeFileSync(budgetPath, "{ not json");
  const result = spawnSync(process.execPath, [SCRIPT, logPath, budgetPath, "linux"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot read the declared budget/);
});

test("an unreadable log refuses the run", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "pi-warden-ci-count-"));
  const budgetPath = path.join(fixture, "budget.json");
  writeFileSync(budgetPath, JSON.stringify(LINUX_BUDGET));
  const result = spawnSync(
    process.execPath,
    [SCRIPT, path.join(fixture, "missing.log"), budgetPath, "linux"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot read the captured log/);
});

test("missing arguments refuse the run", () => {
  const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: assert-test-outcome\.mjs/);
});
