---
title: 'TODO: Guard i32.rem_s divisor zero'
priority: Medium
effort: 2-4h
created: 2026-04-30
issue: https://github.com/8f4e/8f4e/issues/649
status: Open
completed: null
---

# TODO: Guard i32.rem_s divisor zero

## Problem Description

The `remainder` instruction emits WebAssembly `i32.rem_s` for integer operands. WebAssembly has no non-trapping variant for integer remainder. The raw opcode traps when the divisor is zero.

The compiler currently requires the divisor stack item to be known non-zero before emitting `i32.rem_s`, but this behavior should be made explicit in docs and covered with runtime-level tests. If the language wants `remainder` to be non-trapping for dynamic values, the compiler must emit a checked sequence instead of relying on a raw `i32.rem_s`.

## Proposed Solution

Decide whether `remainder` should remain a checked instruction that rejects possibly-zero divisors at compile time, or whether it should become non-trapping at runtime by defining a fallback result for divisor zero.

Possible approaches:

- Keep compile-time validation and improve docs/tests around the required `isNonZero` divisor.
- Emit a runtime guard that returns a defined fallback value when the divisor is zero.
- Add a helper instruction or pattern that makes divisor sanitization obvious before `remainder`.

## Implementation Plan

### Step 1: Define the intended behavior

- Decide whether divisor zero is a compiler error, a runtime fallback, or caller-owned precondition.
- If a fallback is chosen, define the exact result for `x % 0`.

### Step 2: Update compiler/docs as needed

- Update `packages/compiler/src/instructionCompilers/remainder.ts` if runtime guarding is selected.
- Update `packages/compiler/docs/instructions/arithmetic.md` to describe the divisor-zero behavior.

### Step 3: Add coverage

- Add tests proving divisor-zero handling cannot accidentally produce a WebAssembly trap.
- Keep coverage for ordinary positive and negative integer remainder cases.

## Success Criteria

- [ ] `remainder` behavior for divisor zero is explicit in user-facing docs.
- [ ] Tests cover the divisor-zero path or compile-time rejection path.
- [ ] The emitted code cannot unexpectedly trap in supported source-level usage.

## Affected Components

- `packages/compiler/src/instructionCompilers/remainder.ts` - integer remainder code generation and validation.
- `packages/compiler/tests/instructions/` - runtime-level compiler coverage.
- `packages/compiler/docs/instructions/arithmetic.md` - user-facing behavior note.

## Notes

- This is separate from `div`: `i32.rem_s` does not have the `INT_MIN / -1` signed overflow trap. `INT_MIN % -1` returns `0` in WebAssembly.
- WebAssembly does not provide an `i32.rem_s` equivalent of the `0xfc` non-trapping truncation instructions.
