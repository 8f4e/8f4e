# Project Open Plugin

`@8f4e/editor-plugin-project-open` owns Open From Disk and the `importProject` action. Compose it with
[`project-save`](../project-save/README.md) and one per-editor [file session](../../packages/editor-file-session/README.md):

```ts
const fileSession = createProjectFileSession();
const plugins = [
	fileSession.plugin,
	createProjectOpenPlugin({ document: canvas.ownerDocument, fileSession }),
	createProjectSavePlugin({ inputTarget: canvas, fileSession }),
];
```

Install the session plugin before project loaders and the file plugins. The optional `showOpenMenuItem` setting
hides Open From Disk when false; it defaults to true. Open and Save can each be installed independently.

Opening reads and parses the selected file before loading the project and recording its handle. Cancellation and
failed imports retain the current project and destination. A pending Open cannot load a project after disposal.
Browsers without an Open picker use a file input; uploaded files have no writable association. Errors appear in
the editor console. The Save plugin reuses an opened handle for subsequent saves and owns all serialization and writing.

Validate with `npx nx run @8f4e/editor-plugin-project-open:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-project-open:test:screenshot`. The composed tests exercise both plugins and the
shared session, as well as independent installation of Open and Save.
