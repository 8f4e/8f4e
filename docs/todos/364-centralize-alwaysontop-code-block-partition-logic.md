---
title: 'TODO: Centralize alwaysOnTop code block partition logic'
priority: Low
effort: 1-2 hours
created: 2026-04-03
issue: https://github.com/8f4e/8f4e/issues/557
status: Open
completed: null
---

# TODO: Centralize alwaysOnTop code block partition logic

## Problem Description

The `@alwaysOnTop` behavior is implemented through repeated ad hoc array partitioning of `graphicHelper.codeBlocks`. The same "normal blocks first, always-on-top blocks last" rule is currently duplicated across multiple editor-state features, including block creation, multi-block paste, drag reordering, and project-load population.

That duplication has two costs:

1. The rule is easy to implement slightly differently in different places.
2. Fixes to one path do not automatically apply to the others.

This already showed up in practice: `pasteMultipleBlocks.ts` parses `@alwaysOnTop` before inserting a block, while the single-block creation path in `codeBlockCreator/effect.ts` still constructs the new block with the default `alwaysOnTop: false` and only later relies on follow-up recomputation.

## Proposed Solution

Introduce a small shared helper module for z-order partition maintenance around `graphicHelper.codeBlocks`.

The helper should own the three recurring operations:

- partition a full block list into normal blocks followed by always-on-top blocks
- insert a block while preserving that partition
- bring a block to the front within its own partition

This keeps `graphicHelper.codeBlocks` as the canonical z-ordered array, but removes the repeated local `filter(...alwaysOnTop)` logic from unrelated features.

## Implementation Plan

### Step 1: Add a shared partition helper
- Create a small utility module under the code-block feature area.
- Add pure functions such as `partitionCodeBlocksByAlwaysOnTop`, `insertCodeBlockRespectingAlwaysOnTop`, and `bringCodeBlockToFrontWithinPartition`.

### Step 2: Replace duplicated call-site logic
- Update:
  - `features/code-blocks/features/codeBlockCreator/effect.ts`
  - `features/code-blocks/features/codeBlockCreator/pasteMultipleBlocks.ts`
  - `features/code-blocks/features/codeBlockDragger/effect.ts`
  - any remaining load/population path that hand-rolls the same partitioning
- Make the single-block creation path derive `alwaysOnTop` before insertion instead of relying on the default field value.

### Step 3: Add focused coverage
- Add or extend tests to cover:
  - inserting a normal block when top blocks already exist
  - inserting an always-on-top block directly into the top partition
  - bringing a normal block forward without crossing into the top partition
  - bringing an always-on-top block forward within the top partition

## Success Criteria

- [ ] Always-on-top partitioning logic is implemented in one shared helper instead of repeated inline filters.
- [ ] Single-block creation and multi-block paste follow the same insertion semantics.
- [ ] Existing editor-state tests remain green.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/codeBlockCreator/effect.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/codeBlockCreator/pasteMultipleBlocks.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/codeBlockDragger/effect.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/graphicHelper/effect.ts`

## Risks & Considerations

- Low risk if the helper stays pure and narrowly scoped to array ordering.
- The refactor should not change the fact that `graphicHelper.codeBlocks` remains the source of truth for render order and hit-testing.

## Related Items

- Related: `349-add-always-on-top-editor-directive-for-code-blocks.md`

## Notes

- This is primarily a consistency and maintainability refactor, but it also closes the gap between single-block creation and the already-correct multi-block paste path.
