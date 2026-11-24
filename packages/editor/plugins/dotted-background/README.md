# Dotted background

`dottedBackgroundPlugin` draws the editor's base canvas color and world-anchored alternating dots using a
procedural WebGL shader. It registers a `beforeSprites` render layer, leaving all sprite drawing and later GPU passes
to the renderer and other plugins.

The plugin owns the shaders, font-specific dot positions, and GPU resources. The shared render layer API provides the
installed font and grid, resolved palette, and presented viewport. Panning and camera transitions move the pattern
with the visible scene. Font and palette changes update the layer without reloading the shader or generating atlas
pixels. No reloadable buffers are allocated, so the layer remains valid during rendering-memory suspension.

Install this plugin eagerly in compositions that should use the dotted background. Compositions can omit it or
register other background layers instead. Disposal unregisters the layer and releases its program and vertex array.

Run Nx `build`, `test`, `typecheck`, and `test:screenshot` targets to validate the plugin.
