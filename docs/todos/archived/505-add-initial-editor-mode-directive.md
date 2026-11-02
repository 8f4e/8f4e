---
title: 'TODO: Add an initial editor mode directive'
priority: Medium
effort: 4-8h
created: 2026-10-21
issue: null
status: Completed
completed: 2026-10-29
---

# TODO: Add an initial editor mode directive

## Problem Description

The editor previously supported `edit` and `view` modes without letting a project declare its starting mode.
The host-level `initialEditorMode` option made that choice a property of the embedding application. This change
replaces that unreleased API with project metadata and retains no compatibility fallback.

## Proposed Solution

Add a project-global editor directive that accepts exactly one of the two editor modes:

```txt
; @mode edit
; @mode view
```

Resolve the directive while loading a project and apply it before the loaded project becomes interactive or is first
rendered. The directive sets only the mode for that project-load boundary; it must not continuously force the editor
back to the declared mode after a user changes modes.

Remove `initialEditorMode` from editor-state, editor-core, and both editor compositions. A valid, unique directive
selects the starting mode; otherwise use view mode. Do not derive a loaded project's mode from the editing feature
flag or retain the previous project's active mode. Invalid arguments and duplicate declarations produce diagnostics.

The host's `modeToggling` flag controls user switching controls; it does not override the project's initial mode.
Apply the resolved mode through the existing mode-transition path so the active mode determines editing permission. Keep line-selection policy independent
of mode changes.

## Anti-Patterns

- Do not subscribe to `@mode` as a continuously enforced value; entering edit or view mode later must still work.
- Do not retain the removed host option or add a feature-flag compatibility fallback.
- Do not maintain a second mode-transition implementation that can drift from the existing editor-mode effect.
- Do not apply the directive late enough to briefly render or accept input in the wrong mode.
- Do not treat a mode transition as a project-content edit, autosave trigger, or undo-history entry.

## Implementation Plan

### Step 1: Add and validate the global directive

- Register `@mode` in the global editor-directive system.
- Accept exactly one argument, `edit` or `view`, and report invalid or conflicting project-global declarations through
  the existing editor-directive diagnostics path.
- Keep the directive as editor metadata that the compiler ignores.

### Step 2: Resolve the starting mode during project loading

- Remove the host initial-mode option from every public composition and internal option type.
- Resolve the unique valid project declaration, or use view mode when none is valid.
- Apply the result once for each newly loaded or replaced project before project readiness and first rendering.

### Step 3: Reuse the editor-mode transition contract

- Use `editorMode` as the only source of editing permission; remove the redundant editing feature flag.
- Preserve `featureFlags.codeLineSelection` across mode changes and project replacement.
- Ensure loading a project while another project is open can select a new initial mode without carrying over stale
  state from the previous project.
- Keep later keyboard or programmatic mode changes independent from the directive value.

### Step 4: Add tests and documentation

- Cover valid edit/view values, missing and invalid directives, duplicate declarations, project replacement, and
  directive application when mode-toggling controls are disabled.
- Test initial mounting and subsequent project replacement without a one-frame mode mismatch or lost first input.
- Document `@mode`, its load-only behavior, the view default, and its relationship to `modeToggling`.

## Validation Checkpoints

- Run editor-state, editor-core, and editor-default tests and typechecks through Nx.
- Verify that a project with `; @mode edit` becomes interactive in edit mode on its first ready frame.
- Verify that user mode changes persist after load and are not reset by unrelated state or source changes.
- Verify that disabling mode-toggling controls does not prevent applying the project directive.

## Success Criteria

- [x] `; @mode edit` and `; @mode view` are recognized as project-global editor directives.
- [x] A valid directive selects the mode applied at the project-load boundary.
- [x] The host initial-mode option is removed without compatibility fallbacks.
- [x] The directive still selects the initial mode when mode-toggling controls are disabled.
- [x] Missing, invalid, or duplicate directives select view mode with appropriate diagnostics.
- [x] Editor mode is the only source of editing permission; feature flags remain independent.
- [x] Later user or programmatic mode changes are not overwritten by the directive.
- [x] Loading another project resolves its starting mode independently.
- [x] The directive is documented in the editor directives documentation.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/` - `@mode`
  registration, parsing, and diagnostics.
- `packages/editor/packages/editor-core/packages/editor-state/src/features/editor-mode/` - user mode transitions that
  preserve capability flags.
- `packages/editor/packages/editor-core/packages/editor-state/src/features/project-changes/` - one-time mode application
  after directive derivation and before publishing a project replacement.
- `packages/editor/packages/editor-core/packages/editor-state-types/` - removal of the initial-mode option and typing
  of the resolved directive.
- `packages/editor/packages/editor-core/docs/editor-directives.md` - directive syntax, behavior, and precedence.
- `packages/editor/packages/editor-default/README.md` - source-owned initial mode and removal of the host option.

## Risks & Considerations

- **Load timing**: directives are available only after project source is parsed, while editor state is initialized
  earlier. The load lifecycle needs an explicit point where the mode can be resolved before first interaction/render.
- **Mode controls**: `modeToggling` controls user switching, independently of source-owned initial mode.
- **Reactive directive infrastructure**: global directives currently recompute when source changes, but `@mode` is
  intentionally load-scoped and must not inherit continuous configuration semantics accidentally.
- **Project replacement**: opening a second project must not reuse the first project's directive or the user's last
  mode.
- **Invalid duplicates**: deterministic diagnostics are preferable to silently selecting a mode based on block order.

## Related Items

- [TODO 486: Lazy-load editing features on entering edit mode](../486-lazy-load-editing-features-on-edit-mode.md)
- [Editor directives](../../../packages/editor/packages/editor-core/docs/editor-directives.md)
- [Default editor mounting options](../../../packages/editor/packages/editor-default/README.md)

## Completion Notes

Completed on 2026-10-29:

- Registered and validated project-global `@mode edit` and `@mode view`, including duplicate diagnostics.
- Removed `initialEditorMode` from the core, default, and minimal editor options without compatibility fallbacks.
- Applied the resolved mode at project replacement; later source edits and history restoration preserve the user's
  active mode. Removed redundant editing state and preserved line-selection preferences.
- Updated composition documentation, test setup, browser fixtures, and verified screenshot references.
- Passed Nx builds, unit tests, and typechecks across editor compositions and plugins, website and WebMCP browser
  integrations, plugin screenshot checks, and Biome checks on changed TypeScript files.
