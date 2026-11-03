---
title: 'TODO: Add float64 support for equal instruction'
priority: High
effort: 1-3h
created: 2026-02-20
issue: https://github.com/8f4e/8f4e/issues/406
status: Completed
completed: 2026-05-10
---

# TODO: Add float64 support for equal instruction

## Problem Description

`equal` is missing explicit float64 support in the compiler instruction path.

## Proposed Solution

Emit `F64_EQ` when both operands are float64; keep existing int32/float32 behavior and mixed-width validation.

## Implementation Plan

### Step 1: Update instruction compiler
- Patch `packages/compiler/src/instructionCompilers/equal.ts`.

### Step 2: Add regression tests
- Add float64 coverage for `equal` in instruction compiler tests/snapshots.
- Keep existing int32/float32 behavior covered.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run tests/instructions`
- `rg -n "equal|F64|isFloat64" packages/compiler/src/instructionCompilers`

## Success Criteria

- [x] `equal` handles float64 correctly.
- [x] Existing int32/float32 behavior remains unchanged.
- [x] Regression tests cover the float64 path.

## Related Items

- **Related**: `docs/todos/261-update-instruction-test-helpers-for-float64.md`
- **Related**: `docs/todos/252-add-float-promote-demote-instructions.md`
