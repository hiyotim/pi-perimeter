import path from "node:path";

import { isResolvedPath, type ResolvedPath } from "./paths.ts";

export type ResourceSensitivity = "ordinary" | "sensitive" | "secret";

export type ResourceCategory =
  | "environment"
  | "ssh-credentials"
  | "private-key"
  | "cloud-credentials"
  | "service-credentials"
  | "package-auth"
  | "git-credentials";

export type ResourceMatchReason =
  | "env-template"
  | "env-file"
  | "ssh-directory"
  | "ssh-private-key-name"
  | "pem-file"
  | "private-key-extension"
  | "aws-credentials"
  | "aws-sso-cache"
  | "gcloud-credentials"
  | "github-cli-credentials"
  | "kubeconfig"
  | "docker-auth"
  | "netrc"
  | "package-auth-file"
  | "git-credential-store";

export type PathEvidence = "canonical-path" | "lexical-path";

export interface ResourceMatch {
  readonly category: ResourceCategory;
  readonly sensitivity: Exclude<ResourceSensitivity, "ordinary">;
  readonly reason: ResourceMatchReason;
  readonly evidence: readonly PathEvidence[];
}

export interface ResourceClassification {
  readonly sensitivity: ResourceSensitivity;
  readonly matches: readonly ResourceMatch[];
}

export class ResourceClassificationError extends Error {
  readonly code: "INVALID_PROVENANCE";
  readonly input: unknown;

  constructor(message: string, input: unknown) {
    super(message);
    this.name = "ResourceClassificationError";
    this.code = "INVALID_PROVENANCE";
    this.input = input;
  }
}

interface PathFacts {
  readonly basename: string;
  readonly extension: string;
  readonly components: readonly string[];
}

interface ResourceRuleBase {
  readonly category: ResourceCategory;
  readonly reason: ResourceMatchReason;
}

interface FixedSensitivityResourceRule extends ResourceRuleBase {
  readonly sensitivity: ResourceMatch["sensitivity"];
  readonly matches: (facts: PathFacts) => boolean;
}

interface PerIdentitySensitivityResourceRule extends ResourceRuleBase {
  readonly sensitivityFor: (
    facts: PathFacts,
  ) => ResourceMatch["sensitivity"] | undefined;
}

type ResourceRule =
  | FixedSensitivityResourceRule
  | PerIdentitySensitivityResourceRule;

const ENV_TEMPLATE_MARKERS = new Set(["example", "sample", "template", "dist"]);

function isEnvTemplateBasename(basename: string): boolean {
  if (!basename.startsWith(".env.")) {
    return false;
  }

  return basename
    .slice(".env.".length)
    .split(".")
    .some((token) => ENV_TEMPLATE_MARKERS.has(token));
}

const SSH_PRIVATE_KEY_NAMES = new Set([
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
]);

const SSH_PRIVATE_KEY_BACKUP_SUFFIXES = new Set([".bak", ".backup", ".old", "~"]);

function isSshPrivateKeyName(basename: string): boolean {
  if (SSH_PRIVATE_KEY_NAMES.has(basename)) {
    return true;
  }

  for (const suffix of SSH_PRIVATE_KEY_BACKUP_SUFFIXES) {
    if (basename.endsWith(suffix)) {
      const base = basename.slice(0, -suffix.length);
      if (SSH_PRIVATE_KEY_NAMES.has(base)) {
        return true;
      }
    }
  }

  return false;
}

const PRIVATE_KEY_EXTENSION_SENSITIVITIES = new Map<
  string,
  ResourceMatch["sensitivity"]
>([
  [".key", "sensitive"],
  [".p12", "secret"],
  [".pfx", "secret"],
]);

const PACKAGE_AUTH_FILES = new Set([".npmrc", ".pypirc", ".yarnrc.yml"]);

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function inspectPath(value: string): PathFacts {
  const folded = asciiLower(value);
  const root = path.parse(folded).root;
  const components = folded
    .slice(root.length)
    .split(path.sep)
    .filter((component) => component.length > 0);
  const basename = components.at(-1) ?? "";

  return {
    basename,
    extension: path.extname(basename),
    components,
  };
}

function hasComponent(facts: PathFacts, component: string): boolean {
  return facts.components.includes(component);
}

function hasComponentSequence(
  facts: PathFacts,
  sequence: readonly string[],
): boolean {
  if (sequence.length > facts.components.length) {
    return false;
  }

  for (let start = 0; start <= facts.components.length - sequence.length; start += 1) {
    if (sequence.every((component, offset) => facts.components[start + offset] === component)) {
      return true;
    }
  }

  return false;
}

function endsWithComponents(
  facts: PathFacts,
  suffix: readonly string[],
): boolean {
  const start = facts.components.length - suffix.length;

  return (
    start >= 0 &&
    suffix.every((component, offset) => facts.components[start + offset] === component)
  );
}

const RULES: readonly ResourceRule[] = [
  {
    category: "environment",
    sensitivity: "sensitive",
    reason: "env-template",
    matches: ({ basename }) => isEnvTemplateBasename(basename),
  },
  {
    category: "environment",
    sensitivity: "secret",
    reason: "env-file",
    matches: ({ basename }) =>
      basename === ".env" ||
      (basename.startsWith(".env.") && !isEnvTemplateBasename(basename)),
  },
  {
    category: "ssh-credentials",
    sensitivity: "sensitive",
    reason: "ssh-directory",
    matches: (facts) => hasComponent(facts, ".ssh"),
  },
  {
    category: "ssh-credentials",
    sensitivity: "secret",
    reason: "ssh-private-key-name",
    matches: ({ basename }) => isSshPrivateKeyName(basename),
  },
  {
    category: "private-key",
    sensitivity: "sensitive",
    reason: "pem-file",
    matches: ({ extension }) => extension === ".pem",
  },
  {
    category: "private-key",
    reason: "private-key-extension",
    sensitivityFor: ({ extension }) =>
      PRIVATE_KEY_EXTENSION_SENSITIVITIES.get(extension),
  },
  {
    category: "cloud-credentials",
    sensitivity: "secret",
    reason: "aws-credentials",
    matches: (facts) => endsWithComponents(facts, [".aws", "credentials"]),
  },
  {
    category: "cloud-credentials",
    sensitivity: "secret",
    reason: "aws-sso-cache",
    matches: (facts) => hasComponentSequence(facts, [".aws", "sso", "cache"]),
  },
  {
    category: "cloud-credentials",
    sensitivity: "secret",
    reason: "gcloud-credentials",
    matches: (facts) =>
      endsWithComponents(facts, [".config", "gcloud", "credentials.db"]) ||
      endsWithComponents(facts, [".config", "gcloud", "access_tokens.db"]) ||
      endsWithComponents(facts, [
        ".config",
        "gcloud",
        "application_default_credentials.json",
      ]),
  },
  {
    category: "service-credentials",
    sensitivity: "secret",
    reason: "github-cli-credentials",
    matches: (facts) =>
      endsWithComponents(facts, [".config", "gh", "hosts.yml"]),
  },
  {
    category: "cloud-credentials",
    sensitivity: "secret",
    reason: "kubeconfig",
    matches: (facts) => endsWithComponents(facts, [".kube", "config"]),
  },
  {
    category: "service-credentials",
    sensitivity: "secret",
    reason: "docker-auth",
    matches: (facts) => endsWithComponents(facts, [".docker", "config.json"]),
  },
  {
    category: "service-credentials",
    sensitivity: "secret",
    reason: "netrc",
    matches: ({ basename }) => basename === ".netrc",
  },
  {
    category: "package-auth",
    sensitivity: "sensitive",
    reason: "package-auth-file",
    matches: ({ basename }) => PACKAGE_AUTH_FILES.has(basename),
  },
  {
    category: "git-credentials",
    sensitivity: "secret",
    reason: "git-credential-store",
    matches: ({ basename }) => basename === ".git-credentials",
  },
];

function maximumSensitivity(matches: readonly ResourceMatch[]): ResourceSensitivity {
  if (matches.some(({ sensitivity }) => sensitivity === "secret")) {
    return "secret";
  }

  return matches.length > 0 ? "sensitive" : "ordinary";
}

function assertPathIdentity(value: unknown, label: string): void {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new ResourceClassificationError(
      `Classifier ${label} must be a non-empty path without null bytes`,
      { label, value },
    );
  }

  if (!path.isAbsolute(value)) {
    throw new ResourceClassificationError(
      `Classifier ${label} must be an absolute path`,
      { label, value },
    );
  }

  if (path.normalize(value) !== value) {
    throw new ResourceClassificationError(
      `Classifier ${label} must be a normalized path`,
      { label, value },
    );
  }
}

function identitySensitivity(
  rule: ResourceRule,
  facts: PathFacts,
): ResourceMatch["sensitivity"] | undefined {
  if ("sensitivityFor" in rule) {
    return rule.sensitivityFor(facts);
  }

  return rule.matches(facts) ? rule.sensitivity : undefined;
}

/**
 * Classifies path characteristics from a successful Phase 1A result.
 *
 * The input must be the exact object issued by {@link resolveWorkspacePath}.
 * Spreads, assignments, prototype inheritance, and descriptor copies do not
 * transfer the module-owned resolver identity and are rejected.
 *
 * This function is content-blind and does not authorize or enforce access.
 */
export function classifyPathResource(
  input: ResolvedPath,
): ResourceClassification {
  if (!isResolvedPath(input)) {
    throw new ResourceClassificationError(
      "Classifier input must be a successful Phase 1A path resolution result",
      input,
    );
  }

  assertPathIdentity(input.canonicalPath, "canonicalPath");
  assertPathIdentity(input.absolutePath, "absolutePath");
  assertPathIdentity(input.workspaceRoot, "workspaceRoot");

  const canonicalFacts = inspectPath(input.canonicalPath);
  const lexicalFacts = inspectPath(input.absolutePath);
  const matches: ResourceMatch[] = [];

  for (const rule of RULES) {
    const identitySensitivities: ResourceMatch["sensitivity"][] = [];
    const evidence: PathEvidence[] = [];

    const canonicalSensitivity = identitySensitivity(rule, canonicalFacts);
    if (canonicalSensitivity !== undefined) {
      identitySensitivities.push(canonicalSensitivity);
      evidence.push("canonical-path");
    }

    const lexicalSensitivity = identitySensitivity(rule, lexicalFacts);
    if (lexicalSensitivity !== undefined) {
      identitySensitivities.push(lexicalSensitivity);
      evidence.push("lexical-path");
    }

    if (identitySensitivities.length > 0) {
      matches.push({
        category: rule.category,
        sensitivity: identitySensitivities.includes("secret")
          ? "secret"
          : "sensitive",
        reason: rule.reason,
        evidence,
      });
    }
  }

  return {
    sensitivity: maximumSensitivity(matches),
    matches,
  };
}
