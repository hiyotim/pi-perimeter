/**
 * Bounded shell grammar: lexer and recursive-descent parser for the supported
 * entry-command subset of [docs/SHELL-GATE.md].
 *
 * This module is pure. It performs no filesystem, process, policy, or Pi work,
 * and it is deliberately NOT a security boundary: the Seatbelt profile is.
 * Its job is to produce an exact structured form for classification, for the
 * approval binding, and for the static resource/rewrite plan, and to refuse
 * (never to approximate) anything it cannot represent exactly.
 *
 * Every supported construct has a fixed representation; every unsupported or
 * ambiguous construct produces a refusal with a specific code. The parser
 * never expands, executes, or interprets anything.
 */

export const SHELL_PARSE_LIMITS = Object.freeze({
  maxInputChars: 8192,
  maxTokens: 4096,
  maxCommands: 256,
  maxWordsPerCommand: 256,
  maxGroupDepth: 8,
  maxRedirectionsPerCommand: 32,
  maxAssignmentsPerCommand: 32,
});

export type ShellParseErrorCode =
  | "SHELL_INPUT_EMPTY"
  | "SHELL_INPUT_TOO_LONG"
  | "SHELL_TOKEN_LIMIT"
  | "SHELL_COMMAND_LIMIT"
  | "SHELL_WORD_LIMIT"
  | "SHELL_DEPTH_LIMIT"
  | "SHELL_UNSUPPORTED_EXPANSION"
  | "SHELL_UNSUPPORTED_GLOB"
  | "SHELL_UNSUPPORTED_HEREDOC"
  | "SHELL_UNSUPPORTED_BACKGROUND"
  | "SHELL_UNSUPPORTED_SEPARATOR"
  | "SHELL_UNSUPPORTED_REDIRECTION"
  | "SHELL_UNSUPPORTED_KEYWORD"
  | "SHELL_UNSUPPORTED_ESCAPE"
  | "SHELL_UNSUPPORTED_SYNTAX";

export interface ShellParseFailure {
  readonly ok: false;
  readonly code: ShellParseErrorCode;
  readonly detail: string;
  readonly offset: number;
}

export interface ShellWord {
  /** Exact value after quote removal. Never contains an expansion. */
  readonly text: string;
  /** True when any part of the word was quoted (never expanded, never globbed). */
  readonly quoted: boolean;
  /** Inclusive source span of the word in the parsed text, for token rewriting. */
  readonly start: number;
  /** Exclusive end of the source span. */
  readonly end: number;
}

export type ShellRedirection =
  | {
      readonly kind: "file";
      readonly fd: 0 | 1 | 2;
      readonly mode: "read" | "write" | "append";
      readonly target: ShellWord;
    }
  | { readonly kind: "dup"; readonly fd: 1 | 2; readonly from: 1 | 2 };

export interface ShellAssignment {
  readonly name: string;
  readonly value: string;
}

export interface ShellSimpleCommand {
  readonly kind: "simple";
  readonly assignments: readonly ShellAssignment[];
  readonly words: readonly ShellWord[];
  readonly redirections: readonly ShellRedirection[];
}

export interface ShellGroup {
  readonly kind: "group";
  readonly program: ShellProgram;
}

export type ShellCommandNode = ShellSimpleCommand | ShellGroup;

export type ShellListSeparator = ";" | "&&" | "||";

export interface ShellPipeline {
  readonly commands: readonly ShellCommandNode[];
}

export interface ShellListItem {
  readonly pipeline: ShellPipeline;
  readonly separator: ShellListSeparator | null;
}

export interface ShellProgram {
  readonly items: readonly ShellListItem[];
}

export type ShellParseResult =
  | { readonly ok: true; readonly program: ShellProgram }
  | ShellParseFailure;

/**
 * Reserved words that change the execution model beyond a simple command or a
 * subshell group. They are refused rather than interpreted.
 */
const RESERVED_WORDS = new Set([
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "for",
  "in",
  "do",
  "done",
  "while",
  "until",
  "case",
  "esac",
  "select",
  "function",
  "time",
  "coproc",
  "{",
  "}",
  "!",
  "[[",
  "]]",
]);

type Token =
  | { readonly kind: "word"; readonly word: ShellWord; readonly offset: number }
  | { readonly kind: "op"; readonly op: string; readonly offset: number }
  | { readonly kind: "redirect"; readonly redirection: ShellRedirection; readonly offset: number };

interface LexerState {
  readonly input: string;
  offset: number;
  tokenCount: number;
}

function fail(
  code: ShellParseErrorCode,
  detail: string,
  offset: number,
): ShellParseFailure {
  return { ok: false, code, detail, offset };
}

function isSpace(char: string): boolean {
  return char === " " || char === "\t";
}

/** Characters that always terminate an unquoted word. */
function isMetacharacter(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "|" ||
    char === "&" ||
    char === ";" ||
    char === "(" ||
    char === ")" ||
    char === "<" ||
    char === ">"
  );
}

const ASSIGNMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Characters rejected inside an unquoted word, with their refusal reason. */
function unsupportedWordCharacter(char: string): { code: ShellParseErrorCode; detail: string } | undefined {
  if (char === "$") {
    return { code: "SHELL_UNSUPPORTED_EXPANSION", detail: "parameter/command expansion is unsupported" };
  }
  if (char === "`") {
    return { code: "SHELL_UNSUPPORTED_EXPANSION", detail: "command substitution is unsupported" };
  }
  if (char === "*" || char === "?" || char === "[" || char === "]") {
    return { code: "SHELL_UNSUPPORTED_GLOB", detail: "globbing and pattern matching are unsupported" };
  }
  if (char === "~") {
    return { code: "SHELL_UNSUPPORTED_GLOB", detail: "tilde expansion is unsupported" };
  }
  if (char === "{" || char === "}") {
    return { code: "SHELL_UNSUPPORTED_GLOB", detail: "brace expansion is unsupported" };
  }
  if (char === "!") {
    return { code: "SHELL_UNSUPPORTED_KEYWORD", detail: "history expansion/negation is unsupported" };
  }
  return undefined;
}

function readQuoted(
  state: LexerState,
  quote: "'" | '"',
  startOffset: number,
): { value: string } | ShellParseFailure {
  const input = state.input;
  state.offset += 1;
  let value = "";
  for (;;) {
    if (state.offset >= input.length) {
      return fail("SHELL_UNSUPPORTED_SYNTAX", `unterminated ${quote} quote`, startOffset);
    }
    const char = input[state.offset];
    if (char === quote) {
      state.offset += 1;
      return { value };
    }
    if (quote === '"') {
      if (char === "$" || char === "`") {
        return fail(
          "SHELL_UNSUPPORTED_EXPANSION",
          "expansion inside double quotes is unsupported",
          state.offset,
        );
      }
      if (char === "\\") {
        const next = input[state.offset + 1];
        if (next === '"' || next === "\\") {
          value += next;
          state.offset += 2;
          continue;
        }
        return fail(
          "SHELL_UNSUPPORTED_ESCAPE",
          "only \\\" and \\\\ are supported inside double quotes",
          state.offset,
        );
      }
      if (char === "\n") {
        return fail("SHELL_UNSUPPORTED_SYNTAX", "multi-line double-quoted string is unsupported", state.offset);
      }
    }
    // A newline inside single quotes is part of the word (bash semantics) and
    // is preserved verbatim; every branch must advance the offset.
    value += char;
    state.offset += 1;
  }
}

/**
 * Reads one word. Returns undefined when the current position does not start a
 * word (the caller then handles the operator or whitespace).
 */
function readWord(state: LexerState): { word: ShellWord } | ShellParseFailure | undefined {
  const input = state.input;
  const start = state.offset;
  const char = input[start];
  if (char === undefined || isSpace(char) || char === "\n") return undefined;
  if (isMetacharacter(char)) return undefined;
  if (char === "#") return undefined;
  if (char === "[" || char === "]") {
    const next = input[start + 1];
    if (next === undefined || isSpace(next) || next === "\n" || isMetacharacter(next)) {
      state.offset += 1;
      return { word: Object.freeze({ text: char, quoted: false, start, end: state.offset }) };
    }
  }

  let text = "";
  let quoted = false;
  while (state.offset < input.length) {
    const current = input[state.offset];
    if (isSpace(current) || current === "\n" || isMetacharacter(current)) break;
    if (current === "'" || current === '"') {
      const quotedResult = readQuoted(state, current, state.offset);
      if ("code" in quotedResult) return quotedResult;
      text += quotedResult.value;
      quoted = true;
      continue;
    }
    if (current === "#") {
      // '#' continues a word only when it did not start one.
      text += current;
      state.offset += 1;
      continue;
    }
    if (current === "\\") {
      const next = input[state.offset + 1];
      if (next === undefined) {
        return fail("SHELL_UNSUPPORTED_ESCAPE", "trailing backslash", state.offset);
      }
      if (next === "\n") {
        return fail("SHELL_UNSUPPORTED_ESCAPE", "line continuation is unsupported", state.offset);
      }
      if (isMetacharacter(next) || next === "\\" || next === "'" || next === '"' || next === "#" || next === "$" || next === "`") {
        text += next;
        quoted = true;
        state.offset += 2;
        continue;
      }
      return fail(
        "SHELL_UNSUPPORTED_ESCAPE",
        `escaping ${JSON.stringify(next)} is unsupported outside quotes`,
        state.offset,
      );
    }
    const unsupported = unsupportedWordCharacter(current);
    if (unsupported !== undefined) {
      return fail(unsupported.code, unsupported.detail, state.offset);
    }
    text += current;
    state.offset += 1;
  }
  return { word: Object.freeze({ text, quoted, start, end: state.offset }) };
}

function readRedirection(
  state: LexerState,
): { redirection: ShellRedirection } | ShellParseFailure | undefined {
  const input = state.input;
  const start = state.offset;
  let fdStart = start;
  while (fdStart < input.length && input[fdStart] >= "0" && input[fdStart] <= "9") fdStart += 1;
  const digits = input.slice(start, fdStart);
  const operator = input[fdStart];

  // '&>' redirects both streams.
  if (digits === "" && operator === "&" && input[start + 1] === ">") {
    const target = readRedirectTarget(state, start + 2);
    if ("code" in target) return target;
    return { redirection: Object.freeze({ kind: "file", fd: 1, mode: "write", target: target.word }) };
  }
  if (operator !== ">" && operator !== "<") return undefined;
  if (digits !== "" && digits !== "0" && digits !== "1" && digits !== "2") {
    return fail("SHELL_UNSUPPORTED_REDIRECTION", `file descriptor ${digits} is unsupported`, start);
  }
  const fd: 0 | 1 | 2 = digits === "" || digits === "1" ? (operator === "<" ? 0 : 1) : (Number(digits) as 0 | 2);
  let cursor = fdStart + 1;
  let mode: "read" | "write" | "append";
  if (operator === "<") {
    if (input[cursor] === "<") {
      return fail(
        "SHELL_UNSUPPORTED_HEREDOC",
        input[cursor + 1] === "<" ? "here-strings are unsupported" : "here-documents are unsupported",
        start,
      );
    }
    if (input[cursor] === ">") {
      return fail("SHELL_UNSUPPORTED_REDIRECTION", "read-write redirection is unsupported", start);
    }
    mode = "read";
  } else {
    mode = input[cursor] === ">" ? "append" : "write";
    if (mode === "append") cursor += 1;
    if (input[cursor] === ">") {
      return fail("SHELL_UNSUPPORTED_REDIRECTION", "unsupported redirection operator", start);
    }
    if (input[cursor] === "&") {
      const target = input[cursor + 1];
      if (mode === "append" || (fd !== 1 && fd !== 2) || (target !== "1" && target !== "2")) {
        return fail("SHELL_UNSUPPORTED_REDIRECTION", "unsupported descriptor duplication", start);
      }
      if (fd === Number(target)) {
        return fail("SHELL_UNSUPPORTED_REDIRECTION", "self descriptor duplication is unsupported", start);
      }
      state.offset = cursor + 2;
      return {
        redirection: Object.freeze({ kind: "dup", fd, from: Number(target) as 1 | 2 }),
      };
    }
  }
  if (mode === "read" && fd !== 0) {
    return fail("SHELL_UNSUPPORTED_REDIRECTION", "input redirection is only supported for fd 0", start);
  }
  const target = readRedirectTarget(state, cursor);
  if ("code" in target) return target;
  return { redirection: Object.freeze({ kind: "file", fd, mode, target: target.word }) };
}

function readRedirectTarget(
  state: LexerState,
  offset: number,
): { word: ShellWord } | ShellParseFailure {
  state.offset = offset;
  while (state.offset < state.input.length && isSpace(state.input[state.offset])) state.offset += 1;
  const word = readWord(state);
  if (word === undefined) {
    return fail("SHELL_UNSUPPORTED_REDIRECTION", "redirection requires a literal target", offset);
  }
  if ("code" in word) return word;
  return word;
}

function nextToken(state: LexerState): Token | ShellParseFailure | undefined {
  const input = state.input;
  for (;;) {
    if (state.offset >= input.length) return undefined;
    const char = input[state.offset];
    if (isSpace(char)) {
      state.offset += 1;
      continue;
    }
    if (char === "#") {
      while (state.offset < input.length && input[state.offset] !== "\n") state.offset += 1;
      continue;
    }
    break;
  }
  const start = state.offset;
  state.tokenCount += 1;
  if (state.tokenCount > SHELL_PARSE_LIMITS.maxTokens) {
    return fail("SHELL_TOKEN_LIMIT", "command exceeds the token budget", start);
  }
  const char = input[start];
  if (char === "\n" || char === ";") {
    if (char === ";" && input[start + 1] === ";") {
      return fail("SHELL_UNSUPPORTED_SEPARATOR", "case/;; separators are unsupported", start);
    }
    state.offset += 1;
    return { kind: "op", op: ";", offset: start };
  }
  if (char === "&") {
    if (input[start + 1] === "&") {
      state.offset += 2;
      return { kind: "op", op: "&&", offset: start };
    }
    if (input[start + 1] === ">") {
      const redirection = readRedirection(state);
      return redirection === undefined || "code" in redirection
        ? fail("SHELL_UNSUPPORTED_SYNTAX", "invalid redirection", start)
        : { kind: "redirect", redirection: redirection.redirection, offset: start };
    }
    return fail("SHELL_UNSUPPORTED_BACKGROUND", "background execution is unsupported", start);
  }
  if (char === "|") {
    if (input[start + 1] === "|") {
      state.offset += 2;
      return { kind: "op", op: "||", offset: start };
    }
    if (input[start + 1] === "&") {
      return fail("SHELL_UNSUPPORTED_BACKGROUND", "|& is unsupported", start);
    }
    state.offset += 1;
    return { kind: "op", op: "|", offset: start };
  }
  if (char === "(" || char === ")") {
    state.offset += 1;
    return { kind: "op", op: char, offset: start };
  }
  if (char === "<" || char === ">" || (char >= "0" && char <= "9")) {
    const redirection = readRedirection(state);
    if (redirection !== undefined) {
      if ("code" in redirection) return redirection;
      return { kind: "redirect", redirection: redirection.redirection, offset: start };
    }
    if (char === "<" || char === ">") {
      return fail("SHELL_UNSUPPORTED_SYNTAX", "invalid redirection", start);
    }
  }
  const word = readWord(state);
  if (word === undefined) {
    return fail("SHELL_UNSUPPORTED_SYNTAX", `unexpected character ${JSON.stringify(char)}`, start);
  }
  if ("code" in word) return word;
  return { kind: "word", word: word.word, offset: start };
}

interface ParserState {
  readonly tokens: readonly Token[];
  index: number;
  commandCount: number;
}

function peek(state: ParserState): Token | undefined {
  return state.tokens[state.index];
}

function parseProgram(
  state: ParserState,
  depth: number,
): { program: ShellProgram } | ShellParseFailure {
  if (depth > SHELL_PARSE_LIMITS.maxGroupDepth) {
    return fail("SHELL_DEPTH_LIMIT", "group nesting exceeds the supported depth", state.index);
  }
  const items: ShellListItem[] = [];
  const isSeparator = (
    token: Token | undefined,
  ): token is { readonly kind: "op"; readonly op: string; readonly offset: number } =>
    token !== undefined && token.kind === "op" && token.op === ";";

  // Blank lines and comment lines produce separator runs before any command.
  while (isSeparator(peek(state))) state.index += 1;
  if (peek(state) === undefined || (peek(state) as Token).kind === "op" && (peek(state) as { op: string }).op === ")") {
    return fail("SHELL_UNSUPPORTED_SYNTAX", "empty command list is unsupported", state.index);
  }

  for (;;) {
    const pipeline = parsePipeline(state, depth);
    if ("ok" in pipeline) return pipeline;
    state.commandCount += 1;
    if (state.commandCount > SHELL_PARSE_LIMITS.maxCommands) {
      return fail("SHELL_COMMAND_LIMIT", "command exceeds the command budget", state.index);
    }
    const next = peek(state);
    if (next !== undefined && next.kind === "op" && (next.op === ";" || next.op === "&&" || next.op === "||")) {
      state.index += 1;
      const separator = next.op as ShellListSeparator;
      // Repeated newlines collapse into one separator, exactly like bash.
      while (isSeparator(peek(state))) state.index += 1;
      const after = peek(state);
      if (after === undefined || (after.kind === "op" && after.op === ")")) {
        items.push(Object.freeze({ pipeline: pipeline.pipeline, separator: null }));
        break;
      }
      items.push(Object.freeze({ pipeline: pipeline.pipeline, separator }));
      continue;
    }
    items.push(Object.freeze({ pipeline: pipeline.pipeline, separator: null }));
    break;
  }
  return { program: Object.freeze({ items: Object.freeze(items) }) };
}

function parsePipeline(
  state: ParserState,
  depth: number,
): { pipeline: ShellPipeline } | ShellParseFailure {
  const commands: ShellCommandNode[] = [];
  for (;;) {
    const command = parseCommandNode(state, depth);
    if ("ok" in command) return command;
    commands.push(command.node);
    const next = peek(state);
    if (next !== undefined && next.kind === "op" && next.op === "|") {
      state.index += 1;
      if (peek(state) === undefined) {
        return fail("SHELL_UNSUPPORTED_SYNTAX", "pipeline ends with '|'", state.index);
      }
      continue;
    }
    return { pipeline: Object.freeze({ commands: Object.freeze(commands) }) };
  }
}

function parseCommandNode(
  state: ParserState,
  depth: number,
): { node: ShellCommandNode } | ShellParseFailure {
  const token = peek(state);
  if (token === undefined) {
    return fail("SHELL_UNSUPPORTED_SYNTAX", "unexpected end of command", state.index);
  }
  if (token.kind === "op" && token.op === "(") {
    state.index += 1;
    const inner = parseProgram(state, depth + 1);
    if ("ok" in inner) return inner;
    const closing = peek(state);
    if (closing === undefined || closing.kind !== "op" || closing.op !== ")") {
      return fail("SHELL_UNSUPPORTED_SYNTAX", "unbalanced '(' group", state.index);
    }
    state.index += 1;
    return { node: Object.freeze({ kind: "group", program: inner.program }) };
  }
  if (token.kind === "op") {
    return fail("SHELL_UNSUPPORTED_SYNTAX", `unexpected operator ${JSON.stringify(token.op)}`, token.offset);
  }
  if (token.kind === "redirect") {
    // A redirection may open a command (for example '> file cmd'); handled below.
    return parseSimpleCommand(state, []);
  }
  const first = token.word;
  if (first.quoted === false && RESERVED_WORDS.has(first.text)) {
    return fail(
      "SHELL_UNSUPPORTED_KEYWORD",
      `reserved word ${JSON.stringify(first.text)} is unsupported`,
      token.offset,
    );
  }
  if (first.quoted === false && first.text === "[[") {
    return fail("SHELL_UNSUPPORTED_KEYWORD", "[[]] tests are unsupported", token.offset);
  }
  return parseSimpleCommand(state, []);
}

function parseSimpleCommand(
  state: ParserState,
  _unused: readonly never[],
): { node: ShellSimpleCommand } | ShellParseFailure {
  const assignments: ShellAssignment[] = [];
  const words: ShellWord[] = [];
  const redirections: ShellRedirection[] = [];
  let sawWord = false;

  for (;;) {
    const token = peek(state);
    if (token === undefined) break;
    if (token.kind === "op") break;
    if (token.kind === "redirect") {
      state.index += 1;
      if (redirections.length >= SHELL_PARSE_LIMITS.maxRedirectionsPerCommand) {
        return fail("SHELL_WORD_LIMIT", "too many redirections", token.offset);
      }
      redirections.push(token.redirection);
      continue;
    }
    const word = token.word;
    if (word.quoted === false && RESERVED_WORDS.has(word.text)) {
      return fail(
        "SHELL_UNSUPPORTED_KEYWORD",
        `reserved word ${JSON.stringify(word.text)} is unsupported`,
        token.offset,
      );
    }
    if (!sawWord && word.quoted === false && word.text.includes("=")) {
      const separator = word.text.indexOf("=");
      const name = word.text.slice(0, separator);
      if (ASSIGNMENT_PATTERN.test(name)) {
        state.index += 1;
        if (assignments.length >= SHELL_PARSE_LIMITS.maxAssignmentsPerCommand) {
          return fail("SHELL_WORD_LIMIT", "too many assignments", token.offset);
        }
        assignments.push(Object.freeze({ name, value: word.text.slice(separator + 1) }));
        continue;
      }
    }
    state.index += 1;
    sawWord = true;
    if (words.length >= SHELL_PARSE_LIMITS.maxWordsPerCommand) {
      return fail("SHELL_WORD_LIMIT", "too many words in one command", token.offset);
    }
    words.push(word);
  }

  if (words.length === 0 && assignments.length === 0 && redirections.length === 0) {
    return fail("SHELL_UNSUPPORTED_SYNTAX", "empty command", state.index);
  }
  return {
    node: Object.freeze({
      kind: "simple",
      assignments: Object.freeze(assignments),
      words: Object.freeze(words),
      redirections: Object.freeze(redirections),
    }),
  };
}

/**
 * Parses one entry command string. Pure; the result is a frozen structure or a
 * specific refusal. Nested shell strings are parsed separately by the caller
 * with the same function and its own depth accounting.
 */
export function parseShellCommand(input: unknown): ShellParseResult {
  if (typeof input !== "string") {
    return fail("SHELL_UNSUPPORTED_SYNTAX", "command must be a string", 0);
  }
  if (input.includes("\0")) {
    return fail("SHELL_UNSUPPORTED_SYNTAX", "command must not contain a NUL byte", 0);
  }
  if (input.trim().length === 0) {
    return fail("SHELL_INPUT_EMPTY", "empty command", 0);
  }
  if (input.length > SHELL_PARSE_LIMITS.maxInputChars) {
    return fail("SHELL_INPUT_TOO_LONG", "command exceeds the supported length", 0);
  }
  const state: LexerState = { input, offset: 0, tokenCount: 0 };
  const tokens: Token[] = [];
  for (;;) {
    const token = nextToken(state);
    if (token === undefined) break;
    if ("ok" in token) return token;
    tokens.push(token);
  }
  const parser: ParserState = { tokens: Object.freeze(tokens), index: 0, commandCount: 0 };
  const program = parseProgram(parser, 0);
  if ("ok" in program) return program;
  if (parser.index !== tokens.length) {
    const trailing = tokens[parser.index];
    return fail(
      "SHELL_UNSUPPORTED_SYNTAX",
      trailing.kind === "redirect"
        ? "redirection attached to a subshell group is unsupported"
        : "unparsed trailing input",
      parser.index,
    );
  }
  return { ok: true, program: program.program };
}

/** Exact canonical serialization of a parsed program, used for binding hashes. */
export function serializeShellProgram(program: ShellProgram): string {
  const parts: string[] = [];
  const writeCommand = (command: ShellCommandNode): void => {
    if (command.kind === "group") {
      parts.push("group(");
      writeProgram(command.program);
      parts.push(")");
      return;
    }
    parts.push("cmd(");
    for (const assignment of command.assignments) {
      parts.push(`assign:${assignment.name}=${JSON.stringify(assignment.value)};`);
    }
    for (const word of command.words) {
      parts.push(`word:${word.quoted ? "q" : "u"}${JSON.stringify(word.text)};`);
    }
    for (const redirection of command.redirections) {
      if (redirection.kind === "dup") {
        parts.push(`dup:${redirection.fd}>&${redirection.from};`);
      } else {
        parts.push(`redir:${redirection.fd}:${redirection.mode}:${JSON.stringify(redirection.target.text)};`);
      }
    }
    parts.push(")");
  };
  const writeProgram = (value: ShellProgram): void => {
    for (const item of value.items) {
      parts.push("[");
      for (const command of item.pipeline.commands) {
        writeCommand(command);
        parts.push("|");
      }
      parts.push(`]${item.separator ?? ""}`);
    }
  };
  writeProgram(program);
  return parts.join("");
}
