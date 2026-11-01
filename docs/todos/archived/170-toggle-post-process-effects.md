---
title: 'TODO: Toggle post-process effects via function key'
priority: Medium
effort: 1-2h
created: 2026-01-13
issue: https://github.com/8f4e/8f4e/issues/402
status: Cancelled
completed: 2026-09-07
---

# TODO: Toggle post-process effects via function key

## Problem Description

Post-process effects can take over the entire editor surface. If a fragment shader goes wrong, it can make the editor unreadable. We need a fast toggle to disable effects without relying on shader edits.

## Proposed Solution

Toggle post-process effects at runtime by updating a feature flag via `store.set`. Bind a function key in the host layer to call into the editor package, then have the editor package update the feature flag and trigger a re-apply of post-process effects. Editor-state should subscribe to the feature flag change.
- Keep key mapping outside editor-state (platform-specific).
- Update a feature flag in the editor package on toggle.
- When disabled, load `[]` as post-process effects.

## Implementation Plan

### Step 1: Add feature flag
- Introduce `featureFlags.postProcessEffects: boolean` with a default of `true`.

### Step 2: Toggle via store.set
- Add an editor-package helper that calls `store.set` to flip the feature flag.
- Subscribe to the feature flag change in editor-state.

### Step 3: Respect the toggle
- Gate `loadPostProcessEffects` so it loads `[]` when disabled and the derived effects when enabled.

### Step 4: Bind a function key in host
- Add a keydown handler (suggest `F9`) in the app layer to call the editor-package helper.

## Success Criteria

- [ ] Function key toggles post-process effects without requiring shader edits.
- [ ] Effects are cleared immediately when disabled.
- [ ] Re-enabling restores effects without reload.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/types.ts` - add feature flag
- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/state/createDefaultState.ts` - default flag
- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/state/featureFlags.ts` - default flag wiring
- `packages/editor/packages/editor-core/packages/editor-state/src/effects/shaders/shaderEffectsDeriver.ts` - subscribe to feature flag and respect toggle
- `packages/editor/packages/editor-core/src/index.ts` - toggle handling and load gating
- `src/editor.ts` - host key binding

## Risks & Considerations

- **UX**: Pick a function key that avoids browser-reserved shortcuts.
- **State**: Ensure toggle does not affect shader parsing or errors.
- **Parity**: Keep behavior consistent across platforms by exposing the event.

## Related Items

- **Related**: `docs/brainstorming_notes/022-post-process-effects-toggle-event.md`
- **Related**: `docs/todos/168-decouple-editor-keybindings.md`

## Notes

- Use an event-based toggle to keep editor-state decoupled from key mapping.
