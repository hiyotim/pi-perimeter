#!/usr/bin/env node
/**
 * Asserts the declared test outcome for one platform against the TAP summary
 * of a captured `npm run check` log.
 *
 * The suite prints pass/fail/skip counts, but nothing compares them with a
 * declaration, so a new skip condition, a whole test file that stopped being
 * collected, or a masked failure could still look green. This script fails
 * closed: a missing or incomplete summary, an undeclared platform, a budget
 * that is not declared as integers, or any count outside the declared budget
 * refuses the run.
 *
 * Usage:
 *   node scripts/assert-test-outcome.mjs <log> <budget.json> <platform>
 *
 * The budget file maps a platform key to `{ minTests, fail, skipped }`:
 *   minTests  the fewest collected tests that may pass the assertion
 *   fail      the only tolerated number of failing tests (0 in practice)
 *   skipped   the exact number of tests the declared platform conditions skip
 */

import { readFileSync } from "node:fs";

const USAGE = "usage: assert-test-outcome.mjs <log> <budget.json> <platform>";
const FIELDS = ["tests", "pass", "fail", "skipped"];
const DECLARED_FIELDS = ["minTests", "fail", "skipped"];

function refuse(message) {
  process.stderr.write(`pi-warden CI count assertion refused: ${message}\n`);
  process.exit(1);
}

/** Returns the last TAP summary value for a field, or null when absent. */
function lastSummaryValue(log, field) {
  const pattern = new RegExp(`^#\\s+${field}\\s+(\\d+)\\s*$`, "gm");
  let value = null;
  for (const match of log.matchAll(pattern)) value = Number(match[1]);
  return value;
}

const [logPath, budgetPath, platform] = process.argv.slice(2);
if (!logPath || !budgetPath || !platform) refuse(USAGE);

let log;
try {
  log = readFileSync(logPath, "utf8");
} catch (error) {
  refuse(`cannot read the captured log ${logPath}: ${error.message}`);
}

let budget;
try {
  budget = JSON.parse(readFileSync(budgetPath, "utf8"));
} catch (error) {
  refuse(`cannot read the declared budget ${budgetPath}: ${error.message}`);
}

const declared = budget?.[platform];
if (declared === undefined) refuse(`no declared budget for platform ${platform}`);
for (const field of DECLARED_FIELDS) {
  if (!Number.isInteger(declared[field])) refuse(`the budget for ${platform} must declare an integer ${field}`);
}

const observed = {};
for (const field of FIELDS) observed[field] = lastSummaryValue(log, field);
const missing = FIELDS.filter((field) => observed[field] === null);
if (missing.length > 0) refuse(`the log carries no complete TAP summary (missing ${missing.join(", ")})`);

const described = FIELDS.map((field) => `${field} ${observed[field]}`).join(", ");
if (observed.pass + observed.fail + observed.skipped !== observed.tests) {
  refuse(`the TAP summary is internally inconsistent: ${described}`);
}
if (observed.fail !== declared.fail) {
  refuse(`expected ${declared.fail} failing test(s), observed ${observed.fail}: ${described}`);
}
if (observed.skipped !== declared.skipped) {
  refuse(
    `expected ${declared.skipped} skipped test(s) on ${platform}, observed ${observed.skipped}: ${described}; ` +
      "a changed skip set needs an explicit budget update and review",
  );
}
if (observed.tests < declared.minTests) {
  refuse(`expected at least ${declared.minTests} collected test(s), observed ${observed.tests}: ${described}`);
}

process.stdout.write(
  `pi-warden CI count assertion passed for ${platform}: ${described} ` +
    `(declared minTests ${declared.minTests}, fail ${declared.fail}, skipped ${declared.skipped})\n`,
);
