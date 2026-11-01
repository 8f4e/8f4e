---
title: 'TODO: Lazy-load editing features on entering edit mode'
priority: Medium
effort: 2-4d
created: 2026-09-06
issue: https://github.com/8f4e/8f4e/issues/959
status: Open
completed: null
---

# TODO: Lazy-load Editing Features on Entering Edit Mode

## Problem Description

Editor-state initialization eagerly imports code editing, edit history, and block-manipulation effects. Runtime feature
flags can disable their behavior, but do not remove their download cost for editors initialized in view mode.

This is a larger structural opportunity for viewer use cases. The current product homepage and gallery initialize their
editors in edit mode, so they would still need these features immediately under their existing behavior.

## Proposed Solution

Separate features used exclusively for authoring from features needed to load, render, navigate, and run projects.
Load and register the authoring effects when entering edit mode, including initial edit-mode mounting. Keep interactions
that already work in view mode, such as project controls, available according to their existing semantics.

## Implementation Plan

1. Audit effects, keyboard handlers, and shared helpers to identify an actual authoring-only dependency boundary.
   Check history flags and programmatic edit paths individually instead of assuming all mutations require edit mode.
2. Add a cached module loader and per-editor registration lifecycle. Await readiness during initial edit-mode mounting
   and gate mode transitions so the first editing action cannot be lost while handlers are loading.
3. Preserve registration order, history behavior, feature flags, and cleanup. Repeated toggles must not duplicate
   listeners or reset history unexpectedly; handle mode reversal and disposal during loading.
4. Compare view-mode and edit-mode startup bytes and readiness, and validate both initial modes and transitions.

## Success Criteria

- [ ] View-mode startup excludes code proven to be exclusively required for authoring.
- [ ] Loading, compilation, rendering, navigation, and existing view-mode controls retain their behavior.
- [ ] Initial edit-mode mounting waits until editing handlers are ready.
- [ ] The first action after a mode transition is handled correctly, including under delayed loading.
- [ ] History, programmatic edits, and independent feature flags retain their existing contracts.
- [ ] Repeated toggles, concurrent editors, failed loading, and disposal do not leak or duplicate effects.
- [ ] Production measurements report both viewer savings and edit-mode startup/transition costs.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/index.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/editor-mode/`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-editing/`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/edit-history/`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/`
- `packages/editor/packages/editor-core/src/events/keyboardEvents.ts` and editor initialization

## Risks & Considerations

Some block-creation and mutation helpers are also used during project loading or through interactive controls. Moving
them wholesale would break viewers. Any asynchronous state-initialization API change must propagate to consumers and
testing helpers. Changing the product website's initial mode is a separate product decision, not part of this task.

## Validation Checkpoints

- Run `npx nx run-many --target=test --projects=@8f4e/editor-state,@8f4e/editor-core,@8f4e/editor-default` and corresponding typechecks.
- Run `npx nx run @8f4e/editor-website:build` and inspect view/edit dependency loading with representative mounts.
- Exercise text entry, clipboard actions, block operations, undo/redo, and project controls across mode transitions.
- Test deferred loading, load failure, rapid toggling, and disposal with focused lifecycle tests.

## Related Items

- [TODO 274: Remove unused editor-core feature-flag configuration](archived/274-consolidate-default-feature-flags-source.md).
- [TODO 484: Lazy-load context-menu builders](archived/484-lazy-load-context-menu-builders.md).
- [TODO 485: Lazy-load project export formatting](archived/485-lazy-load-project-export-formatting.md).

## References

- [Editor-state initialization](../../packages/editor/packages/editor-core/packages/editor-state/src/index.ts)

## Notes

Identified through source inspection on 2026-09-06. Prioritize only after measuring the authoring-only dependency set;
runtime-disabled code and code that is actually excluded from the initial bundle are different outcomes.

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update `docs/todos/_index.md`.
