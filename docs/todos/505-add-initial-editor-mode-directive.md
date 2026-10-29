---
title: 'TODO: Add an initial editor mode directive'
priority: Medium
effort: 4-8h
created: 2026-10-21
issue: null
status: Open
completed: null
---

# TODO: Add an initial editor mode directive

## Problem Description

The editor supports `edit` and `view` modes, but a project cannot declare which mode should be active when it is
opened. Hosts can pass `initialEditorMode` while mounting an editor, and otherwise editor-state derives a default from
the editing feature flag. That makes the starting mode a property of the embedding application rather than the loaded
project.

Projects intended for presentation or interaction may need to open in view mode, while authoring-focused projects may
need to open ready for editing. Without project metadata, every host must know and supply that choice separately.

## Proposed Solution

Add a project-global editor directive that accepts exactly one of the two editor modes:

```txt
; @mode edit
; @mode view
```

Resolve the directive while loading a project and apply it before the loaded project becomes interactive or is first
rendered. The directive sets only the mode for that project-load boundary; it must not continuously force the editor
back to the declared mode after a user changes modes.

Define precedence explicitly:

1. If the host disables mode toggling, its configured or default initial mode remains authoritative.
2. Otherwise, a valid project `@mode` directive selects the starting mode.
3. Without a valid directive, retain the host's `initialEditorMode` or the current feature-flag-derived default.

When host configuration disables mode toggling, loading project source must not weaken the host's restriction. Applying
the resolved mode should use the existing editor-mode transition path so `state.editorMode`, editing capabilities, and
line selection remain synchronized.

## Anti-Patterns

- Do not subscribe to `@mode` as a continuously enforced value; entering edit or view mode later must still work.
- Do not let project source override a host-enforced view-only or edit-only embedding policy.
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

- Preserve the host's initial mode and mode-toggling policy until project directives can be resolved.
- Resolve host policy, the project directive, and the current fallback in the documented precedence order.
- Apply the result once for each newly loaded or replaced project before project readiness and first rendering.

### Step 3: Reuse the editor-mode transition contract

- Route initial mode application through shared mode-transition logic so `editorMode`, `featureFlags.editing`, and
  `featureFlags.codeLineSelection` stay consistent.
- Ensure loading a project while another project is open can select a new initial mode without carrying over stale
  state from the previous project.
- Keep later keyboard or programmatic mode changes independent from the directive value.

### Step 4: Add tests and documentation

- Cover valid edit/view values, missing and invalid directives, duplicate declarations, explicit host overrides, and
  mode-toggling restrictions.
- Test initial mounting and subsequent project replacement without a one-frame mode mismatch or lost first input.
- Document `@mode`, its load-only behavior, and its precedence relative to `initialEditorMode` and `modeToggling`.

## Validation Checkpoints

- Run editor-state, editor-core, and editor-default tests and typechecks through Nx.
- Verify that a project with `; @mode edit` becomes interactive in edit mode on its first ready frame.
- Verify that user mode changes persist after load and are not reset by unrelated state or source changes.
- Verify that an embedding host can still enforce its configured mode when mode toggling is disabled.

## Success Criteria

- [ ] `; @mode edit` and `; @mode view` are recognized as project-global editor directives.
- [ ] A valid directive selects the mode applied at the project-load boundary.
- [ ] A valid project directive takes precedence over the host's initial-mode fallback when mode toggling is enabled.
- [ ] A host mode-locking policy takes precedence over project source.
- [ ] Missing or invalid directives preserve the existing fallback behavior and produce appropriate diagnostics.
- [ ] Initial application keeps editor mode and editing-related feature flags synchronized.
- [ ] Later user or programmatic mode changes are not overwritten by the directive.
- [ ] Loading another project resolves its starting mode independently.
- [ ] The directive is documented in the editor directives documentation.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/global-editor-directives/` - `@mode`
  registration, parsing, and diagnostics.
- `packages/editor/packages/editor-core/packages/editor-state/src/features/editor-mode/` - shared mode application and
  state synchronization.
- `packages/editor/packages/editor-core/packages/editor-state/src/features/project-loading/` - one-time resolution at
  the project-load boundary.
- `packages/editor/packages/editor-core/packages/editor-state-types/` - host-option and resolved-policy typing if the
  explicit-option distinction must be retained in state.
- `packages/editor/packages/editor-core/docs/editor-directives.md` - directive syntax, behavior, and precedence.
- `packages/editor/packages/editor-default/README.md` - relationship to the host-level `initialEditorMode` option.

## Risks & Considerations

- **Load timing**: directives are available only after project source is parsed, while editor state is initialized
  earlier. The load lifecycle needs an explicit point where the mode can be resolved before first interaction/render.
- **Embedding safety**: project-controlled edit mode must not bypass a host's view-only policy.
- **Reactive directive infrastructure**: global directives currently recompute when source changes, but `@mode` is
  intentionally load-scoped and must not inherit continuous configuration semantics accidentally.
- **Project replacement**: opening a second project must not reuse the first project's directive or the user's last
  mode unless that is the documented fallback.
- **Invalid duplicates**: deterministic diagnostics are preferable to silently selecting a mode based on block order.

## Related Items

- [TODO 486: Lazy-load editing features on entering edit mode](486-lazy-load-editing-features-on-edit-mode.md)
- [Editor directives](../../packages/editor/packages/editor-core/docs/editor-directives.md)
- [Default editor mounting options](../../packages/editor/packages/editor-default/README.md)

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update
`docs/todos/_index.md`.
