# Project Export Plugin

`@8f4e/editor-plugin-project-export` adds project Save and Export to the editor. The host supplies its input element
and file-writing functions:

```ts
createProjectExportPlugin({
	inputTarget: canvas,
	saveProject: projectFiles.saveProject,
	exportProject: projectFiles.exportProject,
});
```

The plugin owns the **Export Project** main-menu item, the `saveProject` and `exportProject` actions, and the
Cmd/Ctrl+S shortcut on `inputTarget`. It serializes current source from the root project tree, including nested
groups and notes, and uses `export.fileName` or `project` for the `.8f4e` filename. Actions work in both editor modes.

The supplied functions are called during the action, before awaiting asynchronous work. The default editor shares
them with its project-import file service: Save reuses the current destination, while Export acts as Save As.
Serialization and filesystem failures are reported in the editor console. Disposal removes all plugin registrations.

Generic project serialization, filename configuration, undo/redo, and session autosaving remain in core.
WebAssembly export is provided separately by `@8f4e/editor-plugin-wasm-export`.

Validate with `npx nx run @8f4e/editor-plugin-project-export:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-project-export:test:screenshot`.
