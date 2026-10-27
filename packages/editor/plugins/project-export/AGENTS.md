# Project Export Plugin

- Own project Save/Export actions, the Export Project main-menu contribution, and Cmd/Ctrl+S here.
- Export `createProjectExportPlugin({ inputTarget, saveProject, exportProject })` with inline dependency types.
- Receive the editor's input element and file-writing functions from the host. Browser file associations remain in
  the shared host service used by Open, Save, and Save As.
- Use public editor-state serialization and logging helpers. Keep generic serialization and session persistence in core.
- Invoke file callbacks synchronously from the user action so the host can start its file picker immediately.
- Return an explicit disposer for the DOM listener, action handlers, and menu contribution.
- Run `npx nx run @8f4e/editor-plugin-project-export:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-project-export:test:screenshot` for the real canvas shortcut and menu test.
