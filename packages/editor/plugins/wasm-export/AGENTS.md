# WebAssembly Export Plugin

- Own Export WebAssembly, the exportWasm action, WASM Blob creation, pickers, downloads, and file writes here.
- Export `createWasmExportPlugin({ document, getCodeBuffer })` with inline factory dependencies. Read current compiler
  bytes when the action runs and snapshot them before awaiting the picker. Keep browser resources out of plugin context.
- Start the picker in the user gesture; release object URLs and abort failed writable streams. Cancellation is expected.
- Use public export filename and editor logging helpers. Project source files and session persistence have separate plugins.
- Return an explicit disposer for the event handler and menu contribution.
- Run `npx nx run @8f4e/editor-plugin-wasm-export:build|test|typecheck` after changes.
