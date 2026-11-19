# Wires plugin

`@8f4e/editor-plugin-wires` owns the WebGL wire pass. The default, gallery, and landing browser compositions install
`wiresPlugin` and `connectorsPlugin` separately. A host can install wires without connector labels or widgets, or
install the connector presentation without a WebGL wire layer.

The pass tracks endpoints through the shared connector geometry API, independently of block culling. It runs above
sprites, forwards palette changes and GPU memory release to the drawer, and releases its resources on disposal.
Each frame resets and fills one retained CPU buffer, then uploads the used range once. Dialogs suppress wires; the
selected input block highlights its connections.

## Wire rasterization

Wires follow a Bresenham staircase with one pixel per column for shallow angles or per row for steep angles.
Normal connections use a one-pixel thickness; selected input blocks use two pixels. Selected wires expand the
staircase along its minor axis. Both endpoints snap to the nearest pixel and are included; reversing the endpoints
preserves the same pixels. The comparison below enlarges pixels 3×, with the previous rectangle coverage on the
left and Bresenham rendering on the right.

![Wire rendering before and after Bresenham rasterization](images/bresenham-comparison.png)

Run the package's `build`, `test`, `typecheck`, and `test:screenshot` Nx targets to verify it.
