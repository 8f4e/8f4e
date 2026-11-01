---
title: 'TODO: Use CodeBlock name instead of recomputing from code'
priority: Low
effort: 2-4 days
created: 2026-01-22
issue: https://github.com/8f4e/8f4e/issues/403
status: Completed
completed: 2026-06-14
---

# TODO: Use CodeBlock name instead of recomputing from code

## Problem Description

The system frequently derives source-level block names by calling `getCodeBlockNameFromSource(code)` during updates and rendering. This is redundant because `CodeBlockGraphicData.name` is intended to carry the current source-facing block name. Recomputing on every update adds overhead and can lead to inconsistencies if code changes impact the derived name unexpectedly.

## Proposed Solution

Treat `CodeBlockGraphicData.name` as the source of truth and stop recalculating source names from code during normal update flows. Only assign names at creation time or when code changes require a new name, for example when a module name changes.

## Implementation Plan

### Step 1: Inventory usages
- Find all usages of `getCodeBlockNameFromSource` in runtime code paths.
- Identify which ones are only needed at creation time.

### Step 2: Shift to creation-time assignment
- Ensure `name` is set when code blocks are created/imported.
- Remove or guard any `getCodeBlockNameFromSource(code)` calls during updates/rendering.
- Add a targeted update path that refreshes `name` when code changes require it.

### Step 3: Verify behavior
- Add/adjust tests to confirm IDs stay stable across edits.
- Ensure any functionality that depends on derived IDs still works.

## Success Criteria

- [x] No runtime code path recomputes code block names on each update
- [x] Names are assigned once during creation/import and remain stable
- [x] Names update when code changes make the derived name invalid
- [x] Tests cover name stability across edits

## Affected Components

- `packages/editor/packages/editor-state/src/features/code-blocks/features/graphicHelper/effect.ts` - currently recomputes `graphicData.id`
- `packages/editor/packages/editor-state/src/features/code-blocks/utils/getCodeBlockNameFromSource.ts` - usage reduction
- Any other code paths that call `getCodeBlockNameFromSource` outside creation

## Risks & Considerations

- **Risk 1**: Some existing behaviors may rely on names changing when code changes.
- **Risk 2**: Imported projects might contain legacy or duplicate names.
- **Dependencies**: None.
- **Breaking Changes**: Possible if external consumers assume names are derived from code.

## Related Items

- **Related**: `docs/todos/archived/197-editor-config-blocks.md`

## Notes

- Consider adding validation to ensure names are unique at creation/import time.

## Archive Instructions

When this TODO is completed:
1. Update the front matter to set `status: Completed` and provide the `completed` date
2. Move it to the `todo/archived/` folder to keep the main todo directory clean and organized
3. Update the `todo/_index.md` file to:
   - Move the TODO from the "Active TODOs" section to the "Completed TODOs" section
   - Add the completion date to the TODO entry (use `date +%Y-%m-%d` command if current date is not provided in the context)
