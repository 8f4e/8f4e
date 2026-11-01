---
title: 'TODO: Add depth-aware pointer metadata query dereferencing'
priority: Medium
effort: 2-4h
created: 2026-05-27
issue: https://github.com/8f4e/8f4e/issues/715
status: Open
completed: null
---

# TODO: Add depth-aware pointer metadata query dereferencing

## Problem Description

8f4e now supports explicit pointer dereference depth for runtime `push` arguments, so `push *ptr` and
`push **ptr` mean different things when `ptr` is declared as a double pointer. Compile-time pointer metadata
queries do not mirror that model yet.

Current state:
- `sizeof(*pptr)` on a `float64** pptr` resolves to the pointer-slot width, `4`
- `max(*pptr)` on a `float64** pptr` resolves to the pointer-slot max, `2147483647`
- `sizeof(**pptr)` and `max(**pptr)` are parsed as queries against target `*pptr`, then fail to resolve

Why this is a problem:
- helper syntax no longer follows the same dereference-depth contract as `push`
- generic pointer code cannot ask for the final pointee metadata through a double pointer
- existing tests cover helper internals, but not the user-facing `sizeof(**ptr)` / `max(**ptr)` forms

## Proposed Solution

Make pointer metadata query parsing and resolution carry explicit dereference depth, matching `memory-pointer`
identifier handling.

High-level approach:
- parse `sizeof(*name)`, `sizeof(**name)`, `max(*name)`, and `max(**name)` into structured pointer metadata queries
- store both the base identifier and the requested dereference depth on the parsed argument shape
- resolve the query from memory or local pointer metadata by comparing requested depth against declared pointer depth
- reject query depths greater than the declared pointer depth with the same semantic error family used for `push **ptr`

Expected semantics:
- `sizeof(*float64Ptr)` returns `8`
- `sizeof(*float64PtrPtr)` returns `4`
- `sizeof(**float64PtrPtr)` returns `8`
- `max(*float64PtrPtr)` returns pointer-slot max
- `max(**float64PtrPtr)` returns `float64` max

## Anti-Patterns

- Do not keep the current one-star string stripping and try to special-case target names beginning with `*`.
- Do not make `sizeof(**ptr)` a runtime dereference; metadata queries remain compile-time only.
- Do not silently return `undefined` for excessive dereference depth once the target pointer is known.

## Implementation Plan

### Step 1: Extend parsed argument metadata
- Add dereference depth to pointee metadata query argument variants.
- Reuse the tokenizer's leading-star depth counting and current `**` cap.

### Step 2: Resolve metadata by requested depth
- Add helper functions that accept a requested dereference depth, not only the declared pointer depth.
- Use pointer-slot metadata when requested depth is less than declared depth.
- Use the declared pointee base type when requested depth equals declared depth.

### Step 3: Add parser and semantic tests
- Cover `sizeof(**ptr)` and `max(**ptr)` classification.
- Cover memory-backed and local pointer-backed resolution.
- Cover excessive depth rejection for `sizeof(**ptr)` on a single pointer.

### Step 4: Add public/compiler behavior tests
- Add instruction-level tests for `push sizeof(**param)` or an equivalent compile-time use.
- Keep existing `sizeof(*param)` behavior unchanged.

## Validation Checkpoints

- `npx nx run compiler:test -- --run packages/tokenizer/src/syntax/parseArgument.test.ts src/semantic/resolveCompileTimeArgument.test.ts src/utils/memoryData.test.ts tests/instructions/call.test.ts`
- `npx nx run @8f4e/language-spec:typecheck`
- `npx nx run @8f4e/compiler:typecheck`

## Success Criteria

- [ ] `sizeof(**ptr)` resolves correctly for double-pointer memory declarations.
- [ ] `sizeof(**param)` resolves correctly for double-pointer function params or locals.
- [ ] `max(**ptr)` resolves to the final pointee type max value.
- [ ] One-star metadata queries keep their current pointer-slot semantics for double pointers.
- [ ] Tests cover tokenizer classification, semantic resolution, and at least one public compiler path.

## Affected Components

- `packages/compiler/packages/language-spec/src/arguments.ts` - argument metadata shape for pointee queries.
- `packages/compiler/packages/sub-program/packages/tokenizer/src/syntax/parseArgument.ts` - parsing/classification of pointer metadata queries.
- `packages/compiler/src/semantic/resolveCompileTimeArgument.ts` - compile-time metadata resolution.
- `packages/compiler/src/utils/memoryData.ts` - depth-aware pointer metadata helpers.
- `packages/compiler/tests/instructions/` - public behavior coverage.

## Risks & Considerations

- **Parser overlap**: `sizeof(*module:memory)` currently has ambiguous-looking intermodule behavior; preserve or intentionally clarify it while adding depth metadata.
- **Error boundary**: syntax caps such as `***ptr` belong in tokenizer/syntax validation, while declared-depth excess belongs in semantic validation.
- **Breaking Changes**: This is additive for currently failing `**` helper forms; existing one-star behavior should remain stable.

## Related Items

- **Related**: `docs/todos/archived/323-add-pointee-min-value-prefix-for-pointers.md`
- **Related**: `docs/todos/archived/428-add-pointer-aware-count-and-min-metadata-queries.md`

## Notes

- Created after reviewing double-pointer support on 2026-05-27. Runtime `push *ptr` / `push **ptr` looked
  depth-aware and tested; this TODO is specifically for compile-time metadata helper parity.
