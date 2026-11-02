# Screenshot Plugin

`@8f4e/editor-plugin-screenshot` adds **Take Screenshot** to the editor's main menu. It captures the current canvas
as PNG, omitting the mode overlay and offscreen block arrows, and saves it using the browser's file picker or a
download. The filename follows the project's export filename, defaulting to `project.png`.

The browser host supplies dependencies through the plugin factory:

```ts
import initEditor, { type Editor } from '@8f4e/editor-core';
import { createScreenshotPlugin } from '@8f4e/editor-plugin-screenshot';

let editor: Editor;
editor = await initEditor(canvas, {
	...options,
	plugins: [createScreenshotPlugin({ canvas, renderFrame: () => editor.renderFrame() })],
});
```

The factory binds the plugin to that canvas. Its render callback runs when the action is selected, after editor
initialization. The shared `EditorPluginContext` needs no browser resources or screenshot services.
`@8f4e/editor-default` creates this plugin for each mounted editor.

The plugin uses the canvas's document and window for browser operations. It begins the file picker in the menu
action before awaiting PNG encoding, renders a fresh frame, and restores the previous overlay flags after saving
or failure. It owns and unregisters its menu contribution and event listener.

Validate with `npx nx run @8f4e/editor-plugin-screenshot:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-screenshot:test:screenshot`.
