---
title: 'TODO: Remove dead compiler block-state caches'
priority: Medium
effort: 2-4h
created: 2026-08-21
issue: https://github.com/8f4e/8f4e/issues/954
status: Completed
completed: 2026-10-20
---

# TODO: Remove Dead Compiler Block-State Caches

## Problem Description

`CompilationContext` still carries `activeBlockDepths` and seven `inside...Block` booleans for module, function, generic,
loop, condition, constants, and map blocks. The shared block-stack helpers update all of these fields on every block
push and pop, and context construction derives them from `blockStack`.

These caches were introduced for direct block-placement checks, but no production consumer reads them anymore. Current
loop and map consumers use the narrower `activeLoopBlocks` and `activeMapBlock` caches instead. The dead fields now add
state that must stay synchronized, broaden the compiler context contract, and preserve tests for behavior that no
runtime compiler path needs.

## Proposed Solution

Remove `activeBlockDepths` and all seven legacy `inside...Block` booleans from the compiler context and its construction
and mutation helpers. Simplify block pushes and pops so they maintain only the ordered `blockStack` and the actively
consumed loop/map caches.

Keep `activeLoopBlocks` and `activeMapBlock`. They provide direct access to data used by semantic reference resolution,
stack analysis, and code generation and are not part of this cleanup.

## Anti-Patterns

- Do not retain aliases, optional fallback fields, or compatibility accessors for the removed caches.
- Do not replace the dead fields with repeated `blockStack` scans when no consumer needs the information.
- Do not remove `blockStack`, `activeLoopBlocks`, or `activeMapBlock` as part of this focused cleanup.
- Do not preserve tests whose only purpose is verifying updates to removed state.

## Implementation Plan

### Step 1: Narrow The Compilation Context

- Remove `activeBlockDepths` and the seven `inside...Block` properties from `CompilationContext`.
- Remove the same fields from context override/helper types and test fixtures.
- Keep the ordered block stack and actively consumed loop/map cache types unchanged.

### Step 2: Simplify Context Construction

- Stop creating and deriving block-depth counts in `createCompilationContext`.
- Narrow `getBlockState` to derive only `activeLoopBlocks` and `activeMapBlock`, or remove the helper if its remaining
  work is clearer inline.
- Remove override behavior that exists solely for the deleted caches.

### Step 3: Simplify Block Mutation

- Remove depth increments and decrements from `pushBlock` and `popBlock`.
- Delete `updateBlockContextFlag` and its block-type switch.
- Continue maintaining `activeLoopBlocks` and `activeMapBlock` exactly as current consumers require.

### Step 4: Update Tests And Fixtures

- Delete assertions for the removed boolean flags and depth counts.
- Update manually constructed compiler contexts in stack-analyzer and compiler tests.
- Retain nested-loop and map coverage that verifies the live caches and ordered block stack.

## Validation Checkpoints

- `rg -n "activeBlockDepths|inside(Module|Function|Generic|Loop|Condition|Constants|Map)Block" packages/compiler`
- `npx nx run @8f4e/language-spec:typecheck`
- `npx nx run @8f4e/semantic-utils:test`
- `npx nx run @8f4e/semantic-utils:typecheck`
- `npx nx run @8f4e/stack-analyzer:test`
- `npx nx run @8f4e/stack-analyzer:typecheck`
- `npx nx run @8f4e/semantic-reference-resolver:test`
- `npx nx run @8f4e/wasm-codegen:test`
- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/compiler:typecheck`

## Success Criteria

- [ ] `CompilationContext` contains no `activeBlockDepths` or `inside...Block` compatibility fields.
- [ ] Block push/pop operations no longer update unused depth or boolean state.
- [ ] Context construction no longer derives unused block-state caches.
- [ ] `blockStack`, `activeLoopBlocks`, and `activeMapBlock` behavior remains covered and unchanged.
- [ ] Compiler package tests and typechecks pass without compatibility aliases or fallback reads.

## Affected Components

- `packages/compiler/packages/language-spec/src/semantic.ts` - narrow `CompilationContext`.
- `packages/compiler/packages/sub-program/packages/semantic-utils/src/createCompilationContext.ts` - remove dead cache construction.
- `packages/compiler/packages/sub-program/packages/semantic-utils/src/blockStack.ts` - remove dead cache synchronization.
- `packages/compiler/packages/sub-program/packages/semantic-utils/src/blockStack.test.ts` - remove obsolete assertions and retain live-cache coverage.
- `packages/compiler/packages/sub-program/packages/stack-analyzer/src/analyzeInstruction.test.ts` - update manually constructed context fixtures.

## Risks & Considerations

- **Hidden consumers**: Run a repository-wide identifier search before deletion; typechecking should catch structural
  context consumers that are not found by the initial source audit.
- **Nested loops**: Preserve `activeLoopBlocks` nesting behavior while simplifying the generic block-state machinery.
- **Map lifecycle**: Maps are non-nestable by placement rules, but `activeMapBlock` must still be cleared at the same
  point during block closure.
- **No compatibility burden**: These fields are compiler-internal and unused, so remove them directly rather than
  deprecating them.

## Related Items

- **Related**: `docs/todos/archived/409-track-block-context-flags-during-stack-analysis.md`
- **Related**: `docs/todos/archived/463-refactor-stack-analyzer-to-return-fact-report.md`
