---
title: 'TODO: Centralize compile-time metadata query resolution'
priority: Medium
effort: 2-4h
created: 2026-05-27
issue: https://github.com/8f4e/8f4e/issues/719
status: Open
completed: null
---

# TODO: Centralize compile-time metadata query resolution

## Problem Description

Compile-time metadata query resolution is currently implemented as many sequential branches in
`resolveCompileTimeArgument.ts`.

Current state:
- local and intermodule `count`, `sizeof`, `max`, and `min` branches repeat target lookup logic
- pointer-aware query branches repeat memory/local pointer lookup logic
- each new helper requires edits in multiple nearby branches
- unresolved target behavior is implicit in repeated `return undefined` paths

Why this is a problem:
- behavior is harder to audit as helper count grows
- adding depth-aware `**` support will need the same lookup and validation logic again
- pointer locals and pointer memory declarations can drift if handled in separate branches

## Proposed Solution

Split metadata resolution into two phases:

1. Resolve the metadata target into a common `ResolvedMetadataTarget`.
2. Evaluate a query kind against that target.

Example:

```ts
type ResolvedMetadataTarget =
	| { kind: 'memory'; memory: DataStructure; memoryMap: MemoryMap }
	| { kind: 'pointer'; pointer: PointerMetadata };
```

Then `count`, `sizeof`, `max`, and `min` become small query evaluators rather than large parser-shape branches.

## Anti-Patterns

- Do not keep query evaluation interleaved with target lookup.
- Do not add more sequential `if (operand.referenceKind === ...)` branches for each new pointer helper.
- Do not let memory-backed and local-backed pointer helpers use separate semantic rules.
- Do not return `undefined` for known targets with invalid dereference depth once TODO 427 is implemented.

## Implementation Plan

### Step 1: Extract target resolution
- Add a helper that resolves local memory, intermodule memory, local pointer, and pointer memory targets.
- Make unresolved identifiers explicit at the call site.

### Step 2: Extract query evaluation
- Add small evaluators for `count`, `sizeof`, `max`, and `min`.
- Route pointer and non-pointer cases through shared metadata helper functions.

### Step 3: Add depth and validation hooks
- Accept requested dereference depth from the parsed argument shape.
- Validate excessive pointer depth consistently.

### Step 4: Simplify tests
- Keep behavior tests, but add focused unit tests for target resolution and query evaluation if useful.

## Validation Checkpoints

- `npx nx run compiler:test -- --run src/semantic/resolveCompileTimeArgument.test.ts src/utils/memoryData.test.ts tests/instructions/constantExpressions.test.ts`
- `npx nx run @8f4e/compiler:typecheck`
- `rg -n "referenceKind === '.*element|pointee-element|intermodular-element" packages/compiler/src/semantic/resolveCompileTimeArgument.ts`

## Success Criteria

- [ ] Metadata target lookup is centralized.
- [ ] Query evaluation is centralized by query kind.
- [ ] Memory-backed and local-backed pointer metadata use the same rules.
- [ ] TODO 427 can add `**` support without duplicating resolver branches.

## Affected Components

- `packages/compiler/src/semantic/resolveCompileTimeArgument.ts`
- `packages/compiler/src/utils/memoryData.ts`
- `packages/compiler/packages/language-spec/src/arguments.ts`
- `packages/compiler/src/semantic/resolveCompileTimeArgument.test.ts`

## Risks & Considerations

- **Ordering**: This pairs naturally with TODO 429. Doing both together may reduce churn.
- **Error behavior**: Moving from `undefined` to explicit errors for known-invalid pointer depth should follow the compiler error-domain guidance.
- **Test churn**: Expected if the parsed argument shape changes first.

## Related Items

- **Related**: `docs/todos/429-unify-metadata-query-argument-shape.md`
- **Related**: `docs/todos/427-add-depth-aware-pointer-metadata-query-dereferencing.md`
- **Related**: `docs/todos/archived/428-add-pointer-aware-count-and-min-metadata-queries.md`

## Notes

- Created after reviewing the `count(*name)` and `min(*name)` implementation. The feature is small, but the resolver code grew by another set of parallel branches.
