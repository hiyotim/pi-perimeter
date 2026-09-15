# Configuration Authorization

Status: implemented and independently reviewed as an unenforced policy primitive; owner acceptance is pending. No Pi tool consumes these results. Review evidence is in [CONFIGURATION-AUTHORIZATION-AUDIT.md](CONFIGURATION-AUTHORIZATION-AUDIT.md).

## Bounded schema

Each source is UTF-8 JSON, no larger than 64 KiB, with this complete version-1 shape:

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

Both top-level keys are required and no other key is permitted. `operations` may be empty and may contain each of exactly `read`, `write`, and `edit` at most once. Values are exactly the primitive strings `ALLOW`, `ASK`, and `DENY`. There is no coercion, normalization, case folding, aliasing, migration, or permissive recovery. Duplicate keys, including equivalent escaped keys, malformed JSON, unknown keys or operations, unsupported versions, missing required values, excessive nesting, and oversized input invalidate the whole source.

The parser accepts a primitive string, builds its own key maps, and issues a frozen policy value registered in a private identity set. It rejects other runtime values before property access, so inherited properties, accessors, proxies, boxed strings, iterators, and coercion hooks cannot supply policy. The stored operation map and its containing policy are frozen and share no mutable input object.

## Sources and lifecycle

`loadOperationPolicySources(resource, trustedUserConfigRoot)` loads exactly two optional files for one evaluation snapshot:

- user/global: `<trustedUserConfigRoot>/pi-warden/policy.json`;
- project: `<resource.workspaceRoot>/.pi-warden/policy.json`.

The user root is a trusted host input, not configuration payload. It must be an absolute, normalized, existing, canonical directory and must not itself be a symlink. The project root comes only from a genuine resolver-issued resource; project data cannot replace or relabel it. Source roles come from these fixed loader positions. Embedded `source`, `role`, trust, workspace, classification, or path fields are unknown schema keys and invalidate the source.

Missing fixed source paths are absence and contribute nothing. Other lookup, type, open, or read failures invalidate that source. Every existing component below either root is checked without following symlinks; the final file is opened with `O_NOFOLLOW`, must be a regular single-link file, and is read from that descriptor. Symlinked or hard-linked policy aliases are rejected. The loader returns one frozen, privately issued source set and privately binds it to the canonical workspace from the genuine loading resource. A forged source set, or an issued set substituted into evaluation for another genuine workspace, fails closed.

This is a bounded loading-time check, not a general filesystem isolation or TOCTOU guarantee. An attacker able to replace ancestor directories concurrently remains an enforcement-time concern. No project file is granted trusted authority, and both source roles currently have the same restriction-only lattice effect.

## Effective decisions and failure domains

For an exact supported operation and a genuine resolver-issued resource, `evaluateEffectivePath` obtains the accepted read/write/edit baseline internally. It then merges every entry for that exact operation under `ALLOW < ASK < DENY`. A valid entry for another operation has no effect. Equal and weaker entries are valid but cannot lower the result.

An absent source or absent exact-operation entry contributes nothing. An invalid loaded source denies every read, write, and edit decision consuming that source set; valid-looking entries are not salvaged. A forged source set also denies. Baseline resource/classification denials remain denials regardless of configuration.

The frozen result reports the operation, effective outcome and reason, complete baseline decision, and a fixed user/project source summary. Summaries expose only source role, status, validation/load code, and the applicable outcome or `null`; they do not expose paths, configuration payloads, or secret data. A configuration strengthening uses `CONFIGURATION_RESTRICTION`; a configuration failure over a non-denying baseline uses `CONFIGURATION_INVALID`. A baseline denial keeps its more specific resource reason while invalid-source detail remains visible in the source summaries.

## Explicit limits

The implementation adds no approvals, containment, path selectors, multiple-source framework, executable configuration, delete/rename policy, shell/network policy, audit sink, migration, or Pi hook. `ALLOW` is an unenforced policy result, not a capability or execution grant. `SANDBOX` is not a valid authorization outcome. The extension entry point remains empty.
