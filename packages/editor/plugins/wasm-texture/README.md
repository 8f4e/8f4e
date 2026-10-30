# WASM Texture Plugin

`@8f4e/editor-plugin-wasm-texture` draws a project's RGBA8 framebuffer over the editor. The default and minimal
compositions load it when they find `wasmTexture` configuration anywhere in the project tree.

```text
; @config wasmTexture.entry main
; @config wasmTexture.target screen:rgba
; @config wasmTexture.width 64
; @config wasmTexture.height 32
; @config wasmTexture.magnification 4
; @config wasmTexture.position center
```

The entry defaults to `main`, magnification to `1`, and position to `center`. The target and both source dimensions
must be present before a render layer is created. Position may be `left`, `center`, or `right`; these center the
image in the left half, full canvas, or right half. Pixels use top-to-bottom RGBA order, nearest sampling, and their
own alpha. The entry executes every frame against the compiler's shared memory without reinitializing defaults.

Custom hosts install `createWasmTexturePlugin({ getCodeBuffer, getMemory })` with live compiler getters. Install it
after connectors to draw above wires. Core and web-ui do not install this feature. Configuration updates and
compilation prepare the WASM instance; frames run the entry, upload its buffer, and draw it. Recompilation replaces
the instance, and disposal invalidates pending instantiation and releases all registrations and GPU resources.
