# Texture Runtime

`@8f4e/editor-plugin-texture-runtime` executes a project entry once per editor frame and draws its RGBA8 framebuffer
over the editor. The default and minimal compositions load it when they find `textureRuntime` configuration anywhere in the project tree.

```text
; @config textureRuntime.enabled true
; @config textureRuntime.entry main
; @config textureRuntime.target screen:rgba
; @config textureRuntime.width 64
; @config textureRuntime.height 32
; @config textureRuntime.magnification 4
; @config textureRuntime.position center
```

Execution is disabled by default; set `textureRuntime.enabled true` to activate it. The entry defaults to `main`,
magnification to `1`, and position to `center`. The target and both source dimensions must be present and the runtime
enabled before a render layer is created. Position may be `left`, `center`, or `right`; these center the image in the
left half, full canvas, or right half. Pixels use top-to-bottom RGBA order, nearest sampling, and their
own alpha. The entry executes every frame against the compiler's shared memory without reinitializing defaults.

Custom hosts install `createTextureRuntimePlugin({ getCodeBuffer, getMemory })` with live compiler getters. Install it
after connectors to draw above wires. Core and web-ui do not install this feature. Configuration updates reuse the
current or pending WASM instance and refresh the entry, framebuffer, and placement. Activation and accepted compilation
create instances; frames run the entry, upload its buffer, and draw it. Configuration removal and disposal invalidate
pending instantiation and release resources.

The runtime uses the editor’s frame clock. It can run alongside audio, worker, and test runtimes against the same
compiler memory; each runtime has its own enabled lifecycle.
