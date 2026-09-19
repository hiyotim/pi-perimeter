/**
 * Refusal vocabulary shared by the containment, projection, export and helper
 * adapters. Every refusal is an error that blocks the affected step; none of
 * them can be converted into an allowance by a caller.
 */

export type ShellRefusalCode =
  | "PLATFORM_UNSUPPORTED"
  | "HELPER_MISSING"
  | "HELPER_UNTRUSTED"
  | "SANDBOX_EXEC_UNTRUSTED"
  | "PROFILE_GENERATION_FAILED"
  | "RUNTIME_DIRECTORY_FAILED"
  | "PROJECTION_FAILED"
  | "PROJECTION_LIMIT_EXCEEDED"
  | "IMPORT_OBJECT_REFUSED"
  | "EXPORT_FAILED"
  | "EXPORT_LIMIT_EXCEEDED"
  | "EXPORT_CONFLICT"
  | "EXPORT_NOT_AUTHORIZED"
  | "EXPORT_HELPER_REFUSED"
  | "QUIESCENCE_NOT_ESTABLISHED"
  | "SELF_TEST_FAILED"
  | "CONTAINMENT_FAILED"
  | "CANCELLED";

export class ShellRefusal extends Error {
  readonly code: ShellRefusalCode;
  readonly detail: string;

  constructor(code: ShellRefusalCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "ShellRefusal";
    this.code = code;
    this.detail = detail;
  }
}

export function refusalReason(error: unknown): { code: ShellRefusalCode; detail: string } {
  if (error instanceof ShellRefusal) return { code: error.code, detail: error.detail };
  return { code: "CONTAINMENT_FAILED", detail: error instanceof Error ? error.message : String(error) };
}
