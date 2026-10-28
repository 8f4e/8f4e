# Project Files Plugin

`@8f4e/editor-plugin-project-files` owns Open From Disk, Save, and Export Project, including browser file access and
Cmd/Ctrl+S. The host supplies the editor's input element:

```ts
createProjectFilesPlugin({ inputTarget: canvas, showOpenMenuItem: true });
```

The plugin uses the input element's document and window for file pickers, uploads, and downloads. The optional
`showOpenMenuItem` setting hides Open From Disk when false; it defaults to true. The `importProject`, `saveProject`,
and `exportProject` actions belong to this plugin. Save and Export serialize the entire root project, including nested
groups, and use the shared export filename configuration.

Save reuses the current file handle. Opening a file associates it with the current project after reading and parsing
succeed. Export acts as Save As and selects the destination for subsequent saves. Loading another project through
`loadProject`, including New Project, clears the association. Undo and redo restore snapshots within the current
project and retain it. Cancellation and failed imports retain the previous project and destination.

Pickers and permission requests start synchronously in the user gesture. Writes run in command order and overlapping
saves reuse a pending destination. Accepted writes finish with their captured source and destination even after a
project replacement or disposal; an old write cannot adopt its destination for the new project. A pending Open cannot
load a project after disposal. All handles, write queues, listeners, and menu contributions belong to one installation.

Browsers without picker APIs use file uploads for Open and downloads for Save/Export. Uploaded files have no writable
association. I/O and source serialization errors are reported in the editor console.

Core retains generic project loading, serialization, and undo/redo. Session persistence and WebAssembly export are
separate plugins. The default editor supplies browser resources without sharing file handles or file callbacks with core.

Validate with `npx nx run @8f4e/editor-plugin-project-files:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-project-files:test:screenshot`.
