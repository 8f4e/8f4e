---
title: 'TODO: Add `min(*name)` pointee min value prefix for pointers'
priority: Medium
effort: 2-4h
created: 2026-03-26
issue: https://github.com/8f4e/8f4e/issues/449
status: Completed
completed: 2026-05-27
---

# TODO: Add `min(*name)` pointee min value prefix for pointers

## Problem Description

8f4e already supports `min(name)` to push the minimum finite value for the element type of a memory item. For pointer-typed memory items, that currently reflects the pointer storage type rather than the pointee type.

Current state:
- `min(buffer)` returns the min value for the memory item `buffer` itself
- for pointers, that means the pointer slot behaves like an integer-typed memory item
- there is no direct syntax to ask for the minimum value of the pointee type

Why this is a problem:
- pointer-aware generic code cannot ask for pointee numeric lower bounds directly
- the min/max metadata prefix family is incomplete for pointer semantics
- users may expect `min(*name)` once `sizeof(*name)` and `max(*name)` exist

## Proposed Solution

Add support for `min(*name)` as a compile-time identifier form meaning "minimum finite value of the type pointed to by `name`".

High-level approach:
- extend identifier parsing/classification to recognize `min(*name)`
- resolve it only for pointer-typed memory identifiers
- preserve current `min(name)` behavior for the memory item itself

Expected semantics with current type system:
- `min(buffer)` where `buffer` is `int*` keeps describing the pointer slot type
- `min(*buffer)` where `buffer` is `int*` returns the minimum finite value for `int`
- `min(*buffer)` where `buffer` is `float64*` returns the minimum finite value for `float64`

## Anti-Patterns

- Do not silently redefine `min(name)` for pointers.
- Do not implement `min(*name)` as a runtime dereference.
- Do not allow `min(*name)` on non-pointer identifiers without an explicit error path.

## Implementation Plan

### Step 1: Add syntax support for `min(*name)`
- Introduce a dedicated parser/helper for pointee min-value identifiers
- Ensure it is classified separately from `min(name)`

### Step 2: Resolve pointee numeric limits
- Derive pointee type limits from pointer metadata
- Reuse existing min-value helper rules where possible

### Step 3: Add tests
- Cover `int*`, `float*`, and `float64*`
- Cover invalid non-pointer usage
- Cover `push !*name` and declaration initializer cases if supported

### Step 4: Update docs
- Document `min(*name)` beside `min(name)`
- Clarify the distinction between pointer-slot and pointee-type min values

## Validation Checkpoints

- `sed -n '1,220p' packages/compiler/docs/prefixes.md`
- `rg -n "!\\*|pointee min value" packages/compiler`
- `npx nx run @8f4e/compiler:test`

## Success Criteria

- [ ] `min(*name)` is accepted for pointer memory identifiers.
- [ ] `min(name)` keeps its existing meaning.
- [ ] `min(*name)` resolves to the correct min value for the pointee type.
- [ ] Invalid usage produces a clear error.
- [ ] Compiler docs explain the difference between `min(name)` and `min(*name)`.

## Affected Components

- `packages/compiler/src/syntax/` - identifier parsing and classification for `min(*name)`
- `packages/compiler/src/utils/memoryIdentifier.ts` - prefix-aware identifier checks
- `packages/compiler/src/utils/memoryData.ts` - pointee min-value lookup
- `packages/compiler/src/instructionCompilers/push/` - compile-time min-value push handling
- `packages/compiler/docs/prefixes.md` - language docs for identifier prefixes

## Risks & Considerations

- **Type-system limits**: coarse pointer base types bound how precise pointee min values can be.
- **Parser overlap**: `min(*name)` must not be misclassified as `min(name)` or `*name`.
- **Error boundary**: invalid usage should follow the repo's syntax-vs-compiler error guidance.

## Related Items

- **Related**: `docs/todos/archived/319-add-pointee-element-word-size-prefix-for-pointers.md`
- **Related**: `docs/todos/archived/322-add-pointee-max-value-prefix-for-pointers.md`

## Notes

- This TODO assumes pointee numeric-range metadata can be derived entirely from the declared pointer type.
- If typed narrow pointers are added later, `min(*name)` should follow the narrowed pointee type.
- Completed on 2026-05-27 as part of TODO 428. `min(*name)` now has explicit parser, semantic, helper, docs, and public compiler coverage.
