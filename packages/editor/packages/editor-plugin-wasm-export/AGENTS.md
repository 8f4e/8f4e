# WebAssembly Export Plugin

- Own the Export WebAssembly main-menu contribution and `exportWasm` action here.
- Export `createWasmExportPlugin({ exportBinaryCode })` with an inline dependency type.
- Receive file writing from the host. The default editor reads the current compiler buffer when the action runs.
- Use the shared export filename helper; source serialization and session persistence remain in core.
- Return an explicit disposer for the event handler and menu contribution.
- Run `npx nx run @8f4e/editor-plugin-wasm-export:build|test|typecheck` after changes.
