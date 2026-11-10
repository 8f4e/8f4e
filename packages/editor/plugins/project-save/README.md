# Project Save Plugin

`@8f4e/editor-plugin-project-save` owns Save, Export Project/Save As, and Cmd/Ctrl+S. It serializes the current root
project as `.8f4e` source, including nested groups, and writes it using the configured export filename.

```ts
const fileSession = createProjectFileSession();
const plugins = [fileSession.plugin, createProjectSavePlugin({ inputTarget: canvas, fileSession })];
```

Install the session plugin before project loaders. Share the same session with the Open plugin when installed together
so Save can reuse an opened file.

The `saveProject` action and keyboard shortcut reuse the current handle, requesting write permission when needed.
The first Save chooses a destination. `exportProject` always chooses a destination and adopts it for later saves.
Browsers without a Save picker download the source each time. Cancellation and failed writes retain the previous handle.
Serialization and I/O errors appear in the editor console.

Pickers and permission requests start synchronously in the user gesture. Writes run in command order, and overlapping
saves reuse a pending destination. Accepted writes retain their captured source and destination after project replacement
or disposal, but cannot associate an old destination with a replacement project. The session clears the handle on
`loadProject` and disposal; the Save plugin resets its pending destination and generation. Undo/redo retain the handle.

Source formatting, browser save/download helpers, and write coordination are private to this plugin. The shared
file session contains only the handle and reset lifecycle. Open handles file reading and parsing independently.

Validate with `npx nx run @8f4e/editor-plugin-project-save:build|test|typecheck`. Tests here cover source formatting,
saving/export, permissions, queued writes, and shortcuts without Open. The default editor owns composed file tests;
its `test:screenshot` target and the gallery editor's browser suite cover the browser workflows.
