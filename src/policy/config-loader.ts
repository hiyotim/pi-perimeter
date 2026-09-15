import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

import {
  parseOperationPolicy,
  MAX_POLICY_DOCUMENT_BYTES,
  type ConfigurationValidationErrorCode,
  type OperationPolicy,
} from "./configuration.ts";
import { isResolvedPath, type ResolvedPath } from "./paths.ts";

export type PolicySourceName = "user" | "project";
export type PolicySourceErrorCode =
  | ConfigurationValidationErrorCode
  | "INVALID_LOADING_CONTEXT"
  | "UNSAFE_SOURCE_PATH"
  | "SOURCE_READ_FAILED";

export type PolicySourceState =
  | { readonly status: "absent" }
  | { readonly status: "valid"; readonly policy: OperationPolicy }
  | { readonly status: "invalid"; readonly code: PolicySourceErrorCode };

export interface LoadedPolicySources {
  readonly user: PolicySourceState;
  readonly project: PolicySourceState;
}

const issuedSourceSets = new WeakSet<object>();
const sourceSetWorkspaces = new WeakMap<object, string>();
const USER_POLICY_COMPONENTS = ["pi-warden", "policy.json"] as const;
const PROJECT_POLICY_COMPONENTS = [".pi-warden", "policy.json"] as const;

function state<T extends PolicySourceState>(value: T): T {
  return Object.freeze(value);
}

function issue(
  user: PolicySourceState,
  project: PolicySourceState,
  workspaceRoot?: string,
): LoadedPolicySources {
  const result = Object.freeze({ user, project });
  issuedSourceSets.add(result);
  if (workspaceRoot !== undefined) sourceSetWorkspaces.set(result, workspaceRoot);
  return result;
}

async function loadFixedSource(
  root: string,
  components: readonly string[],
): Promise<PolicySourceState> {
  let current = root;
  for (let index = 0; index < components.length; index += 1) {
    current = path.join(current, components[index]);
    let metadata;
    try {
      metadata = await lstat(current);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return state({ status: "absent" });
      }
      return state({ status: "invalid", code: "SOURCE_READ_FAILED" });
    }
    if (metadata.isSymbolicLink()) {
      return state({ status: "invalid", code: "UNSAFE_SOURCE_PATH" });
    }
    const isLast = index === components.length - 1;
    if ((!isLast && !metadata.isDirectory()) || (isLast && !metadata.isFile())) {
      return state({ status: "invalid", code: "UNSAFE_SOURCE_PATH" });
    }
  }

  let handle;
  try {
    handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.nlink !== 1) {
      return state({ status: "invalid", code: "UNSAFE_SOURCE_PATH" });
    }
    if (metadata.size > MAX_POLICY_DOCUMENT_BYTES) {
      return state({ status: "invalid", code: "DOCUMENT_TOO_LARGE" });
    }
    const bytes = await handle.readFile();
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return state({ status: "invalid", code: "MALFORMED_JSON" });
    }
    const parsed = parseOperationPolicy(text);
    return parsed.status === "valid"
      ? state({ status: "valid", policy: parsed.policy })
      : state({ status: "invalid", code: parsed.code });
  } catch {
    return state({ status: "invalid", code: "SOURCE_READ_FAILED" });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function canonicalTrustedRoot(root: unknown): Promise<string | undefined> {
  if (typeof root !== "string" || root.length === 0 || root.includes("\0") || !path.isAbsolute(root)) {
    return undefined;
  }
  const normalized = path.normalize(root);
  if (normalized !== root) return undefined;
  try {
    const metadata = await lstat(root);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return undefined;
    const canonical = await realpath(root);
    return canonical === root ? canonical : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads exactly one trusted-user and one project policy from fixed locations.
 * The caller, not configuration data, supplies the trusted user config root;
 * the project root comes only from a genuine resolver-issued resource.
 */
export async function loadOperationPolicySources(
  resource: ResolvedPath,
  trustedUserConfigRoot: string,
): Promise<LoadedPolicySources> {
  if (!isResolvedPath(resource)) {
    const invalid = state({ status: "invalid", code: "INVALID_LOADING_CONTEXT" } as const);
    return issue(invalid, invalid);
  }

  const userRoot = await canonicalTrustedRoot(trustedUserConfigRoot);
  const user = userRoot === undefined
    ? state({ status: "invalid", code: "INVALID_LOADING_CONTEXT" } as const)
    : await loadFixedSource(userRoot, USER_POLICY_COMPONENTS);
  const project = await loadFixedSource(resource.workspaceRoot, PROJECT_POLICY_COMPONENTS);
  return issue(user, project, resource.workspaceRoot);
}

export function isLoadedPolicySources(value: unknown): value is LoadedPolicySources {
  return typeof value === "object" && value !== null && issuedSourceSets.has(value);
}

export function policySourcesApplyToResource(
  loaded: LoadedPolicySources,
  resource: ResolvedPath,
): boolean {
  return (
    isLoadedPolicySources(loaded) &&
    isResolvedPath(resource) &&
    sourceSetWorkspaces.get(loaded) === resource.workspaceRoot
  );
}
