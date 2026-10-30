# Project Export Plugin

`@8f4e/editor-plugin-project-export` contributes Export Project to the main menu and handles `exportProject`.
It requires a per-editor [file session](../../packages/editor-file-session/README.md):

```ts
const fileSession = createProjectFileSession();
const plugins = [fileSession.plugin, createProjectExportPlugin({ document: canvas.ownerDocument, fileSession })];
```

Install the session plugin before project loaders. Export serializes the whole root project as `.8f4e` source using
the configured export filename. A Save picker selects the destination; browsers without one download the source.
The minimal editor installs this composition for exporting edited examples.

Export works independently of Open/Save. When `createProjectFilesPlugin` receives the same session, Export acts as
Save As and later Cmd/Ctrl+S saves reuse its destination. The session holds the shared handle and pending write state and resets the
association on project replacement. This plugin owns its menu, action, serialization, filename selection, and logging;
the shared browser writer accepts the prepared Blob.

Run Nx `build` and `typecheck` for this package. The project-files composed tests and minimal-editor gallery browser
tests cover its menu, source export, shared destination, and cleanup.
