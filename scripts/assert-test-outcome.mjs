#!/usr/bin/env node
/**
 * Asserts the declared test outcome for one platform against the TAP summary of
 * a captured `npm run check` log.
 *
 * The suite prints pass/fail/skip counts, but nothing compares them with a
 * declaration, so a new skip condition, a collected-count change, or a masked
 * failure could still look green. The declaration is exact rather than a floor:
 * a floor would let a test silently disappear as long as another one replaced it.
 *
 * The script fails closed: a missing or incomplete summary, an undeclared
 * platform, a budget that is not declared as integers, or any count outside the
 * declaration refuses the run.
 *
 * Coupling: the summary shape (`# tests|pass|fail|skipped|todo|cancelled`) is
 * Node's TAP reporter, which the pinned CI Node (22.19.0) selects for a piped,
 * non-TTY stdout. A different reporter shape (for example Node 23+ locally
 * printing `ℹ` lines) refuses the run instead of guessing.
 *
 * Usage:
 *   node scripts/assert-test-outcome.mjs <log> <budget.json> <platform>
 *
 * The budget file maps a platform key to `{ tests, fail, skipped }`:
 *   tests    the exact number of tests the platform must collect
 *   fail     the only tolerated number of failing tests (0 in practice)
 *   skipped  the exact number of tests the declared platform conditions skip
 */

import { readFileSync } from "node:fs";

const USAGE = "usage: assert-test-outcome.mjs <log> <budget.json> <platform>";
const SUMMARY_FIELDS = ["tests", "pass", "fail", "skipped", "todo", "cancelled"];
const DECLARED_FIELDS = ["tests", "fail", "skipped"];

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
for (const field of SUMMARY_FIELDS) observed[field] = lastSummaryValue(log, field);
const missing = SUMMARY_FIELDS.filter((field) => observed[field] === null);
if (missing.length > 0) refuse(`the log carries no complete TAP summary (missing ${missing.join(", ")})`);

const described = SUMMARY_FIELDS.map((field) => `${field} ${observed[field]}`).join(", ");
const classified = observed.pass + observed.fail + observed.skipped + observed.todo + observed.cancelled;
if (classified !== observed.tests) {
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
if (observed.tests !== declared.tests) {
  refuse(
    `expected ${declared.tests} collected test(s) on ${platform}, observed ${observed.tests}: ${described}; ` +
      "a changed test set needs an explicit budget update and review",
  );
}

process.stdout.write(
  `pi-warden CI count assertion passed for ${platform}: ${described} ` +
    `(declared tests ${declared.tests}, fail ${declared.fail}, skipped ${declared.skipped})\n`,
);
