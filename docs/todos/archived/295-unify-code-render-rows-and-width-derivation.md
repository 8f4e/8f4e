---
title: 'TODO: Unify code render rows and width derivation'
priority: Low
effort: 2-4h
created: 2026-03-09
issue: https://github.com/8f4e/8f4e/issues/554
status: Cancelled
completed: 2026-09-07
---

# TODO: Unify code render rows and width derivation

## Problem Description

The editor currently derives rendered code rows and code-block width through separate code paths:

- `codeToRender` is built in `graphicHelper/effect.ts`
- width is computed separately in `getCodeBlockGridWidth.ts`

After adding tab-stop support, both paths use the same tab-layout rules, but they still duplicate render-shape logic. That creates a maintenance risk: future formatting features could update one path and accidentally leave the other inconsistent.

## Proposed Solution

Extract a shared helper that derives rendered code rows from raw code once, including:
- line-number prefix cells
- tab-expanded visual cells
- any future render-only layout transforms

Then use that shared derived output for both:
- `graphicData.codeToRender`
- code-block width calculation

The goal is for width to be computed from the exact same rendered row model that is later drawn on screen.

## Anti-Patterns

- Do not keep duplicating parallel width/render logic when adding future layout features.
- Do not move width calculation into the renderer; keep it in editor-state derivation.
- Do not change persisted source text as part of this refactor.

## Implementation Plan

### Step 1: Extract shared rendered-row builder
- Create a helper that accepts raw code and returns render rows with line-number prefixes and tab expansion applied.
- Keep the helper pure and independent from sprite/color lookups.

### Step 2: Reuse it in graphic derivation
- Replace the inline `codeToRender` construction in `graphicHelper/effect.ts` with the shared helper.

### Step 3: Reuse it in width calculation
- Update `getCodeBlockGridWidth.ts` to compute longest row width from the shared rendered-row output instead of recomputing visual widths separately.

### Step 4: Verify unchanged behavior
- Keep existing width and rendering behavior identical for blocks without tabs.
- Preserve current tab-stop behavior introduced in TODO 294.

## Validation Checkpoints

- `npx nx run @8f4e/editor-state:test`
- `npx nx run @8f4e/editor-state:typecheck`
- `rg -n "codeToRender|getCodeBlockGridWidth|tabLayout" packages/editor/packages/editor-core/packages/editor-state/src`

## Success Criteria

- [ ] Render-row derivation lives in one shared helper.
- [ ] `codeToRender` uses the shared derived rows.
- [ ] Width calculation uses the same derived row model.
- [ ] Existing tests still pass without behavioral regression.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/graphicHelper/effect.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/graphicHelper/getCodeBlockGridWidth.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-editing/tabLayout.ts`

## Risks & Considerations

- **Scope creep**: This should stay a small consolidation refactor, not a renderer redesign.
- **Behavior drift**: The shared helper must preserve current line-number prefix sizing and tab-expansion semantics exactly.

## Related Items

- **Depends on**: `docs/todos/294-add-editor-tab-stop-directive.md`
- **Related**: `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/graphicHelper/effect.ts`
- **Related**: `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/graphicHelper/getCodeBlockGridWidth.ts`

## Notes

- Created immediately after implementing tab-stop support to capture the follow-up refactor opportunity while context is fresh.

## Archive Instructions

When this TODO is completed:
1. Update the front matter to set `status: Completed` and provide the `completed` date
2. Move it to the `todo/archived/` folder to keep the main todo directory clean and organized
3. Update the `todo/_index.md` file to:
   - Move the TODO from the "Active TODOs" section to the "Completed TODOs" section
   - Add the completion date to the TODO entry (use `date +%Y-%m-%d` command if current date is not provided in the context)
