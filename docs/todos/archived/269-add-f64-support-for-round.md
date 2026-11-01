---
title: 'TODO: Add float64 support for round instruction'
priority: High
effort: 1-3h
created: 2026-02-20
issue: https://github.com/8f4e/8f4e/issues/415
status: Completed
completed: 2026-10-15
---

# TODO: Add float64 support for round instruction

## Problem Description

`round` is missing explicit float64 support in the compiler instruction path.

## Proposed Solution

Emit `F64_NEAREST` for float64 operands while keeping `F32_NEAREST` for float32.

## Implementation Plan

### Step 1: Update instruction compiler
- Patch `packages/compiler/src/instructionCompilers/round.ts`.

### Step 2: Add regression tests
- Add float64 coverage for `round` in instruction compiler tests/snapshots.
- Keep existing int32/float32 behavior covered.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run tests/instructions`
- `rg -n "round|F64|isFloat64" packages/compiler/src/instructionCompilers`

## Success Criteria

- [ ] `round` handles float64 correctly.
- [ ] Existing int32/float32 behavior remains unchanged.
- [ ] Regression tests cover the float64 path.

## Related Items

- **Related**: `docs/todos/261-update-instruction-test-helpers-for-float64.md`
- **Related**: `docs/todos/252-add-float-promote-demote-instructions.md`
