---
title: 'TODO: Track block context flags during stack analysis'
priority: Medium
effort: 2-4h
created: 2026-05-19
issue: https://github.com/8f4e/8f4e/issues/662
status: Completed
completed: 2026-05-19
---

# TODO: Track block context flags during stack analysis

## Problem Description

`validateInstruction` checks whether each instruction is inside constants/map blocks by scanning the block stack. These block types are not expected to nest, so this can be made cheaper with simple maintained context booleans rather than generic depth counters.

The compiler coverage hotspot run showed repeated block-stack scans contributing to range executions.

## Proposed Solution

Extend the compilation context/block-stack handling with maintained booleans for the hot block-context checks, starting with `insideConstantsBlock` and `insideMapBlock`. Keep the existing `blockStack` as the ordered source of codegen metadata such as map state, expected block results, and loop locals.

Update block entry/exit code so the booleans are set when entering `constants` / `map` blocks and cleared when leaving them. Then make validation read the cached booleans instead of scanning the block stack for every instruction.

Do not add nesting counters or future-facing block-depth machinery for this task. If same-type nesting becomes a real language feature later, add the extra state then.

## Implementation Plan

### Step 1: Add Current-Scope Context Flags
- Add optional `insideConstantsBlock` and `insideMapBlock` booleans to `CompilationContext`.
- Initialize them to `false` in compiler and namespace-prepass context creation helpers.

### Step 2: Centralize Current Block Flag Updates
- Add small helpers in `packages/compiler/src/utils/blockStack.ts` for pushing and popping block state.
- Keep the helpers intentionally simple: set the matching boolean to `true` on push and `false` on pop for `BlockType.CONSTANTS` and `BlockType.MAP`.
- Convert the `constants`, `constantsEnd`, `mapBegin`, and `mapEnd` block mutations to use the helpers.

### Step 3: Read Cached Flags During Validation
- Update `validateInstruction` to use `context.insideConstantsBlock` and `context.insideMapBlock`.
- Leave broader `validateScope` scans alone unless the same change is clearly useful while touching the code.

### Step 4: Cover Current Behavior
- Add focused tests for flag updates and clearing after `constantsEnd` / `mapEnd`.
- Add or keep regression coverage proving invalid instructions are still rejected inside `constants` and `map` blocks.
- Run `npx nx run compiler:test`.

## Success Criteria

- [x] Validation still rejects instructions in invalid block scopes.
- [x] `validateInstruction` no longer scans `context.blockStack` for constants/map membership.
- [x] `insideConstantsBlock` and `insideMapBlock` are set and cleared by shared block-stack helpers.
- [x] Compiler coverage hotspot mitigation landed through cached block-context flags.

## Completion Notes

Completed on 2026-05-19.

- Verified `CompilationContext` has cached `insideConstantsBlock` and `insideMapBlock` flags.
- Verified `validateInstruction` reads the cached flags instead of scanning `context.blockStack`.
- Verified shared `pushBlock` / `popBlock` helpers maintain block-context flags and have focused tests.
- Implementation landed in `f300323e2 fix(compiler): cache block context flags`.

## Affected Components

- `packages/compiler/src/stackAnalysis/validateInstruction.ts`
- `packages/compiler/src/utils/blockStack.ts`
- `packages/compiler/src/compiler.ts`
- `packages/compiler-spec` compilation context types
