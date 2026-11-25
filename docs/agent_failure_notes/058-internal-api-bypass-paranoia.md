---
title: Agent Failure Note - Internal API bypass paranoia
date: 2026-06-01
agent: Codex
model: GPT-5
---

# Agent Failure Note - Internal API Bypass Paranoia

## Short Summary

The agent added defensive fallbacks for callers bypassing an internal tokenizer API even though the project is unreleased and the user explicitly wanted internal APIs to break cleanly. The simple design was a parse-time flag; the agent turned it into compatibility handling and unrelated metadata plumbing.

## Original Problem

The tokenizer already visited every module line. It could record a required flag during that pass so the compiler
would not need to scan the source again. The agent instead made the flag optional and kept a fallback that rescanned
modules whose callers did not supply it. A caller bypassing the internal API should fail or be updated rather than
receive a hidden compatibility path.

## Anti-Patterns

- Adding fallbacks for hypothetical callers that bypass internal APIs.
- Treating tests and fixtures as compatibility clients instead of updating them to the new contract.
- Keeping an exported helper whose only job is to preserve the old scan-based behavior.
- Making metadata optional to avoid updating all call sites.
- Expanding a tokenizer/compiler metadata change into editor graphic data or persistence state.
- Using "conservative" behavior as an excuse to hide an incomplete migration.

## Failure Pattern

Protecting impossible or unsupported internal call paths after the user explicitly asked to break internal APIs and avoid compatibility shims.

## Correct Solution

Keep ownership narrow:

- The project tokenizer owns its parse-time metadata.
- The compiler consumes the flag directly.
- Internal callers, tests, and fixtures must be updated to provide the new required metadata.
- Do not add fallback scans, compatibility helpers, or UI/editor metadata just in case something bypasses the tokenizer.

If a call path does bypass the tokenizer, treat that as a call-site migration problem. Fix the call site or let typecheck/tests expose it. Do not preserve the old behavior behind an optional field or fallback.
