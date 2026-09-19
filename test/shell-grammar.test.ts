import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseShellCommand,
  serializeShellProgram,
  SHELL_PARSE_LIMITS,
} from "../src/policy/shell-grammar.ts";

function ok(command: string) {
  const result = parseShellCommand(command);
  assert.equal(result.ok, true, `expected ${JSON.stringify(command)} to parse (${JSON.stringify(result)})`);
  if (!result.ok) throw new Error("unreachable");
  return result.program;
}

function refused(command: string) {
  const result = parseShellCommand(command);
  assert.equal(result.ok, false, `expected ${JSON.stringify(command)} to be refused`);
  if (result.ok) throw new Error("unreachable");
  return result;
}

test("supported grammar parses into an exact structure", () => {
  const program = ok("npm run check");
  assert.equal(program.items.length, 1);
  const command = program.items[0].pipeline.commands[0];
  assert.equal(command.kind, "simple");
  if (command.kind !== "simple") throw new Error("unreachable");
  assert.deepEqual(
    command.words.map((word) => word.text),
    ["npm", "run", "check"],
  );
  assert.equal(command.words[0].quoted, false);
});

test("quotes, escapes and comments are represented exactly", () => {
  const program = ok(`echo 'a b' "c d" e\\ f # trailing comment`);
  const command = program.items[0].pipeline.commands[0];
  if (command.kind !== "simple") throw new Error("unreachable");
  assert.deepEqual(
    command.words.map((word) => [word.text, word.quoted]),
    [
      ["echo", false],
      ["a b", true],
      ["c d", true],
      ["e f", true],
    ],
  );
});

test("pipelines, lists, subshell groups and redirections are structured", () => {
  const program = ok("cd src && (ls -l | head -3; wc -l < in.txt)");
  assert.equal(program.items.length, 2);
  assert.equal(program.items[0].separator, "&&");
  assert.equal(program.items[1].separator, null);
  assert.equal(program.items[0].pipeline.commands[0].kind, "simple");
  const group = program.items[1].pipeline.commands[0];
  assert.equal(group.kind, "group");
  if (group.kind !== "group") throw new Error("unreachable");
  assert.equal(group.program.items.length, 2);
  assert.equal(group.program.items[0].pipeline.commands.length, 2, "pipeline in the group");
  const readRedirect = group.program.items[1].pipeline.commands[0];
  if (readRedirect.kind !== "simple") throw new Error("unreachable");
  assert.deepEqual(
    readRedirect.redirections.map((redirection) =>
      redirection.kind === "file" ? `file:${redirection.fd}:${redirection.mode}:${redirection.target.text}` : "dup",
    ),
    ["file:0:read:in.txt"],
  );
  const redirectRun = parseShellCommand("echo hi > out.txt 2>&1");
  assert.equal(redirectRun.ok, true);
  if (!redirectRun.ok) throw new Error("unreachable");
  const redirectCommand = redirectRun.program.items[0].pipeline.commands[0];
  if (redirectCommand.kind !== "simple") throw new Error("unreachable");
  assert.deepEqual(
    redirectCommand.redirections.map((redirection) =>
      redirection.kind === "file"
        ? `file:${redirection.fd}:${redirection.mode}:${redirection.target.text}`
        : `dup:${redirection.fd}>${redirection.from}`,
    ),
    ["file:1:write:out.txt", "dup:2>1"],
  );
});

test("assignments and the test command brackets are supported", () => {
  const program = ok("FOO=bar export BAZ=1; [ -f x ] && echo yes");
  const assignment = program.items[0].pipeline.commands[0];
  if (assignment.kind !== "simple") throw new Error("unreachable");
  assert.deepEqual(assignment.assignments, [{ name: "FOO", value: "bar" }]);
  assert.deepEqual(
    assignment.words.map((word) => word.text),
    ["export", "BAZ=1"],
  );
  const testCommand = program.items[1].pipeline.commands[0];
  if (testCommand.kind !== "simple") throw new Error("unreachable");
  assert.deepEqual(
    testCommand.words.map((word) => word.text),
    ["[", "-f", "x", "]"],
  );
});

test("unsupported constructs are refused with a specific code", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["echo $(id)", "SHELL_UNSUPPORTED_EXPANSION"],
    ["echo `id`", "SHELL_UNSUPPORTED_EXPANSION"],
    ["echo $HOME", "SHELL_UNSUPPORTED_EXPANSION"],
    ["echo ${HOME}", "SHELL_UNSUPPORTED_EXPANSION"],
    ["echo $((1+1))", "SHELL_UNSUPPORTED_EXPANSION"],
    ["ls *.ts", "SHELL_UNSUPPORTED_GLOB"],
    ["ls file?.txt", "SHELL_UNSUPPORTED_GLOB"],
    ["ls file[0-9]", "SHELL_UNSUPPORTED_GLOB"],
    ["ls ~/x", "SHELL_UNSUPPORTED_GLOB"],
    ["echo {a,b}", "SHELL_UNSUPPORTED_GLOB"],
    ["cat <<EOF", "SHELL_UNSUPPORTED_HEREDOC"],
    ["cat <<< word", "SHELL_UNSUPPORTED_HEREDOC"],
    ["sleep 1 &", "SHELL_UNSUPPORTED_BACKGROUND"],
    ["ls |& cat", "SHELL_UNSUPPORTED_BACKGROUND"],
    ["case x in x) ;; esac", "SHELL_UNSUPPORTED_SEPARATOR"],
    ["echo hi >", "SHELL_UNSUPPORTED_REDIRECTION"],
    ["echo hi 3> out", "SHELL_UNSUPPORTED_REDIRECTION"],
    ["echo hi 2>&3", "SHELL_UNSUPPORTED_REDIRECTION"],
    ["if true; then echo x; fi", "SHELL_UNSUPPORTED_KEYWORD"],
    ["for i in 1; do echo x; done", "SHELL_UNSUPPORTED_KEYWORD"],
    ["while true; do :; done", "SHELL_UNSUPPORTED_KEYWORD"],
    ["function f { :; }", "SHELL_UNSUPPORTED_GLOB"],
    ["( ls ) > out.txt", "SHELL_UNSUPPORTED_SYNTAX"],
    ["time ls", "SHELL_UNSUPPORTED_KEYWORD"],
    ["coproc ls", "SHELL_UNSUPPORTED_KEYWORD"],
    ["! ls", "SHELL_UNSUPPORTED_KEYWORD"],
    ["echo a\\", "SHELL_UNSUPPORTED_ESCAPE"],
    ['echo "a\\nb"', "SHELL_UNSUPPORTED_ESCAPE"],
    ['echo "a$b"', "SHELL_UNSUPPORTED_EXPANSION"],
    ["echo 'unterminated", "SHELL_UNSUPPORTED_SYNTAX"],
    ["echo (", "SHELL_UNSUPPORTED_SYNTAX"],
    ["ls |", "SHELL_UNSUPPORTED_SYNTAX"],
    ["", "SHELL_INPUT_EMPTY"],
    ["   ", "SHELL_INPUT_EMPTY"],
    ["echo hi\0", "SHELL_UNSUPPORTED_SYNTAX"],
  ];
  for (const [command, code] of cases) {
    const result = refused(command);
    assert.equal(result.code, code, `command ${JSON.stringify(command)} produced ${result.code}: ${result.detail}`);
  }
});

test("parse limits are enforced rather than approximated", () => {
  const long = `echo ${"a".repeat(SHELL_PARSE_LIMITS.maxInputChars)}`;
  assert.equal(refused(long).code, "SHELL_INPUT_TOO_LONG");

  const deep = `${"(".repeat(SHELL_PARSE_LIMITS.maxGroupDepth + 2)}ls${")".repeat(SHELL_PARSE_LIMITS.maxGroupDepth + 2)}`;
  assert.equal(refused(deep).code, "SHELL_DEPTH_LIMIT");

  const manyWords = `echo ${Array.from({ length: SHELL_PARSE_LIMITS.maxWordsPerCommand + 10 }, () => "x").join(" ")}`;
  assert.equal(refused(manyWords).code, "SHELL_WORD_LIMIT");

  const manyCommands = Array.from({ length: SHELL_PARSE_LIMITS.maxCommands + 10 }, () => "ls").join("; ");
  const code = refused(manyCommands).code;
  assert.ok(
    code === "SHELL_COMMAND_LIMIT" || code === "SHELL_TOKEN_LIMIT",
    `expected a command/token limit refusal, got ${code}`,
  );

  assert.equal(refused("x".repeat(SHELL_PARSE_LIMITS.maxInputChars + 1)).code, "SHELL_INPUT_TOO_LONG");
});

test("non-string input is refused", () => {
  for (const value of [undefined, null, 42, {}, [], Buffer.from("ls")]) {
    const result = parseShellCommand(value as unknown);
    assert.equal(result.ok, false);
  }
});

test("canonical serialization is stable and distinguishes shapes", () => {
  const program = ok("cd src && npm run check");
  const serialized = serializeShellProgram(program);
  assert.equal(typeof serialized, "string");
  assert.equal(serialized, serializeShellProgram(ok("cd src && npm run check")));
  assert.notEqual(serialized, serializeShellProgram(ok("cd src || npm run check")));
  assert.notEqual(serialized, serializeShellProgram(ok("cd srcs && npm run check")));
});

test("a newline inside single quotes is preserved and the parser terminates", () => {
  // Regression: the single-quote branch once failed to advance the offset and
  // spun forever on a newline, hanging the whole host before any policy check.
  const program = ok("echo 'a\nb'");
  const command = program.items[0].pipeline.commands[0];
  if (command.kind !== "simple") throw new Error("unreachable");
  assert.deepEqual(
    command.words.map((word) => word.text),
    ["echo", "a\nb"],
  );
  const quotedOnly = ok("'\n'");
  const word = quotedOnly.items[0].pipeline.commands[0];
  if (word.kind !== "simple") throw new Error("unreachable");
  assert.deepEqual(word.words.map((entry) => entry.text), ["\n"]);

  // A multi-line double-quoted string is refused, never hung on.
  assert.equal(refused('echo "a\nb"').code, "SHELL_UNSUPPORTED_SYNTAX");
});

test("word source spans cover the exact text, enabling sealed rewrites", () => {
  const text = "source scripts/build.sh";
  const program = ok(text);
  const command = program.items[0].pipeline.commands[0];
  if (command.kind !== "simple") throw new Error("unreachable");
  const target = command.words[1];
  assert.equal(text.slice(target.start, target.end), "scripts/build.sh");
});
