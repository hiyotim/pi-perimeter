# Roadmap

This roadmap uses release gates, not dates. A phase is complete only when its listed behavior is implemented, reviewed, tested, and documented without overstating guarantees.

## Phase 0 — Foundation

- [x] Project documentation and terminology.
- [x] Planned architecture and trust boundaries.
- [x] Threat model and attack matrix.
- [x] Development rules and contribution workflow.
- [x] Test strategy for isolated security fixtures.
- [x] Minimal, non-enforcing Pi package skeleton.

**Release gate:** all documents agree that no security enforcement exists yet; the manifest follows current Pi package conventions; no runtime dependency is introduced.

## Phase 1 — Pure Policy Core

- [x] Path normalization and canonicalization.
- [x] Component-aware workspace containment.
- [x] Existing-target and creation-target handling.
- [x] Symlink resolution and documented race limitation.
- [ ] Secret path and resource classification.
- [ ] Structured `ALLOW`, `ASK`, and `DENY` decisions with reason codes.
- [ ] Monotonic configuration authority rules.

**Release gate:** a platform-independent policy core passes table-driven and adversarial tests using temporary fixtures, with no Pi or sandbox side effects.

## Phase 2 — Pi Tool Gates

- [ ] Gate `read`, `write`, and `edit`.
- [ ] Gate `grep`, `find`, and `ls`.
- [ ] Define coverage behavior for unknown/new model-facing tools.
- [ ] Implement precise approval UX and scoped approval state.
- [ ] Re-verify supported Pi APIs and compatibility range.

**Release gate:** every supported in-process file tool demonstrably uses the central policy model; missing coverage fails closed; approval scope and timeout behavior have regression tests.

## Phase 3 — Sandboxed Shell

- [ ] Re-evaluate available OS-level containment mechanisms.
- [ ] Investigate and, if suitable, integrate Anthropic Sandbox Runtime.
- [ ] Route model `bash` and user `!`/`!!` commands through containment.
- [ ] Construct a sanitized child environment.
- [ ] Block on missing, unsupported, or failed sandbox initialization.
- [ ] Prove there is no unrestricted fallback.

**Release gate:** ordinary shell workflow runs in verified containment on supported macOS versions; failure-path and bypass tests pass; provider authentication remains outside child processes by default.

## Phase 4 — Network

- [ ] Restrict sandbox network access by default.
- [ ] Define allowlisted development services.
- [ ] Add destination- and session-scoped approval.
- [ ] Test redirects, DNS, proxies, loopback, local services, and exfiltration cases.

**Release gate:** documented tests demonstrate the stated network policy on supported platforms, and no broader exfiltration-resistance claim is made.

## Phase 5 — Hardening

- [ ] Adopt or implement an auditable shell parser/AST strategy.
- [ ] Test nested shells, substitutions, redirections, sourced scripts, and subprocesses.
- [ ] Expand symlink and time-of-check/time-of-use adversarial coverage.
- [ ] Investigate macOS Keychain behavior without promising isolation prematurely.
- [ ] Build a maintained adversarial regression suite.
- [ ] Conduct an independent security-focused review.

**Release gate:** all high-priority threats have explicit enforcement evidence, regression coverage, or a clearly documented limitation.

## Phase 6 — Public Beta

- [ ] Add GitHub CI and reproducible checks.
- [ ] Publish a Pi, Node, macOS, and Linux compatibility matrix.
- [ ] Prepare npm packaging and publication safeguards.
- [ ] Define a private vulnerability-reporting channel.
- [ ] Complete security and documentation reviews.

**Release gate:** installation, rollback, compatibility, disclosure, and known limitations are documented and tested; publication requires explicit maintainer action.

## Phase 7 — v1.0

- [ ] Stabilize the supported security guarantees.
- [ ] Maintain regression evidence for every guarantee.
- [ ] Resolve or explicitly bound release-blocking known unknowns.
- [ ] Complete an independent audit appropriate to the claimed boundary.

**Release gate:** v1.0 is released only after the implementation and regression suite support a stable, narrowly worded set of security guarantees.
