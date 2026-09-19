import assert from "node:assert/strict";
import { test } from "node:test";

import { applySealedEdits, buildShellPlan, resolveLogicalPath } from "../src/policy/shell-plan.ts";

function planOf(command: string) {
  const result = buildShellPlan(command);
  assert.equal(result.ok, true, `expected ${JSON.stringify(command)} to plan (${JSON.stringify(result)})`);
  if (!result.ok) throw new Error("unreachable");
  return result.plan;
}

function refusedOf(command: string) {
  const result = buildShellPlan(command);
  assert.equal(result.ok, false, `expected ${JSON.stringify(command)} to be refused`);
  if (result.ok) throw new Error("unreachable");
  return result;
}

test("static operands are collected without treating flags as paths", () => {
  const plan = planOf("cat data/state.txt notes.txt --color=never -v");
  assert.deepEqual(
    plan.operands.map((operand) => `${operand.kind}:${operand.logicalPath}`),
    ["read:data/state.txt", "read:notes.txt"],
  );
  assert.equal(plan.risk, "ordinary");
});

test("redirection targets are write operands and devices are skipped", () => {
  const plan = planOf("node build.js > dist/out.txt 2> err.log < input.txt 2>&1");
  assert.deepEqual(
    plan.operands.map((operand) => `${operand.kind}:${operand.logicalPath}`).sort(),
    ["read:build.js", "read:input.txt", "write:dist/out.txt", "write:err.log"],
  );
  const devices = planOf("ls > /dev/null 2>/dev/null");
  assert.deepEqual(devices.operands, []);
});

test("cd is tracked for later operands and does not escape the projection", () => {
  const plan = planOf("cd src && cat main.js");
  assert.deepEqual(
    plan.operands.map((operand) => operand.logicalPath),
    ["src/main.js"],
  );
  const escaping = planOf("cd ../../.. && cat x");
  assert.ok(escaping.refusals.some((refusal) => refusal.code === "SHELL_EXTERNAL_PATH"));
});

test("subshell groups do not leak their cwd to later commands", () => {
  const plan = planOf("(cd src; cat a.js); cat b.js");
  assert.deepEqual(
    plan.operands.map((operand) => operand.logicalPath),
    ["src/a.js", "b.js"],
  );
});

test("external, absolute and dynamic operands are refused, not approximated", () => {
  assert.ok(planOf("cat ../outside.txt").refusals.some((refusal) => refusal.code === "SHELL_EXTERNAL_PATH"));
  assert.ok(planOf("cat /etc/passwd").refusals.some((refusal) => refusal.code === "SHELL_EXTERNAL_PATH"));
  assert.ok(planOf("echo x > /tmp/x").refusals.some((refusal) => refusal.code === "SHELL_EXTERNAL_PATH"));
  assert.equal(refusedOf("echo $HOME").code, "SHELL_UNSUPPORTED_EXPANSION");
  assert.ok(planOf("bash -s").refusals.some((refusal) => refusal.code === "SHELL_DYNAMIC_SOURCE"));
  assert.ok(planOf("bash").refusals.some((refusal) => refusal.code === "SHELL_DYNAMIC_SOURCE"));
});

test("nested shell strings are recursively classified with a depth limit", () => {
  const nested = planOf("bash -c 'curl https://example.com'");
  assert.equal(nested.risk, "network", "risk must come from the nested string");
  assert.equal(planOf("bash -c \"bash -c 'ls'\"").risk, "ordinary");

  // Build nested `bash -c "..."` strings to the supported depth by escaping
  // each level for the double-quoted context it is embedded in.
  const escape = (value: string): string => value.split("\\").join("\\\\").split('"').join('\\"');
  const wrap = (inner: string): string => `bash -c "${escape(inner)}"`;
  let withinLimit = "ls";
  for (let index = 0; index < 6; index += 1) withinLimit = wrap(withinLimit);
  const accepted = buildShellPlan(withinLimit);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) throw new Error("unreachable");
  assert.deepEqual(accepted.plan.refusals, [], "supported depth must be accepted");

  let beyondLimit = "ls";
  for (let index = 0; index < 9; index += 1) beyondLimit = wrap(beyondLimit);
  assert.ok(beyondLimit.length < 8192, `fixture must stay inside the input limit (${beyondLimit.length})`);
  const refused = buildShellPlan(beyondLimit);
  assert.equal(refused.ok, true);
  if (!refused.ok) throw new Error("unreachable");
  assert.ok(
    refused.plan.refusals.some((refusal) => refusal.code === "SHELL_PLAN_LIMIT"),
    "recursion beyond the supported depth must be refused",
  );
});

test("script and sourced inputs become sealed requests with rewrite spans", () => {
  const source = planOf("source scripts/build.sh && ls");
  assert.deepEqual(source.sealed.map((entry) => entry.logicalPath), ["scripts/build.sh"]);
  assert.equal(source.sealedEdits.length, 1);
  assert.equal(source.sealedEdits[0].sealedIndex, 0);

  const script = planOf("bash scripts/build.sh arg1");
  assert.deepEqual(script.sealed.map((entry) => entry.logicalPath), ["scripts/build.sh"]);

  const rewritten = applySealedEdits(
    "source scripts/build.sh && ls",
    source.sealedEdits,
    ["'/private/sealed/abc-0.sh'"],
  );
  assert.equal(rewritten, "source '/private/sealed/abc-0.sh' && ls");

  // Sealed inputs inside a nested string are refused rather than rewritten.
  const nestedSource = planOf("bash -c 'source inner.sh'");
  assert.ok(nestedSource.refusals.some((refusal) => refusal.code === "SHELL_DYNAMIC_SOURCE"));

  // External and dynamic script sources are refused.
  assert.ok(planOf("source /etc/profile").refusals.some((refusal) => refusal.code === "SHELL_EXTERNAL_PATH"));
  assert.ok(planOf("source ../x.sh").refusals.some((refusal) => refusal.code === "SHELL_EXTERNAL_PATH"));
  assert.equal(refusedOf("source $(echo x)").code, "SHELL_UNSUPPORTED_EXPANSION");
});

test("command risk classes are derived from the fixed tables", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["npm run check", "ordinary"],
    ["ls -la", "ordinary"],
    ["rm -rf dist", "destructive"],
    ["mv a b", "destructive"],
    ["curl https://example.com", "network"],
    ["ssh host", "network"],
    ["git status", "ordinary"],
    ["sudo id", "privilege"],
    ["launchctl list", "system"],
    ["security find-generic-password", "credential"],
    ["gh pr create", "publish"],
    ["docker push image", "publish"],
    ["npm publish", "publish"],
    ["npm install", "network"],
    ["npm run check", "ordinary"],
    ["git push origin main", "publish"],
    ["git clone https://example.com/x", "network"],
    ["npm token list", "credential"],
    ["eval 'ls'", "unsupported-builtin"],
    ["/usr/bin/nc -z host 80", "network"],
    ["./scripts/run.sh", "unsupported-builtin"],
    ["scripts/run.sh", "unsupported-builtin"],
    ["build.sh", "unsupported-builtin"],
    ["some-unknown-tool --flag", "unknown"],
  ];
  for (const [command, risk] of cases) {
    assert.equal(planOf(command).risk, risk, `command ${JSON.stringify(command)}`);
  }
});

test("the strictest class in a pipeline or list wins", () => {
  assert.equal(planOf("ls | curl https://example.com").risk, "network");
  assert.equal(planOf("ls && sudo id").risk, "privilege");
  assert.equal(planOf("cat a.txt; unknown-tool").risk, "unknown");
  assert.equal(
    planOf("ls").risk,
    "ordinary",
    "a plain command must stay ordinary so the ordinary workflow does not need approval",
  );
});

test("wrappers are unwrapped so the real command is classified", () => {
  assert.equal(planOf("env FOO=bar curl https://example.com").risk, "network");
  assert.equal(planOf("command rm -rf x").risk, "destructive");
  // A wrapper with nothing left to run is not an ordinary tool: `env` and
  // `command` are command runners, so an unresolved spelling needs approval.
  assert.equal(planOf("env").risk, "unknown");
});

test("wrapper flags cannot downgrade a denied command class", () => {
  // Regression: 'env -S'/'command -p' previously dropped the wrapped command
  // line, so a network command classified as ordinary.
  const splitString = planOf("env -S 'curl https://example.com'");
  assert.ok(splitString.refusals.some((refusal) => refusal.code === "SHELL_UNSUPPORTED_COMMAND_FORM"));
  assert.equal(planOf("command -p curl https://example.com").risk, "network");
  assert.equal(planOf("env -i curl https://x").risk, "network");
  assert.equal(planOf("env --unset FOO ssh host").risk, "network");
  assert.equal(planOf("env -u FOO SSH_AUTH_SOCK= ssh host").risk, "network");
  assert.equal(planOf("command -v ls").risk, "unknown", "a query flag executes nothing, so it is not a runner with a wrapped command");
  const unknownFlag = planOf("env --frobnicate curl https://x");
  assert.ok(unknownFlag.refusals.some((refusal) => refusal.code === "SHELL_UNSUPPORTED_COMMAND_FORM"));
});

test("command runners require approval rather than passing as ordinary", () => {
  assert.equal(planOf("xargs -a list.txt sh").risk, "unknown");
  assert.equal(planOf("npx yarn publish").risk, "unknown");
  assert.equal(planOf("find . -exec sh -c 'curl https://x' ;").risk, "unknown");
  assert.equal(planOf("find . -delete").risk, "destructive");
  assert.equal(planOf("find . -name '*.ts'").risk, "ordinary", "a plain search stays ordinary");
});

test("wrapper nesting beyond the supported depth refuses instead of downgrading", () => {
  // Regression: the unwrap guard used to fall back to the wrapper word itself,
  // so 'env env env env env curl ...' classified as ordinary.
  const deep = planOf("env env env env env curl https://example.com");
  assert.equal(deep.risk, "network");
  assert.equal(planOf("env env sudo id").risk, "privilege");
  assert.equal(planOf("command command command rm -rf x").risk, "destructive");

  const overLimit = planOf(`${"env ".repeat(24)}ls`);
  assert.ok(
    overLimit.refusals.some((refusal) => refusal.code === "SHELL_UNSUPPORTED_COMMAND_FORM"),
    "exhausting the wrapper budget must refuse",
  );
});

test("command runners and dispatcher flags cannot hide a denied command", () => {
  // 'timeout' executes its remaining arguments.
  assert.equal(planOf("timeout 10 sudo id").risk, "privilege");
  assert.equal(planOf("timeout 10s curl https://example.com").risk, "network");
  assert.equal(planOf("env timeout 10 curl https://example.com").risk, "network");
  assert.equal(planOf("timeout -s KILL 5 security find-generic-password").risk, "credential");
  assert.ok(
    planOf("timeout sudo id").refusals.some((refusal) => refusal.code === "SHELL_UNSUPPORTED_COMMAND_FORM"),
    "a missing duration must refuse instead of classifying the runner",
  );

  // A dispatcher flag whose value is unknown could hide the subcommand.
  assert.equal(planOf("git -c x=y push").risk, "publish");
  assert.equal(planOf("git -c x=y status").risk, "ordinary");
  assert.equal(planOf("git --no-pager status").risk, "ordinary");
  assert.equal(planOf("npm --prefix ./x install").risk, "network");
  assert.equal(planOf("npm --silent run check").risk, "ordinary");
  assert.ok(
    planOf("git --unknown-flag push").refusals.some((refusal) => refusal.code === "SHELL_UNSUPPORTED_COMMAND_FORM"),
    "an unrecognized dispatcher flag before the subcommand must refuse",
  );

  // 'env -' ends option parsing, exactly like '--'.
  assert.equal(planOf("env - curl https://example.com").risk, "network");
  assert.equal(planOf("env -i - curl https://example.com").risk, "network");
});

test("a wrapped dispatcher keeps its own subcommand classification", () => {
  // Regression: the timeout unwrap re-sliced with a stale index, so the
  // wrapped command's arguments were dropped and `git push` classified
  // ordinary.
  assert.equal(planOf("timeout 10 git push").risk, "publish");
  assert.equal(planOf("timeout 10 npm publish").risk, "publish");
  assert.equal(planOf("timeout 10 env curl https://example.com").risk, "network");
  assert.equal(planOf("timeout 10 sh -c 'curl https://example.com'").risk, "network");
  assert.equal(planOf("timeout 10 bash -c 'sudo id'").risk, "privilege");
  assert.equal(planOf("timeout 10 command curl https://example.com").risk, "network");
  assert.equal(planOf("gtimeout 5 git push").risk, "publish");
  assert.equal(planOf("timeout 10 gtimeout 10 curl https://example.com").risk, "network");
  assert.equal(planOf("timeout 10 docker push image").risk, "publish");
  assert.equal(planOf("timeout 10 npm run check").risk, "ordinary");
});

test("assignments after -- are still assignments for env", () => {
  assert.equal(planOf("env -- FOO=1 curl https://example.com").risk, "network");
  assert.equal(planOf("env FOO=1 curl https://example.com").risk, "network");
  assert.equal(planOf("command FOO=1 curl https://example.com").risk, "network");
});

test("dispatcher aliases, unlisted subcommands and path forms do not downgrade", () => {
  // npm dereferences aliases and prefixes; the table models them explicitly.
  assert.equal(planOf("npm x curl https://example.com").risk, "unknown");
  assert.equal(planOf("npm up pkg").risk, "network");
  assert.equal(planOf("npm pub pkg").risk, "publish");
  assert.equal(planOf("npm tok create").risk, "credential");
  assert.equal(planOf("npm view lodash").risk, "network");
  // git's unlisted network subcommands are listed; an unlisted one refuses.
  assert.equal(planOf("git daemon").risk, "network");
  assert.equal(planOf("git svn clone https://example.com/x").risk, "network");
  assert.equal(planOf("git clean -fdx").risk, "destructive");
  assert.equal(planOf("git status").risk, "ordinary");
  for (const command of ["git frobnicate", "npm frobnicate"]) {
    assert.ok(
      planOf(command).refusals.some((refusal) => refusal.code === "SHELL_UNSUPPORTED_COMMAND_FORM"),
      `${command} must refuse rather than take the dispatcher's ordinary base class`,
    );
  }
  // A wrapper reached by a relative path is a workspace object executed by
  // path, not a wrapper.
  assert.equal(planOf("./env ls").risk, "unsupported-builtin");
  assert.equal(planOf("sub/env ls").risk, "unsupported-builtin");
  assert.equal(planOf("/usr/bin/env curl https://example.com").risk, "network", "a system-path wrapper is still unwrapped");
});

test("wrapper spellings and case cannot hide the wrapped command", () => {
  // Regression: only the literal bare name or a literal /usr/bin/ spelling was
  // unwrapped, so other kernel-resolvable spellings fell through to the
  // wrapper's own (ordinary) class.
  for (const command of [
    "//usr/bin/env curl https://example.com",
    "/usr//bin/env curl https://example.com",
    "/usr/./bin/env curl https://example.com",
    "ENV FOO=1 curl https://example.com",
    "env curl https://example.com",
  ]) {
    assert.equal(planOf(command).risk, "network", command);
  }
  assert.equal(planOf("//usr/bin/timeout 10 git push").risk, "publish");
  assert.equal(planOf("//usr/bin/env bash -c 'curl https://example.com'").risk, "network");
});

test("network-reaching dispatcher forms are classified, not waved through", () => {
  assert.equal(planOf("npm pack lodash").risk, "network");
  assert.equal(planOf("npm link lodash").risk, "network");
  assert.equal(planOf("git remote update").risk, "network");
  assert.equal(planOf("git remote add -f origin https://example.com").risk, "network");
  assert.equal(planOf("git archive --remote=https://example.com HEAD").risk, "network");
  assert.equal(planOf("git remote add origin https://example.com").risk, "ordinary");
  assert.equal(planOf("git remote -v").risk, "ordinary");
  assert.equal(planOf("git add -f file.txt").risk, "ordinary", "a local -f must not become a network class");
});

test("case-shifted and path-spelled wrappers cannot hide the wrapped command", () => {
  // The declared target's filesystem is case-insensitive, so a case-shifted
  // directory component resolves to the same wrapper.
  assert.equal(planOf("//USR//bin/env curl https://example.com").risk, "network");
  assert.equal(planOf("/USR/bin/env curl https://example.com").risk, "network");
  assert.equal(planOf("/usr/BIN/env curl https://example.com").risk, "network");
  assert.equal(planOf("//USR//BIN/timeout 10 git push").risk, "publish");
  // A wrapper reached by a non-system path is a runner by path, not an
  // ordinary tool, and needs approval.
  assert.equal(planOf("/opt/homebrew/bin/env curl https://example.com").risk, "unknown");
  assert.equal(planOf("/usr/local/bin/env curl https://example.com").risk, "unknown");
});

test("dispatcher value flags cannot hide the subcommand verb", () => {
  // Regression: the second-word walk filtered dash args independently, so the
  // value of a preceding flag became the subcommand word.
  assert.equal(planOf("git -c x=y remote update").risk, "network");
  assert.equal(planOf("git -C dir remote add -f origin https://example.com").risk, "network");
  assert.equal(planOf("git remote show origin").risk, "network");
  assert.equal(planOf("git remote -v").risk, "ordinary");
  assert.equal(planOf("git remote add origin https://example.com").risk, "ordinary");
  assert.equal(planOf("git -c x=y push").risk, "publish");
});

test("unknown inline dispatcher flags refuse instead of being skipped", () => {
  const unknownInline = planOf("git --frobnicate=x status");
  assert.ok(
    unknownInline.refusals.some((refusal) => refusal.code === "SHELL_UNSUPPORTED_COMMAND_FORM"),
    "an unrecognized --flag=value before the subcommand must refuse",
  );
  // Recognized value and boolean flags, inline or not, still walk correctly.
  assert.equal(planOf("npm --prefix=./x install").risk, "network");
  assert.equal(planOf("npm --registry=https://registry.example install").risk, "network");
  assert.equal(planOf("git --git-dir=/x status").risk, "ordinary");
  assert.equal(planOf("git --no-pager status").risk, "ordinary");
  assert.equal(planOf("git -c x=y push").risk, "publish");
});

test("comments and blank lines separate commands instead of refusing them", () => {
  assert.equal(planOf("# leading comment\necho hi").risk, "ordinary");
  assert.equal(planOf("echo a\n\n\necho b").risk, "ordinary");
  assert.equal(planOf("echo a\n# mid comment\necho b").risk, "ordinary");
  assert.equal(planOf("echo a &&\n echo b").risk, "ordinary");
  // A command with nothing to run is refused, not treated as an empty plan.
  assert.equal(refusedOf("# only a comment").code, "SHELL_UNSUPPORTED_SYNTAX");
});

test("the plan terminates on every single-quoted input", () => {
  for (const command of ["echo 'a\nb'", "'\n'", "cat 'x\n\ny'", "source 'a\nb.sh'"]) {
    const result = buildShellPlan(command);
    assert.equal(typeof result.ok, "boolean", `planning ${JSON.stringify(command)} must terminate`);
  }
});

test("logical path resolution is lexical and confined", () => {
  assert.deepEqual(resolveLogicalPath("", "a/b"), { kind: "ok", path: "a/b" });
  assert.deepEqual(resolveLogicalPath("a", "./b"), { kind: "ok", path: "a/b" });
  assert.deepEqual(resolveLogicalPath("a/b", "../c"), { kind: "ok", path: "a/c" });
  assert.deepEqual(resolveLogicalPath("", "."), { kind: "ok", path: "" });
  assert.equal(resolveLogicalPath("", "../x").kind, "external");
  assert.equal(resolveLogicalPath("a", "../../x").kind, "external");
  assert.equal(resolveLogicalPath("", "/etc").kind, "external");
});

test("the plan is deterministic and describes the exact command", () => {
  const first = planOf("cd src && ls -l | head -3");
  const second = planOf("cd src && ls -l | head -3");
  assert.deepEqual(first, second);
  assert.equal(first.command, "cd src && ls -l | head -3");
});
