---
title: 'TODO: Add row-align context-menu action with fixed spacing'
priority: Medium
effort: 4-8h
created: 2026-02-18
issue: https://github.com/8f4e/8f4e/issues/411
status: Open
completed: null
---

# TODO: Add row-align context-menu action with fixed spacing

## Problem Description

There is no quick layout action to arrange multiple related code blocks into a clean horizontal row while keeping their relative left-to-right order.

## Requested Behavior

- Add a new context-menu action to align code blocks in a row.
- Apply only to code blocks within the selected block's single group.
- Keep the original horizontal order of the involved blocks.
- Align all target blocks to the same `y` position as the first code block.
- Place each subsequent block with a fixed gap of `4` grid columns after the previous block.

## Proposed Label
- `Align blocks in row`

## Implementation Notes

- Sorting/order basis:
  - Preserve current horizontal order (ascending by current `gridX`).
- Vertical alignment:
  - Use the first block's `gridY` as the shared row `y`.
- Spacing:
  - Use block width-aware placement with an additional fixed `4`-column gap between adjacent blocks.
  - Formula for each next block start: `prev.gridX + prev.gridWidth + 4`.

## Scope

- Target set is all code blocks in the selected block's `groupName`.
- Action is available only when the selected block belongs to a group.

## Implementation Plan

### Step 1: Menu wiring
- Add new context-menu item and dispatch a dedicated event.

### Step 2: Target set resolution
- Resolve all blocks sharing the selected block's `groupName`.

### Step 3: Row layout operation
- Sort targets by current `gridX`.
- Anchor row `y` to first block.
- Recompute `gridX` sequence with fixed 4-column gaps and block widths.
- Keep operation atomic for undo/history.

### Step 4: Tests
- Add tests for:
  - order preservation
  - y alignment to first block
  - fixed 4-column spacing
  - no-op when fewer than 2 target blocks

## Validation Checkpoints

- `npx nx run editor-state:test`
- `npx nx run editor-state:typecheck`
- `rg -n "Align blocks in row|align.*row|gridX|gridY" packages/editor/packages/editor-core/packages/editor-state/src`

## Success Criteria

- [ ] Menu item exists and dispatches action.
- [ ] Action is available only for grouped blocks.
- [ ] Blocks keep original left-to-right order.
- [ ] All target blocks share the first block's `gridY`.
- [ ] Adjacent blocks are separated by exactly 4 columns plus prior block width.
- [ ] Tests cover placement logic and edge cases.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/menu/menus/moduleMenu.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/**/effect.ts` (new align-row handler)
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/**/effect.test.ts`

## Notes

- This TODO records requested behavior only. Implementation is intentionally deferred.
