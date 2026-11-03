---
title: 'TODO: Make load infer narrow width from pointer metadata'
priority: Medium
effort: 4-8h
created: 2026-06-12
issue: https://github.com/8f4e/8f4e/issues/949
status: Open
completed: null
---

# TODO: Make `load` Infer Narrow Width From Pointer Metadata

## Problem Description

The plain `load` instruction currently performs a 32-bit integer load. This is predictable, but easy to misuse when an
address is known to point into a narrow integer buffer such as `int8[]`, `int16[]`, `int8u[]`, or `int16u[]`.

The `readInterpolated(int16* ...)` overload showed the sharp edge: using `load` on an `int16*` address reads two packed
16-bit samples as one 32-bit integer. The correct implementation must use `load16s`, but that width information already
exists in stack pointer metadata when the address still has provenance.

## Proposed Solution

Make `load` metadata-aware:

- If the consumed stack item is an address with known pointee metadata, choose the load variant from the pointee type.
- If the address points to `int8`, use signed 8-bit load.
- If the address points to `int8u`, use unsigned 8-bit load.
- If the address points to `int16`, use signed 16-bit load.
- If the address points to `int16u`, use unsigned 16-bit load.
- If the address points to normal `int`, keep the current 32-bit integer load.

For raw integer addresses, computed addresses that have lost provenance, or any address without pointee metadata, keep
the current 32-bit `load` behavior. Users can still choose explicit `load8s`, `load8u`, `load16s`, or `load16u` when the
compiler cannot know the address type.

## Anti-Patterns

- Do not guess a narrow width from byte alignment or address arithmetic alone.
- Do not change plain integer values into typed addresses just because they numerically fall inside a memory range.
- Do not remove explicit width-specific load instructions; they are still needed for untyped pointer math.
- Do not make raw integer addresses ambiguous. The fallback must remain the current 32-bit `load`.

## Implementation Plan

### Step 1: Inspect Stack Address Metadata

- Extend the `load` instruction compiler to inspect the consumed stack item's `pointsTo` metadata.
- Keep existing memory access guards and safe-range behavior intact.

### Step 2: Select the Load Variant

- Map known pointee base types to the matching load bytecode and access byte width.
- Preserve current `load` behavior when pointee metadata is absent or points to normal `int`.

### Step 3: Add Regression Tests

- Add compiler instruction tests for `load` from `int8*`, `int8u*`, `int16*`, and `int16u*` addresses.
- Add a regression fixture showing that `int16[]` sample reads do not return packed 32-bit values.
- Add a fallback test showing that raw integer addresses still compile as 32-bit `load`.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test`
- `node packages/cli/bin/cli.js test packages/compiler/tests/stdlib/read-interpolated-int16.test.8f4e`

## Success Criteria

- [ ] `load` emits narrow signed/unsigned load instructions when address metadata proves a narrow pointee type.
- [ ] `load` keeps 32-bit behavior for untyped integer addresses.
- [ ] Existing explicit load instructions continue to work unchanged.
- [ ] `readInterpolated(int16* ...)` can use plain `load` safely if desired.

## Affected Components

- `packages/compiler/src/instructionCompilers/load.ts` - load variant selection.
- `packages/compiler/src/stackAnalysis` - consumed address metadata must remain available to codegen.
- `packages/compiler/tests` - instruction and fixture coverage.
- `packages/compiler/packages/stdlib/std/memory/readInterpolated.8f4e` - may simplify the `int16*` overload after the compiler behavior lands.

## Risks & Considerations

- **Semantic shift**: existing code that intentionally used plain `load` to read packed 32-bit values through a typed
  narrow pointer would change behavior. Such code should use an explicit 32-bit load path if one is needed.
- **Metadata preservation**: pointer arithmetic can strip or weaken provenance. The feature should only activate when
  metadata is still trustworthy.
- **Float memory**: this TODO is only about integer `load`; `float` and `float64` should remain governed by their own
  explicit load instructions unless a broader typed-load design is chosen later.

## Related Items

- **Related**: `docs/todos/425-split-stack-item-value-and-address.md`
- **Related**: `docs/todos/431-separate-pointer-type-and-provenance-facts.md`
- **Related**: `docs/todos/456-improve-function-overload-mismatch-diagnostics.md`
