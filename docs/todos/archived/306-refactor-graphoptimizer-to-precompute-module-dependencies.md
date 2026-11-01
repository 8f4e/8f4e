---
title: 'TODO: Refactor graphOptimizer to precompute module dependencies'
priority: Medium
effort: 4-8h
created: 2026-03-14
issue: https://github.com/8f4e/8f4e/issues/421
status: Completed
completed: 2026-03-31
---

# TODO: Refactor graphOptimizer to precompute module dependencies

## Problem Description

[packages/compiler/src/graphOptimizer.ts](packages/compiler/src/graphOptimizer.ts) currently recomputes module ids and intermodular dependencies inside sort comparators.

Current behavior:
- the file separates constants blocks from regular modules
- it sorts regular modules by id
- it performs a second sort that repeatedly:
  - scans each AST for the `module` line
  - filters instructions that might carry intermodular references
  - collects referenced module ids for both compared modules
- the dependency extraction logic is duplicated almost verbatim for `astA` and `astB`

Why this is a problem:
- comparator work scales badly because ASTs are rescanned on every comparison
- duplicated reference extraction logic is harder to maintain and easier to drift
- the current implementation hides the real intent, which is dependency-aware ordering

## Proposed Solution

Split module metadata extraction from module ordering.

High-level approach:
- introduce a normalization step that extracts, once per AST:
  - module id
  - whether the AST is a constants block
  - referenced module ids
- sort or topologically order the normalized objects using the precomputed metadata
- then map back to the original AST list

Recommended implementation shape:
- add a helper like `getModuleSortMetadata(ast)`
- add a helper like `extractIntermodularDependencies(ast)` or `getReferencedModuleIds(ast)`
- keep deterministic id ordering as a tie-breaker

## Anti-Patterns

- Do not keep the current duplicated dependency-extraction blocks and merely move them into local lambdas inside the comparator.
- Do not rely on incidental stable-sort behavior without an explicit tie-break rule.
- Do not change intermodular reference semantics while doing this refactor.
- Do not reintroduce raw-string syntax parsing where current AST metadata (`targetModuleId`, `intermoduleIds`) already exists.

## Implementation Plan

### Step 1: Extract metadata helpers
- Add a helper to get the module/constants identity for an AST
- Add a helper to collect referenced module ids from the current AST metadata surface
- Reuse existing `targetModuleId` / `intermoduleIds` fields instead of reconstructing syntax

### Step 2: Precompute normalized sort inputs
- Transform `AST[]` into metadata records once
- Store dependency lists or sets on the metadata records
- Avoid repeated `find`, `filter`, and `map` inside comparators

### Step 3: Simplify ordering logic
- Replace the double-sort comparator structure with a clearer dependency-aware order
- Keep constants blocks first
- Keep deterministic alphabetical ordering when dependencies do not constrain the result

### Step 4: Add regression coverage
- Preserve existing supported reference forms
- Add tests that assert deterministic ordering for:
  - independent modules
  - single dependency chains
  - mixed prefix syntaxes
  - duplicate module ids

## Validation Checkpoints

- `rg -n "graphOptimizer|sortModules|intermodular" packages/compiler/src`
- `sed -n '1,260p' packages/compiler/src/graphOptimizer.ts`
- `npx nx run @8f4e/compiler:typecheck --skipNxCache`
- `npx nx run compiler:test --skipNxCache -- packages/compiler/src/graphOptimizer.ts`

## Success Criteria

- [ ] `graphOptimizer.ts` no longer rescans both ASTs inside sort comparators to extract the same metadata repeatedly.
- [ ] Intermodular dependency extraction exists in one shared path.
- [ ] Module ordering stays deterministic.
- [ ] Existing supported intermodular reference forms keep working.
- [ ] Tests cover both dependency and non-dependency ordering cases.

## Affected Components

- `packages/compiler/src/graphOptimizer.ts` - main refactor target
- `packages/compiler/src/types.ts` / tokenizer-provided AST metadata - dependency source inputs
- `packages/compiler/src/index.ts` - indirect consumer of sorted module order

## Risks & Considerations

- **Ordering regressions**: this file controls compile order, so even a readability refactor needs tight tests.
- **Cycle handling**: if dependency ordering is only partial, the implementation still needs deterministic fallback behavior.
- **Reference coverage**: all currently supported intermodular forms represented in AST metadata must remain reflected in the extracted dependencies.

## Notes

- This is primarily a refactor and small compile-time optimization, not a behavior change.
- The payoff is mostly code clarity plus lower repeated AST work during compilation.
- The old raw-syntax parsing concern is largely gone; the remaining problem is repeated AST rescanning and duplicated metadata extraction.
