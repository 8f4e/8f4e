# Texture Runtime

`@8f4e/editor-plugin-texture-runtime` displays framebuffers below `@texture` directives and can execute one project
entry per editor frame. The default and minimal editors load it when either a directive or `textureRuntime`
configuration appears anywhere in the project tree.

```text
; @config textureRuntime.enabled true
; @config textureRuntime.entry renderFrame

; @texture screen:color rgba 32 32 4
; @texture screen:mask 1bit 64 32 2
```

`@texture <framebuffer> <type> <width> <height> <magnification>` reserves space immediately below its source line and
widens the containing block when needed. Dimensions and magnification are positive integers. Framebuffers are plain
memory names: `pixels` in the containing module, `screen:pixels` in another module, or exposed memory in a group.
Memory is read directly from the declaration; no pointer operators or CPU pixel conversion are involved. The declaration
must contain enough bytes for the complete image. Valid directives reserve space even before compilation resolves memory.

| Type | Source layout |
| --- | --- |
| `1bit` | Black/white bits, MSB first; each row occupies `ceil(width / 8)` bytes and unused trailing bits are ignored |
| `mono` | One unsigned grayscale byte per pixel, 0 black through 255 white |
| `rgb` | Three unsigned bytes per pixel, red/green/blue; opaque |
| `rgba` | Four unsigned bytes per pixel, red/green/blue/alpha |

All formats use top-to-bottom rows and nearest sampling. Multiple directives can display different buffers, or view
the same buffer at different scales. One WebGL program and rectangle serve every view; a format uniform controls
interpretation, including GPU bit extraction. Views retain their own texture storage. Removed/offscreen views release
storage, and GPU memory release/restoration recreates uploads without recompiling the shared program.

Textures follow their block and the viewport in the existing canvas-wide overlay pass above sprites and wires. They
may cover overlapping blocks and other editor content; they do not participate in block occlusion.

`textureRuntime.enabled` defaults to false and controls only WASM execution. When enabled, `textureRuntime.entry`
(default `main`) runs exactly once per editor frame before uploading all visible views, including frames with no
visible textures. Textures still display shared memory with execution disabled, so audio/worker runtimes or static
initial values can supply their pixels. Execution never reinitializes memory defaults.

Custom hosts install `createTextureRuntimePlugin({ getCodeBuffer, getMemory })` using live compiler getters. Install it
after connectors for overlay ordering. Ready/pending instances survive presentation and entry edits; activation and
accepted compilation create instances. Disable, recompilation, and disposal invalidate stale pending instantiations.
