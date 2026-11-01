---
title: 'TODO: Add storeWords with explicit count and word size'
priority: High
effort: 1-2d
created: 2026-02-23
issue: https://github.com/8f4e/8f4e/issues/645
status: Open
completed: null
---

# TODO: Add storeWords with explicit count and word size

## Problem Description

`storeBytes <count>` covers contiguous byte writes, but there is no equivalent explicit instruction for contiguous multi-byte word writes.

Without a word-oriented variant, users must manually compute per-element addresses and issue repeated `store` calls, which is verbose and error-prone when building packed memory layouts.

## Proposed Solution

Add `storeWords <count> <wordSizeExpr>` as an explicit memory instruction.

Semantics:
- Stack layout before call: `... , dstAddress , value1 , value2 , ... , valueN`
- `storeWords N W` pops `N` values from the top of the stack, then pops destination address.
- Writes words contiguously in original push order at stride `W` bytes:
  - `value1 -> dstAddress + 0 * W`
  - `value2 -> dstAddress + 1 * W`
  - ...
  - `valueN -> dstAddress + (N-1) * W`
- `wordSizeExpr` is compile-time resolved and may be:
  - a literal (`1`, `2`, `4`),
  - a constant identifier,
  - a supported derived identifier such as `%buffer`.
- Resolved `wordSize` values: `1`, `2`, `4` (MVP).
  - `1` uses `i32.store8`
  - `2` uses `i32.store16`
  - `4` uses `i32.store`

Example:

```8f4e
push &buffer
push 10
push 20
push 30
storeWords 3 2
```

```8f4e
int16[] buffer 16 0
push &buffer
; push 16 values...
storeWords 16 %buffer
```

## Anti-Patterns

- Do not infer `wordSize` from stack metadata in this TODO.
- Do not mix float/int store opcode selection in this first version.
- Do not change existing `store` and `storeBytes` semantics.

## Implementation Plan

### Step 1: Add wasm store helpers for subword writes
- Add `i32.store16` helper (and reuse `i32.store8` from `storeBytes` work).

### Step 2: Add `storeWords` instruction compiler
- Implement `packages/compiler/src/instructionCompilers/storeWords.ts`.
- Validate arguments (`count` and `wordSizeExpr` required; non-negative count; supported resolved word sizes).
- Resolve `wordSizeExpr` at compile time from literals/constants/supported prefixes (including `%buffer`).
- Validate operand availability (`count + 1` stack items including destination address).
- Emit contiguous stores in correct source order with opcode chosen from `wordSize`.

### Step 3: Register and document instruction
- Register in `packages/compiler/src/instructionCompilers/index.ts`.
- Add docs to `packages/compiler/docs/instructions/memory.md`.
- Add link in `packages/compiler/docs/instructions.md`.

### Step 4: Tests
- Add happy-path tests for `wordSize` 1/2/4.
- Add invalid-argument tests (unsupported sizes, negative values, unresolved identifiers).
- Add `%buffer` argument test for word-size resolution.
- Add ordering and operand-underflow tests.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run instructionCompilers`
- `rg -n "storeWords|store16|store8|wordSize" packages/compiler/src packages/compiler/docs`

## Success Criteria

- [ ] `storeWords <count> <wordSize>` compiles and writes contiguous words with correct stride.
- [ ] `storeWords <count> %buffer` resolves `%buffer` to the target element word size at compile time.
- [ ] `wordSize` 1/2/4 map to correct wasm store opcodes.
- [ ] Value write order matches push order.
- [ ] Invalid arguments and insufficient operands produce compiler errors.

## Affected Components

- `packages/compiler/src/instructionCompilers/storeWords.ts` (new)
- `packages/compiler/src/instructionCompilers/index.ts`
- `packages/compiler/src/wasmUtils/store/i32store16.ts` (new)
- `packages/compiler/docs/instructions/memory.md`
- `packages/compiler/docs/instructions.md`

## Risks & Considerations

- **Alignment behavior**: define and document behavior for unaligned addresses.
- **Signedness expectations**: clarify truncation semantics for 8/16-bit stores.
- **Scope control**: keep MVP integer-focused; float and typed variants can be separate follow-ups.

## Related Items

- **Depends on**: `docs/todos/archived/277-add-storebytes-with-explicit-byte-count.md`
- **Related**: `docs/todos/archived/146-investigate-index-arithmetic-support.md`

## Notes

- This TODO keeps `storeWords` explicit and predictable, matching the `storeBytes <count>` direction.
