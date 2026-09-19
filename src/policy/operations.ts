/**
 * Explicit mapping from model-facing Pi file tools to the fixed v1 policy
 * operations. This mapping is intentionally exhaustive and small: every
 * supported file tool is resolved to exactly one of the accepted policy
 * operations; everything else fails closed at the gate.
 *
 * The mapping documents which effects each tool can reach and therefore which
 * operation must authorize it:
 *
 * - `read` touches the exact target file (offset/limit only shape the view).
 * - `write` creates or overwrites the exact target file and may create missing
 *   workspace-parent directories beneath that target's canonical path.
 * - `edit` rewrites the exact existing target file.
 * - `grep` reads the contents of every descendant of the search root, so it is
 *   mediated by the `read` operation at the root, then per-descendant `read`
 *   classification before any content is read.
 * - `find` walks the descendants of the search root, observing names and file
 *   types; it is mediated by the `read` operation at the root, then
 *   per-descendant `read` classification before any name is emitted.
 * - `ls` observes the immediate entries of the search root, including names
 *   and directory suffixes; it is mediated by the `read` operation at the
 *   root, then per-descendant `read` classification before any name is
 *   emitted.
 *
 * `grep`, `find`, and `ls` therefore cannot bypass a read (or stronger)
 * restriction through a different tool name: wherever `read` or a stronger
 * configuration applies, these tools inherit it via the same central policy.
 */
export type FileToolName = "read" | "write" | "edit" | "grep" | "find" | "ls";

/**
 * Shell routes. `bash` is integrated through the contained shell lifecycle
 * (Goal 3); every other shell dialect, including `powershell`, stays blocked
 * until it has its own reviewed containment path.
 */
export const SUPPORTED_SHELL_TOOLS: readonly string[] = ["bash"];
export const BLOCKED_SHELL_TOOLS: readonly string[] = ["powershell"];

const FILE_TOOL_OPERATIONS: Readonly<Record<FileToolName, "read" | "write" | "edit">> = Object.freeze({
  read: "read",
  write: "write",
  edit: "edit",
  grep: "read",
  find: "read",
  ls: "read",
});

export function isFileToolName(tool: string): tool is FileToolName {
  return (
    tool === "read" ||
    tool === "write" ||
    tool === "edit" ||
    tool === "grep" ||
    tool === "find" ||
    tool === "ls"
  );
}

/** Returns the policy operation that mediates the given file tool, or undefined. */
export function mapFileToolToOperation(tool: string): "read" | "write" | "edit" | undefined {
  if (!isFileToolName(tool)) return undefined;
  return FILE_TOOL_OPERATIONS[tool];
}

export function isBlockedShellTool(tool: string): boolean {
  return tool === "powershell";
}

/** True for the shell tool mediated by the contained shell lifecycle. */
export function isContainedShellTool(tool: string): boolean {
  return tool === "bash";
}
