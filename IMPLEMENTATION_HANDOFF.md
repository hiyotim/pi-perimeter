# Implementation Handoff

Task ID: `20260920-private-vulnerability-reporting`
Baseline: `6e6c967eb2483d8d8502cd30456c55bd332cfb12`; unstaged owner acceptance updates in `STATE.md` (SHA-256 `c7cf85c1062a88c33d5a2b8783ffe03ea6e02af79fac2fbf23880dabed8fadf3`) and `ROADMAP.md` (SHA-256 `6956e2d9a447d6e9f339e74b1908ba622328cf18852069c0753a8a3e87453a3e`), plus unrelated untracked `.commandcode/`; index empty.
Scope Gate: READY

## Goal

Establish one verified private vulnerability-reporting channel and publish accurate, safe responsible-disclosure instructions for `pi-warden`, closing only that bounded Phase 6 checklist item.

## Context

- Goals 1–4 and Phases 1–4 are owner-accepted within the guarantees and limitations recorded in `STATE.md` and `ROADMAP.md`.
- `SECURITY.md` currently states that no private channel exists. `CONTRIBUTING.md` repeats that status, and `README.md` links to `SECURITY.md` for reporting policy.
- Public beta, publication, installation, release acceptance, incident-response operations, and broader Phase 6 work remain separate gates.
- The repository must not publish exploit details, credentials, tokens, reporter data, or private-channel secrets.

## Scope

- Obtain the maintainer-selected private intake endpoint and its public-safe contact instructions before claiming that reporting is available.
- Configure or enable that single channel only when the maintainer has explicitly authorized the external action and the channel can restrict report contents to intended maintainers.
- Update `SECURITY.md` with the verified private reporting route, reporting scope, safe reproduction guidance using fake data, expected acknowledgement/process wording without unsupported response-time promises, and guidance for urgent or sensitive reports.
- Update the existing disclosure references in `CONTRIBUTING.md` and, only if needed for an accurate discoverable link or status, `README.md`.
- Preserve the existing accepted guarantees, limitations, and warning that permitted endpoints can receive projected workspace data.

## Out of Scope

- Runtime, policy, approval, sandbox, network, test, build, package, CI, or dependency changes.
- A second reporting channel, automated triage, incident-response tooling, encryption/key management, bug bounty, service-level or response-time commitments, legal safe-harbor policy, CVE issuance, release notes, publication, push, or real-profile installation.
- Completing security/documentation review as a whole, the compatibility matrix, packaging safeguards, GitHub CI, public beta, Phase 6, or Phase 7.
- Changing `STATE.md` or `ROADMAP.md`; their pre-existing acceptance updates are baseline work and must remain attributable to the owner.

## Risk Gates

- Before enabling an external service or publishing contact details, the maintainer must supply or approve the exact private endpoint, authorized recipients, ownership, and public-safe wording. Do not invent an address, expose a personal contact, or claim confidentiality that the channel does not provide.
- Before declaring the channel operational, send one explicitly authorized synthetic report containing no vulnerability, credential, exploit, or personal data and verify delivery to the intended restricted recipients. A documentation-only link check cannot substitute for delivery evidence.

## Acceptance Criteria

1. One maintainer-approved private reporting endpoint is operational, publicly discoverable from `SECURITY.md`, and restricted to the intended recipients.
2. An authorized synthetic report with non-sensitive content is received through the documented route; the evidence records only safe metadata and does not expose the private report or recipient secrets.
3. `SECURITY.md` accurately states what to report, what information helps investigation, how to use fake data, what must not be posted publicly, and what reporters should expect without promising confidentiality, remediation, disclosure, or response times beyond the channel's demonstrated behavior.
4. `CONTRIBUTING.md` and any changed `README.md` references agree with `SECURITY.md`; no current text still claims that a private channel is unavailable.
5. Existing Goal 1–4 guarantees and limitations are unchanged, and the change does not claim public-beta, release, publication, installation, or completion of any other Phase 6 item.
6. Only the authorized disclosure documentation and unavoidable maintainer-approved external channel configuration differ from the baseline; the pre-existing `STATE.md`, `ROADMAP.md`, and `.commandcode/` state is preserved and separately attributable.

## Verification

- For Criteria 1–2, inspect the channel's recipient/access configuration and perform the authorized non-sensitive synthetic delivery test; record only endpoint type, delivery result, date, and intended-recipient confirmation.
- For Criteria 3–5, manually compare `SECURITY.md`, `CONTRIBUTING.md`, any changed `README.md`, `STATE.md`, and `ROADMAP.md`; verify links resolve and every guarantee/status statement matches the accepted checkpoint.
- For Criterion 6, compare `git status --short` and the diff against the recorded baseline identities; confirm no source, test, package, build, configuration, manifest, accepted contract, or audit artifact changed.
- Run `git diff --check` and inspect the complete documentation diff. Because this Goal is documentation/channel-only, do not attribute earlier runtime test or manifest results as fresh evidence.
- Obtain an independent security/documentation review of the final instructions and safe verification record before owner acceptance.

## Constraints

- Use no real credentials, vulnerabilities, exploit payloads, private reporter data, or sensitive user data in setup or verification.
- Publish only the minimum contact information required to reach the approved channel. Keep recipient lists, service credentials, recovery material, and private reports outside repository-writable content.
- State only demonstrated channel properties. Approval of an endpoint does not establish guaranteed confidentiality, anonymity, availability, response time, remediation, or coordinated-disclosure terms.
- Preserve the separation between authorization, approval, containment, disclosure intake, and release acceptance.
- Do not stage, commit, push, publish, or alter the owner acceptance baseline unless separately authorized.

## Escalate If

- No maintainer-approved private endpoint or authorized recipient set is available.
- The proposed service requires publishing personal contact data, storing secrets in the repository, granting repository-controlled content authority, or accepting unsupported confidentiality/response commitments.
- A synthetic delivery test cannot be authorized or cannot confirm receipt by the intended restricted recipients.
- The work requires a second channel, automation, dependency/configuration changes, legal policy, incident-response process, publication, or any broader Phase 6 outcome.
- `STATE.md`, `ROADMAP.md`, or another baseline artifact changes materially before execution and ownership or attribution becomes ambiguous.
