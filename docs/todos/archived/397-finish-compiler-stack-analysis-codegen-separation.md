---
title: 'TODO: Finish compiler stack analysis/codegen separation'
priority: Medium
effort: 2-4d
created: 2026-05-11
issue: https://github.com/8f4e/8f4e/issues/653
status: Done
completed: 2026-05-20
---

# TODO: Finish compiler stack analysis/codegen separation

## Problem Description

TODO 394 centralized compiler instruction stack validation: `withValidation` is gone, compiler-owned instruction contracts live in `packages/compiler-spec/src/instructionSpecs.ts`, and stack validation helpers live under `packages/compiler/src/stackAnalysis/`.

That was an important first extraction step, but the compiler is still not fully split into distinct stack-analysis and codegen stages:

- `compileLine` still calls `validateInstruction(...)` immediately before emitting bytecode.
- instruction compiler files still read and mutate `context.stack`;
- codegen still receives `CompilationContext`, which exposes the stack-analysis state;
- stack effects are now documented as shared spec metadata, but are not yet returned as analyzed line data with codegen hints;
- there is no automated boundary check preventing stack validation from creeping back into codegen.

This keeps stack typing partially coupled to bytecode emission and makes later compiler work, such as generic function specialization or typed dispatch, harder than it needs to be.

## Proposed Solution

Finish the stage-boundary refactor that TODO 394 started.

The final pipeline should be:

- semantic normalization resolves compile-time arguments;
- stack analysis validates stack availability, operand types, function signatures, control-flow stack shape, and stack effects;
- codegen consumes analyzed lines and emits bytecode from trusted analysis results.

Codegen should not own stack validation or mutate the analysis stack directly.

## Implementation Plan

### Step 1: Introduce analyzed line output

- Add a typed analyzed-line structure that records the original normalized line, stack before/after, consumed operands, produced stack items, and codegen hints.
- Keep hints limited to facts codegen needs, such as value type and access width.
- Return analyzed lines from a stack-analysis pass instead of validating one line at a time inside `compileLine`.

### Step 2: Convert simple instruction effects

- Move stack effects for simple linear instructions into stack analysis.
- Use the shared stack-effect metadata in `@8f4e/compiler-spec` as the declarative source for display/docs and as the starting point for analysis-owned simple effects.
- Start with arithmetic, comparisons, casts, `drop`, and `clearStack`.
- Keep existing bytecode output stable while removing stack mutation from those instruction compilers.

### Step 3: Convert complex instruction effects

- Move custom stack behavior for `push`, `call`, `load`, `loadFloat`, `store`, `storeBytes`, `memoryCopy`, control-flow instructions, `functionEnd`, and `return` into stack analysis.
- Preserve existing semantic behavior and error codes unless an intentional behavior change is documented.

### Step 4: Narrow codegen context

- Introduce a codegen context type that does not expose `stack`.
- Update instruction compiler signatures so bytecode emitters consume analyzed line data and the narrowed codegen context.
- Remove direct `context.stack` reads and writes from non-test instruction compiler files.

### Step 5: Add boundary enforcement

- Add a repository-level regression test or script that fails when codegen files import stack-analysis validation helpers or reference `context.stack`.
- Keep stack-analysis tests focused on stack effects and stack-type errors.
- Keep existing compiler integration tests for bytecode stability.

## Validation Checkpoints

```sh
rg "withValidation" packages/compiler/src
rg "context\\.stack|validateOperandTypes|peekStackOperands" packages/compiler/src/instructionCompilers -g '!*.test.ts'
npx nx run compiler:test
npx nx run compiler:typecheck
```

The first command should return no matches. The second command should return no non-test codegen matches after the separation is complete.

## Success Criteria

- [x] Stack analysis runs as a distinct pass after semantic normalization and before codegen.
- [x] Stack-type-related errors are owned by stack analysis.
- [x] Analyzed line data records consumed operands, produced stack items, and stack before/after.
- [x] Codegen instruction functions consume analyzed lines instead of mutating `context.stack`.
- [x] Codegen uses a narrowed context type that does not expose `stack`.
- [x] Non-test instruction compiler files do not import stack-analysis validation helpers.
- [x] Automated checks fail if `context.stack` or stack validation helpers reappear in codegen files.
- [x] Existing compiler behavior and bytecode snapshots remain stable unless intentionally changed.
- [x] Focused compiler tests and typechecks pass.

## Affected Components

- `packages/compiler/src/stackAnalysis/` - analysis pass, stack effects, validation helpers, and tests.
- `packages/compiler-spec/src/instructionSpecs.ts` - central instruction contract table extended with stack-effect metadata.
- `packages/compiler/src/instructionCompilers/` - bytecode emitters converted away from stack mutation.
- `packages/compiler/src/compiler.ts` - pipeline orchestration for semantic normalization, stack analysis, and codegen.
- `packages/compiler-spec` - shared analyzed-line and narrowed codegen-context contract types if they need to cross package boundaries.

## Risks & Considerations

- **Behavior drift**: moving stack effects out of instruction compilers can subtly change errors or stack metadata.
- **Overgrown hints**: codegen hints should stay small and should not become a second validation surface.
- **Hybrid state**: avoid leaving some instructions analysis-owned and others codegen-owned for long without clear tests.
- **Test churn**: instruction compiler unit tests may need to shift from stack mutation assertions to analysis-pass assertions.

## Related Items

- **Follows**: `docs/todos/archived/394-extract-stack-analysis-pass.md`
- **Related**: `docs/todos/384-add-compiler-algorithmic-regression-metrics.md`

## Notes

- This TODO intentionally starts from the current post-394 state, where `withValidation` has already been removed and instruction stack validation has already moved into `packages/compiler/src/stackAnalysis/`.
- `packages/compiler-spec/src/instructionSpecs.ts` now exposes user-facing docs, stack-effect display metadata, and stack-signature helpers. The remaining work is to make compiler stack analysis consume this metadata and to remove stack mutation from codegen.
- Completed on 2026-05-20 by introducing analyzed lines and a narrowed codegen context, moving stack effects out of instruction emitters, and adding `architectureBoundaries.test.ts` to enforce the new boundary.
