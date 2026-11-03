---
title: 'TODO: Add float64 support for sqrt instruction'
priority: High
effort: 1-3h
created: 2026-02-20
issue: https://github.com/8f4e/8f4e/issues/417
status: Completed
completed: 2026-05-10
---

# TODO: Add float64 support for sqrt instruction

## Problem Description

`sqrt` is missing explicit float64 support in the compiler instruction path.

## Proposed Solution

Emit `F64_SQRT` for float64 operands while keeping `F32_SQRT` for float32.

## Implementation Plan

### Step 1: Update instruction compiler
- Patch `packages/compiler/src/instructionCompilers/sqrt.ts`.

### Step 2: Add regression tests
- Add float64 coverage for `sqrt` in instruction compiler tests/snapshots.
- Keep existing int32/float32 behavior covered.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run tests/instructions`
- `rg -n "sqrt|F64|isFloat64" packages/compiler/src/instructionCompilers`

## Success Criteria

- [x] `sqrt` handles float64 correctly.
- [x] Existing int32/float32 behavior remains unchanged.
- [x] Regression tests cover the float64 path.

## Related Items

- **Related**: `docs/todos/261-update-instruction-test-helpers-for-float64.md`
- **Related**: `docs/todos/252-add-float-promote-demote-instructions.md`
