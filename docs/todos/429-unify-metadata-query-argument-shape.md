---
title: 'TODO: Unify metadata query argument shape'
priority: Medium
effort: 2-4h
created: 2026-05-27
issue: https://github.com/8f4e/8f4e/issues/716
status: Open
completed: null
---

# TODO: Unify metadata query argument shape

## Problem Description

Metadata query parsing currently has separate argument variants and classifier branches for each helper family:
`count(name)`, `sizeof(name)`, `max(name)`, `min(name)`, and their pointer-aware forms.

Current state:
- tokenizer code repeats the same local/intermodule/pointee branching for each query
- language-spec has many reference kinds for one conceptual operation family
- semantic resolution has matching repeated branches for each query and pointer variant
- adding `count(*name)` and `min(*name)` required touching several parallel paths

Why this is a problem:
- duplicated branches make it easy to place logic in the wrong classifier
- adding `**` metadata support will multiply the same shapes again
- tests need broad snapshot churn for a small metadata query extension

## Proposed Solution

Replace the per-helper reference-kind explosion with one structured metadata-query argument shape.

Suggested shape:

```ts
{
	type: ArgumentType.IDENTIFIER;
	referenceKind: 'metadata-query';
	query: 'count' | 'sizeof' | 'max' | 'min';
	scope: 'local' | 'intermodule';
	targetMemoryId: string;
	targetModuleId?: string;
	dereferenceDepth: 0 | 1 | 2;
}
```

The exact field names can change, but the important part is that the query kind, target, scope, and requested dereference depth are data, not separate TypeScript union variants.

## Anti-Patterns

- Do not add another round of query-specific variants for `**` forms.
- Do not keep compatibility aliases for old internal reference kinds after the migration.
- Do not parse pointer metadata queries by stripping only one leading `*`.
- Do not leave local and intermodule metadata queries represented by unrelated shapes.

## Implementation Plan

### Step 1: Add the unified argument shape
- Replace metadata-specific reference kinds in `packages/compiler/packages/language-spec/src/arguments.ts`.
- Include explicit `query` and `dereferenceDepth` fields.
- Keep address references, plain identifiers, constants, and runtime pointer dereferences as separate concepts.

### Step 2: Collapse tokenizer classification
- Replace `classifyCountQuery`, `classifyWordSizeQuery`, `classifyMaxQuery`, and `classifyMinQuery` with one table-driven classifier.
- Parse leading `*` count once and enforce the current `**` cap.
- Preserve intermodule query parsing.

### Step 3: Update semantic consumers
- Update compile-time resolution and normalization to consume the unified shape.
- Remove old per-query reference-kind branches.

### Step 4: Refresh tests and docs
- Update parser classification tests to assert the new shape.
- Update semantic tests and snapshots.
- Keep language docs focused on behavior, not internal reference kinds.

## Validation Checkpoints

- `npx nx run compiler:test -- --run packages/tokenizer/src/syntax/parseArgument.test.ts src/semantic/resolveCompileTimeArgument.test.ts`
- `npx nx run @8f4e/language-spec:typecheck`
- `npx nx run @8f4e/compiler:typecheck`

## Success Criteria

- [ ] Metadata queries use one language-spec argument variant.
- [ ] Parser logic for `count`, `sizeof`, `max`, and `min` is table-driven or otherwise centralized.
- [ ] Pointer metadata queries carry explicit dereference depth.
- [ ] Old metadata reference kinds are removed.
- [ ] Existing supported query behavior remains covered by tests.

## Affected Components

- `packages/compiler/packages/language-spec/src/arguments.ts`
- `packages/compiler/packages/sub-program/packages/tokenizer/src/syntax/parseArgument.ts`
- `packages/compiler/src/semantic/resolveCompileTimeArgument.ts`
- `packages/compiler/src/semantic/normalizeCompileTimeArguments.ts`
- `packages/compiler/tests/instructions/`

## Risks & Considerations

- **Wide snapshot churn**: AST snapshots will change because query argument metadata becomes structurally different.
- **TODO 427 overlap**: This is the clean foundation for depth-aware `**` metadata queries.
- **No compatibility burden**: The project has not been released, so remove old internal shapes directly.

## Related Items

- **Related**: `docs/todos/427-add-depth-aware-pointer-metadata-query-dereferencing.md`
- **Related**: `docs/todos/archived/428-add-pointer-aware-count-and-min-metadata-queries.md`
- **Related**: `docs/todos/426-decide-compiler-broad-type-splitting-strategy.md`

## Notes

- Created after implementing `count(*name)` and `min(*name)` on 2026-05-27. The implementation worked, but the repeated classifier and resolver branches made the next metadata extension feel unnecessarily fragile.
