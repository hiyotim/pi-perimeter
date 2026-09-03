# Sandbox Module

**Status: planned; not implemented.**

This directory will contain OS-specific containment adapters for shell subprocesses, including environment sanitization and network policy enforcement.

The adapter consumes policy decisions; it does not grant authorization. Initialization must be verified before any operation requiring containment. An unsupported platform or initialization failure must block execution rather than fall back to an unrestricted process.

Anthropic Sandbox Runtime is the current primary candidate for Phase 3, but it is not a dependency and must be re-evaluated before adoption.
