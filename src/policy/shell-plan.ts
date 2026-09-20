/**
 * Pure shell plan: turns a parsed entry command into the exact set of static
 * resource requests, sealed-input requests, token rewrites and command-risk
 * contributions used by the shell gate.
 *
 * The plan is advisory-with-teeth: it decides which statically visible paths
 * must be classified by the accepted authorizer before spawn, which script
 * inputs must be sealed, and which textual forms are unsupported. It is never
 * the enforcement boundary — the Seatbelt profile and the contained export are.
 *
 * Paths in the plan are logical paths inside the projection root (`.`-relative,
 * normalised, never escaping). All filesystem work happens in the caller.
 */

import {
  parseShellCommand,
  type ShellCommandNode,
  type ShellParseErrorCode,
  type ShellProgram,
  type ShellSimpleCommand,
  type ShellWord,
} from "./shell-grammar.ts";
import {
  argumentTriggeredRisk,
  classifyCommandName,
  classifyCommandSubcommand,
  isDispatcherCommand,
  isTimeoutDuration,
  secondWordRisk,
  strictestShellRisk,
  type ShellCommandRisk,
} from "./shell-commands.ts";
import { extractNetworkTargets, type ShellNetworkTarget } from "./network.ts";

export const SHELL_PLAN_LIMITS = Object.freeze({
  maxRecursionDepth: 8,
  maxCommands: 512,
  maxOperands: 256,
  maxSealedInputs: 32,
  maxNetworkTargets: 64,
  maxRiskClasses: 64,
});

export type ShellPlanRefusalCode =
  | "SHELL_EXTERNAL_PATH"
  | "SHELL_UNSUPPORTED_PATH_FORM"
  | "SHELL_DYNAMIC_SOURCE"
  | "SHELL_UNSUPPORTED_COMMAND_FORM"
  | "SHELL_PLAN_LIMIT";

export interface ShellPlanRefusal {
  readonly code: ShellPlanRefusalCode;
  readonly detail: string;
}

export interface ShellReadOperand {
  readonly kind: "read";
  readonly logicalPath: string;
  readonly origin: string;
}

export interface ShellWriteOperand {
  readonly kind: "write";
  readonly logicalPath: string;
  readonly origin: string;
}

export type ShellOperand = ShellReadOperand | ShellWriteOperand;

export interface ShellSealedInput {
  /** Logical path inside the projection whose bytes must be bound. */
  readonly logicalPath: string;
  readonly origin: string;
}

/** A token of the entry text to replace with a host-generated sealed path. */
export interface ShellSealedEdit {
  readonly start: number;
  readonly end: number;
  readonly sealedIndex: number;
}

export interface ShellPlan {
  readonly command: string;
  readonly risk: ShellCommandRisk;
  readonly riskReasons: readonly string[];
  readonly commands: number;
  readonly operands: readonly ShellOperand[];
  readonly sealed: readonly ShellSealedInput[];
  readonly sealedEdits: readonly ShellSealedEdit[];
  /** Destinations statically representable in network-class commands. */
  readonly networkTargets: readonly ShellNetworkTarget[];
  /** Distinct per-command risk classes in first-seen order. */
  readonly riskClasses: readonly ShellCommandRisk[];
  readonly refusals: readonly ShellPlanRefusal[];
}

export type ShellPlanResult =
  | { readonly ok: true; readonly plan: ShellPlan }
  | {
      readonly ok: false;
      readonly code: ShellParseErrorCode | ShellPlanRefusalCode;
      readonly detail: string;
    };

const DEVICE_PATHS = new Set(["/dev/null", "/dev/stdin", "/dev/stdout", "/dev/stderr"]);

const ASSIGNMENT_LIKE = /^[A-Za-z_][A-Za-z0-9_]*=/;

const SHELL_WRAPPERS = new Set(["env", "command", "timeout", "gtimeout"]);
const SHELL_WRAPPERS_LABEL = "env/command";
/** Bounded wrapper unwrapping depth; exhaustion is a refusal, not a fallback. */
const WRAPPER_DEPTH_LIMIT = 16;

const SHELL_INTERPRETERS = new Set(["bash", "sh"]);

interface WalkState {
  readonly refusals: ShellPlanRefusal[];
  readonly operands: ShellOperand[];
  readonly sealed: ShellSealedInput[];
  readonly sealedEdits: ShellSealedEdit[];
  readonly networkTargets: ShellNetworkTarget[];
  readonly riskClasses: ShellCommandRisk[];
  readonly riskReasons: string[];
  risk: ShellCommandRisk;
  commands: number;
}

function refuse(state: WalkState, code: ShellPlanRefusalCode, detail: string): void {
  if (state.refusals.length < 64) state.refusals.push(Object.freeze({ code, detail }));
}

function noteRisk(state: WalkState, risk: ShellCommandRisk, reason: string): void {
  const merged = strictestShellRisk(state.risk, risk);
  if (merged !== state.risk) {
    state.risk = merged;
  }
  if (risk !== "ordinary" && !state.riskReasons.includes(reason) && state.riskReasons.length < 32) {
    state.riskReasons.push(reason);
  }
}

/** Lexical normalization of a command path; never touches the filesystem. */
export function normalizeCommandPath(value: string): string {
  const stack: string[] = [];
  for (const segment of value.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return `/${stack.join("/")}`;
}

function basenameOf(value: string): string {
  const index = value.lastIndexOf("/");
  const base = index === -1 ? value : value.slice(index + 1);
  return base.toLowerCase();
}

/** Normalises one logical path against the current logical cwd. */
export function resolveLogicalPath(
  cwd: string,
  token: string,
): { readonly kind: "ok"; readonly path: string } | { readonly kind: "external" } | { readonly kind: "invalid" } {
  if (token.length === 0 || token.includes("\0")) return { kind: "invalid" };
  if (token.startsWith("/")) {
    return DEVICE_PATHS.has(token) ? { kind: "invalid" } : { kind: "external" };
  }
  const segments = (cwd === "" ? [] : cwd.split("/")).concat(token.split("/"));
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return { kind: "external" };
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return { kind: "ok", path: stack.join("/") };
}

/**
 * A word is an operand candidate unless it is a flag or an inline assignment.
 * Candidates are resolved against the projection and then the host by the
 * caller; a candidate that resolves to neither is not a path at all.
 */
function isCandidateOperand(text: string): boolean {
  if (text.length === 0) return false;
  if (text.length > 1 && text.startsWith("-")) return false;
  if (ASSIGNMENT_LIKE.test(text)) return false;
  return true;
}

function addOperand(
  state: WalkState,
  kind: "read" | "write",
  cwd: string,
  word: ShellWord,
  origin: string,
  allowMissing: boolean,
): void {
  if (word.text.startsWith("/") && DEVICE_PATHS.has(word.text)) return;
  if (state.operands.length >= SHELL_PLAN_LIMITS.maxOperands) {
    refuse(state, "SHELL_PLAN_LIMIT", "command exceeds the static operand budget");
    return;
  }
  const resolved = resolveLogicalPath(cwd, word.text);
  if (resolved.kind === "external") {
    refuse(
      state,
      "SHELL_EXTERNAL_PATH",
      `path operand ${JSON.stringify(word.text)} is outside the workspace projection (${origin})`,
    );
    return;
  }
  if (resolved.kind === "invalid") {
    if (allowMissing) return;
    refuse(state, "SHELL_UNSUPPORTED_PATH_FORM", `path operand ${JSON.stringify(word.text)} is not supported (${origin})`);
    return;
  }
  if (resolved.path === "" && kind === "write") {
    refuse(state, "SHELL_UNSUPPORTED_PATH_FORM", `empty write target (${origin})`);
    return;
  }
  state.operands.push(
    Object.freeze(
      kind === "read"
        ? { kind: "read" as const, logicalPath: resolved.path, origin }
        : { kind: "write" as const, logicalPath: resolved.path, origin },
    ),
  );
}

function addSealedInput(
  state: WalkState,
  text: string,
  cwd: string,
  origin: string,
  depth: number,
  word: ShellWord,
): void {
  if (depth > 0) {
    refuse(
      state,
      "SHELL_DYNAMIC_SOURCE",
      `sourced or script input inside a nested shell string is unsupported (${origin})`,
    );
    return;
  }
  if (text.startsWith("/") && !text.startsWith("./") && !text.startsWith("../")) {
    refuse(state, "SHELL_EXTERNAL_PATH", `script input ${JSON.stringify(text)} is an absolute path (${origin})`);
    return;
  }
  if (state.sealed.length >= SHELL_PLAN_LIMITS.maxSealedInputs) {
    refuse(state, "SHELL_PLAN_LIMIT", "command exceeds the sealed input budget");
    return;
  }
  const resolved = resolveLogicalPath(cwd, text);
  if (resolved.kind === "external") {
    refuse(state, "SHELL_EXTERNAL_PATH", `script input ${JSON.stringify(text)} is outside the workspace projection (${origin})`);
    return;
  }
  if (resolved.kind !== "ok" || resolved.path === "") {
    refuse(state, "SHELL_DYNAMIC_SOURCE", `script input ${JSON.stringify(text)} is not a supported projection path (${origin})`);
    return;
  }
  const index = state.sealed.length;
  state.sealed.push(Object.freeze({ logicalPath: resolved.path, origin }));
  state.sealedEdits.push(Object.freeze({ start: word.start, end: word.end, sealedIndex: index }));
}

/**
 * Resolves the effective command words after unwrapping `env`/`command`.
 *
 * The wrapper is never silently skipped: an unrecognized wrapper flag is a
 * refusal, because dropping the wrapped command line would let a denied
 * command class be classified as the wrapper itself. `env -S`/`--split-string`
 * is refused outright: its argument is a command line we cannot parse.
 */
function unwrapCommand(
  words: readonly ShellWord[],
): { readonly words: readonly ShellWord[] } | { readonly refusal: string } {
  const TIMEOUT_VALUE_FLAGS = ["-s", "--signal", "-k", "--kill-after"];
  const TIMEOUT_BOOLEAN_FLAGS = ["-v", "--verbose", "--foreground", "--preserve-status", "-p"];
  const ENV_BOOLEAN_FLAGS = ["-i", "--ignore-environment", "-0", "--null", "-v", "--verbose", "--debug"];
  const ENV_VALUE_FLAGS = ["-u", "--unset", "-C", "--chdir", "-P", "--path", "--argv0"];

  let current = words;
  for (let guard = 0; guard < WRAPPER_DEPTH_LIMIT; guard += 1) {
    if (current.length === 0) return { words: current };

    // A wrapper is unwrapped when it is the bare name (in any case, because
    // the declared target's filesystem is case-insensitive) or a spelling that
    // normalizes to a system path. Any other path spelling is a workspace or
    // out-of-projection object executed by path, which classifyCommandName
    // refuses for its own reasons.
    const wrapperText = current[0].text;
    const name = basenameOf(wrapperText);
    if (!SHELL_WRAPPERS.has(name)) return { words: current };
    const normalized = wrapperText.startsWith("/") ? normalizeCommandPath(wrapperText) : wrapperText;
    const isBareName = wrapperText.toLowerCase() === name;
    const isSystemPath =
      /^\/(usr\/)?bin\/[^/]+$/.test(normalized.toLowerCase()) && basenameOf(normalized) === name;
    if (!isBareName && !isSystemPath) return { words: current.slice(0, 1) };

    let index = 1;
    let afterDoubleDash = false;
    let commandStart = -1;
    while (index < current.length) {
      const text = current[index].text;
      if (!afterDoubleDash && text === "--") {
        afterDoubleDash = true;
        index += 1;
        continue;
      }
      if (name === "timeout" || name === "gtimeout") {
        if (TIMEOUT_VALUE_FLAGS.includes(text)) {
          index += 2;
          continue;
        }
        if (TIMEOUT_BOOLEAN_FLAGS.includes(text) || (text.startsWith("-") && text.length > 1)) {
          index += 1;
          continue;
        }
        if (!isTimeoutDuration(text)) {
          return { refusal: `${name} requires a duration before the command it runs` };
        }
        index += 1;
        commandStart = index;
        break;
      }
      // `env` treats NAME=VALUE as an assignment even after `--`; `command`
      // does not treat it as an assignment at all.
      if (name === "env" && ASSIGNMENT_LIKE.test(text)) {
        index += 1;
        continue;
      }
      if (!afterDoubleDash && ASSIGNMENT_LIKE.test(text)) {
        index += 1;
        continue;
      }
      if (!afterDoubleDash && text === "-" && name === "env") {
        afterDoubleDash = true;
        index += 1;
        continue;
      }
      if (!afterDoubleDash && text.length > 1 && text.startsWith("-")) {
        const flag = text.split("=")[0];
        if (name === "command") {
          if (flag === "-p") {
            index += 1;
            continue;
          }
          if (flag === "-v" || flag === "-V") {
            // Query-only: the wrapper is the effective command.
            return { words: current.slice(0, 1) };
          }
          return { refusal: `unsupported ${name} flag ${JSON.stringify(flag)}` };
        }
        if (ENV_BOOLEAN_FLAGS.includes(flag)) {
          index += 1;
          continue;
        }
        if (flag === "-S" || flag === "--split-string") {
          return { refusal: `${name} ${flag} takes a command string that cannot be classified exactly` };
        }
        if (ENV_VALUE_FLAGS.includes(flag)) {
          index += text.includes("=") ? 1 : 2;
          continue;
        }
        return { refusal: `unsupported ${name} flag ${JSON.stringify(flag)}` };
      }
      commandStart = index;
      break;
    }

    if (commandStart < 0 || commandStart >= current.length) {
      // No command follows: the wrapper itself is the effective command and
      // classifies as an unclassified runner (for example bare `env`, or a
      // `timeout` with no duration and no command).
      return { words: current.slice(0, 1) };
    }
    current = current.slice(commandStart);
  }
  // Guard exhausted: refuse rather than treat the wrapper itself as the
  // command, which would classify the wrapped command line as ordinary.
  return { refusal: `nested ${SHELL_WRAPPERS_LABEL} wrappers exceed the supported depth` };
}

function analyzeSimple(
  command: ShellSimpleCommand,
  cwd: string,
  depth: number,
  state: WalkState,
): string {
  state.commands += 1;
  if (state.commands > SHELL_PLAN_LIMITS.maxCommands) {
    refuse(state, "SHELL_PLAN_LIMIT", "command exceeds the command budget");
    return cwd;
  }

  for (const redirection of command.redirections) {
    if (redirection.kind !== "file") continue;
    const mode = redirection.mode === "read" ? "read" : "write";
    addOperand(state, mode, cwd, redirection.target, `redirection ${redirection.mode}`, mode === "write");
  }

  if (command.words.length === 0) {
    noteRisk(state, "ordinary", "assignment or redirection only");
    return cwd;
  }

  const unwrapped = unwrapCommand(command.words);
  if ("refusal" in unwrapped) {
    refuse(state, "SHELL_UNSUPPORTED_COMMAND_FORM", unwrapped.refusal);
    return cwd;
  }
  const words = unwrapped.words;
  const name = words[0].text;
  const lowered = basenameOf(name);
  const classification = classifyCommandName(name);
  noteRisk(state, classification.risk, `${name}: ${classification.reason}`);
  let effectiveRisk = classification.risk;
  const argumentsAfterName = words.slice(1).map((word) => word.text);
  if (isDispatcherCommand(classification.lookedUp)) {
    const subcommandRisk = classifyCommandSubcommand(classification.lookedUp, argumentsAfterName);
    if (typeof subcommandRisk === "string") {
      noteRisk(state, subcommandRisk, `${name}: subcommand class`);
      effectiveRisk = strictestShellRisk(effectiveRisk, subcommandRisk);
    } else if (subcommandRisk !== undefined) {
      refuse(state, "SHELL_UNSUPPORTED_COMMAND_FORM", subcommandRisk.refusal);
    }
  }
  const secondWord = secondWordRisk(classification.lookedUp, argumentsAfterName);
  if (secondWord !== undefined) {
    noteRisk(state, secondWord, `${name} ${argumentsAfterName.filter((value) => !value.startsWith("-"))[1] ?? ""}: subcommand verb class`);
    effectiveRisk = strictestShellRisk(effectiveRisk, secondWord);
  }
  const argumentRisk = argumentTriggeredRisk(classification.lookedUp, argumentsAfterName);
  if (argumentRisk !== undefined) {
    noteRisk(state, argumentRisk.risk, `${name}: ${argumentRisk.reason}`);
    effectiveRisk = strictestShellRisk(effectiveRisk, argumentRisk.risk);
  }
  if (!state.riskClasses.includes(effectiveRisk)) {
    if (state.riskClasses.length >= SHELL_PLAN_LIMITS.maxRiskClasses) {
      refuse(state, "SHELL_PLAN_LIMIT", "command exceeds the risk-class budget");
      return cwd;
    }
    state.riskClasses.push(effectiveRisk);
  }
  if (effectiveRisk === "network") {
    if (state.networkTargets.length >= SHELL_PLAN_LIMITS.maxNetworkTargets) {
      refuse(state, "SHELL_PLAN_LIMIT", "command exceeds the network-target budget");
      return cwd;
    }
    for (const target of extractNetworkTargets(words.map((word) => word.text))) {
      state.networkTargets.push(target);
    }
  }

  if (lowered === "cd") {
    if (words.length !== 2) {
      refuse(state, "SHELL_UNSUPPORTED_COMMAND_FORM", "cd requires exactly one static literal path argument");
      return cwd;
    }
    const resolved = resolveLogicalPath(cwd, words[1].text);
    if (resolved.kind !== "ok") {
      refuse(
        state,
        resolved.kind === "external" ? "SHELL_EXTERNAL_PATH" : "SHELL_UNSUPPORTED_PATH_FORM",
        `cd target ${JSON.stringify(words[1].text)} is outside the workspace projection`,
      );
      return cwd;
    }
    return resolved.path;
  }

  if (lowered === "source" || name === ".") {
    if (words.length !== 2) {
      refuse(state, "SHELL_UNSUPPORTED_COMMAND_FORM", "source requires exactly one static literal path argument");
      return cwd;
    }
    addSealedInput(state, words[1].text, cwd, "source", depth, words[1]);
    return cwd;
  }

  if (SHELL_INTERPRETERS.has(lowered)) {
    analyzeShellInvocation(words, cwd, depth, state);
    return cwd;
  }

  if (lowered === "export" || lowered === "set" || lowered === "unset" || lowered === "shift" || lowered === "umask") {
    return cwd;
  }

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    if (!isCandidateOperand(word.text)) continue;
    addOperand(state, "read", cwd, word, `${lowered} operand`, false);
  }
  return cwd;
}

function analyzeShellInvocation(
  words: readonly ShellWord[],
  cwd: string,
  depth: number,
  state: WalkState,
): void {
  let index = 1;
  let inlineString: ShellWord | undefined;
  let script: ShellWord | undefined;
  let sawStdinSource = false;
  while (index < words.length) {
    const word = words[index];
    const text = word.text;
    if (text === "-c") {
      index += 1;
      if (index >= words.length) {
        refuse(state, "SHELL_UNSUPPORTED_COMMAND_FORM", "-c requires a static literal command string");
        return;
      }
      inlineString = words[index];
      index += 1;
      continue;
    }
    if (text === "-s") {
      sawStdinSource = true;
      index += 1;
      continue;
    }
    if (text.startsWith("-")) {
      if (text === "-o" || text === "+o") {
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (text === "--") {
      index += 1;
      script = words[index];
      index += 1;
      break;
    }
    script = word;
    index += 1;
    break;
  }

  if (inlineString !== undefined) {
    if (depth + 1 > SHELL_PLAN_LIMITS.maxRecursionDepth) {
      refuse(state, "SHELL_PLAN_LIMIT", "nested shell recursion exceeds the supported depth");
      return;
    }
    const nested = parseShellCommand(inlineString.text);
    if (!nested.ok) {
      refuse(state, "SHELL_UNSUPPORTED_COMMAND_FORM", `nested shell string is unsupported (${nested.code}: ${nested.detail})`);
      return;
    }
    walkProgram(nested.program, cwd, depth + 1, state);
    return;
  }
  if (script !== undefined) {
    addSealedInput(state, script.text, cwd, "script argument", depth, script);
    return;
  }
  refuse(
    state,
    "SHELL_DYNAMIC_SOURCE",
    sawStdinSource
      ? "shell reading its program from stdin (-s) is unsupported"
      : "shell invocation without a static script path or -c string is unsupported",
  );
}

function walkCommand(node: ShellCommandNode, cwd: string, depth: number, state: WalkState): string {
  if (node.kind === "group") {
    // A subshell group runs with a copy of the logical cwd.
    walkProgram(node.program, cwd, depth, state);
    return cwd;
  }
  return analyzeSimple(node, cwd, depth, state);
}

function walkProgram(program: ShellProgram, cwd: string, depth: number, state: WalkState): void {
  if (depth > SHELL_PLAN_LIMITS.maxRecursionDepth) {
    refuse(state, "SHELL_PLAN_LIMIT", "shell recursion exceeds the supported depth");
    return;
  }
  let current = cwd;
  for (const item of program.items) {
    for (const command of item.pipeline.commands) {
      current = walkCommand(command, current, depth, state);
    }
  }
}

/**
 * Builds the static plan for one entry command string. Pure: no filesystem,
 * policy, process, or Pi interaction.
 */
export function buildShellPlan(command: string): ShellPlanResult {
  const parsed = parseShellCommand(command);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code, detail: parsed.detail };
  }
  const state: WalkState = {
    refusals: [],
    operands: [],
    sealed: [],
    sealedEdits: [],
    networkTargets: [],
    riskClasses: [],
    riskReasons: [],
    risk: "ordinary",
    commands: 0,
  };
  walkProgram(parsed.program, "", 0, state);
  if (state.commands > SHELL_PLAN_LIMITS.maxCommands) {
    return { ok: false, code: "SHELL_PLAN_LIMIT", detail: "command exceeds the command budget" };
  }
  const plan: ShellPlan = Object.freeze({
    command,
    risk: state.risk,
    riskReasons: Object.freeze([...state.riskReasons]),
    commands: state.commands,
    operands: Object.freeze([...state.operands]),
    sealed: Object.freeze([...state.sealed]),
    sealedEdits: Object.freeze([...state.sealedEdits]),
    networkTargets: Object.freeze([...state.networkTargets]),
    riskClasses: Object.freeze([...state.riskClasses]),
    refusals: Object.freeze([...state.refusals]),
  });
  return { ok: true, plan };
}

/** Single-quotes a host-generated path for safe inclusion in the entry text. */
export function shellQuoteLiteral(value: string): string {
  return `'${value.split("'").join(`'\\''`)}'`;
}

/** Applies sealed-path edits to the entry text, producing the executed string. */
export function applySealedEdits(
  text: string,
  edits: readonly ShellSealedEdit[],
  replacements: readonly string[],
): string | undefined {
  const ordered = [...edits].sort((left, right) => right.start - left.start);
  let result = text;
  let previousStart = text.length + 1;
  for (const edit of ordered) {
    const replacement = replacements[edit.sealedIndex];
    if (replacement === undefined) return undefined;
    if (edit.end > previousStart || edit.start >= edit.end) return undefined;
    result = result.slice(0, edit.start) + replacement + result.slice(edit.end);
    previousStart = edit.start;
  }
  return result;
}
