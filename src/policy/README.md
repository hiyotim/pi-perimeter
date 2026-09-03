# Policy Module

**Status: partially implemented in Phase 1A.**

This directory will own pure, deterministic security decisions:

- path normalization and canonical identity;
- workspace containment;
- secret and dangerous-operation classification;
- configuration authority and monotonic policy merging;
- structured `ALLOW`, `ASK`, and `DENY` results with reason codes.

`paths.ts` implements canonical workspace resolution, filesystem-aware target canonicalization, longest-existing-ancestor handling for creation targets, and component-aware containment. It returns information for future policy decisions but does not authorize or enforce any operation. Broken links and resolution errors are explicit failures. Canonicalization cannot eliminate time-of-check/time-of-use races between a check and a later filesystem operation.

The policy module must not display UI, start processes, or treat sandbox availability as proof of authorization. Remaining classification, authority, and decision logic is planned.
