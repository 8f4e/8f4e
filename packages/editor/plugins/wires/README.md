# Wires plugin

`@8f4e/editor-plugin-wires` owns wire endpoint layout and the WebGL wire pass. The default and landing editors install
`wiresPlugin` for straight lines. The gallery editor installs `looseWiresPlugin` instead for wires with a downward sag.
Install only one variant per editor. Both work independently of `connectorsPlugin`.

The wire tracker uses compiler metadata and settled editor layout to find declaration, fixed reference, and group
`expose` endpoints, including endpoints outside the viewport. It indexes outputs by byte address for the current
project level. Each frame reads live pointer slots from memory and uses the compiler-resolved address for fixed
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

Loose wires use the same pixel lines to draw a curve. Sag increases with the horizontal span, up to 96 canvas pixels,
and nearly vertical wires stay straight. Both variants follow the same rendered connector positions as blocks move.

Run the package's `build`, `test`, `typecheck`, and `test:screenshot` Nx targets to verify it.
