import { isResolvedPath, type ResolvedPath } from "./paths.ts";
import { classifyPathResource } from "./resources.ts";

export type ReadPathDenyReason =
  | "INVALID_RESOURCE"
  | "UNSUPPORTED_OPERATION"
  | "SECRET_RESOURCE"
  | "SENSITIVE_RESOURCE"
  | "READ_TARGET_MISSING";

export type ReadPathDecision =
  | {
      readonly decision: "ALLOW";
      readonly reason: "WORKSPACE_READ";
    }
  | {
      readonly decision: "ASK";
      readonly reason: "EXTERNAL_READ";
    }
  | {
      readonly decision: "DENY";
      readonly reason: ReadPathDenyReason;
    };

/**
 * Applies the fixed default read-path decision table to a genuine Phase 1A
 * result. Classification is obtained internally and cannot be supplied or
 * bypassed by the caller.
 *
 * This function is synchronous and content-blind: it performs no filesystem
 * access and returns a default path-rule result, not an approval, capability,
 * or sandbox outcome.
 */
export function evaluateReadPath(
  operation: "read",
  resource: ResolvedPath,
): ReadPathDecision {
  if (!isResolvedPath(resource)) {
    return { decision: "DENY", reason: "INVALID_RESOURCE" };
  }

  if (operation !== "read") {
    return { decision: "DENY", reason: "UNSUPPORTED_OPERATION" };
  }

  const { sensitivity } = classifyPathResource(resource);

  if (sensitivity === "secret") {
    return { decision: "DENY", reason: "SECRET_RESOURCE" };
  }

  if (sensitivity === "sensitive") {
    return { decision: "DENY", reason: "SENSITIVE_RESOURCE" };
  }

  if (!resource.targetExists) {
    return { decision: "DENY", reason: "READ_TARGET_MISSING" };
  }

  if (resource.insideWorkspace) {
    return { decision: "ALLOW", reason: "WORKSPACE_READ" };
  }

  return { decision: "ASK", reason: "EXTERNAL_READ" };
}

export type WritePathDenyReason =
  | "INVALID_RESOURCE"
  | "UNSUPPORTED_OPERATION"
  | "SECRET_RESOURCE"
  | "SENSITIVE_RESOURCE";

export type WritePathDecision =
  | {
      readonly decision: "ALLOW";
      readonly reason: "WORKSPACE_WRITE";
    }
  | {
      readonly decision: "ASK";
      readonly reason: "EXTERNAL_WRITE";
    }
  | {
      readonly decision: "DENY";
      readonly reason: WritePathDenyReason;
    };

/**
 * Applies the fixed default write-path decision table to a genuine Phase 1A
 * result. Classification is obtained internally and cannot be supplied or
 * bypassed by the caller. Unlike read, an ordinary missing target inside the
 * workspace is an acceptable creation target for this default path rule.
 *
 * This function is synchronous and content-blind: it performs no filesystem
 * access and returns a default path-rule result, not an execution grant,
 * approval, capability, or sandbox outcome.
 */
export function evaluateWritePath(
  operation: "write",
  resource: ResolvedPath,
): WritePathDecision {
  if (!isResolvedPath(resource)) {
    return { decision: "DENY", reason: "INVALID_RESOURCE" };
  }

  if (operation !== "write") {
    return { decision: "DENY", reason: "UNSUPPORTED_OPERATION" };
  }

  const { sensitivity } = classifyPathResource(resource);

  if (sensitivity === "secret") {
    return { decision: "DENY", reason: "SECRET_RESOURCE" };
  }

  if (sensitivity === "sensitive") {
    return { decision: "DENY", reason: "SENSITIVE_RESOURCE" };
  }

  if (resource.insideWorkspace) {
    return { decision: "ALLOW", reason: "WORKSPACE_WRITE" };
  }

  return { decision: "ASK", reason: "EXTERNAL_WRITE" };
}
