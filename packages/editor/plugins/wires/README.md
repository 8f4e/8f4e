# Wires plugin

`@8f4e/editor-plugin-wires` owns wire endpoint layout and the straight WebGL wire pass. The default and landing
editors install `wiresPlugin` and `connectorsPlugin` separately. Neither plugin depends on the other. The gallery
editor uses [`@8f4e/editor-plugin-loose-wires`](../loose-wires/README.md) instead.

The wire tracker uses compiler metadata and settled editor layout to find declaration, fixed reference, and group
`expose` endpoints, including endpoints outside the viewport. It indexes outputs by byte address for the current
project level. It refreshes the index on accepted compiler metadata changes and settled layout notifications
independently. Each frame reads live pointer slots from memory and uses the compiler-resolved address for fixed
references. Endpoint offsets stay relative to their blocks; the frame's web-ui rendering geometry supplies each
block's viewport-relative origin, including offscreen endpoints.

The pass runs above sprites, forwards palette changes and GPU memory release to the drawer, and releases its resources on disposal.
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
