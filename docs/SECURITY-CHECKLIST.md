# Security Pull Request Checklist

Use the applicable items before review. Explain every unchecked item that affects the change.

## Scope and policy

- [ ] The affected invariant and trust boundary are named.
- [ ] The change is small enough to review independently.
- [ ] `ALLOW`, `ASK`, `DENY`, and `SANDBOX` semantics remain distinct.
- [ ] Failure behavior is explicit and appropriately fail-closed.
- [ ] Project configuration cannot weaken global policy.

## Filesystem

- [ ] Paths are canonicalized before the security decision.
- [ ] Relative traversal and absolute paths are covered.
- [ ] Component-aware containment replaces string-prefix checks.
- [ ] Existing and not-yet-existing targets are handled safely.
- [ ] Symlink escape, symlink-to-secret, and replacement races are considered.
- [ ] Secret rules override workspace allowance and ordinary approval.
- [ ] External reads, writes, renames, links, and deletes have explicit outcomes.

## Process and environment

- [ ] Shell syntax, redirections, substitution, indirection, and nested shells are considered.
- [ ] Regex-only classification is not presented as complete protection.
- [ ] Model `bash` and user `!`/`!!` paths receive equivalent enforcement.
- [ ] Child environments exclude credentials and dangerous control variables by default.
- [ ] Privilege escalation, system modification, destructive Git, publish, and deploy cases are covered.

## Sandbox and network

- [ ] Required containment is verified before execution.
- [ ] Missing, unsupported, or failed sandbox initialization blocks execution.
- [ ] No unrestricted fallback exists.
- [ ] Network access is no broader than documented.
- [ ] Unknown destinations, redirects, proxies, loopback, and exfiltration paths are considered.

## Evidence and maintenance

- [ ] Tests use temporary isolated fixtures and fake secrets only.
- [ ] Positive, negative, failure, and adversarial regression cases are included.
- [ ] New Pi tools or API changes cannot bypass the central policy unnoticed.
- [ ] Dependency additions have a security and maintenance review.
- [ ] Targeted and complete relevant checks pass.
- [ ] Documentation describes only implemented and tested guarantees.
- [ ] The final diff contains no credentials, generated noise, disabled tests, or unrelated refactors.
