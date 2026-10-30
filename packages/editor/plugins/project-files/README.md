# Project Files Plugin

`@8f4e/editor-plugin-project-files` owns Open From Disk, Save, and Cmd/Ctrl+S. Project source export is supplied by
[`@8f4e/editor-plugin-project-export`](../project-export/README.md). Both receive the same per-editor
[`file session`](../../packages/editor-file-session/README.md):

```ts
const fileSession = createProjectFileSession();
const plugins = [
	fileSession.plugin,
	createProjectFilesPlugin({ inputTarget: canvas, fileSession, showOpenMenuItem: true }),
	createProjectExportPlugin({ document: canvas.ownerDocument, fileSession }),
];
```

Install the session plugin before project loaders and file plugins. The optional `showOpenMenuItem` setting hides
Open From Disk when false; it defaults to true. The `importProject` and `saveProject` actions belong to Open/Save.
Omitting the Export plugin removes only Export Project; omitting Open/Save removes Open and the Save shortcut.

Opening reads and parses the file before loading it and associating its handle. Save reuses that handle. Export acts
as Save As: the shared session makes its destination available to subsequent saves. Cancelled or failed imports retain
the current project and destination. A pending Open cannot load a project after disposal. Browsers without an Open
picker use a file input; uploaded files have no writable association. Errors are reported in the editor console.

Each file plugin serializes its own project. The session holds the destination and pending write state; the shared
browser writer handles permissions, destination selection, ordered writes, and download fallbacks. Core
retains generic project loading, serialization helpers, and undo/redo. Browser file handling stays outside core.

Validate with `npx nx run @8f4e/editor-plugin-project-files:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-project-files:test:screenshot`. These tests compose the file session and both plugins
and also exercise each feature independently.
