---
title: 'TODO: Update instruction test helpers for float64 and refactor call test'
priority: Medium
effort: 2-4h
created: 2026-02-20
issue: https://github.com/8f4e/8f4e/issues/644
status: Cancelled
completed: 2026-09-07
---

# TODO: Update instruction test helpers for float64 and refactor call test

## Problem Description

`packages/compiler/tests/instructions/testUtils.ts` currently reads/writes all non-integer memory as float32 in shared helpers like `moduleTesterWithFunctions`.

This makes float64 instruction tests unreliable when they go through the generic helper path.

## Proposed Solution

Update instruction test memory helpers to route float values by width:
- use `getFloat64` / `setFloat64` when `memoryItem.isFloat64 === true`,
- keep `getFloat32` / `setFloat32` for 32-bit float memory,
- keep integer behavior unchanged.

Then refactor the float64 call regression test in `tests/instructions/call.test.ts` to use `moduleTesterWithFunctions`.

## Anti-Patterns

- Do not infer float64 only from JavaScript number shape.
- Do not change integer helper behavior while adding float64 support.
- Do not keep duplicate float64 test paths once helper support is correct.

## Implementation Plan

### Step 1: Update helper read/write routing
- Modify helper memory read/write in:
  - `packages/compiler/tests/instructions/testUtils.ts`
- Branch by memory metadata:
  - int -> `Int32` path
  - float32 -> `Float32` path
  - float64 -> `Float64` path

### Step 2: Add helper-level regression coverage
- Add/adjust tests that verify float64-backed memory uses 64-bit read/write through instruction test helpers.

### Step 3: Refactor call float64 test
- Rewrite the explicit `DataView` float64 call regression in:
  - `packages/compiler/tests/instructions/call.test.ts`
- Use `moduleTesterWithFunctions` once helper precision is fixed.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run tests/instructions/call.test.ts tests/instructions/store.test.ts`
- `rg -n "getFloat64|setFloat64|moduleTesterWithFunctions" packages/compiler/tests/instructions`

## Success Criteria

- [ ] `moduleTesterWithFunctions` preserves float64 values without float32 truncation.
- [ ] float64 call regression test passes when implemented via shared helper.
- [ ] existing int32/float32 instruction tests remain unchanged and passing.

## Affected Components

- `packages/compiler/tests/instructions/testUtils.ts`
- `packages/compiler/tests/instructions/call.test.ts`

## Related Items

- **Related**: `docs/todos/260-add-float64-support-in-function-signatures.md`
- **Related**: `docs/todos/258-add-f64-store-support.md`
- **Related**: `docs/todos/250-add-f64-push-support.md`
