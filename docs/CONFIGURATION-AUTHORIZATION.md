# Configuration Authorization

The policy loader and evaluator are implemented and consumed by the supported file and shell gates. No configuration is required for default file authorization and closed-network shell execution. File-operation entries can only make the built-in policy stricter; `ALLOW` cannot override a secret denial or another restriction.

This document describes current configuration behavior. The original primitive review is preserved in [CONFIGURATION-AUTHORIZATION-AUDIT.md](CONFIGURATION-AUTHORIZATION-AUDIT.md); integration and acceptance records are in [FILE-GATE.md](FILE-GATE.md), [NETWORK-GATE.md](NETWORK-GATE.md), and [STATE.md](../STATE.md).

## Bounded schema

Each source is UTF-8 JSON, no larger than 64 KiB, with this minimal version-1 shape:

```json
{
  "version": 1,
  "operations": {
    "read": "ASK",
    "write": "DENY",
    "edit": "ALLOW"
  }
}
```

Both top-level keys are required. The only additional permitted key is the optional `network` section described below. `operations` may be empty and may contain each of exactly `read`, `write`, and `edit` at most once. Values are exactly the primitive strings `ALLOW`, `ASK`, and `DENY`. There is no coercion, normalization, case folding, aliasing, migration, or permissive recovery. Duplicate keys, including equivalent escaped keys, malformed JSON, unknown keys or operations, unsupported versions, missing required values, excessive nesting, and oversized input invalidate the whole source.

The parser accepts a primitive string, builds its own key maps, and issues a frozen policy value registered in a private identity set. It rejects other runtime values before property access, so inherited properties, accessors, proxies, boxed strings, iterators, and coercion hooks cannot supply policy. The stored operation map and its containing policy are frozen and share no mutable input object.

## Sources and lifecycle

`loadOperationPolicySources(resource, trustedUserConfigRoot)` loads exactly two optional files for one evaluation snapshot:

- user/global: `<trustedUserConfigRoot>/pi-warden/policy.json`;
- project: `<resource.workspaceRoot>/.pi-warden/policy.json`.

In Pi integration, `<trustedUserConfigRoot>` is Pi's agent directory, resolved by `getAgentDir()`: normally `$HOME/.pi/agent`, or the selected `PI_CODING_AGENT_DIR`. These policy-directory spellings are retained from the former project name.

The user root is a trusted host input, not configuration payload. It must be an absolute, normalized, existing, canonical directory and must not itself be a symlink. The project root comes only from a genuine resolver-issued resource; project data cannot replace or relabel it. Source roles come from these fixed loader positions. Embedded `source`, `role`, trust, workspace, classification, or path fields are unknown schema keys and invalidate the source.

Missing fixed source paths are absence and contribute nothing. Other lookup, type, open, or read failures invalidate that source. Every existing component below either root is checked without following symlinks; the final file is opened with `O_NOFOLLOW`, must be a regular single-link file, and is read from that descriptor. Symlinked or hard-linked policy aliases are rejected. The loader returns one frozen, privately issued source set and privately binds it to the canonical workspace from the genuine loading resource. A forged source set, or an issued set substituted into evaluation for another genuine workspace, fails closed.

This is a bounded loading-time check, not a general filesystem isolation or TOCTOU guarantee. An attacker able to replace ancestor directories concurrently remains an enforcement-time concern. No project file is granted trusted authority, and both source roles currently have the same restriction-only lattice effect.

## Effective decisions and failure domains

For an exact supported operation and a genuine resolver-issued resource, `evaluateEffectivePath` obtains the accepted read/write/edit baseline internally. It then merges every entry for that exact operation under `ALLOW < ASK < DENY`. A valid entry for another operation has no effect. Equal and weaker entries are valid but cannot lower the result.

An absent source or absent exact-operation entry contributes nothing. An invalid loaded source denies every read, write, and edit decision consuming that source set; valid-looking entries are not salvaged. A forged source set also denies. Baseline resource/classification denials remain denials regardless of configuration.

The frozen result reports the operation, effective outcome and reason, complete baseline decision, and a fixed user/project source summary. Summaries expose only source role, status, validation/load code, and the applicable outcome or `null`; they do not expose paths, configuration payloads, or secret data. A configuration strengthening uses `CONFIGURATION_RESTRICTION`; a configuration failure over a non-denying baseline uses `CONFIGURATION_INVALID`. A baseline denial keeps its more specific resource reason while invalid-source detail remains visible in the source summaries.

## Optional network destinations

The trusted user/global policy may add a narrow destination list:

```json
{
  "version": 1,
  "operations": {},
  "network": {
    "destinations": [
      { "host": "registry.npmjs.org", "ports": [443] }
    ]
  }
}
```

There are no built-in trusted destinations. The project source may restrict matching hosts or ports and cannot add authority. The example allows a destination, not all package-manager behavior: other endpoints, redirects, unsupported clients, and unrepresentable requests can still be refused. Representable destinations may also be approved for one invocation. Invalid network configuration invalidates the source and fails closed.

Read the [network contract](NETWORK-GATE.md#5-policy-sources-and-monotonicity) for exact validation, composition, approvals, and broker limits. Allowed endpoints can receive data a contained process can read.

## Explicit limits

Configuration supplies policy data, not executable code, permanent approvals, or containment. It provides no path selectors, delete/rename policy, migration, or permissive error recovery. `SANDBOX` is not a valid operation-policy value. An effective `ALLOW` still requires the gate's supported execution route and any applicable containment checks. See [usage](USAGE.md) for the effect on normal work.
