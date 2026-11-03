# WebAssembly Export Plugin

`@8f4e/editor-plugin-wasm-export` owns Export WebAssembly, WASM Blob creation, and browser file writing.

```ts
createWasmExportPlugin({ document: canvas.ownerDocument, getCodeBuffer: compiler.getCodeBuffer });
```

The factory receives browser resources and a getter for the current compiled bytes. Each `exportWasm` action snapshots
those bytes and uses the shared export filename configuration, defaulting to `project.wasm`. The picker opens during
the user gesture. Browsers without it download the Blob through an object URL. Picker cancellation cancels the action;
write failures abort the writable stream and are reported in the editor console.

The plugin owns its menu contribution, action handler, and cleanup. It does not serialize source or share project file
associations. Its browser dependencies are supplied through the factory; the shared plugin contract is unchanged.

Validate with `npx nx run @8f4e/editor-plugin-wasm-export:build|test|typecheck`.
