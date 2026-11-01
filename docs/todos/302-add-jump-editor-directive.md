---
title: 'TODO: Add jump editor directive for code block navigation'
priority: Medium
effort: 4-8h
created: 2026-03-14
issue: https://github.com/8f4e/8f4e/issues/400
status: Open
completed: null
---

# TODO: Add jump editor directive for code block navigation

## Problem Description

The editor currently supports code block navigation through the context-menu jump flow, but there is no in-code directive for linking one code block to another.

That makes it awkward to build navigable projects where one block acts as an entry point, hub, or table of contents for other blocks. Users can leave comments that mention another code block id, but those comments are not interactive and do not move the viewport.

## Proposed Solution

Add a new editor-only directive:

```txt
; @jump foo
```

The directive should take exactly one argument: the target code block id. Clicking the directive row should select the matching code block and center the viewport on it, using the same viewport movement behavior as existing jump navigation.

Key requirements:

- Treat `@jump` as editor metadata only, not as a compiler instruction.
- Resolve the directive argument directly against code block `id`.
- Do not depend on `@favorite` or any other directive.
- If no matching code block exists, treat activation as a no-op.
- Keep the behavior local to the editor interaction/rendering pipeline.

## Anti-Patterns

- Do not route `@jump` lookup through `@favorite`.
- Do not introduce a second code-block navigation implementation if the existing jump path can be reused.
- Do not make plain comment text clickable unless it is a valid `@jump` directive.
- Do not auto-jump on load or hover; the jump should happen only on explicit click.

## Implementation Plan

### Step 1: Add directive-owned jump parsing
- Create a `jump` directive feature under the central editor directive system.
- Parse `; @jump <code-block-id>` and reject missing-argument forms.
- Represent the directive as clickable row-level widget metadata tied to the directive line.

### Step 2: Reuse existing code block navigation
- Connect jump activation to the current code-block jump/viewport-centering path.
- Resolve by target `id` only.
- Preserve current behavior when the target block cannot be found.

### Step 3: Add interaction tests and docs
- Add parser, hit-testing, and click-to-jump tests in editor-state.
- Verify that the selected block and viewport update correctly after clicking a valid jump directive.
- Document `@jump` in the editor directives docs with at least one example.

## Validation Checkpoints

- `npx nx run editor:test`
- `npx nx run editor:typecheck`
- `rg -n "@jump|jumpToFavoriteCodeBlock|jumpToCodeBlock" packages/editor/docs packages/editor/packages/editor-core/packages/editor-state/src`

## Success Criteria

- [ ] `; @jump foo` is recognized as an editor directive.
- [ ] Clicking a valid `@jump` directive selects the target code block with id `foo`.
- [ ] The viewport centers on the target block after the jump.
- [ ] Missing targets fail safely without throwing or breaking interaction.
- [ ] The compiler continues to ignore the directive.
- [ ] The directive is documented in the editor directives docs.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/directives/` - jump directive parsing, widget registration, and interaction
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/codeBlockNavigation/` - reused jump navigation path
- `packages/editor/docs/editor-directives.md` - directive documentation

## Risks & Considerations

- **Naming drift**: the current navigation event naming is favorite-specific, which may become misleading if reused for generic block jumps.
- **Hit-testing overlap**: click handling for `@jump` should not interfere with dragging, cursor placement, or other directive widgets.
- **Duplicate ids**: if duplicate code block ids are possible, the resolution rule should be explicit and tested.
- **Collapsed blocks**: jump activation should still target the correct block regardless of hide/collapse display transformations.

## Related Items

- **Related**: `docs/todos/299-move-favorite-directive-under-central-directive-system.md`
- **Related**: `docs/todos/300-extract-directive-editing-into-shared-feature.md`
- **Related**: `docs/todos/297-add-url-editor-directive.md`

## Notes

- This TODO reflects the narrowed design: `@jump` resolves directly to a code block id and does not depend on `@favorite`.
- If the existing favorite-specific event naming is reused internally, a follow-up cleanup may still be worthwhile to make the navigation API generic.
