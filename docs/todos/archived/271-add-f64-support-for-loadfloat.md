---
title: 'TODO: Add float64 support for loadFloat instruction'
priority: High
effort: 1-3h
created: 2026-02-20
issue: https://github.com/8f4e/8f4e/issues/422
status: Completed
completed: 2026-10-21
---

# TODO: Add float64 support for loadFloat instruction

## Problem Description

`loadFloat` is missing explicit float64 support in the compiler instruction path.

## Proposed Solution

Add a float64 load path (`f64.load`) and keep existing float32 load behavior and bounds checks.

## Implementation Plan

### Step 1: Update instruction compiler
- Patch `packages/compiler/src/instructionCompilers/loadFloat.ts`.

### Step 2: Add regression tests
- Add float64 coverage for `loadFloat` in instruction compiler tests/snapshots.
- Keep existing int32/float32 behavior covered.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run tests/instructions`
- `rg -n "loadFloat|F64|isFloat64" packages/compiler/src/instructionCompilers`

## Success Criteria

- [ ] `loadFloat` handles float64 correctly.
- [ ] Existing int32/float32 behavior remains unchanged.
- [ ] Regression tests cover the float64 path.

## Related Items

- **Related**: `docs/todos/261-update-instruction-test-helpers-for-float64.md`
- **Related**: `docs/todos/252-add-float-promote-demote-instructions.md`
