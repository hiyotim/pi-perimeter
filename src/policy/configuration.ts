import type { AuthorizationOutcome } from "./authority.ts";

export type PolicyOperation = "read" | "write" | "edit";

export type ConfigurationValidationErrorCode =
  | "INVALID_INPUT"
  | "DOCUMENT_TOO_LARGE"
  | "MALFORMED_JSON"
  | "DUPLICATE_KEY"
  | "INVALID_SCHEMA";

export type ConfigurationParseResult =
  | { readonly status: "valid"; readonly policy: OperationPolicy }
  | {
      readonly status: "invalid";
      readonly code: ConfigurationValidationErrorCode;
    };

const operationPolicyBrand = Symbol("pi-warden.operationPolicyBrand");
const issuedPolicies = new WeakSet<object>();
export const MAX_POLICY_DOCUMENT_BYTES = 64 * 1024;
const MAX_JSON_DEPTH = 32;

export interface OperationPolicy {
  readonly version: 1;
  readonly operations: Readonly<Partial<Record<PolicyOperation, AuthorizationOutcome>>>;
  readonly [operationPolicyBrand]: true;
}

class DuplicateKeyError extends Error {}

class JsonReader {
  private offset = 0;
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  parse(): unknown {
    const value = this.value(0);
    this.space();
    if (this.offset !== this.text.length) {
      throw new SyntaxError("Trailing JSON content");
    }
    return value;
  }

  private value(depth: number): unknown {
    if (depth > MAX_JSON_DEPTH) {
      throw new SyntaxError("JSON nesting limit exceeded");
    }
    this.space();
    const token = this.text[this.offset];
    if (token === "{") return this.object(depth + 1);
    if (token === "[") return this.array(depth + 1);
    if (token === '"') return this.string();
    if (this.text.startsWith("true", this.offset)) {
      this.offset += 4;
      return true;
    }
    if (this.text.startsWith("false", this.offset)) {
      this.offset += 5;
      return false;
    }
    if (this.text.startsWith("null", this.offset)) {
      this.offset += 4;
      return null;
    }
    return this.number();
  }

  private object(depth: number): Map<string, unknown> {
    this.offset += 1;
    const result = new Map<string, unknown>();
    this.space();
    if (this.text[this.offset] === "}") {
      this.offset += 1;
      return result;
    }
    while (true) {
      this.space();
      if (this.text[this.offset] !== '"') throw new SyntaxError("Expected key");
      const key = this.string();
      if (result.has(key)) throw new DuplicateKeyError("Duplicate JSON key");
      this.space();
      if (this.text[this.offset] !== ":") throw new SyntaxError("Expected colon");
      this.offset += 1;
      result.set(key, this.value(depth));
      this.space();
      const separator = this.text[this.offset];
      if (separator === "}") {
        this.offset += 1;
        return result;
      }
      if (separator !== ",") throw new SyntaxError("Expected object separator");
      this.offset += 1;
    }
  }

  private array(depth: number): unknown[] {
    this.offset += 1;
    const result: unknown[] = [];
    this.space();
    if (this.text[this.offset] === "]") {
      this.offset += 1;
      return result;
    }
    while (true) {
      result.push(this.value(depth));
      this.space();
      const separator = this.text[this.offset];
      if (separator === "]") {
        this.offset += 1;
        return result;
      }
      if (separator !== ",") throw new SyntaxError("Expected array separator");
      this.offset += 1;
    }
  }

  private string(): string {
    const start = this.offset;
    this.offset += 1;
    while (this.offset < this.text.length) {
      const character = this.text.charCodeAt(this.offset);
      if (character === 0x22) {
        this.offset += 1;
        return JSON.parse(this.text.slice(start, this.offset)) as string;
      }
      if (character < 0x20) throw new SyntaxError("Control character in string");
      if (character === 0x5c) {
        this.offset += 1;
        const escape = this.text[this.offset];
        if (escape === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(this.text.slice(this.offset + 1, this.offset + 5))) {
            throw new SyntaxError("Invalid unicode escape");
          }
          this.offset += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(escape ?? "")) {
          throw new SyntaxError("Invalid string escape");
        }
      }
      this.offset += 1;
    }
    throw new SyntaxError("Unterminated string");
  }

  private number(): number {
    const match = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    match.lastIndex = this.offset;
    const result = match.exec(this.text);
    if (result === null) throw new SyntaxError("Expected JSON value");
    this.offset = match.lastIndex;
    const value = Number(result[0]);
    if (!Number.isFinite(value)) throw new SyntaxError("Invalid JSON number");
    return value;
  }

  private space(): void {
    while (
      this.offset < this.text.length &&
      (this.text[this.offset] === " " ||
        this.text[this.offset] === "\t" ||
        this.text[this.offset] === "\n" ||
        this.text[this.offset] === "\r")
    ) {
      this.offset += 1;
    }
  }
}

function invalid(code: ConfigurationValidationErrorCode): ConfigurationParseResult {
  return Object.freeze({ status: "invalid", code });
}

function isOutcome(value: unknown): value is AuthorizationOutcome {
  return value === "ALLOW" || value === "ASK" || value === "DENY";
}

/** Parses the complete, minimal v1 policy schema without inspecting objects supplied by callers. */
export function parseOperationPolicy(input: unknown): ConfigurationParseResult {
  if (typeof input !== "string") return invalid("INVALID_INPUT");
  if (Buffer.byteLength(input, "utf8") > MAX_POLICY_DOCUMENT_BYTES) {
    return invalid("DOCUMENT_TOO_LARGE");
  }

  let root: unknown;
  try {
    root = new JsonReader(input).parse();
  } catch (error) {
    return invalid(error instanceof DuplicateKeyError ? "DUPLICATE_KEY" : "MALFORMED_JSON");
  }

  if (!(root instanceof Map) || root.size !== 2 || !root.has("version") || !root.has("operations")) {
    return invalid("INVALID_SCHEMA");
  }
  if (root.get("version") !== 1) return invalid("INVALID_SCHEMA");
  const rawOperations = root.get("operations");
  if (!(rawOperations instanceof Map)) return invalid("INVALID_SCHEMA");

  const operations: Partial<Record<PolicyOperation, AuthorizationOutcome>> = Object.create(null);
  for (const [operation, outcome] of rawOperations) {
    if (
      (operation !== "read" && operation !== "write" && operation !== "edit") ||
      !isOutcome(outcome)
    ) {
      return invalid("INVALID_SCHEMA");
    }
    const validatedOperation: PolicyOperation = operation;
    operations[validatedOperation] = outcome;
  }

  Object.freeze(operations);
  const policy = Object.freeze({
    version: 1 as const,
    operations,
    [operationPolicyBrand]: true as const,
  });
  issuedPolicies.add(policy);
  return Object.freeze({ status: "valid", policy });
}

export function policyContribution(
  policy: OperationPolicy,
  operation: PolicyOperation,
): AuthorizationOutcome | undefined {
  if (!issuedPolicies.has(policy)) return undefined;
  return policy.operations[operation];
}
