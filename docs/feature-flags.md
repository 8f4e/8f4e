# Editor Feature Flags

Hosts configure editor capabilities through the `featureFlags` mounting option. The active editor mode is separate:
source editing is allowed when `state.editorMode === 'edit'`. Projects choose their initial mode with `; @mode edit`
or `; @mode view`; projects without a valid, unique declaration start in view mode.

There is no `editing` feature flag. Changing modes or loading another project preserves every feature flag,
including `codeLineSelection`.

## Available Flags

All flags default to `true` in the core and default editor:

- `contextMenu` — Show right-click context menus.
- `moduleDragging` — Allow repositioning blocks while in edit mode.
- `codeLineSelection` — Allow selecting source lines and moving the caret, independently of editor mode.
- `viewportDragging` — Allow panning the viewport.
- `modeToggling` — Enable user controls for switching between edit and view modes.
- `modeOverlay` — Show the mode hint at the top of the viewport.
- `historyTracking` — Track source changes for undo and redo.
- `offscreenBlockArrows` — Show arrows pointing toward blocks outside the viewport.
- `projectCreation` — Show the New Project action while in edit mode.

The minimal editor disables `projectCreation` by default. Its other flags use the core defaults.

## Configure a Host

```typescript
import { mountDefaultEditor } from '@8f4e/editor-default';

const editor = await mountDefaultEditor(canvas, {
  initialProjectUrl: '/projects/demo.8f4e',
  featureFlags: {
    moduleDragging: false,
    codeLineSelection: false,
  },
});
```

The project can still declare `; @mode edit` in one of its blocks. That enables source-editing commands without
reenabling dragging or line selection. The editor applies the declaration only when loading the project; later
source edits and undo/redo preserve the active mode.

## Disable User Mode Switching

Declare the desired starting mode in the project:

```text
note editor
; @mode view
noteEnd
```

Then disable the host's mode-switching controls:

```typescript
const editor = await mountDefaultEditor(canvas, {
  initialProjectUrl: '/projects/presentation.8f4e',
  featureFlags: {
    modeToggling: false,
    contextMenu: false,
    moduleDragging: false,
    codeLineSelection: false,
  },
});
```

`modeToggling` controls user switching controls; it does not override the project's declared mode or prevent trusted
plugins from changing the mode programmatically. Leave `viewportDragging` enabled when readers should be able to pan.

## Runtime State and Types

Feature flags remain available in `state.featureFlags`. Trusted plugins can update them through their state manager.
For example, the screenshot plugin temporarily disables `modeOverlay` and `offscreenBlockArrows` while capturing a
frame, then restores their previous values. Mode changes do not overwrite those preferences.

Use `FeatureFlagsConfig` for a typed partial configuration:

```typescript
import type { FeatureFlagsConfig } from '@8f4e/editor-core';

const featureFlags: FeatureFlagsConfig = {
  contextMenu: false,
  codeLineSelection: false,
};
```
