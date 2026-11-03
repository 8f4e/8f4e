---
title: 'TODO: Reuse WASM instance across incremental compiles'
priority: High
effort: 3-6h
created: 2026-03-14
issue: https://github.com/8f4e/8f4e/issues/646
status: Open
completed: null
---

# TODO: Reuse WASM instance across incremental compiles

## Problem Description

The compiler worker currently recreates the WebAssembly instance on every compile, even when memory can be reused and the runtime shape has not changed.

Current behavior:
- `packages/editor/packages/compiler-worker/src/compileAndUpdateMemory.ts` calls `WebAssembly.instantiate(...)` for each compilation.
- The worker can reuse memory and patch changed defaults, but it has no instance cache or executable-code invalidation check.
- A new instance is created even when the compiled execution code is unchanged.

This adds instantiation work to otherwise incremental updates. Memory reuse and instance reuse are separate decisions.

## Proposed Solution

Implement instance reuse in the compiler worker with explicit executable-code and memory invalidation.

High-level approach:
- cache the active instance together with the code and memory identity used to create it
- distinguish between:
  - memory recreation
  - program shape changes that require a new instance
  - default-value-only changes that can be patched into existing memory
- preserve the current rule: initialize defaults for new/recreated memory, otherwise patch changed defaults without running execution entries

Likely implementation shape:
- add or reuse a helper that detects whether the compiled bytecode or executable structure changed in a way that invalidates the current instance
- instantiate only when the cached code or memory is incompatible with the new compilation
- leave `getMemoryValueChanges(...)` as the fast path for default-value-only updates

## Anti-Patterns

- Do not use memory identity alone as the instance reuse condition; compiled code must also remain compatible.
- Do not silently reuse an instance when exported function layout or compiled code buffer changed incompatibly.
- Do not mix memory-patching logic with instance lifecycle decisions in one large branch.

## Implementation Plan

### Step 1: Define the actual reset condition
- Audit current worker helpers in `packages/editor/packages/compiler-worker/src/`
- Decide which changes require a fresh `WebAssembly.instantiate(...)`
- Capture that in a dedicated helper or well-named boolean

### Step 2: Add the reuse path
- Introduce an internal instance cache and explicit invalidation condition in `compileAndUpdateMemory(...)`
- Keep instance lifecycle separate from memory patching
- Verify reuse through actual instantiation behavior instead of adding unused result flags

### Step 3: Verify initialization and patching behavior
- Confirm `initDefaults()` still runs when memory is recreated or first created
- Confirm incremental default changes still patch memory without running execution entries
- Confirm stable compiles do not force a full instance reset

### Step 4: Add regression tests
- Add worker tests for:
  - initial compile
  - recompilation with unchanged structure
  - recompilation with memory-size change
  - recompilation with code-shape change

## Validation Checkpoints

- `npx nx run @8f4e/compiler-worker:test`
- `npx nx run @8f4e/compiler-worker:typecheck`
- Test unchanged-code reuse, changed-code invalidation, memory replacement, and default patching through compilation.

## Success Criteria

- [ ] The compiler worker no longer reinstantiates WebAssembly on every compile by default.
- [ ] Instance reuse happens when memory and program structure are still compatible.
- [ ] Incompatible code or memory changes still force a safe reset.
- [ ] Incremental default-value patching remains intact.
- [ ] Tests cover both reuse and reset paths.

## Affected Components

- `packages/editor/packages/compiler-worker/src/compileAndUpdateMemory.ts` - current per-compilation instantiation
- `packages/editor/packages/compiler-worker/src/getOrCreateMemory.ts` - memory recreation logic
- `packages/editor/packages/compiler-worker/src/didProgramOrMemoryStructureChange.ts` - existing structure checks
- `packages/editor/packages/compiler-worker/src/getMemoryValueChanges.ts` - incremental patch path

## Risks & Considerations

- **Incorrect reuse detection**: reusing an incompatible instance could produce stale exports or invalid runtime behavior.
- **State semantics**: some callers may now observe preserved runtime state where they previously saw resets on every compile.
- **Test coverage**: verify actual instance reuse and code invalidation in addition to memory values.

## Related Items

- **Related**: `docs/todos/123-add-memory-reinit-reason-reporting.md`
- **Related**: `docs/todos/238-add-rerun-init-only-modules-on-default-value-change.md`
- **Related**: `docs/todos/259-add-float64-live-memory-patching-in-compiler-worker.md`

## Notes

The service-ownership cleanup removed an unreachable instance-reuse stub and unused reset-result fields. That cleanup
preserves per-compilation instantiation. This task remains responsible for implementing and verifying real instance reuse.
