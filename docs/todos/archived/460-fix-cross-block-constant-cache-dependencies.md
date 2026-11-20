---
title: 'TODO: Fix cross-block constant cache dependencies'
priority: Medium
effort: 4-8h
created: 2026-06-15
issue: null
status: Completed
completed: 2026-06-17
---

# TODO: Fix Cross-Block Constant Cache Dependencies

## Problem Description

The compiler AST cache is keyed and validated per source block. It checks the block cache key, source line count, and
source hash before returning the cached parsed AST.

That is correct for tokenizer output, but constants introduce a cross-block semantic dependency:

- a module block can contain `int[] buffer SIZE`;
- a separate constants block can define `const SIZE 2`;
- if the user changes only the constants block to `const SIZE 4`, the module block source hash still matches.

The previous constant pass mutated the AST it received. That meant the source-block AST cache needed a more deliberate
model before it could safely coexist with cross-block constant changes in editor/dev-loop scenarios.

This is now resolved by replacing the mutating inliner with `@8f4e/constant-resolver`, which returns per-line constant
facts while leaving tokenizer ASTs source-shaped.

## Proposed Solution

Keep the tokenizer AST cache source-shaped. Resolve constants for each project compilation and pass the resulting facts
to later compiler passes beside the original AST. Do not cache transformed/inlined ASTs using source hashes.

## Anti-Patterns

- Do not make the constant resolver perform AST-wide reference rebinding just to protect the tokenizer cache.
- Do not add a per-compile AST clone as an unowned bridge without an explicit cache strategy.
- Do not cache inlined ASTs using only the module/function/prototype source hash.
- Do not treat an unchanged module source hash as proof that its inlined constant values are unchanged.
- Do not couple this to memory layout planning; `push sizeof(buffer)` and other memory metadata expressions are a
  separate semantic concern.

## Implementation Plan

### Step 1: Define Cache Layers

- Keep cached tokenizer ASTs source-shaped.
- Document ownership and mutation rules for each cached value.
- Keep `@8f4e/constant-resolver` focused on constant collection and reference facts.

### Step 2: Track Constant Dependencies

- Resolve constant namespaces for each project compilation.
- Pass resolved constant facts to later passes instead of caching transformed ASTs.
- Keep any future transformed-cache key dependent on resolved namespace values.

### Step 3: Add Practical Regression Coverage

- Covered recompiling an unchanged module block after changing only a used constants block.
- Verified cached parser ASTs remain source-shaped.
- Function/prototype transformed-cache coverage is only needed if a transformed AST cache is introduced later.

## Validation Checkpoints

- Add focused regression coverage before changing cache behavior.
- `npx nx run @8f4e/compiler:test -- --run tests/compilerOptionsAndCache.test.ts`
- `npx nx run @8f4e/constant-resolver:test`
- `npx nx run @8f4e/compiler:test`

## Success Criteria

- [x] Cache behavior is explicit about source-shaped ASTs versus transformed ASTs.
- [x] Recompiling after changing only a used constants block cannot reuse stale inlined values.
- [x] The constant resolver does not own cache invalidation or AST graph-rebinding policy.
- [x] Memory planning remains a separate pass after constant resolution.
- [x] Regression tests cover the practical editor/dev-loop scenario.

## Affected Components

- `packages/compiler/packages/sub-program/packages/tokenizer/src/index.ts` - current source-block AST cache lookup and storage.
- `packages/compiler/packages/sub-program/src/compileSubProgram.ts` - per-compile AST preparation and constant resolution integration.
- `packages/compiler/packages/sub-program/packages/constant-resolver` - should stay simple and avoid cache-specific responsibilities.
- `packages/compiler/tests/compilerOptionsAndCache.test.ts` - likely home for future practical cache dependency coverage.

## Risks & Considerations

- **Hidden dependencies**: constants are imported through `use` lines, so cache invalidation must account for namespace
  contents, not just local source text.
- **Over-caching**: caching inlined ASTs may add complexity without a measured benefit.
- **Mutation boundaries**: downstream passes should receive source AST plus pass-owned facts.
- **Future memory-order work**: decoupling memory layout from execution order should not depend on this cache change.

## Related Items

- **Related**: `docs/todos/archived/458-decouple-module-execution-order-from-memory-layout.md`
- **Related**: `docs/todos/459-extract-compiler-diagnostics-package.md`
- **Related**: PR #808, which decoupled constants from memory before the resolver-report model.
