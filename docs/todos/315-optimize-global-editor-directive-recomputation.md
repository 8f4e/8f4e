---
title: 'TODO: Optimize global editor directive recomputation'
priority: Medium
effort: 3-6h
created: 2026-03-16
issue: https://github.com/8f4e/8f4e/issues/556
status: Open
completed: null
---

# TODO: Optimize global editor directive recomputation

## Problem Description

The global editor directives effect currently rescans every code block whenever:
- `graphicHelper.codeBlocks` changes
- `graphicHelper.selectedCodeBlock.code` changes
- `graphicHelper.selectedCodeBlockForProgrammaticEdit.code` changes

Current behavior:
- [packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/effect.ts](packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/effect.ts) always calls the global resolver over the full project
- [packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/registry.ts](packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/registry.ts) loops through every code block to rebuild the resolved state and error list

Why this is a problem:
- the selected-block subscriptions are frequent while editing
- most edits only affect one block
- full-project recomputation is unnecessary work if we can maintain per-block directive contributions incrementally

Important constraint:
- this is not as simple as "only inspect the changed block"
- global directives allow duplicate identical declarations and must still detect conflicts across the whole project
- editing or deleting one block can change which remaining declaration is authoritative

## Proposed Solution

Introduce incremental recomputation for global editor directives.

High-level approach:
- cache each block's global editor directive contributions separately
- on selected-block edits, recompute only the changed block's contribution
- merge cached per-block contributions into the project-global result without reparsing unrelated blocks

Possible implementation shape:
- store a lightweight per-block global-directive summary keyed by block id or creation index
- let each global directive plugin produce per-block contribution data
- derive the final resolved state and error list from cached block summaries

## Anti-Patterns

- Do not assume a selected-block edit can be resolved from that block alone.
- Do not special-case any one global directive in the effect; keep the optimization generic for future global editor directives.
- Do not duplicate parsing logic outside the global editor directive feature area.

## Implementation Plan

### Step 1: Define per-block contribution shape
- Add an internal representation for one block's global editor directive contribution
- Ensure it can represent declarations, duplicate-compatible values, and conflict candidates

### Step 2: Cache block-level contributions
- Recompute only the edited block when `selectedCodeBlock.code` or `selectedCodeBlockForProgrammaticEdit.code` changes
- Rebuild the full cache only when the code block collection itself changes structurally

### Step 3: Merge cached contributions into global state
- Resolve the final `globalEditorDirectives` object from cached block summaries
- Rebuild the global-directive-owned entries in `editorDirectiveErrors` from the merged result

### Step 4: Add focused tests
- Cover unchanged-project edits
- Cover edits that introduce or remove conflicts
- Cover edits that delete the previously authoritative declaration

## Validation Checkpoints

- `sed -n '1,200p' packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/effect.ts`
- `sed -n '1,240p' packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/registry.ts`
- `npx nx run @8f4e/editor-state:test`

## Success Criteria

- [ ] Selected-block code edits no longer require reparsing every code block for global editor directives.
- [ ] Structural project changes still produce correct global editor directive results.
- [ ] Conflict detection remains correct when declarations are added, changed, or removed.
- [ ] The optimization remains generic for future global editor directives.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/effect.ts` - currently triggers full recomputation on every relevant edit
- `packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/registry.ts` - currently resolves from a full code block scan
- `packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/` - likely home for block-level contribution caching helpers

## Risks & Considerations

- **Incorrect incremental merge**: conflict handling can become wrong if block-level contributions are underspecified.
- **Feature lock-in**: the optimization should not assume a fixed set of global editor directives.
- **Cache invalidation**: block identity and deletion/reordering behavior must be handled carefully.

## Notes

- The current implementation is correct but not incremental.
- This optimization should preserve the directive-owned plugin architecture introduced for global editor directives.
