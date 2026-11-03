---
title: 'TODO: Add compile-time int cast helper'
priority: Medium
effort: 4-8h
created: 2026-06-11
issue: https://github.com/8f4e/8f4e/issues/948
status: Open
completed: null
---

# TODO: Add Compile-Time `int(...)` Cast Helper

## Problem Description

Compile-time expressions can fold arithmetic such as `113*CLOUDS_RATIO`, but when the result is not known to be an
integer type the value is awkward to use in integer-only positions such as array lengths, loop counts, and other
compile-time size arguments.

Runtime instructions such as `castToInt` do not help here because declarations like `float[] buffer DELAY_SIZE` need the
value before runtime code exists.

The reverb example needs sample-rate-relative constants such as:

```8f4e
const CLOUDS_RATIO SAMPLE_RATE/CLOUDS_SAMPLE_RATE
const DELAY_SIZE int(113*CLOUDS_RATIO)
float[] buffer DELAY_SIZE
```

## Proposed Solution

Add a compile-time helper form:

```8f4e
int(<compile-time-expression>)
```

`int(...)` should fold during compile-time argument resolution and return an integer constant. It should not emit runtime
code and should not be implemented as a stdlib function.

The helper should work in every position that already accepts compile-time constants or compile-time expressions:

```8f4e
const DELAY_SIZE int(113*CLOUDS_RATIO)
float[] buffer int(DELAY_SIZE)
push int(DELAY_SIZE)
loop int(SAMPLE_RATE/60)
```

## Resolved Decisions

- The helper name is `int`.
- The helper is compile-time only.
- The initial conversion should match runtime `castToInt` semantics: truncate toward zero.
- The helper should mark the folded result as `isInteger: true`.
- The helper should accept literals, constants, and existing compile-time expressions inside its argument.
- The helper should be supported anywhere compile-time argument normalization already runs, not only for `push`.

## Anti-Patterns

- Do not add this as a runtime instruction.
- Do not add this as a stdlib function; stdlib functions cannot affect declaration-time array sizes.
- Do not special-case only `push int(...)`; array declarations and loop counts are the main use case.
- Do not silently reinterpret arbitrary runtime stack values. The input must be resolvable at compile time.

## Implementation Plan

### Step 1: Extend Argument Parsing

- Add syntax support for compile-time helper calls such as `int(<arg>)`.
- Keep the AST shape distinct from normal function calls so it cannot be confused with runtime `call int`.
- Reuse existing compile-time expression parsing where possible for the helper argument.

### Step 2: Extend Compile-Time Resolution

- Teach `tryResolveCompileTimeArgument` / related compile-time folding code to resolve `int(...)`.
- Resolve the inner argument using the existing compile-time resolver.
- Return `Math.trunc(inner.value)` with `isInteger: true`.
- Preserve appropriate address safety metadata only when it is still valid; otherwise drop address metadata.

### Step 3: Normalize All Compile-Time Argument Positions

- Ensure the helper works through the existing normalization path for:
  - `const` declarations
  - memory declaration sizes
  - `push` arguments
  - `loop` counts
  - any other instruction argument that already accepts compile-time folded values

### Step 4: Add Tests

- Add parser/tokenizer tests for valid and invalid `int(...)` forms.
- Add compiler semantic tests for folded values:
  - `int(1.9)` -> `1`, integer
  - `int(-1.9)` -> `-1`, integer
  - `int(113*CLOUDS_RATIO)` folds when `CLOUDS_RATIO` is known
- Add integration-style examples for:
  - `const SIZE int(...)`
  - `float[] buffer int(...)`
  - `push int(...)`
  - `loop int(...)`

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/examples:test`
- Compile a small example containing `float[] buffer int(113*48000/32000)`.

## Success Criteria

- [ ] `int(...)` folds at compile time and produces integer constants.
- [ ] `int(...)` works in array length declarations.
- [ ] `int(...)` works in `push` and `loop` arguments.
- [ ] Runtime behavior and the existing `castToInt` instruction are unchanged.

## Affected Components

- `packages/compiler` - compile-time argument resolution and normalization.
- tokenizer/parser package - argument syntax support for compile-time helper calls.
- `packages/examples` - examples can use `int(...)` for sample-rate-relative sizes after implementation.

## Risks & Considerations

- **Syntax ambiguity**: `int(...)` must remain a compile-time helper, not a runtime call.
- **Rounding semantics**: use truncation toward zero to match `castToInt`; add `round(...)`, `floor(...)`, or `ceil(...)`
  separately if they are needed later.
- **Address metadata**: truncating address-derived expressions can invalidate safety metadata; prefer dropping metadata
  unless it can be proven safe.

## Related Items

- **Related**: `docs/todos/379-add-exponentiation-support-to-compile-time-expressions.md`
- **Related**: `docs/todos/432-centralize-compile-time-metadata-query-resolution.md`
- **Related**: `docs/todos/434-show-const-values-in-tooltips.md`
