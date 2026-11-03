---
title: 'TODO: Add `&*name` pointee start address prefix for pointers'
priority: Medium
effort: 2-4h
created: 2026-03-26
issue: https://github.com/8f4e/8f4e/issues/452
status: Open
completed: null
---

# TODO: Add `&*name` pointee start address prefix for pointers

## Problem Description

8f4e already supports `&name` to push the start byte address of a memory item and `*name` to dereference a pointer. However, there is no compile-time identifier form for "start address of the pointee" that mirrors these two concepts together.

Current state:
- `&buffer` returns the byte address of the pointer variable itself
- `*buffer` performs a runtime dereference and loads the pointed-to value
- there is no direct syntax for "the byte address stored in this pointer" as an address-oriented compile-time identifier form

Why this is a problem:
- pointer-manipulation code lacks a direct counterpart to the intended `%*name` pointee metadata syntax
- users have to express pointee-address access indirectly through runtime load paths instead of an address-focused prefix form
- the current prefix family is incomplete for pointer-oriented workflows

## Proposed Solution

Add support for `&*name` as a distinct identifier form meaning "the start byte address of the value pointed to by `name`".

High-level approach:
- extend identifier parsing/classification to recognize `&*name`
- resolve it only for pointer-typed memory identifiers
- preserve current `&name` behavior so it continues to mean the address of the memory item itself

Expected semantics:
- `&buffer` where `buffer` is `int*` keeps returning the byte address of the pointer slot
- `&*buffer` returns the pointee start byte address currently stored in `buffer`

## Anti-Patterns

- Do not redefine `&name` for pointers.
- Do not model `&*name` as string rewriting into an existing unrelated syntax path if it obscures pointer-specific validation.
- Do not allow `&*name` on non-pointer identifiers without an explicit error path.

## Implementation Plan

### Step 1: Add syntax support for `&*name`
- Introduce a dedicated parser/helper for pointee start-address identifiers
- Ensure it is classified separately from `&name` and `*name`

### Step 2: Compile pointer-value address access
- Reuse the pointer load path where appropriate, but keep the identifier meaning address-oriented
- Validate pointer-only usage

### Step 3: Add tests
- Cover `int*`, `float*`, and `float64*`
- Cover invalid non-pointer usage
- Cover `push &*name` and declaration initializer cases if supported

### Step 4: Update docs
- Document `&*name` in the prefix docs beside `&name` and `*name`
- Clarify how it differs from runtime dereference

## Validation Checkpoints

- `sed -n '1,220p' packages/compiler/docs/prefixes.md`
- `rg -n "&\\*|pointee start address" packages/compiler`
- `npx nx run @8f4e/compiler:test`

## Success Criteria

- [ ] `&*name` is accepted for pointer memory identifiers.
- [ ] `&name` keeps its existing meaning.
- [ ] `&*name` resolves to the byte address stored in the pointer.
- [ ] Invalid usage produces a clear error.
- [ ] Compiler docs explain the difference between `&name` and `&*name`.

## Affected Components

- `packages/compiler/src/syntax/` - identifier parsing and classification for `&*name`
- `packages/compiler/src/utils/memoryIdentifier.ts` - prefix-aware identifier checks
- `packages/compiler/src/instructionCompilers/push/` - pointer-address push handling
- `packages/compiler/docs/prefixes.md` - language docs for identifier prefixes

## Risks & Considerations

- **Syntax ambiguity**: `&*name` must not be confused with composing two existing operators ad hoc.
- **Runtime vs compile-time semantics**: the feature should stay clearly address-focused.
- **Error boundary**: invalid usage should follow the repo's syntax-vs-compiler error guidance.

## Related Items

- **Related**: `docs/todos/archived/319-add-pointee-element-word-size-prefix-for-pointers.md`
- **Related**: `docs/todos/archived/146-investigate-index-arithmetic-support.md`

## Notes

- This TODO is about pointer-value address access, not loading the pointee contents.
- If the final language design prefers treating `&*name` as syntactic sugar over an existing load-address sequence, that should remain invisible at the source-language level.
