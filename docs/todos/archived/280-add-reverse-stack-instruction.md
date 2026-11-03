---
title: 'TODO: Add reverse stack instruction with explicit item count'
priority: High
effort: 4-8h
created: 2026-02-23
issue: https://github.com/8f4e/8f4e/issues/418
status: Cancelled
completed: 2026-06-14
---

# TODO: Add reverse stack instruction with explicit item count

## Problem Description

8f4e has `drop` and `clearStack`, but no primitive to reverse a contiguous segment of the stack. This forces instruction authors and users to emulate reversal manually, which is verbose and error-prone for byte/word sequence workflows.

## Proposed Solution

Add a new stack instruction:

- `reverse <count>`

Semantics:
- Reverses the top `<count>` stack items in place.
- Stack effect: `..., a1, a2, ..., aN -> ..., aN, ..., a2, a1`
- `count` must be a non-negative integer.
- `reverse 0` and `reverse 1` are no-ops.

Example:

```8f4e
push 1
push 2
push 3
push 4
reverse 3
; stack becomes: 1, 4, 3, 2
```

## Anti-Patterns

- Do not silently clamp `count` to current stack size.
- Do not mutate stack metadata inconsistently (must move full `StackItem` entries as units).
- Do not restrict to integer-only operands; this is a structural stack operation.

## Implementation Plan

### Step 1: Add instruction compiler
- Implement `packages/compiler/src/instructionCompilers/reverse.ts`.
- Validate:
  - one required argument,
  - integer literal,
  - `count >= 0`,
  - stack length is at least `count`.
- Reverse the last `count` `StackItem`s in `context.stack`.
- Emit no wasm bytecode.

### Step 2: Register instruction
- Add `reverse` to `packages/compiler/src/instructionCompilers/index.ts`.
- Add keyword to valid instruction list/syntax paths if needed.

### Step 3: Tests
- Add tests for:
  - basic reversal (`reverse 2`, `reverse 3`, mixed types),
  - no-op cases (`0`, `1`),
  - insufficient operands,
  - invalid/negative/non-integer count.

### Step 4: Docs
- Add `reverse` to:
  - `packages/compiler/docs/instructions/stack.md`,
  - `packages/compiler/docs/instructions.md` index.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run instructionCompilers/reverse.ts`
- `npx nx run @8f4e/compiler:typecheck`
- `rg -n "reverse" packages/compiler/src packages/compiler/docs`

## Success Criteria

- [ ] `reverse <count>` reverses top stack items deterministically.
- [ ] No wasm bytecode is emitted by `reverse`.
- [ ] Validation errors are raised for invalid counts and insufficient stack items.
- [ ] Docs and instruction index include `reverse`.

## Affected Components

- `packages/compiler/src/instructionCompilers/reverse.ts` (new)
- `packages/compiler/src/instructionCompilers/index.ts`
- `packages/compiler/docs/instructions/stack.md`
- `packages/compiler/docs/instructions.md`

## Related Items

- **Related**: `docs/todos/archived/277-add-storebytes-with-explicit-byte-count.md`
- **Related**: `docs/todos/278-add-storewords-with-explicit-count-and-word-size.md`

## Notes

- This instruction is intentionally structural and type-agnostic to keep stack manipulation orthogonal to value typing.
