# Network Gate Audit (Goal 4)

Status: executor evidence record for `20260919-restricted-networking-e2e-evidence`,
against the contract in [NETWORK-GATE.md](NETWORK-GATE.md). It records the
target-platform probe matrix, the end-to-end positive controls, the negative
cases, the adversarial mutation checks, the exact artifact identities with
their Goal 3 provenance, and the fresh independent review of the final
snapshot. Executor-run evidence below is labelled as such; reviewer-run checks
are labelled as reviewer evidence.

## 1. Environment identity

| Item | Recorded value |
| --- | --- |
| OS | macOS 27.0, build `26A428` (`sw_vers`), kernel `27.0.0` |
| Architecture | arm64 |
| Runtime | Node `v26.8.1` |
| Containment | `/usr/bin/sandbox-exec`, SHA-256 `58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8` (matches the pinned identity recorded at Goal 3 acceptance) |
| Pi | `@earendil-works/pi-coding-agent` `0.84.4` installed at the workspace; the extension surface used by both shell routes (`tool_call` gate + controlled `bash` tool; `user_bash` handler) is unchanged from the Goal 3 record and was re-verified present on this machine before the implementation (executor check: `npm ls` and the installed package's API surface) |
| Goal 3 manifests | `docs/shell-gate-hashes.json` (37 entries) and `docs/file-gate-hashes.json` (19 entries) verified against the working tree before edits: all entries matched, old hashes `d5e4e5f2…` and `9698efea…` |
| Baseline | `e8cab0cc08b9de8e0d755067559f14ba893c1396`, clean ancestry verified; the working tree changed only within this Goal's scope |
| Environment caveat | On this shell the sandboxed network is intercepted: name resolution returns synthetic `198.20.0.0/16` answers for every name, so "reachable on the public internet" cannot be distinguished from "reachable through the environment's interception". What the evidence below establishes is the enforcement path (destination identity, tunnel accounting, fail-closed behavior), not properties of the wider internet. |

## 2. Enforcement vocabulary: probe matrix (executor-run, real processes)

Every network-filter form the profile language offers was probed against the
pinned `sandbox-exec` on the declared target, with the real generated base
profile (Goal 3's deny-default profile text, byte-identical generation) plus
one candidate rule. Results:

| Rule attempted | Parser verdict |
| --- | --- |
| `(allow network-outbound (remote ip "198.20.0.237:443"))` | **REFUSED** — "host must be * or localhost in network address" |
| `(allow network-outbound (remote ip "198.20.0.237"))` | REFUSED — "port missing in network address" |
| `(remote tcp "registry.npmjs.org:443")` (hostname) | REFUSED — same host restriction |
| `(remote ip "198.20.0.0/24:443")` (CIDR) | REFUSED |
| `(remote ip "[::1]:443")`, `"::1:443"`, `"0:0:0:0:0:0:0:1:443"` (IPv6 literals) | REFUSED |
| `(remote host "…")` | REFUSED — no `host` filter exists on this build |
| `(allow network-outbound (remote tcp "*:443"))` | accepted (quoted) |
| `(allow network-outbound (remote ip "*:443"))` | accepted |
| `(allow network-outbound (remote ip "localhost:443"))` | accepted |
| `(allow network-outbound (remote tcp "localhost:42429"))` | accepted (the broker rule) |
| `(allow network-bind)` / `(allow network-inbound (local ip "*:8080"))` | accepted (never emitted by pi-warden) |

Apple's own system profiles under `/System/Library/Sandbox/Profiles/` use the
same restricted vocabulary (`(remote tcp "*:25")`, `(deny network-outbound
(remote ip "localhost:631"))`); no destination-IP or hostname filter appears
anywhere. This establishes contract §2 N1: **no destination-exact outbound
allowance is expressible in the profile language on the declared target.**

## 3. Connection-time effect matrix (executor-run)

The compiled C probe (`probe.c`, no interpreter dependency) runs inside
containment under the production base profile plus exactly one network rule
(`(allow network-outbound (remote tcp "localhost:42429"))`), with a host-side
loopback listener on 42429 as the positive control:

```text
tcp4 127.0.0.1:42429 CONNECT-OK        (the broker endpoint is reachable)
tcp4 127.0.0.1:42430 DENIED errno=1    (EPERM — port-exact)
tcp4 198.20.0.237:443 DENIED errno=1   (EPERM — no direct external egress)
tcp4 198.20.0.239:443 DENIED errno=1   (EPERM)
tcp4 10.255.255.1:443 DENIED errno=1   (EPERM — no private-range egress)
tcp6 ::1:42429 errno=61              (permitted by the rule; ECONNREFUSED — nothing listened)
tcp6 ::1:443 DENIED errno=1
udp4 198.20.0.237:443 DENIED errno=1   (EPERM — UDP, even to the allowed port)
udp4 8.8.8.8:53 DENIED errno=1
udp4 127.0.0.1:53 DENIED errno=1
listen4 42431 DENIED errno=1           (EPERM — bind/listen)
listen4 0 DENIED errno=1
unix /var/run/syslog DENIED errno=1    (EPERM — no Unix-domain route)
unix /private/tmp/… DENIED errno=2
dns registry.npmjs.org DENIED gai=8    (EAI_NONAME — no resolver route)
dns localhost OK                       (/etc/hosts only)
```

The rule's actual scope was measured in the round-2 review (executor-run
there, reproduced here): `127.0.0.1:<port>` connects, the machine's own LAN
address on that port connects, an IPv4-mapped loopback form connects, `::1` on
that port is permitted (ECONNREFUSED with no listener), while `127.0.0.2`,
`192.168.1.1`, `8.8.8.8`, the neighbouring port and every other port/protocol
are EPERM. The profile language cannot express a single loopback address, so
the enforced rule is one TCP port on local addresses; the broker binds
`127.0.0.1` only and nothing else is served, which is why the contract states
the scope this way and declares the residual local-address surface.

The resolver control was probed further (executor-run): even a probe profile
that grants `mach-lookup` (to `com.apple.mDNSResponder` and
`com.apple.mDNSResponder.d3shared`), or all Mach lookups, or all Mach lookups
plus outbound DNS ports, cannot resolve a name inside containment —
`curl` reports "Could not resolve host" and `dscacheutil` returns no results.
On the declared target, a sandboxed client cannot use the system resolver even
when Mach allowances are granted; pi-warden's generated profiles never emit a
Mach rule at all. This establishes contract §2 N2: **child-originated DNS does
not exist on this route.**

## 4. End-to-end positive controls (executor-run)

### 4.1 The contained tunnel opens to the authorized destination only

The registered suite (`test/network-effects.test.ts`) prepares one invocation
with a non-empty scope (`registry.npmjs.org:443` from the trusted user
policy), runs the real profile and helper, and probes from inside containment:

```text
pinned-tunnel:    HTTP/1.1 200 Connection established
substitution:     HTTP/1.1 403 Forbidden
redirect-target:  HTTP/1.1 403 Forbidden
wrong-port:       HTTP/1.1 403 Forbidden
loopback-target:  HTTP/1.1 403 Forbidden
metadata-target:  HTTP/1.1 403 Forbidden
no-port:          HTTP/1.1 400 Bad Request
bracket-target:   HTTP/1.1 400 Bad Request
not-connect:      HTTP/1.1 405 Method Not Allowed
broker-neighbor-port: direct-denied:EPERM
udp-broker-port:  udp-denied:EPERM
listen:           listen-denied:EPERM
resolver:         dns-denied
proxy-override:   override-denied:EPERM
```

The redirect row is the mechanically identical case to substitution: a tool
that follows an HTTP redirect opens a new CONNECT to the new host, and the
broker refuses it because it is not in the pinned scope. The proxy-override
row re-points the child's own `HTTPS_PROXY` at a neighbouring loopback port;
the profile's port-exact rule denies the connection outright.

The positive control is gated by a host-side reachability probe of the same
destination: when the host cannot reach it, the suite asserts the route fails
closed (bad gateway/closed) instead of succeeding, never the reverse.

### 4.2 An ordinary dependency fetch through the containment adapter (executor-run)

The evidence/test lifecycle checkpoint `runContainedShellCommand` — which
exercises the same containment adapter the production routes use but performs no
policy or approval step of its own — was exercised with a real dependency fetch:
the child ran
`npm install ms --no-audit --no-fund` in a fixture workspace under the
generated profile whose only network rule is the invocation's broker endpoint,
with the constructed environment plus the Goal 4 proxy variables
(`HTTP(S)_PROXY`/`ALL_PROXY` = `http://127.0.0.1:<port>`, `NO_PROXY=""`,
`npm_config_proxy`/`npm_config_https_proxy` same). Recorded output:

```text
added 1 package in 749ms
```

The quoted connection line above comes from the executor's instrumented
research broker (a scratch probe with logging, not a shipped artifact); the
production broker logs nothing. The shipped artifact's own record of the same
class of run is its report line, whose shape the registered end-to-end runs
show:

```text
network scope enforced via broker port <port>: registry.npmjs.org (ports 443 -> 1 pinned address(es), IPv4); tunnels 2 opened, 0 refused, 0 failed, <n> bytes relayed
```

The installed package loads after the run (`ms 2.1.3`). The broker's pinned
dial is host-side; the child saw only the loopback proxy variables.

### 4.3 TLS trust inside containment (executor-run)

The contained child performs TLS with its own toolchain trust store: an
executor probe (a node tunnel client run under the generated profile, recorded
in §2's session) completes a TLS session to `registry.npmjs.org` through the
broker (HTTP 200 with 701 bytes of content) using node's built-in root store,
with no system trust file. The registered suite's probe matrix is plain
sockets and does not include a TLS client; the end-to-end dependency fetch of
§4.2 is the registered-path TLS evidence. The
system CA bundle `/etc/ssl/cert.pem` is denied to the child by design: the
accepted classifier treats every `*.pem` path as private-key evidence and the
profile denies those families, so curl (whose SecureTransport backend loads
that CA file when it verifies a proxied TLS connection) fails closed with
"error setting certificate verify locations: CAfile: /etc/ssl/cert.pem"
(executor-recorded). A tool that cannot establish trust fails closed; no
credential store or secret file is reachable for trust evaluation.

## 5. Registered-suite results on the declared target

Final run (`npm run typecheck`, then the complete registered suites): typecheck
PASS; 356 registered tests, 355 passed, 0 failed, 1 platform skip; `git diff
--check` clean. The single skip is inverted by construction: it is
`test/seatbelt-profile.test.ts`'s unsupported-platform assertion, which runs
only off-darwin (`skip: darwin ? "declared target only" : false`) and cannot
execute on the declared target at all. No declared-target check is skipped. The Goal 3
regressions (closed-network controls, file gates, import/environment/containment
/quiescence/freeze/export) are registered in the same run and pass; the Goal 3
manifest test now binds only the artifacts Goal 4 did not change, and the
changed bytes are bound by the Goal 4 manifest (§7).

## 6. Adversarial mutation checks (executor-run, scratch tree)

Each mutation was applied to a scratch copy (never the real tree) and its
affected registered suite must fail:

| Mutation (fail-open direction) | Affected suite | Result |
| --- | --- | --- |
| M1 broker accepts any host (destination substitution) | network-effects | BITES (fail=1) |
| M2 broker ignores the port check | network-effects | BITES (fail=1) |
| M3 profile never emits the network rule | seatbelt-profile | BITES (fail=1) |
| M4 binding serialization drops the network scope line | shell-approvals | BITES (fail=1) |
| M5 pinDestination skips the public-address filter | network-effects | BITES (fail=1) |
| M6 shell-policy drops the unapproved-ASK contribution | shell-policy | BITES (fail=1) |
| M7 closed-scope network commands are no longer denied | shell-policy | BITES (fail=2) |
| M8 environment drops the proxy variables | network-effects | BITES (fail=2) |
| M9 extraction represents `http://` words | network-policy | BITES (fail=1) |
| M10 composition unions project ports (fail open) | network-policy | BITES (fail=1) |
| M11 embedded-IPv4 extraction accepts mapped loopback (review F1) | network-effects | BITES (fail=2) |
| M12 approved ports replace trusted ports on a duplicate host (review F2) | network-effects | BITES (fail=1) |
| M13 the broker's duplicate-host merge replaces instead of merging (review R2) | network-effects | BITES (fail=1) |
| M14 the broker serves tunnels before arming (review R2) | network-effects | BITES (fail=1) |
| M15 compatible-IPv4 extraction removed (review R2/R3) | network-effects | BITES (fail=1) |
| M16 the request line becomes case-insensitive (review R3) | network-effects | BITES (fail=1) |
| M17 special-purpose IPv6 prefixes are accepted (review R3) | network-effects | BITES (fail=1) |
| M18 the zero-prefix refusal is removed (review R3) | network-effects | BITES (fail=1) |

All eighteen fail-open mutations bite (each re-run against the final snapshot:
baseline 12 pass / 0 fail, every mutation makes its suite fail). Two variants
that turned out to be no-ops (an M10 anchor and the first M15 shape) were
replaced with real fail-open mutations, not counted. M11–M12 came with the
round-1 fixes, M13–M15 with the round-2 fixes, M16–M18 with the round-3 fixes
(§8).

## 7. Artifact identities and Goal 3 provenance

Every artifact below is either new in this Goal or a deliberate change to an
accepted Goal 3 artifact. For changed artifacts the Goal 3 manifest records the
accepted (old) bytes; the Goal 4 audit records both. Old hashes are the Goal 3
manifest entries; new hashes bind the current bytes in
[docs/network-gate-hashes.json](network-gate-hashes.json).

| Artifact | Goal 3 / Goal 1 accepted (old) sha256 | Goal 4 (new) sha256 |
| --- | --- | --- |
| src/policy/configuration.ts | 3bd01e1fb95147b0e155c66f806bc42e255ee7977def89834ed23e75dffe51c2 | `84047de76ce47a010aff13f6fdc9abf44ea6238452c542294b70c714c5f54bd0` |
| src/policy/shell-plan.ts | 4bc01434387f48acbd36c857f84b4a2f29c1f4c9712c84831583541428d660dd | `6a26da7354435407e06be77fe6c2ada87922331188339441def612fffc2d583d` |
| src/policy/shell-policy.ts | e6a1adeff4763e8d1fe21825d9bf6e69d7fd3149074783438b0f7d73524ad9a9 | `f12ebcc1741998ee7f88a9cc4932a8eb4012803a8feb3d248ad04d9a3dc5880d` |
| src/gate/shell-runtime.ts | dfe42377f1669e712e2c6394782edbf83b1fa0fc931f6f984e5d1a69e9965c57 | `eb83cb348614660df65e09c860fabd6e0c74fcc6a6d68ea5fe1400272289b901` |
| src/approvals/shell-approvals.ts | a26aca731cd2daa268725635ef4a46f08e35822f62b5342a455a275f9c4e416f | `8c0da45562f18e78dc4fe5762749e99d44c8b23b6f9e8cb7b0c3e23af95bc64d` |
| src/sandbox/errors.ts | a53d48b4d86762483214b867a7e72a43c6ee5e003c33b91ca0172314b86359b1 | `9f1fce6f992cddbe7dec6e3e4399519ae1ff36f6deb969e4398509f97e131cbe` |
| src/sandbox/seatbelt.ts | bc80e83109c8a53a6a6c75d7b7eae31e8ee21772eaab5c627f943f5a7f15b110 | `155c8d2d891240b9c22d75cacd86dfa27a3808ca01c2b7ad43def1e2657e8d3a` |
| src/sandbox/containment.ts | e8d10fd0248b55705ee5700d8609fa04100c5d6bb50eb9388baa02967a1496ab | `68967173c7e189cce97069e54708e73211677178668f49384d4497b5f494ccaf` |
| src/policy/network.ts | (new) | `684b6aa77d74786a44ff752c29dd0104204e543b5c683be579ac0b96bed2a64e` |
| src/sandbox/network-broker.ts | (new) | `6d5a2b263c12d8b69730f3775ea2f9f4c000e705b88f1a4f38014d583d058d46` |
| docs/NETWORK-GATE.md | (new) | `8d8963ffe5f11cb69b94d86a3d9c8f29b1a397f649cae6c74ad904f5d61bdf3d` |
| docs/NETWORK-GATE-AUDIT.md | (new) | (this file; see the manifest) |
| test/network-policy.test.ts | (new) | `4fb0f832c66c80c369c646838214791cfc4d26369e08ef4cf43fab244e5cfd08` |
| test/network-effects.test.ts | (new) | `94b195ebeb6ad466624783f715639f5238c10ff49d6194c3df5200461313ef17` |
| test/network-manifest.test.ts | (new) | `726a01f72ec783d0b269a1af6724e4e072bbb9b7d63dc8223195d83e042a5eca` |
| test/shell-policy.test.ts | 232ff67599ea537308ff55b959bc5694a8704ac777afcbea1defa04d14b2207e | `967c6973cbe0027520ab3cb5a29057044be986bb53b6173fb7625b86c3902097` |
| test/shell-approvals.test.ts | f68123ee4bf4cd911b4523ed72d71f21284ce70bfc136d532d26c386532baa9a | `22906c4bd927f5f0edd26a5c803397e1342c79e9116c203b62e8723951379df6` |
| test/seatbelt-profile.test.ts | ce62d24f45e162ef1665d547cfa051d15d2fc2d5cfbdafc9aaf78fbc5adf538f | `cf143b3b44608a31f06c70c61d44cdbfaefb6617c0d58add7347e7f674d83647` |
| test/shell-manifest.test.ts | 48e6cfbc67e77978d1a8ff5304630bad5458ee1754a334ba7344afc79f7a8e02 | `4ba50fa3770fd4e18d37bcd540d2b2bccb5700e92b2a2355fe7f0a4e822c99ea` |
| docs/SHELL-GATE.md | 8473496ec9f6315e1f354ec7e6b111c37c2f63fba4615af04450f5a3fb9d5ad3 | `e90308b01c61c184329be437cd0a9f737a8a357f40c94a1e9f95b074a36c93fa` |

Every accepted (old) value above is derived from the accepted record, never
from the current bytes: `src/policy/configuration.ts` from the Goal 1 audit's
reviewed-core hash (`docs/CONFIGURATION-AUTHORIZATION-AUDIT.md`); every other
changed artifact from its entry in `docs/shell-gate-hashes.json`, which is
byte-unchanged by this Goal and matches the `e8cab0c` blob. `(new)` marks a
file this Goal introduced. The Goal 4 (new) column is regenerated from the
binding manifest ([docs/network-gate-hashes.json](network-gate-hashes.json)),
whose test asserts that every shared entry differs from the Goal 3 entry
(fresh identity) and that the preserved Goal 1–3 artifacts are byte-identical.
The manifest is the binding record; this file is the narrative record.

## 8. Fresh independent review

A separate read-only reviewer with fresh context (no reuse of any executor
reasoning) reviewed the exact artifact identities of §7 against this contract,
the accepted Goal 1–3 contracts and this audit, recomputing every manifest
hash, running the full suite and `git diff --check`, and probing the broker,
profile generation, policy decisions and the public-address filter.

**Round 1 verdict: FAIL — one blocking finding, two non-blocking findings.**
All three were fixed within this Goal, with biting regressions; the affected
checks and the review were then repeated (round 2 below).

| Finding | Severity | Resolution |
| --- | --- | --- |
| F1 IPv4-mapped/compatible IPv6 forms (`::ffff:127.0.0.1`, `::ffff:10.0.0.1`, `::ffff:169.254.169.254`, `0:0:0:0:0:ffff:7f00:0001`, `::127.0.0.1`) passed the public-address filter | BLOCKING | `embeddedIPv4Of` extracts the embedded IPv4 from compressed, fully expanded and dotted-compatible forms and classifies it with the IPv4 filter, so mapped/compatible loopback, private, link-local and metadata addresses are never pinned (malformed forms refuse). Biting regressions: `IPv4-mapped and compatible IPv6 forms are classified by their embedded address`, `a non-public embedded IPv4 in an IPv6 answer refuses the pin` |
| F2 an approved port on an already-trusted host produced a duplicate host entry; the broker's host map then enforced only the last entry's ports | NON-BLOCKING | `networkStateOf` merges approved ports into the trusted entry per host before pinning, and `openNetworkBroker` merges duplicate host entries defensively (union of ports and addresses). Biting regression: `an approved port on a trusted host extends that host's port set (no overwrite, no widening)` |
| F3 two factual errors in this audit (test count, one manifest hash) | NON-BLOCKING | Corrected; the manifest is the binding record and the count matches the recorded run |

**Round 2 verdict (independent reviewer on the DeepSeek flash model, fresh
context): PASS WITH FINDINGS — no blocking finding.** It recomputed all 20
manifest entries, re-ran the full suite and the migration checks, reproduced
the F1/F2 bite checks, and re-probed the broker and the filter. Its findings
and resolutions:

| Round-2 finding | Severity | Resolution |
| --- | --- | --- |
| §7 of this audit still carried three stale "new" hashes (the round-1 fix artifacts), and STATE said "ten" mutations | NON-BLOCKING | Hashes recomputed from the final bytes, the mutation count corrected to twelve, and both refreshed again after the round-2 fixes |
| The profile rule is not IPv4-loopback-scoped: connections to the machine's own addresses and to IPv4-mapped loopback on the broker port are permitted (measured) | NON-BLOCKING | The contract, this audit, README and the source comments now state the measured scope (one TCP port on local addresses); the broker binds `127.0.0.1` only, §12 declares the residual local-address surface, and the effect matrix records the measured rows |
| Expanded, NAT64 and 6to4 spellings, malformed strings and the 6to4-relay prefix were mis-classified | NON-BLOCKING | `isPublicIPv6` now expands the literal to its eight numeric groups (any spelling), classifies by range, extracts the embedded IPv4 for the mapped/translated/compatible/NAT64/6to4 prefixes, refuses malformed input, and the 6to4-relay prefix is the correct `192.88.99.0/24`; 45-case regression matrix added |
| §4.3 attributed a TLS session to the registered suite; §13 listed redirect/proxy cases absent from the matrix | NON-BLOCKING | TLS is attributed to the executor probe; the registered matrix gained `redirect-target` and `proxy-override` rows (both asserted in the suite) |
| The prompt/report "families" claim was not implemented as worded | NON-BLOCKING | The report now prints pinned address count and families per destination; the prompt shows the canonical destinations, and the contract says exactly that |
| The broker served its pinned scope before the approval decision | NON-BLOCKING | The listener now refuses every request until the invocation is armed, which happens only after the authority is settled and the child is about to start; regression `the broker serves no tunnel before it is armed` |
| A second CONNECT inside an open tunnel is relayed, and extra header lines are ignored, contrary to §7's wording | NON-BLOCKING | The contract now states the measured behaviour (relayed bytes stay inside the already-pinned destination and grant no authority) |
| The broker-side duplicate-host merge had no biting test | NON-BLOCKING | Direct-broker regression added (`a duplicate host in the pinned set merges ports, never replaces them`) and mutation M13 added |

**Round 3 verdict (independent reviewer on the DeepSeek flash model, fresh
context): PASS WITH FINDINGS — no blocking finding.** It verified every
round-2 fix by its own measurement (127 adversarial filter spellings; the
arming path including the pending-approval window; the profile rule's measured
scope; the redirect/proxy rows biting under its own mutations; both shell
routes through the gate) and re-ran eight mutations in a scratch copy. Its
findings and resolutions:

| Round-3 finding | Severity | Resolution |
| --- | --- | --- |
| §7's "new" hash column was stale for seven rows and §5's counts were stale | NON-BLOCKING | Every §7 row is now generated from the binding manifest (verified: zero stale rows) and §5 records the final run's counts |
| STATE still described the profile rule as the IPv4-loopback endpoint | NON-BLOCKING | Corrected to the measured "one TCP port on local addresses"; the mutation and finding counts were corrected too |
| §4.2 quoted a research-broker log no shipped artifact can emit | NON-BLOCKING | The quote is attributed to the executor's instrumented research probe, and the artifact-reproducible production evidence (the report line) is quoted instead |
| The contract claimed IPv4-then-IPv6 dial order and an exact-case request line that the code did not implement | NON-BLOCKING | The contract now states the measured behaviour (resolver order), and the broker's request line is case-sensitive as documented (method tokens are case-sensitive); a `lowercase-connect` probe row asserts the refusal |
| Non-routable IPv6 special-purpose prefixes (`fec0::/10`, `100::/64`, `5f00::/16`, `3fff::/20`, `2001::/23` sub-blocks, reserved zero-prefix forms) classified as public | NON-BLOCKING | `isPublicIPv6` refuses them; the registered matrix gained those forms |
| No dedicated regression for the no-re-resolution (rebinding) claim | NON-BLOCKING | Registered regression `the tunnel dials the pinned address, never a fresh resolution of the host` proves the tunnel reaches a local sink pinned by an unresolvable host name |
| `runContainedShellCommand` is a policy-free exported entry point | NON-BLOCKING | The contract names the production entry points and documents the helper as an evidence/test checkpoint only |
| A dead assertion in the shell manifest test; THREAT_MODEL.md was not updated | NON-BLOCKING | The assertion now checks the Goal 3/Goal 4 artifact split for real, and THREAT_MODEL.md's network section records the implemented Goal 4 responses and residual risks |

All three rounds are closed: one blocking finding (round 1) and eighteen
non-blocking findings (round 1: two, round 2: eight, round 3: eight), every one
fixed within this Goal with a biting regression or a corrected claim. No review
round left an unresolved blocking finding.

**Documentation correction after the final-snapshot audit (2026-09-19,
documentation only).** A further independent audit of the final Goal 4 snapshot
returned REMEDIATION REQUIRED for four documentation defects and no enforcement
defect. All four were corrected in documentation only: this section's finding
total (previously "ten"), §7's accepted-old column (13 rows carried the current
hash, or a value matching no accepted record, instead of the accepted bytes),
§6.1 of the contract (it claimed `http`/`https` extraction; the implementation
and its M9 mutation require `https` only), and stale Goal 4 status lines in
ROADMAP and STATE. No `src/**` or `test/**` byte, no guarantee statement and no
accepted-old value changed; the two edited bound documents are re-recorded in
`docs/network-gate-hashes.json`. One non-blocking observation stays declared and
unfixed by decision: `64:ff9b:1::/48`, `128.0.0.0/16` and `192.175.48.0/24` are
still classified public by the address filter (remote or unroutable addresses,
not local-service exposure).

## 9. Declared limitations

See NETWORK-GATE.md §12: shared-address ambiguity (the broker binds the
hostname string and the pinned addresses; SNI is opaque to it), endpoint
exfiltration (a permitted endpoint can receive child-readable data), the
same-user relay surface on the loopback endpoint while the invocation runs,
tool variance (only proxy-honouring CONNECT tools can use the route; `http://`
fails closed; TLS clients needing the system CA file fail closed, §4.3), stale
pins failing closed per invocation, and the unchanged non-darwin block.
