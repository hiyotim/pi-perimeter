# Read-path default decision contract

Status: implemented and accepted for `20260911-read-path-default-decisions` after independent security review on 2026-09-11. This remains an unenforced path-rule primitive.

## Goal and trust boundary

Add a synchronous, filesystem-read-free default policy primitive for a single read path. It consumes a genuine Phase 1A `ResolvedPath`, obtains classification internally from Phase 1B, and returns one structured `ALLOW`, `ASK`, or `DENY` result. This is the first bounded portion of the roadmap decision item, not completion of the entire policy engine.

Proposed public entry point in `src/policy/decisions.ts`:

```ts
evaluateReadPath(operation: "read", resource: ResolvedPath): ReadPathDecision
```

The operation is explicit so a runtime caller cannot submit an unsupported operation and accidentally obtain the read policy. TypeScript only admits the literal `"read"`; JavaScript or cast-based invalid input must still fail closed. The result is a readonly discriminated union with exactly `decision` and `reason`, with only the combinations below. It is not a transferable approval or a capability token.

The caller must obtain the resource through `resolveWorkspacePath` using the trusted active workspace. Resolver issuance proves identity and integrity, not who authorized that workspace root. The function must not accept caller-supplied sensitivity, membership, classification, approval, configuration, or bypass flags.

## Ordered decision table

Evaluate in this order; emit exactly one row's complete result:

| Condition | decision | reason |
| --- | --- | --- |
| Resource is not a genuine resolver-issued object | `DENY` | `INVALID_RESOURCE` |
| Operation is anything other than the exact string `read` | `DENY` | `UNSUPPORTED_OPERATION` |
| Internal classification is `secret` | `DENY` | `SECRET_RESOURCE` |
| Internal classification is `sensitive` | `DENY` | `SENSITIVE_RESOURCE` |
| Ordinary resource has `targetExists === false` | `DENY` | `READ_TARGET_MISSING` |
| Ordinary existing resource has `insideWorkspace === true` | `ALLOW` | `WORKSPACE_READ` |
| Ordinary existing resource is outside the workspace | `ASK` | `EXTERNAL_READ` |

An unknown or invalid resource is never ordinary. Check issuance before reading resource properties; property traps on forged objects must not be invoked. Unsupported operations cannot reach an allow row. Classification errors must propagate as errors rather than becoming `ALLOW` or `ASK`; there is no fallback classification. Resolver errors remain outside this synchronous function and stop the calling chain.

Both `secret` and `sensitive` are denied without a routine approval override in this default primitive. This covers templates, generic keys, and package-auth names. Secret evidence retains precedence over sensitivity, missing targets, and workspace membership. For ordinary resources, membership uses the canonical relation issued by Phase 1A, including when the lexical name is external but its target is inside. Lexical sensitive evidence can still deny that path through Phase 1B.

## Meaning and limitations

`ALLOW` means only that the fixed default read-path rule passes. A future central engine must combine it with trusted configuration and other applicable restrictions; this result cannot override a stronger deny. `ASK` requests future explicit approval and is not approval itself. No UI, approval consumption, filesystem read, or tool execution happens here.

This primitive does not determine filesystem object type. An existing ordinary directory can pass the path rule; this does not authorize recursive traversal, enumeration, reading descendants, or following application-specific aliases. Future tool integration must validate operation semantics and each resource actually accessed. Ordinary filenames may contain secrets. Filesystem state may change after resolution, including after a missing/existing check. TOCTOU, hard links, mounts, and all Phase 1A limitations remain.

Writes, edits, deletes, renames, directory enumeration, multi-path operations, shell commands, network access, environment-variable classification, configuration merging, and approval exceptions are outside this Goal. No `SANDBOX` outcome is introduced: containment remains an orthogonal, later requirement. No Pi integration is authorized.

## Required regression evidence

Use genuine resolver results from temporary fabricated workspaces and external resources. Compare complete literal results for every table row and its precedence overlaps. Include secret and sensitive resources inside/outside, missing ordinary/secret/sensitive paths, both alias directions across the workspace boundary, secret-target and sensitive-looking aliases, compound templates, `.key`/`.p12` mixed aliases, unknown operations, and forged provenance.

Provenance tests include spread, `Object.assign`, inheritance, descriptor copies, serialized copies, proxies, copied symbols, null/primitives, and structural objects with claimed ordinary/inside flags. Include a forged getter/proxy that throws on property access to prove issuance is checked first. Type checks must reject non-read operations, structural resources, writes to result fields, and invalid decision/reason combinations. Existing path and classifier contracts must remain byte-identical.
