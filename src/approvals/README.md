# Approvals Module

**Status: planned; not implemented.**

This directory will own approval presentation and scoped approval state. A request must display the exact operation, canonical resource, reason, duration, and containment status.

Approval is an authorization input, not an OS boundary. Timeouts, unavailable UI, invalid responses, and target changes do not grant access. Routine approval must not override hard-denied secrets or higher-authority global restrictions.
