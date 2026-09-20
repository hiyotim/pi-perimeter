# Implementation Handoff

Task ID: `20260919-restricted-networking-e2e-evidence`
Baseline: `e8cab0cc08b9de8e0d755067559f14ba893c1396`

## Goal

Complete Goal 4: permit narrowly scoped outbound development connections from
the accepted contained shell route, with destination/session-bound authority
and end-to-end evidence that network access does not weaken accepted policy,
approval, filesystem, environment, containment, or export boundaries.

## Context

- Goals 1–3 and Phases 1–3 are accepted. Goal 3's exact source/test identities,
  contract, evidence and limitations are in `docs/shell-gate-hashes.json`,
  `docs/SHELL-GATE.md`, `docs/SHELL-GATE-AUDIT.md`, and `STATE.md`.
- The accepted target remains macOS 27.0 (26A428), arm64. Other platforms and
  OS builds are unsupported until separately authorized and evidenced.
- The current Seatbelt profile is deny-default and emits no network or Mach
  allowance. Network command classes are hard-denied, shell approvals cannot
  widen the profile, proxy variables are absent, and model `bash` plus user
  `!`/`!!` share one controlled lifecycle.
- Goal 3's variant-B boundary remains unchanged: complete descendant
  termination, an atomic tree snapshot, protection from independent same-user
  host writers (B3), and mount isolation are not guaranteed.
- Opening one endpoint is an exfiltration capability: an authorized endpoint
  may receive any child-readable projected data. Do not claim broader
  exfiltration resistance.

## Scope

- Before dependent implementation, write an explicit network contract and
  threat/enforcement model defining the supported destination identity,
  protocols, address families, ports, resolution lifecycle, redirects,
  proxies, approval scope, expiry/revocation, and failure behavior. Evidence,
  not command parsing, must establish that the chosen target can enforce it.
- Initial production capability is outbound client TCP to an exact authorized
  destination set. Inbound/listen, UDP, Unix-domain sockets, Mach/broker
  routes, loopback, private/link-local/metadata destinations, and arbitrary
  child-originated DNS remain unavailable unless the contract supplies a
  separately reviewed, equally narrow enforcement rule. Unsupported or
  ambiguous forms fail closed.
- Add the minimum trusted-host network policy needed for fixed development
  allowlists and one-invocation/session-scoped approvals. Repository-controlled
  data may request or further restrict access but must never add a destination,
  approve itself, persist a grant, or weaken trusted global policy.
- Bind every grant to the displayed destination identity and actual enforced
  connection scope, the current runtime/session, containment identity and
  relevant policy state. Reuse is allowed only when explicitly represented by
  that scope; mismatch, timeout, refusal, malformed UI, replay, revocation or
  missing enforcement blocks before network bytes can flow.
- Extend the existing shell policy, approval, containment and gate layers only
  as needed. Preserve the one route for model `bash` and user `!`/`!!`; there
  must be no second spawn path, host-side network escape, or unrestricted
  fallback.
- Cover redirects, DNS changes/rebinding, IPv4/IPv6, shared-address ambiguity,
  explicit and environment proxies, alternate command encodings, nested
  interpreters, subprocesses, and direct socket use. A redirect or later
  resolution cannot inherit authority for a different destination.
- Preserve the constructed environment and protected filesystem/control-plane
  zones. This Goal does not introduce provider credentials, credential brokers,
  host agent sockets, general secret discovery, host delete/rename, or broader
  file-tool capability.
- Add isolated regression/effect tests, a network-gate contract, audit and exact
  artifact manifest. Update current architecture, threat model, user-facing
  limitations, compatibility/status and release evidence to match only the
  demonstrated behavior.

## Acceptance Criteria

1. With no applicable trusted allowlist or matching live approval, networking
   remains closed exactly as in Goal 3. Unsupported platform, stale identity,
   policy/enforcement setup failure, and partial initialization all fail closed
   without spawning an unrestricted child.
2. At least one ordinary dependency-fetch or source-fetch development workflow
   succeeds through the production adapter on the declared target and only to
   the exact authorized destination set. Positive controls show the fixture or
   service is actually reachable.
3. A fixed trusted destination follows documented policy. An unknown but
   representable destination requires an accurate, narrowly scoped approval;
   `DENY` and protected-resource outcomes have no approval bypass. Project
   configuration cannot make either case more permissive.
4. Approval does not transfer across host/address identity, port, protocol,
   runtime, session, policy/profile identity, redirect target, expiry,
   revocation or replay. No network bytes are sent before the matching authority
   and enforcement are both active.
5. Actual-effect tests prove that unapproved external endpoints, DNS exfiltration,
   redirects, proxy tunneling, rebinding, alternate IP families, loopback,
   local/private/link-local/metadata services, UDP, listening sockets,
   Unix-domain sockets and Mach/broker routes cannot escape the accepted scope.
   Parser or source inspection alone is not evidence.
6. Allowed connections do not expose host credentials or environment, reveal
   excluded/protected files, grant access to the original workspace, weaken
   per-target export authorization, lower a `DENY`, or change Goal 3's captured
   bytes and cleanup guarantees.
7. Malicious-repository end-to-end cases combine project configuration,
   symlinks, scripts, nested processes, misleading commands and network attempts
   across file tools and both shell entry routes. Each claimed boundary has a
   biting regression or an explicitly bounded limitation.
8. Network status and approval surfaces show non-secret canonical scope,
   containment state and refusal reasons without logging payloads, secrets or
   credentials. Documentation states that permitted endpoints can receive
   projected workspace data.
9. All changed accepted artifacts receive new identities and fresh checks.
   Complete relevant suites pass on the declared target, and a fresh independent
   security review of the final snapshot has no unresolved blocking finding.
10. Finish implemented and verified, awaiting owner acceptance. Do not mark
    Goal 4 or Phase 4 accepted, publish, install into a real Pi profile, commit,
    push, or begin a later release Goal.

## Verification

- Confirm clean ancestry from the Baseline, current status, and the accepted
  Goal 2/3 manifests before edits. Preserve the `mac-local-before-migration`
  stash.
- Re-check the installed/current supported Pi API and record the actual hooks,
  versions and behavior used by both shell entry routes. Historical API notes
  are not sufficient.
- Run focused pure-policy, parsing, approval/profile-generation and failure-path
  tests while developing. Use only temporary synthetic fixtures and fake data;
  never read real credentials.
- On macOS 27.0 (26A428), arm64, exercise the production binary/profile and
  actual socket effects with working positive controls. Include the authorized
  workflow plus the negative cases in Acceptance Criteria 4–7, descendants,
  cancellation, timeout, crash and cleanup.
- Re-run the accepted closed-network controls with no capability and verify
  Goal 2 file gates plus Goal 3 import, environment, containment, quiescence,
  freeze and export regressions remain intact.
- Run the repository-supported native build, targeted containment/package
  checks, `npm run check`, manifest tests and `git diff --check`. Record exact
  counts, platform skips, toolchain/OS identities and artifact hashes; a skip on
  the declared target blocks acceptance evidence.
- Perform adversarial mutation/probe checks where a passing test could otherwise
  be non-biting, especially destination substitution, redirect/proxy bypass,
  approval binding and fail-open paths.
- Obtain a fresh independent review after the final implementation and evidence
  snapshot. Fix findings within this Goal and repeat only the affected checks
  and review before the final full verification.

## Constraints

- Preserve all accepted authorization ordering (`ALLOW < ASK < DENY`), trusted
  configuration authority, protected-resource rules, approval separation,
  original-workspace isolation, constructed environment, descriptor envelope,
  controlled export and fail-closed behavior.
- A hostname, parsed command, URL string, DNS answer or approval prompt is not
  by itself an enforcement boundary. Do not claim destination binding beyond
  the identity actually constrained at connection time.
- Keep security-critical code and runtime dependencies small and auditable. No
  new runtime dependency, privileged daemon/helper, system extension, packet
  filter/global proxy change, elevated setup, new containment class or broader
  platform support is authorized by this handoff.
- Do not put policy authority or durable approval state in repository-writable
  files or child-writable invocation roots. Do not make network availability a
  condition that weakens filesystem or export checks.
- Do not use real credentials, host credential stores, SSH agents, cloud tokens
  or a user's actual service accounts in implementation or tests.
- Historical audits remain historical. Changed bytes require new evidence; do
  not transfer Goal 3 PASS claims to Goal 4 artifacts.
- Public beta/v1 acceptance, publication, real-profile installation, commit and
  push remain separate owner actions.

## Execution Notes

Establish the enforceable network contract and target-platform effect evidence
before writing dependent policy or approval code. Then complete the smallest
coherent implementation, regressions, documentation, manifest, full checks and
fresh independent review. Routine design choices and review fixes inside this
contract are autonomous; do not stop at an experiment, partial component or
initial test pass.

## Escalate If

Stop and report before proceeding if implementation would require:

- changing this Goal or its Acceptance Criteria;
- weakening an accepted Goal 1–3 invariant or changing the variant-B boundary;
- permitting a destination without enforceable connection-time identity, or
  the declared target cannot enforce the required scope against redirects,
  DNS/proxy indirection and descendants;
- a new runtime dependency, privileged component, global OS/network setting,
  credential injection, different containment class or broader platform claim;
- widening the initial protocol/local-network scope above;
- an unapproved public/external contract, destructive migration, publication,
  real-profile installation, commit or push;
- proceeding from a materially changed or ambiguous baseline; or
- unavailable declared-target or independent-review evidence.
