# Dialogs plugin

`@8f4e/editor-plugin-dialogs` presents the editor's dialog stack. It owns sizing, positioning, text wrapping,
button layout and hit testing, and canvas drawing. Both default and minimal compositions load it after the first render.
Custom editor compositions can install its exported `dialogsPlugin` through the ordinary `plugins` array.

## Opening and closing dialogs

Dialog content and lifecycle belong to the editor. Other plugins use the existing event dispatcher:

```ts
events.dispatch('addDialog', {
	id: 'my-plugin-confirmation',
	title: 'Continue?',
	text: 'Apply these changes?',
	buttons: [{ title: 'Cancel' }, { title: 'Apply', action: 'myPluginApply', payload: { value: 42 } }],
});
events.dispatch('removeDialog', { id: 'my-plugin-confirmation' });
```

Adding an existing ID replaces it and brings it to the top. Removing the top dialog restores the previous one.
`clearDialogs` empties the stack. Buttons close their dialog before dispatching their action unless `close: false`.
The editor keeps this behavior available without the presentation plugin and blocks underlying pointer interactions
while a dialog is open. A dialog opened before plugin installation is presented when installation completes.

## Presentation boundary

`state.dialogStack` contains original `DialogContent` values; `state.dialog` contains the original top dialog's
content, or empty content when the stack is empty. Neither contains calculated geometry or clipped labels.
The plugin caches presentation data per editor and refreshes it when the stack, viewport size, or font grid changes.
Wrapped button rows have a one-cell vertical gap, which contributes to the dialog height.

The editor forwards completed modal presses through `dialogPointerDown`. The plugin finds a button using its
cached geometry and dispatches `activateDialogButton` with `{ id, buttonIndex }`. The editor
validates that this identifies the visible dialog and handles closing and action dispatch. Capture-only touch
probes never activate buttons.

The plugin draws its backdrop and content through the renderer's `registerModalOverlay` hook. This sprite stage
runs after ordinary canvas overlays even when `featureFlags.canvasOverlays` is false. Layout and input listeners
are removed on plugin disposal; dialog content remains editor-owned.

## Validation

- `npx nx run @8f4e/editor-plugin-dialogs:build`
- `npx nx run @8f4e/editor-plugin-dialogs:test`
- `npx nx run @8f4e/editor-plugin-dialogs:typecheck`
- `npx nx run @8f4e/editor-plugin-dialogs:test:screenshot`
