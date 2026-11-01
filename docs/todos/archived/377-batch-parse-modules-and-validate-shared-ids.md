---
title: 'TODO: Batch-parse modules and validate shared ids'
priority: Medium
effort: 4-8h
created: 2026-04-08
issue: https://github.com/8f4e/8f4e/issues/559
status: Cancelled
completed: 2026-09-07
---

# TODO: Batch-parse modules and validate shared ids

## Problem Description

The compiler currently parses each module independently by mapping `compileToAST(...)` over the module list in `packages/compiler/src/index.ts`.

That means cross-module constraints are not visible during parsing:
- duplicate module ids cannot be detected inside a single `compileToAST(...)` call
- the compiler needs a separate batch-level validation step before sorting
- ownership of duplicate-id validation is split away from parsing even though it conceptually belongs at the source-to-AST boundary for the whole module set

This is workable, but it is more indirect than necessary.

## Proposed Solution

Introduce a batch parser helper for module collections.

Desired direction:
- keep `compileToAST(code, lineMetadata)` as the single-source parser
- add a higher-level helper that parses a whole module list and tracks shared top-level ids while doing so
- move duplicate module id validation into that batch parse helper
- let downstream phases such as graph ordering assume the parsed module batch has already passed uniqueness checks

Example direction:

```ts
parseModulesToAsts(modules: Array<{ code: string[]; lineMetadata?: ... }>): AST[]
```

That helper should:
- parse each module
- detect duplicate `module` ids across the full batch
- return the full AST collection only if the batch is valid

## Anti-Patterns

- Do not add hidden mutable global parser state.
- Do not make `compileToAST(...)` depend on previously parsed siblings implicitly.
- Do not move duplicate-id validation back into `graphOptimizer`; ordering should assume validated input.
- Do not add compatibility shims for both old and new orchestration paths; the software is unreleased.

## Implementation Plan

### Step 1: Add a batch parse helper
- Create a helper near the compiler/tokenizer boundary that parses the full module list.
- Keep the current single-input parser available for local/unit use.

### Step 2: Move duplicate module id validation into batch parsing
- Detect duplicate `module` ids while building the AST array.
- Throw the existing duplicate identifier error at that stage.

### Step 3: Simplify compile orchestration
- Replace the current parse-then-assert flow in `packages/compiler/src/index.ts`.
- Remove the standalone duplicate-module assertion helper once the batch parser owns the rule.

### Step 4: Reconfirm downstream assumptions
- Ensure `graphOptimizer` assumes unique module ids.
- Keep constants-vs-module namespace behavior explicit and unaffected unless intentionally redesigned.

## Validation Checkpoints

- `npx nx run compiler:test`
- `rg -n "compileToAST\\(|assertUniqueModuleIds|DUPLICATE_IDENTIFIER|sortModules" packages/compiler`

## Success Criteria

- [ ] Duplicate module ids are rejected during batch parsing rather than by a separate compiler precheck.
- [ ] `graphOptimizer` contains no duplicate-id validation logic.
- [ ] Compiler orchestration in `packages/compiler/src/index.ts` is simpler than the current parse-plus-assert sequence.
- [ ] Existing duplicate-module regression tests still pass with the new ownership boundary.

## Affected Components

- `packages/compiler/src/index.ts` - module parse orchestration
- `packages/compiler/packages/sub-program/packages/tokenizer/` or compiler-side parse wrapper - batch parse helper location
- `packages/compiler/packages/sub-program/src/semantic/buildNamespace.ts` - remove standalone duplicate-module assertion if superseded
- `packages/compiler/src/graphOptimizer.ts` - should remain ordering-only

## Risks & Considerations

- **Scope drift**: this should stay focused on module-batch parsing, not become a broader tokenizer redesign.
- **API churn**: parse orchestration may change, but unreleased status makes that acceptable.
- **Boundary clarity**: keep single-source parsing reusable while adding an explicit batch-level entry point.

## Notes

- This work was deferred intentionally to a later context because the immediate duplicate-id fix was smaller and safer to land first.
- The goal is cleaner ownership of cross-module validation, not parser-global mutable state.
