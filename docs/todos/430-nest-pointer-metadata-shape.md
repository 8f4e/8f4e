---
title: 'TODO: Nest pointer metadata shape'
priority: Medium
effort: 4-8h
created: 2026-05-27
issue: https://github.com/8f4e/8f4e/issues/717
status: Open
completed: null
---

# TODO: Nest pointer metadata shape

## Problem Description

Pointer facts are currently represented by scattered optional fields across multiple language-spec types.

Current state:
- `DataStructure` uses fields such as `pointeeBaseType`, `pointerDepth`, `pointeeElementCount`
- `PointerLocalBinding` repeats a similar set of fields
- `StackAddress.pointsTo` represents similar facts with different names such as `baseType` and `elementCount`
- helper types in `memoryData.ts` use adapter unions to paper over those shape differences

Why this is a problem:
- each phase uses a slightly different vocabulary for the same pointer facts
- adding new pointer metadata requires updating several optional-field lists
- optional fields obscure which facts exist for all pointers and which are provenance-only

## Proposed Solution

Introduce a shared nested pointer metadata shape and use it consistently across memory, locals, and stack address metadata.

Possible shape:

```ts
interface PointerMetadata {
	depth: 1 | 2;
	pointeeType: BaseTypeMetadataKey;
	pointee?: PointerPointeeMetadata;
}

interface PointerPointeeMetadata {
	elementCount?: number;
	provenance: 'memory-start' | 'unknown';
}
```

The precise names should follow language-spec style, but pointer facts should live under one `pointer` field instead of many top-level optional fields.

## Anti-Patterns

- Do not add a nested shape while leaving the old top-level pointer fields active indefinitely.
- Do not use broad casts to bridge old and new pointer metadata.
- Do not keep separate memory/local/stack pointer vocabularies if they can share one language-spec type.
- Do not mix pointer type facts and provenance facts without naming the distinction.

## Implementation Plan

### Step 1: Define shared pointer metadata types
- Add shared `PointerMetadata` and `PointerPointeeMetadata` types to `packages/compiler/packages/language-spec/src/semantic.ts` or another appropriate language-spec file.
- Decide whether `depth` should be a numeric literal union using the current `**` cap.

### Step 2: Migrate producers
- Update memory declaration compilers to populate `pointer`.
- Update function param/local pointer creation to use the nested shape.
- Update stack analysis to propagate the nested shape directly.

### Step 3: Migrate consumers
- Update `memoryData.ts`, push handlers, localSet, address guards, and stack analysis consumers.
- Remove adapter unions and top-level pointer optional fields.

### Step 4: Update tests and snapshots
- Refresh unit tests around pointer declarations, stack analysis, and compile-time metadata.
- Update public AST/memory map snapshots.

## Validation Checkpoints

- `rg -n "pointeeBaseType|pointeeElementCount|pointsTo" packages/compiler packages/compiler/packages/language-spec -g '*.ts'`
- `npx nx run @8f4e/language-spec:typecheck`
- `npx nx run @8f4e/compiler:typecheck`
- `npx nx run compiler:test -- --run src/utils/memoryData.test.ts src/stackAnalysis/analyzeInstruction.test.ts tests/instructions/constantExpressions.test.ts`

## Success Criteria

- [ ] Pointer metadata lives under one nested shape.
- [ ] `DataStructure`, pointer locals, and stack address metadata share the same pointer vocabulary.
- [ ] Old top-level pointer optional fields are removed.
- [ ] Pointer metadata helper code no longer needs shape-adapter unions.

## Affected Components

- `packages/compiler/packages/language-spec/src/memory.ts`
- `packages/compiler/packages/language-spec/src/semantic.ts`
- `packages/compiler/src/semantic/declarations/`
- `packages/compiler/src/stackAnalysis/`
- `packages/compiler/src/utils/memoryData.ts`
- `packages/compiler/src/instructionCompilers/`

## Risks & Considerations

- **Compiler-spec blast radius**: editor/runtime tooling may consume memory-map shapes and need updates.
- **Snapshot churn**: expected and acceptable because the project has not been released.
- **Ordering**: best done near the metadata-query refactor so `**` support can target the final shape.

## Related Items

- **Related**: `docs/todos/425-split-stack-item-value-and-address.md`
- **Related**: `docs/todos/426-decide-compiler-broad-type-splitting-strategy.md`
- **Related**: `docs/todos/429-unify-metadata-query-argument-shape.md`

## Notes

- Created after adding pointer-aware `count(*name)` and `min(*name)`. The feature added one more top-level pointer metadata field, which made the existing optional-field model feel close to its limit.
