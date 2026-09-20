# Network Gate Contract (Goal 4)

Status: implementation contract for `20260919-restricted-networking-e2e-evidence`.
Written before dependent code, as required by
[IMPLEMENTATION_HANDOFF.md](../IMPLEMENTATION_HANDOFF.md). It describes the
behaviour the implementation must have. It is not evidence that the behaviour
exists: the effect evidence is recorded in
[NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md), and every guarantee below is
bounded exactly as stated in §11.

This contract extends the accepted Goal 3 shell gate
([SHELL-GATE.md](SHELL-GATE.md)) without changing any accepted Goal 1–3
contract. Everything the shell gate guarantees for a closed network remains
true whenever the network scope of an invocation is empty; a non-empty scope
adds exactly one contained route and nothing else.

## 1. Outcome and boundaries

The contained shell can make outbound client TCP connections to a fixed,
destination-exact development destination set — trusted allowlist entries
plus, per invocation, narrowly approved representable destinations — through a
per-invocation network broker. Every other network capability stays closed at
the kernel boundary, exactly as in Goal 3: no inbound/listen, no UDP, no
Unix-domain sockets, no Mach lookups, no direct connections to any address
except the broker's loopback endpoint, no arbitrary child-originated DNS, no
proxy escape.

Not in scope: any platform beyond the declared target (§2), any protocol
other than outbound TCP carried through HTTP CONNECT tunnels, inbound
connections to non-local addresses, plain-HTTP
(`http://`) transfers, credential brokers, provider credentials, and any
change to the accepted file gates, projection, export, or approval mechanics.

An authorized endpoint is an exfiltration capability: data the contained
process can read (its projected workspace copies, its output, anything it can
encode) can be sent to any destination in the invocation's enforced scope. No
broader exfiltration resistance is claimed.

## 2. Declared target and enforcement vocabulary

The declared target is unchanged from the shell gate §2: macOS 27.0
(build `26A428`), Darwin major 27, arm64, `/usr/bin/sandbox-exec` at the
pinned SHA-256, the native helper as built by `scripts/build-native.mjs`.

On this target the SBPL profile parser accepts network host filters only in
these forms (probe-recorded in the audit §2):

* `(remote tcp "*:PORT")` / `(remote ip "*:PORT")` — any destination host, one port;
* `(remote tcp "localhost:PORT")` / `(remote ip "localhost:PORT")` — loopback, one port;
* unfiltered `(allow network-outbound)`, `(allow network-bind)`, `(allow network-inbound …)`.

It **rejects every destination-exact form**: a literal IPv4 or IPv6 address,
a hostname, a CIDR/masked form, with or without a port. The audit records the
refusals. Consequently:

**N1. A Seatbelt profile on this target cannot express destination-exact
outbound allowances.** The profile therefore never carries a destination
allowance. Its only possible network rule is the per-invocation broker
endpoint `(allow network-outbound (remote tcp "localhost:<port>"))`, emitted
exactly when the invocation has a non-empty network scope, and nothing else.

What that rule demonstrably permits (probe-recorded on the declared target) is
**one TCP port on local addresses**: connecting to `127.0.0.1:<port>` (the
broker), and equally to another local address of the machine or to an
IPv4-mapped loopback form, at exactly that port. Every neighbouring port, every
non-local address (public, private, metadata), every UDP send, `bind`/`listen`,
and every Unix-domain connect is kernel-denied (EPERM). IPv6 forms of that
port are evaluated by the same local-address rule; a connect to `::1:<port>`
with no listener is refused by the kernel connection, not by the sandbox.

The broker itself binds `127.0.0.1` only, so the surface this leaves outside
the broker is a listener that some *other* local process happens to place on
the same ephemeral port on another local address during the invocation — a
same-user surface inside the accepted B3 boundary, declared in §12. No remote
destination is reachable through the profile rule.

**N2. Child-originated DNS resolution is closed.** The profile contains no
`mach-lookup` rule ever. On the declared target the system resolver additionally
refuses sandboxed clients: `getaddrinfo`, `dscacheutil`, and curl name
resolution return no results even when a probe profile grants `mach-lookup`
(audit §2). Hostname resolution happens only in the trusted host process,
once per invocation at preparation time. A DNS change during the invocation
cannot redirect anything: the broker dials only the pinned addresses of §4,
and never re-resolves.

## 3. Trust boundaries

```text
Pi host process (trusted: policy, approvals, resolution pinning, broker, export)
  |  tool_call / user_bash            (untrusted input: command text, params)
  v
[ 1 authorize ]  shell plan + command risk + effective outcomes
                 network scope = (trusted allowlist ∩ project restriction)
                              ∪ (invocation-approved representable destinations)
                 approval (if any outcome is ASK), bound to the scope
  |                                   no process exists yet
  v
[ 2 prepare ]    platform/helper verification; destination resolution (host-side,
                 public-address validation, pinned); broker listener on 127.0.0.1:<random>
                 (started only for a non-empty scope); profile with the one
                 loopback rule; projection, sealing — unchanged from Goal 3
  v
[ 3 contain ]    unchanged Goal 3 launch; the profile's network rule admits only
                 the broker endpoint; every other socket operation is denied
  v
[ 4 tunnel ]     child tools tunnel through HTTP CONNECT; the broker enforces the
                 pinned scope at tunnel-open time, byte for byte
  v
[ 5 quiesce/export/clean ]  unchanged from Goal 3 (observational quiescence,
                 freeze, per-target re-authorization, captured-bytes invariant)
```

The production entry point for both shell routes is `authorizeShellRoute` /
`executeAuthorizedShellRoute`; the lower-level `runContainedShellCommand`
helper is an evidence/test checkpoint for the lifecycle and performs no policy
or approval step of its own, so no route may call it in place of the authorize
pair.

The broker is part of the trusted host process. It holds the pinned scope
(frozen at preparation), performs no resolution of its own at tunnel time, and
takes no policy decision beyond exact-scope matching. The child holds no
authority over it: a child can request tunnels, and every tunnel is checked
against the frozen scope.

## 4. Destination model

A **destination entry** is `(host, ports)`: one canonical hostname and an
explicit, sorted list of TCP ports. Rules:

1. `host` must be a canonical ASCII hostname: lowercase letters, digits,
   hyphens, dot-separated labels, each label 1–63 characters, total ≤ 253,
   no wildcard, no IP-literal form, no port suffix, no scheme. Validation is
   lexical and exact; anything else refuses the source (fail closed).
2. `ports` is a non-empty list of distinct integers 1–65535. There are no
   port ranges and no defaults in policy entries; `443` is listed explicitly.
3. At preparation time each entry is resolved by the host (its own resolver,
   outside containment). Only public addresses may enter the pinned scope:
   loopback, private, link-local, metadata (169.254.0.0/16), CGNAT, multicast,
   and unspecified addresses are excluded from the pin; an entry with no
   public resolved address makes the whole invocation refuse (fail closed).
   The pinned set records every accepted address family and address.
4. The pinned scope is immutable for the invocation: re-resolution is never
   performed, so a DNS change mid-invocation cannot move a tunnel to a new
   address. A stale pin fails the tunnel (fail closed), not a new resolution.
5. Authority is per destination identity, never per hostname-of-the-moment: a
   redirect to another host, a rebinding of a hostname, or a second hostname
   sharing the pinned address gains nothing (§7).

## 5. Policy sources and monotonicity

**Trusted user/global source** (`<trustedUserConfigRoot>/pi-warden/policy.json`,
the same file and loader as Goal 1): a new optional `network` section of the
same version-1 schema:

```json
{ "version": 1, "operations": { "read": "ALLOW" },
  "network": { "destinations": [ { "host": "registry.npmjs.org", "ports": [443] } ] } }
```

`network` absent is valid and means no trusted destinations. A document whose
`network` section is malformed is an invalid source (INVALID_SCHEMA) and
denies every decision that consumes it, exactly like any other invalid
source (fail closed). There is no built-in default destination: with no
trusted allowlist, the scope is empty and the route behaves byte-identically
to Goal 3.

**Project source** (`.pi-warden/policy.json`): may use the same `network`
key only as a **restriction**. Its destination list is joined by
intersection: a project entry removes a trusted destination or narrows its
ports. A project entry can never add a destination, cannot widen a port set,
and cannot weaken a trusted entry in any way. A project `network` section
when the trusted scope has no matching host contributes nothing. A malformed
project network section makes the project source invalid (fail closed).

Composition (pure, in `src/policy/network.ts`): for each trusted entry,
the project filter applies if it mentions that host at all; the effective
port set is the intersection. Hosts not mentioned by the project pass
through. The composed scope is part of the approval binding (§6).

**Repository-controlled data** (project configuration, projection files,
model output, command text) may request access (by containing a representable
destination in the command, §6) and may further restrict, but can never: add
a destination, approve itself, persist a grant, or weaken trusted policy.

## 6. Approvals

The network approval is an **invocation-scoped destination grant**, integrated
into the existing shell approval (no second approval path, no persistent
state):

1. Destinations statically visible in the entry command — the post-parse
   literal words of commands whose class can connect (`curl`, `wget`, `git`,
   `npm`, `pip3`, and the other listed network-class commands) — are
   **representable**. Extraction is bounded and literal: only a word spelled
   `https://host[:port]/…` contributes `(host, port)`, with an omitted port
   defaulting to `443`; an HTTPS Git remote URL is handled like any other
   HTTPS URL. A written port that is not a valid explicit value makes the word
   unrepresentable. `http://`, every other scheme, IP-literal hosts and all
   other forms stay unrepresentable and unreachable (fail closed).
   Extraction is deliberately one-directional: a destination the parser
   cannot see (coming from a config file, a script, or an environment) is
   unrepresentable and can only be reached through the trusted allowlist.
2. An effective destination not covered by the composed trusted scope makes
   the invocation `ASK`. The approval prompt shows the canonical destinations
   (`host:port` — no payload data, no secrets) alongside the standard command
   bindings; the invocation report additionally states the pinned address
   count and families per destination. `DENY` outcomes and
   protected-resource refusals keep their unconditional precedence; an
   approval can never satisfy them.
3. The grant is single-use, expires in the same 60 s window as the shell
   approval, and is bound to: the exact command text, the parsed form, the
   canonical workspace and cwd, the runtime instance and session epoch, the
   loaded policy states (now including the composed network scope), the
   generated profile hash (which fixes the broker port and the one loopback
   rule), the constructed environment hash (now including the proxy
   variables), the sealed inputs, the static resource outcomes, and the
   canonical network scope. Any mismatch, expiry, replay, missing UI,
   malformed or refused response blocks the invocation before any byte moves.
4. Session-scoped standing grants are **not** implemented in this Goal. A
   trusted allowlist entry is the standing authority; everything else is
   per-invocation. Reuse across invocations, sessions, runtimes, or policy
   states is impossible by construction (the bindings differ).
5. Revocation: disposing the invocation closes the broker listener and
   destroys the pinned scope. A cancelled, timed-out, crashed, or completed
   invocation loses the route immediately. There is no durable grant to
   revoke; the trusted allowlist is changed only in the trusted file by the
   trusted user.

## 7. Enforcement

**The broker.** Per invocation with a non-empty scope, the host opens one TCP
listener bound to `127.0.0.1` on an ephemeral port. It speaks only HTTP
CONNECT:

* it parses the first request line strictly and case-sensitively
  (`CONNECT host:port HTTP/1.0|1.1`; method tokens are case-sensitive, so a
  lowercase spelling is refused), bounded in size; anything else — other
  methods, malformed or missing host or port, an oversized request — is
  refused. Header lines after the request line
  are ignored (they carry no authority), and bytes after the header terminator
  are relayed as tunnel payload;
* the tunnel target must match one pinned entry **exactly**: the host string
  (case-folded) and the port must both match; the host must not be an
  IP-literal, a metadata, private, loopback, or link-local address form;
* the outbound connection is opened **to the pinned addresses only** — the
  addresses recorded for that host at preparation time, tried in the order the
  resolver returned them — never a fresh resolution;
* per tunnel and per invocation byte caps and tunnel concurrency are bounded;
  breaching destroys the tunnel and is reported;
* non-CONNECT traffic on the listener is refused. A second CONNECT written
  *inside* an established tunnel is opaque payload: it travels to the
  already-pinned destination and grants no new authority, exactly like any
  other bytes the child sends.

With an empty scope the broker is never started, no proxy variable is set,
and the profile contains no network rule. With a scope, the listener is opened
during preparation (the profile must embed its port) but **refuses every
request until the invocation is armed**, which happens only after the
invocation's authority is settled and the child is about to start; the
pre-approval window therefore has no reachable route.

**The profile.** One additional line, and only one, is added when the scope
is non-empty: `(allow network-outbound (remote tcp "localhost:<port>"))`,
emitted after the existing allowances. All Goal 3 deny overrides are emitted
unchanged. The port is a host-generated ephemeral value; no repository,
model, or tool-output value can influence any rule.

**The environment.** When the scope is non-empty the constructed environment
adds proxy variables pointing at the broker endpoint only:
`HTTP_PROXY`/`http_proxy`, `HTTPS_PROXY`/`https_proxy`, `ALL_PROXY`/
`all_proxy` (value `http://127.0.0.1:<port>`), and `NO_PROXY`/`no_proxy`
(empty), plus the npm-specific `npm_config_proxy`/`npm_config_https_proxy`
forms. No other variable is added; no host environment value leaks (the
variables are constructed values, not inherited ones). Their exact bytes are
part of the environment hash in the approval binding. A tool that ignores
these variables cannot reach the broker (its direct connects are
kernel-denied) and therefore cannot use the network at all.

**What a child can and cannot do.**

| Child attempt | Outcome |
| --- | --- |
| connect to the broker port, CONNECT to a pinned `host:port` | tunnel opens to the pinned addresses |
| CONNECT to any other host/port (redirect target, rebinding, shared-IP name, proxy service) | broker refuses (403), no outbound socket |
| direct TCP to any address (public, private, metadata) | kernel-denied (EPERM) |
| direct TCP to the broker port through a non-CONNECT payload | connection closed by the broker |
| UDP anywhere, including the broker port | kernel-denied (EPERM) |
| bind/listen anywhere | kernel-denied (EPERM) |
| Unix-domain socket connect | kernel-denied (EPERM) |
| name resolution (getaddrinfo/dscacheutil/curl) | fails (EAI_NONAME) — no resolver route |
| override proxy env inside the command to another endpoint | kernel-denied (port-exact profile) |

A redirect inside an allowed tunnel can only produce another CONNECT request
from the tool; the broker re-checks every CONNECT against the same frozen
scope, so a redirect target cannot inherit authority. A "later resolution"
cannot inherit authority: the broker never re-resolves (§4 rule 4).

## 8. TLS trust inside containment

The contained process validates TLS with its own toolchain trust store.
Declared facts (audit-recorded): node's built-in root store works inside
containment without reading any system trust file; the system CA bundle
`/etc/ssl/cert.pem` is **denied to the contained process by design** — the
accepted classifier treats every `*.pem` path as private-key evidence and the
profile denies those families, so curl (whose SecureTransport backend loads
that file when it verifies a proxy connection) fails closed with
"error setting certificate verify locations" unless the command supplies a
toolchain-internal CA explicitly. No user keychain, credential store, or
secret file is reachable for trust evaluation or anything else. This is a
declared limitation of TLS-capable tool availability inside containment, not
a weakening: a tool that cannot establish trust fails closed.

## 9. Status surfaces

Non-secret reporting only: the invocation report states the enforced scope
(`host:ports`, pinned address counts and families — never payload data), the
broker tunnel counts (opened/refused/failed), and refusal reasons verbatim.
The approval prompt shows the canonical scope before any tunnel exists. No
payload, URL path, credential, token, or session data is ever included in
status, logs, or reports.

## 10. Interaction with accepted boundaries

Networking cannot: weaken filesystem checks (projection, import, freeze,
export and their authorization are untouched); weaken export authorization
(per-target re-authorization unchanged); lower a `DENY` (decisions are
unchanged except that the network command class is no longer hard-denied
when a non-empty scope exists, and the `ASK` path above); expose host
credentials or environment (nothing new is inherited; the proxy variables are
constructed); or survive beyond the invocation (the broker and pinned scope
die with `dispose`). Goal 3's G1–G5 hold unchanged in all cases; with an
empty scope the enforcement profile and the constructed environment are
byte-identical to Goal 3, every effect the invocation can reach is unchanged,
and only the report and approval-prompt text carry the Goal 4 wording.

## 11. Guarantee wording

N1. A contained invocation either runs with zero network rules (empty scope;
behaviour identical to Goal 3) or with exactly one network rule granting only
its per-invocation broker endpoint — one TCP port on local addresses —
and no other network allowance is ever emitted, and no Mach rule is ever
emitted. Because the profile language cannot express a single loopback
address, that one port is local-address-scoped rather than broker-scoped; the
broker binds `127.0.0.1` and is the only service the route needs, and the
declared surface outside it is §12's relay limitation.

N2. A tunnel opens only when its CONNECT target matches one pinned entry
exactly (host string and port) and the outbound socket goes to the addresses
pinned at preparation time. Everything else fails closed.

N3. The scope is composed only from trusted-configuration entries and
per-invocation approvals; project data can only restrict it; no repository,
model, or tool-output value can widen it; no approval satisfies a `DENY` or a
protected-resource refusal.

N4. Authority is bound to the invocation's displayed destination identity and
its actual enforced scope (the pinned addresses and the broker endpoint), to
the command, workspace, runtime instance, session epoch, policy state,
profile, and constructed environment. Mismatch, expiry, replay, or revocation
(dispose) blocks before any byte flows.

N5. Child-originated DNS does not exist on this route (§2 N2); UDP,
listening, Unix-domain, Mach, and all non-broker direct
routes are kernel-denied; proxies and redirects cannot widen the scope.

N6. Allowed connections can receive any data the contained process can
read (the declared endpoint-exfiltration boundary). They cannot reach host
credentials, protected zones, the original workspace, or the excluded
projection objects, and they do not change any Goal 3 export, environment,
or containment guarantee.

N7. Every guarantee above is bounded by §11 of the shell gate (variant-B
boundary, declared target) and by the declared limitations below.

## 12. Declared limitations and residuals

* **Shared-address ambiguity:** authority is bound to the hostname string
  and the pinned addresses. Two unrelated hostnames behind one address are
  distinct authorities (the second is refused unless allowlisted), but TLS
  SNI is opaque to the broker: a pinned endpoint may co-host other virtual
  hosts, and traffic to the pinned hostname's address carries whatever the
  tool addresses it with.
* **Endpoint exfiltration:** any permitted endpoint can receive child-readable
  data (§1).
* **Relay surface:** any same-user host process can reach the broker endpoint
  while the invocation is armed and is served under the same frozen scope (the
  accepted B3 boundary includes the invocation's staging surface; the broker
  adds no authority beyond the pinned scope and no record of local callers).
  Before arming, the listener refuses every request, so the pre-approval
  window has no route. The profile rule that makes the endpoint reachable is
  port-exact but local-address-scoped (the profile language has no
  single-address form): during the invocation another local listener on the
  same ephemeral port and another local address would also be reachable by the
  child. That is the same same-user surface; it grants no remote destination,
  and the port is a host-generated ephemeral value.
* **Tool variance:** only tools that honour the proxy environment variables
  and speak HTTP CONNECT can use the route; tools that resolve names or open
  sockets directly fail closed. `http://` transfers fail closed (CONNECT
  only). TLS clients that need the system CA file fail closed (§8).
* **Stale pins:** a destination whose addresses change mid-invocation fails
  closed for the invocation and re-pins on the next one.
* **Non-darwin targets:** unchanged (blocked, as Goal 3).

## 13. Evidence

[NETWORK-GATE-AUDIT.md](NETWORK-GATE-AUDIT.md) records: the probe matrix
behind §2 (vocabulary and effects, including the parser's rejection of every
destination-exact form and the resolver behaviour), the end-to-end positive
controls (a real dependency fetch through the production adapter to the
authorized destination set only), the negative cases of §7, the adversarial
cases (destination substitution, redirect, proxy override, approval binding,
fail-closed paths), the exact artifact manifest, and the fresh independent
review of the final snapshot.
