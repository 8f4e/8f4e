# WebAssembly Export Plugin

`@8f4e/editor-plugin-wasm-export` adds **Export WebAssembly** to the main menu and handles `exportWasm` actions.

```ts
createWasmExportPlugin({
	exportBinaryCode: fileName => saveWasm(fileName, compilerService.getCodeBuffer()),
});
```

The host callback receives the configured export filename with a `.wasm` extension, defaulting to `project.wasm`.
The default editor supplies a callback that reads the current compiled bytes and opens the browser save picker or
downloads the file. The plugin owns its menu contribution, action handler, and cleanup. It requires no input element
and does not serialize project source.

Validate with `npx nx run @8f4e/editor-plugin-wasm-export:build|test|typecheck`.
