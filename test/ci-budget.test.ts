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
 * case and every refusal the script documents: a new skip, a failure, a shrunken
 * suite, a missing summary, an undeclared platform, and a malformed budget.
 */

const SCRIPT = path.resolve("scripts/assert-test-outcome.mjs");
const LINUX_BUDGET = { linux: { minTests: 356, fail: 0, skipped: 54 } };

function tapSummary(counts: { tests: number; pass: number; fail: number; skipped: number }): string {
  return [
    "TAP version 13",
    "# Subtest: an unrelated test file",
    "ok 1 - an unrelated test file",
    "# tests " + counts.tests,
    "# suites 0",
    "# pass " + counts.pass,
    "# fail " + counts.fail,
    "# cancelled 0",
    "# skipped " + counts.skipped,
    "# todo 0",
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
  const result = runAssertion(tapSummary({ tests: 366, pass: 312, fail: 0, skipped: 54 }), LINUX_BUDGET);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed for linux: tests 366, pass 312, fail 0, skipped 54/);
});

test("an extra skipped test refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 366, pass: 311, fail: 0, skipped: 55 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected 54 skipped test\(s\) on linux, observed 55/);
});

test("a skipped test that reappears without a budget update also refuses", () => {
  const result = runAssertion(tapSummary({ tests: 365, pass: 312, fail: 0, skipped: 53 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /observed 53/);
});

test("a failing test refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 366, pass: 311, fail: 1, skipped: 54 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected 0 failing test\(s\), observed 1/);
});

test("a suite that stopped being collected refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 200, pass: 146, fail: 0, skipped: 54 }), LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected at least 356 collected test\(s\), observed 200/);
});

test("a log without a complete TAP summary refuses the run", () => {
  const result = runAssertion("TAP version 13\nok 1 - one test\n", LINUX_BUDGET);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no complete TAP summary/);
});

test("an internally inconsistent TAP summary refuses the run", () => {
  const result = runAssertion(
    tapSummary({ tests: 366, pass: 312, fail: 0, skipped: 54 }).replace("# tests 366", "# tests 300"),
    LINUX_BUDGET,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /internally inconsistent/);
});

test("a platform without a declared budget refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 366, pass: 312, fail: 0, skipped: 54 }), LINUX_BUDGET, "darwin");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no declared budget for platform darwin/);
});

test("a budget that is not declared as integers refuses the run", () => {
  const result = runAssertion(tapSummary({ tests: 366, pass: 312, fail: 0, skipped: 54 }), {
    linux: { minTests: 356, fail: 0, skipped: "54" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must declare an integer skipped/);
});

test("missing arguments refuse the run", () => {
  const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: assert-test-outcome\.mjs/);
});
