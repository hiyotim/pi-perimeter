/**
 * Strict input framing for the six supported Pi file tools.
 *
 * Nothing in the gate trusts raw tool input structurally. Every field is
 * checked with exact runtime value comparisons before it can influence a
 * decision; anything unexpected fails closed to a structured denial that
 * blocks execution. Validation is a pure check of host-provided input
 * objects; it never supplies paths, identities, or approval state.
 */

export type GateInputErrorCode =
  | "MALFORMED_INPUT"
  | "MISSING_PATH"
  | "INVALID_PATH"
  | "INVALID_CONTENT"
  | "INVALID_EDITS"
  | "INVALID_NUM_ARGUMENT";

export interface GateInputFailure {
  readonly status: "invalid";
  readonly code: GateInputErrorCode;
}

export interface SinglePathFrame {
  readonly status: "ok";
  readonly tool: "read" | "write" | "edit";
  readonly path: string;
  /** Extra validated view arguments; pass-through values with no identity. */
  readonly extras: Readonly<Record<string, unknown>>;
}

export interface SearchRoot {
  readonly tool: "grep" | "find" | "ls";
  /** Absent or empty tool paths default to "." exactly like the Pi builtins. */
  readonly requestedPath: string;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface OtherToolFrame {
  readonly status: "ok";
  readonly tool: string;
}

export type GateInputFrame =
  | { readonly status: "ok"; readonly kind: "resource"; readonly resource: SinglePathFrame }
  | { readonly status: "ok"; readonly kind: "search-root"; readonly root: SearchRoot }
  | { readonly status: "ok"; readonly kind: "other" }
  | GateInputFailure;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validPathField(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && !value.includes("\0");
}

function validOptionalNumber(value: unknown): boolean {
  if (value === undefined) return true;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

function validOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

export type PathToolName = "read" | "write" | "edit";

/** Validates a strict single-target frame for read, write, and edit. */
export function parseSinglePathInput(
  tool: PathToolName,
  input: unknown,
): { ok: true; frame: SinglePathFrame } | { ok: false; failure: GateInputFailure } {
  if (!isPlainObject(input)) {
    return { ok: false, failure: { status: "invalid", code: "MALFORMED_INPUT" } };
  }
  if (!validPathField(input.path)) {
    return {
      ok: false,
      failure: { status: "invalid", code: input.path === undefined ? "MISSING_PATH" : "INVALID_PATH" },
    };
  }
  const extras: Record<string, unknown> = Object.create(null);
  if (tool === "read") {
    if (!validOptionalNumber(input.offset) || !validOptionalNumber(input.limit)) {
      return { ok: false, failure: { status: "invalid", code: "INVALID_NUM_ARGUMENT" } };
    }
    if (input.offset !== undefined) extras.offset = input.offset;
    if (input.limit !== undefined) extras.limit = input.limit;
  }
  if (tool === "write") {
    if (typeof input.content !== "string") {
      return { ok: false, failure: { status: "invalid", code: "INVALID_CONTENT" } };
    }
    extras.content = input.content;
  }
  if (tool === "edit") {
    const edits = input.edits;
    if (!Array.isArray(edits) || edits.length === 0) {
      return { ok: false, failure: { status: "invalid", code: "INVALID_EDITS" } };
    }
    for (const edit of edits) {
      if (
        !isPlainObject(edit) ||
        typeof edit["oldText"] !== "string" ||
        typeof edit["newText"] !== "string" ||
        edit["oldText"].includes("\0") ||
        edit["newText"].includes("\0")
      ) {
        return { ok: false, failure: { status: "invalid", code: "INVALID_EDITS" } };
      }
    }
    extras.edits = edits;
  }
  const requestedPathValue = input["path"] as string;
  return { ok: true, frame: Object.freeze({ status: "ok", tool, path: requestedPathValue, extras: Object.freeze(extras) }) };
}

/** Validates the search-root frame for grep, find, and ls. */
export function parseSearchRootInput(
  tool: "grep" | "find" | "ls",
  input: unknown,
): { ok: true; frame: SearchRoot } | { ok: false; failure: GateInputFailure } {
  if (!isPlainObject(input)) {
    return { ok: false, failure: { status: "invalid", code: "MALFORMED_INPUT" } };
  }
  const requestedPath =
    input["path"] === undefined ? "." : typeof input["path"] === "string" && !input["path"].includes("\0") ? input["path"] : "";
  if (requestedPath === "") {
    return {
      ok: false,
      failure: { status: "invalid", code: input["path"] === undefined ? "INVALID_PATH" : "INVALID_PATH" },
    };
  }
  const options: Record<string, unknown> = Object.create(null);
  if (validOptionalNumber(input["limit"]) && input["limit"] !== undefined) options["limit"] = input["limit"];
  else if (input["limit"] !== undefined) {
    return { ok: false, failure: { status: "invalid", code: "INVALID_NUM_ARGUMENT" } };
  }
  if (tool === "grep") {
    if (typeof input["pattern"] !== "string") {
      return {
        ok: false,
        failure: { status: "invalid", code: input["pattern"] === undefined ? "MALFORMED_INPUT" : "MALFORMED_INPUT" },
      };
    }
    if (input["glob"] !== undefined && typeof input["glob"] !== "string") {
      return { ok: false, failure: { status: "invalid", code: "MALFORMED_INPUT" } };
    }
    if (
      input["ignoreCase"] !== undefined && typeof input["ignoreCase"] !== "boolean" ||
      input["literal"] !== undefined && typeof input["literal"] !== "boolean"
    ) {
      return { ok: false, failure: { status: "invalid", code: "MALFORMED_INPUT" } };
    }
    if (!validOptionalNumber(input["context"])) {
      return { ok: false, failure: { status: "invalid", code: "INVALID_NUM_ARGUMENT" } };
    }
    for (const key of ["pattern", "glob", "ignoreCase", "literal", "context"]) {
      if (input[key] !== undefined) options[key] = input[key];
    }
  }
  if (tool === "find") {
    if (typeof input["pattern"] !== "string") {
      return { ok: false, failure: { status: "invalid", code: "MALFORMED_INPUT" } };
    }
    options["pattern"] = input["pattern"];
  }
  return { ok: true, frame: Object.freeze({ tool, requestedPath, options: Object.freeze(options) }) };
}

/** Validates the frame for any tool name the gate mediates. */
export function parseGateInput(tool: string, input: unknown): GateInputFrame {
  if (tool === "read" || tool === "write" || tool === "edit") {
    const parsed = parseSinglePathInput(tool, input);
    return parsed.ok
      ? { status: "ok", kind: "resource", resource: parsed.frame }
      : parsed.failure;
  }
  if (tool === "grep" || tool === "find" || tool === "ls") {
    const parsed = parseSearchRootInput(tool, input);
    return parsed.ok
      ? { status: "ok", kind: "search-root", root: parsed.frame }
      : parsed.failure;
  }
  return { status: "ok", kind: "other" };
}
