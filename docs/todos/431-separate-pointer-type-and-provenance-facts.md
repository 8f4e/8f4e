---
title: 'TODO: Separate pointer type and provenance facts'
priority: Medium
effort: 2-4h
created: 2026-05-27
issue: https://github.com/8f4e/8f4e/issues/718
status: Open
completed: null
---

# TODO: Separate pointer type and provenance facts

## Problem Description

Pointer declarations combine two different kinds of information:

- type facts from the declaration, such as pointer depth and pointee base type
- provenance facts from a particular value, such as "this pointer was initialized from `&samples`"

Current state:
- `float* ptr` and `float* ptr &samples` share the same broad metadata surface
- `count(*ptr)` needs provenance/count facts, while `sizeof(*ptr)` and `min(*ptr)` mostly need type facts
- pointer type declarations do not establish a reachable element count
- memory-start and memory-end address initializers must be interpreted carefully to avoid overstating count metadata

Why this is a problem:
- helper semantics become harder to explain when type and provenance live side by side
- future pointer assignment/localSet behavior may accidentally preserve stale provenance
- `count(*name)` is inherently provenance-sensitive, unlike `sizeof(*name)` or `min(*name)`

## Proposed Solution

Model pointer type facts and pointer provenance facts separately.

Suggested split:

```ts
pointer: {
	type: {
		depth: 1 | 2;
		pointeeBaseType: BaseTypeMetadataKey;
	};
	provenance?: {
		source: 'memory-start';
		memoryId: string;
		moduleId?: string;
		elementCount?: number;
	};
}
```

Only memory-start provenance should carry allocation-level element count unless a future range system proves a more precise subrange.

## Anti-Patterns

- Do not treat pointer type declarations as proof of array length.
- Do not keep pointee count metadata after pointer arithmetic or assignment from an unknown address.
- Do not infer whole-array count from `name&` end-address initializers.
- Do not make `count(*name)` depend on raw pointer numeric values.

## Implementation Plan

### Step 1: Define semantics
- Document which operations preserve provenance and which clear it.
- Define current behavior for memory-start, memory-end, intermodule memory-start, locals, params, pointer arithmetic, and localSet.

### Step 2: Encode provenance explicitly
- Add a dedicated provenance field or nested shape.
- Store memory-start element count only when the address is known to be a memory start.
- Clear or narrow provenance when the compiler cannot prove the value still points to the same range.

### Step 3: Update pointer-aware helpers
- Make `sizeof(*name)`, `min(*name)`, and `max(*name)` use pointer type facts.
- Make `count(*name)` use provenance facts and fall back only by explicit rule.

### Step 4: Add regression tests
- Cover `&buffer`, `buffer&`, intermodule memory starts, localSet from known and unknown addresses, and pointer arithmetic.

## Validation Checkpoints

- `npx nx run compiler:test -- --run src/semantic/resolveCompileTimeArgument.test.ts src/stackAnalysis/analyzeInstruction.test.ts tests/instructions/constantExpressions.test.ts`
- `npx nx run @8f4e/compiler:typecheck`
- `rg -n "pointeeElementCount|safeRange|clampRange|localSet|pointsTo" packages/compiler packages/compiler/packages/language-spec -g '*.ts'`

## Success Criteria

- [ ] Pointer type facts and provenance facts are represented separately.
- [ ] `count(*name)` only uses explicit provenance/count metadata.
- [ ] Pointer operations clearly preserve, narrow, or clear provenance.
- [ ] Tests cover memory-start versus memory-end pointer initialization.

## Affected Components

- `packages/compiler/packages/language-spec/src/semantic.ts`
- `packages/compiler/packages/language-spec/src/memory.ts`
- `packages/compiler/src/semantic/declarations/createDeclarationCompiler.ts`
- `packages/compiler/src/stackAnalysis/analyzeInstruction.ts`
- `packages/compiler/src/instructionCompilers/localSet.ts`
- `packages/compiler/src/utils/memoryData.ts`

## Risks & Considerations

- **Semantic precision**: This may reveal places where the compiler currently carries provenance too optimistically.
- **Local mutation**: Pointer locals can change values, so provenance updates must follow assignments.
- **TODO 430 overlap**: This is easier if pointer metadata is nested first, but it can also guide that nested shape.

## Related Items

- **Related**: `docs/todos/430-nest-pointer-metadata-shape.md`
- **Related**: `docs/todos/501-preserve-known-pointee-counts-of-one.md`
- **Related**: `docs/todos/archived/428-add-pointer-aware-count-and-min-metadata-queries.md`
- **Related**: `docs/todos/425-split-stack-item-value-and-address.md`

## Notes

- Created after adding `count(*name)`. Count made the type/provenance split visible because pointer type alone does not imply a reachable element count.
