---
title: 'TODO: Add float64 support for castToInt instruction'
priority: High
effort: 1-3h
created: 2026-02-20
issue: https://github.com/8f4e/8f4e/issues/414
status: Cancelled
completed: 2026-09-07
---

# TODO: Add float64 support for castToInt instruction

## Problem Description

`castToInt` is missing explicit float64 support in the compiler instruction path.

## Proposed Solution

Emit `I32_TRUNC_F64_S` for float64 operands while keeping `I32_TRUNC_F32_S` for float32.

## Implementation Plan

### Step 1: Update instruction compiler
- Patch `packages/compiler/src/instructionCompilers/castToInt.ts`.

### Step 2: Add regression tests
- Add float64 coverage for `castToInt` in instruction compiler tests/snapshots.
- Keep existing int32/float32 behavior covered.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run tests/instructions`
- `rg -n "castToInt|F64|isFloat64" packages/compiler/src/instructionCompilers`

## Success Criteria

- [ ] `castToInt` handles float64 correctly.
- [ ] Existing int32/float32 behavior remains unchanged.
- [ ] Regression tests cover the float64 path.

## Related Items

- **Related**: `docs/todos/261-update-instruction-test-helpers-for-float64.md`
- **Related**: `docs/todos/252-add-float-promote-demote-instructions.md`
