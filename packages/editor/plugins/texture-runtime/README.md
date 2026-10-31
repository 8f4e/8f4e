# Texture Runtime

`@8f4e/editor-plugin-texture-runtime` displays framebuffers below `@texture` directives and can execute one project
entry per editor frame. The default and minimal editors load it when either a directive or `textureRuntime`
configuration appears anywhere in the project tree.

```text
; @config textureRuntime.enabled true
; @config textureRuntime.entry renderFrame

; @textureUpload &screen:color rgba 64 64
; @texture &screen:color 4
; @texture &screen:color 4 0 0 32 32
```

`@textureUpload <address> <1bit|mono|rgb|rgba> <width> <height>` describes the complete source texture.
`@texture <address> <magnification> [<x> <y> <width> <height>]` displays it below the directive, either in full or
as a crop in source-pixel coordinates. Upload declarations reserve no image space; each view reserves its own rows
and minimum block width. Crops retain the uploaded texture's row stride, including byte-aligned packed 1bit rows.

Both directives accept pointer sources: `&pixels` or `&screen:pixels` uses the storage's byte address; a plain typed
pointer such as `framebufferPointer` reads the current address from memory. Qualified names and group exposures use
the containing block's scope. Addresses are resolved after entry execution each frame, so pointer swaps affect the
same frame. Uploads are discovered throughout the project, including unopened groups.

Matching resolved byte addresses share one GPU texture and one upload per frame when at least one view is visible,
regardless of the reference spelling, crop, magnification, or number of views. Identical upload declarations coalesce.
Conflicting format/dimension declarations for one address suppress that resource and report an error in the editor
console. The complete upload must fit current WASM memory; crop rectangles must fit the declared source dimensions.
Dimensions and magnification are positive integers; crop offsets are nonnegative integers. Cropped views reserve their
explicit size while unresolved, and whole views can use a matching declaration before compilation resolves its address.

| Type | Source layout |
| --- | --- |
| `1bit` | Black/white bits, MSB first; each row occupies `ceil(width / 8)` bytes and unused trailing bits are ignored |
| `mono` | One unsigned grayscale byte per pixel, 0 black through 255 white |
| `rgb` | Three unsigned bytes per pixel, red/green/blue; opaque |
| `rgba` | Four unsigned bytes per pixel, red/green/blue/alpha |

All formats use top-to-bottom rows and nearest sampling. Multiple directives can display different buffers, or view
the same buffer at different scales. One WebGL program and rectangle serve every view; a format uniform controls
interpretation, including GPU bit extraction. Views share storage by resolved upload address. Uploads with no visible views release
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
