---
title: 'TODO: Discriminate compiler block stack frames'
priority: Medium
effort: 4-8h
created: 2026-05-25
issue: https://github.com/8f4e/8f4e/issues/684
status: Done
completed: 2026-05-25
---

# TODO: Discriminate compiler block stack frames

## Problem Description

`BlockStack` currently stores one broad frame shape where fields such as `mapState` and `loopCounterLocalName` are optional. Code that is already scoped to a map or loop block still has to use non-null assertions or repeated top-frame checks.

This makes compiler-owned impossible states look possible to TypeScript and scatters defensive checks across stack analysis and codegen.

The overall goal is to use strict types for block-state facts once the compiler has established them. A map frame without `mapState` is not a valid internal state; a loop frame is the only frame that can carry loop-specific metadata. These distinctions should be encoded in the block frame union rather than rediscovered through runtime checks.

This refactor should remove code, not move checks around. In particular, do **not** add new codegen-phase runtime validation such as `peekExpectedBlock(...)` followed by `throw getError(...)`. Invalid source block structure should already be rejected by tokenizer, semantic normalization, or stack analysis before codegen runs. Codegen should consume a narrowed internal contract and trust compiler-owned invariants.

## Project Compatibility Note

This project has not been released yet and we own the whole codebase. Do not add compatibility layers, legacy aliases, adapter shims, or fallback paths just to preserve broad internal interfaces. Prefer changing the type contracts directly and updating all call sites in the repo.

## Proposed Solution

Turn block frames into a discriminated union keyed by `blockType`:

- map frames require `mapState`;
- loop frames carry loop counter metadata when present;
- generic, condition, module, function, and constants frames only expose fields they can actually have.

Prefer moving block-specific state into normalized/analyzed data before codegen where that lets codegen stop reading broad frame shapes. For map lowering, the preferred direction is to collect and validate map rows/defaults before `mapEnd` codegen, then give `mapEnd` a typed input that already contains the complete map state. If a helper is needed in codegen, it should be a type-level assertion over an already-proven compiler invariant, not a new user-facing error branch.

The important distinction is between validating user block structure and defending against malformed compiler-owned frames. User source validation remains runtime behavior in tokenizer/semantic/stack-analysis phases; codegen should not revalidate those same facts.

## Implementation Plan

### Step 1: Define Frame Union

- [x] Replace the single broad `BlockStack[number]` shape with named frame types.
- [x] Keep shared result-shape fields in a base frame type.
- [x] Require `mapState` on map frames.

### Step 2: Add Typed Helpers

- [x] Add typed access helpers only where they delete existing code or assertions without adding new runtime error paths in codegen.
- [x] Keep user-facing block mismatch errors in existing validation phases.
- [x] Keep `popBlock(...)` for generic codegen behavior where no type-specific fields are needed.

### Step 3: Update Map and Loop Consumers

- [x] Update `map`, `default`, `mapEnd`, `loopIndex`, and stack-analysis map/loop paths to consume narrowed data.
- [x] Remove `mapState!`, `loopBlock!`, and similar assertions only when the replacement removes ambiguity without adding new codegen checks.

Deferred note: pushing map row/default collection out of codegen belongs to the larger stack-analysis/codegen separation work; this refactor deliberately avoided expanding scope beyond the frame shape.

### Step 4: Delete, Do Not Relocate, Defensive Code

- [x] Confirm the implementation has fewer codegen branches/checks than before.
- [x] Do not replace non-null assertions with codegen `if (!...) throw ...` guards.
- [x] If a narrowed type cannot be expressed without a new codegen check, leave that part for a later typed-line or phase-separation task instead of worsening runtime behavior.

## Validation Checkpoints

- Run `npx nx run compiler-spec:typecheck`.
- Run `npx nx run compiler:typecheck`.
- Run `npx nx run compiler:test`.
- Check `rg -n "mapState!|loopBlock!|popBlock\\(context\\)!" packages/compiler/src`.
- Check `rg -n "peekExpectedBlock|popExpectedBlock|MISSING_BLOCK_START_INSTRUCTION|INSTRUCTION_INVALID_OUTSIDE_LOOP" packages/compiler/src/instructionCompilers` to ensure codegen did not gain new validation branches.

## Success Criteria

- [x] Map block consumers can access `mapState` without non-null assertions.
- [x] Loop metadata consumers are narrowed through a typed frame.
- [x] Invalid block nesting still produces the same compiler errors.
- [x] Codegen does not gain new user-facing runtime checks for block structure.
- [x] Codegen code size/branch count is reduced or unchanged; the refactor does not merely wrap existing ambiguity in helper calls.
- [x] Compiler tests and typechecks pass.

## Completion Notes

Completed in PR followup branch `ai/discriminate-compiler-block-stack-frames`.

- `BlockStack` is now a discriminated union with required `mapState` on map frames and required loop counter metadata on loop frames.
- Codegen uses narrow invariant helpers for map/loop frames without adding user-facing validation branches.
- Existing block-structure errors remain in stack analysis and validation paths.
- `mapState!`, `loopBlock!`, `loopCounterLocalName!`, and close-block `popBlock(context)!` assertions were removed from compiler sources.
- Moving map row/default collection out of codegen remains part of the larger stack-analysis/codegen separation work rather than this frame-shape refactor.

## Affected Components

- `packages/compiler-spec/src/semantic.ts`
- `packages/compiler/src/utils/blockStack.ts`
- `packages/compiler/src/stackAnalysis/analyzeInstruction.ts`
- `packages/compiler/src/instructionCompilers/map.ts`
- `packages/compiler/src/instructionCompilers/mapEnd.ts`
- `packages/compiler/src/instructionCompilers/default.ts`
- `packages/compiler/src/instructionCompilers/loopIndex.ts`

## Risks & Considerations

- **Behavior risk**: Bad block nesting must keep the same error behavior, but that behavior should stay in tokenizer/semantic/stack-analysis validation rather than codegen.
- **Scope creep**: Do not refactor block semantics beyond the frame shape unless needed for typing.
- **Wrong-goal risk**: Do not move map/loop checks deeper into codegen as extra guards. Prefer typed normalized/analyzed lines, stricter frame unions, or smaller no-op codegen paths that delete checks.
- **Regression lesson**: A previous attempt added `peekExpectedBlock(...)` / `popExpectedBlock(...)` checks in codegen. That made the PR worse because it relocated validation instead of removing runtime ambiguity. Avoid that shape.
- **Dependency**: This can be deployed independently from context splitting.

## Related Items

- **Related**: `397-finish-compiler-stack-analysis-codegen-separation.md`
- **Related**: `409-track-block-context-flags-during-stack-analysis.md`
