---
title: 'TODO: Add float32/float64 width checks to localSet instruction'
priority: High
effort: 1-3h
created: 2026-02-20
issue: https://github.com/8f4e/8f4e/issues/551
status: Completed
completed: 2026-10-20
---

# TODO: Add float32/float64 width checks to localSet instruction

## Problem Description

`localSet` is missing explicit float64 support in the compiler instruction path.

## Proposed Solution

Reject float32<->float64 assignments in `localSet` by validating `isFloat64` compatibility in addition to int-vs-float checks.

## Implementation Plan

### Step 1: Update instruction compiler
- Patch `packages/compiler/src/instructionCompilers/localSet.ts`.

### Step 2: Add regression tests
- Add float64 coverage for `localSet` in instruction compiler tests/snapshots.
- Keep existing int32/float32 behavior covered.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run tests/instructions`
- `rg -n "localSet|F64|isFloat64" packages/compiler/src/instructionCompilers`

## Success Criteria

- [ ] `localSet` handles float64 correctly.
- [ ] Existing int32/float32 behavior remains unchanged.
- [ ] Regression tests cover the float64 path.

## Related Items

- **Related**: `docs/todos/261-update-instruction-test-helpers-for-float64.md`
- **Related**: `docs/todos/252-add-float-promote-demote-instructions.md`
