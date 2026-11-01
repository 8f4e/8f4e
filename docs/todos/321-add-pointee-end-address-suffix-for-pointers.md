---
title: 'TODO: Add `*name&` pointee end address suffix for pointers'
priority: Medium
effort: 2-4h
created: 2026-03-26
issue: https://github.com/8f4e/8f4e/issues/451
status: Open
completed: null
---

# TODO: Add `*name&` pointee end address suffix for pointers

## Problem Description

8f4e supports `name&` to push the start byte address of the last word-aligned chunk covering a memory item. That gives users an address-oriented way to reference the end of an allocation. For pointer-typed memory items, there is no corresponding syntax for the end address of the pointee target.

Current state:
- `buffer&` returns the end-address form for the pointer slot itself
- `*buffer` loads the pointee value at runtime
- there is no direct syntax for "end address of the pointee allocation"

Why this is a problem:
- pointer-based range math lacks symmetry with `name&`
- users cannot express pointee-end addressing with a single identifier form
- the pointer prefix/suffix family remains incomplete compared with the scalar/buffer forms

## Proposed Solution

Add support for `*name&` as a distinct identifier form meaning "the start byte address of the last word-aligned chunk covering the pointee allocation addressed by `name`".

High-level approach:
- extend identifier parsing/classification to recognize `*name&`
- resolve it only for pointer-typed memory identifiers
- preserve current `name&` behavior for the pointer variable itself

Expected semantics:
- `buffer&` where `buffer` is `int*` keeps returning the end-address form for the pointer slot
- `*buffer&` returns the end-address form for the pointed-to allocation

## Anti-Patterns

- Do not silently change `name&` semantics for pointers.
- Do not define `*name&` as "address of dereferenced value" without accounting for allocation width.
- Do not allow `*name&` on non-pointer identifiers without a clear error path.

## Implementation Plan

### Step 1: Add syntax support for `*name&`
- Introduce a dedicated parser/helper for pointee end-address identifiers
- Ensure it is classified separately from `name&` and `*name`

### Step 2: Resolve pointee end address
- Load the pointer value and compute the last covered word-aligned chunk using the pointee allocation width
- Validate pointer-only usage

### Step 3: Add tests
- Cover `int*`, `float*`, and `float64*`
- Cover invalid non-pointer usage
- Cover `push *name&` and declaration initializer cases if supported

### Step 4: Update docs
- Document `*name&` in the prefix docs beside `name&`
- Clarify how pointee end-address semantics differ from pointer-slot end-address semantics

## Validation Checkpoints

- `sed -n '1,220p' packages/compiler/docs/prefixes.md`
- `rg -n "\\*.*&|pointee end address" packages/compiler`
- `npx nx run @8f4e/compiler:test`

## Success Criteria

- [ ] `*name&` is accepted for pointer memory identifiers.
- [ ] `name&` keeps its existing meaning.
- [ ] `*name&` resolves to the end-address form for the pointee allocation.
- [ ] Invalid usage produces a clear error.
- [ ] Compiler docs explain the difference between `name&` and `*name&`.

## Affected Components

- `packages/compiler/src/syntax/` - identifier parsing and classification for `*name&`
- `packages/compiler/src/utils/memoryIdentifier.ts` - suffix-aware identifier checks
- `packages/compiler/src/instructionCompilers/push/` - pointer end-address push handling
- `packages/compiler/docs/prefixes.md` - language docs for identifier prefixes

## Risks & Considerations

- **Width resolution**: pointee end-address computation depends on pointee allocation size semantics.
- **Syntax ambiguity**: `*name&` must not be misclassified as ordinary dereference plus existing suffix handling.
- **Current type-system limits**: coarse pointer base types limit how precise pointee-width behavior can be.

## Related Items

- **Related**: `docs/todos/archived/319-add-pointee-element-word-size-prefix-for-pointers.md`
- **Related**: `docs/todos/320-add-pointee-start-address-prefix-for-pointers.md`
- **Related**: `docs/todos/archived/146-investigate-index-arithmetic-support.md`

## Notes

- This TODO assumes the pointee allocation width can be derived from pointer metadata already available at compile time.
- If pointee-end semantics need a different source-level spelling, that should be decided before implementation.
