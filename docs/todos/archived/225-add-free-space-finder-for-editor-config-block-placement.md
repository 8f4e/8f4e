---
title: 'TODO: Add Free-Space Finder for Editor Config Block Placement'
priority: Medium
effort: 4-8h
created: 2026-02-16
issue: https://github.com/8f4e/8f4e/issues/409
status: Completed
completed: 2026-03-18
---

# TODO: Add Free-Space Finder for Editor Config Block Placement

## Problem Description

Editor config blocks are loaded from local storage and appended to the runtime code-block list. Their saved coordinates can collide with project code blocks loaded from the project file, causing overlap and making both blocks harder to read and interact with.

Currently there is no dedicated placement utility that finds a guaranteed free coordinate for editor config blocks when a collision would occur.

## Implemented Solution

Added a placement helper that:
- scans code-block space starting at grid coordinate `0,0`
- scans downward (increasing Y) on the target X span
- returns the first free top-left grid coordinate where the target block does not overlap any existing block
- evaluates occupancy using each block's effective grid bounds (position + width + height)
- leaves `2` grid rows of vertical padding below blocking code blocks when relocating

This helper is used when appending editor config blocks loaded from local storage so placement is deterministic and non-overlapping.

## Implementation Summary

### Step 1: Add occupancy model for code-block bounds
- Added shared grid-bounds utilities for rendered blocks.
- Added explicit code-derived grid sizing for newly created editor config blocks before placement.

### Step 2: Implement free-space scan helper
- Added a pure helper that accepts existing block bounds and target block bounds.
- Starts from `0,0`, scans downward, and skips below blocking spans plus padding.
- Returns grid coordinates suitable for assigning `gridX/gridY`.

### Step 3: Integrate during editor-config block loading
- In the editor-config load path, placement now derives the new block size from code and compares against rendered project block bounds.
- Colliding editor config blocks are re-placed automatically.
- Explicit stored coordinates are preserved when already free.

## Success Criteria

- [x] A helper exists that scans from `0,0` downward and returns the first free coordinate.
- [x] The helper checks overlap using block width and height, not just top-left points.
- [x] Editor config blocks loaded from local storage no longer overlap project blocks by default.
- [x] Placement behavior is deterministic across reloads.
- [x] Unit tests cover collision and non-collision placement cases.

## Affected Components

- `packages/editor/packages/editor-state/src/features/code-blocks/utils/finders/findFirstFreeCodeBlockGridY.ts` - placement and bounds helpers
- `packages/editor/packages/editor-state/src/features/editor-config-module/effect.ts` - editor config block load/placement path
- `packages/editor/packages/editor-state/src/features/editor-config-module/effect.test.ts` - integration coverage for relocation behavior

## Notes

- Occupancy checks remain fully grid-based.
- Existing rendered blocks and newly created editor config blocks now use explicit sizing paths instead of a mixed fallback model.

## Related Items

- **Related**: `docs/todos/124-code-block-grid-coordinates.md`
- **Related**: `docs/todos/197-editor-config-blocks.md` (archived)
