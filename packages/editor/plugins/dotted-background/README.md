# Dotted background

`dottedBackgroundPlugin` draws the editor's base canvas color and world-anchored alternating dots using a
procedural WebGL shader. It registers a `beforeSprites` render layer, leaving all sprite drawing and later GPU passes
to the renderer and other plugins.

The plugin owns the shaders, dot geometry, and GPU resources. The shared render layer API provides the resolved
palette and presented viewport. Each cell receives a pixel-aligned, centered square dot, sized at one quarter of
the shorter grid dimension (rounded to the nearest pixel, at least one pixel). Panning and camera transitions move
the pattern with the visible scene. Dot bounds are recalculated and uploaded only when either grid dimension changes;
camera offsets and drawing-buffer scale are updated every frame. Grid and palette changes do not reload the shader or
generate atlas pixels. No reloadable buffers are allocated, so the layer remains valid during rendering-memory suspension.

Install this plugin eagerly in compositions that should use the dotted background. Compositions can omit it or
register other background layers instead. Disposal unregisters the layer and releases its program and vertex array.

Run Nx `build`, `test`, `typecheck`, and `test:screenshot` targets to validate the plugin.
