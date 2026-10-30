# Connectors plugin

`@8f4e/editor-plugin-connectors` owns input/output connectors and the complete wire renderer. Both default and minimal
editor compositions install `connectorsPlugin` in their fixed plugin set. Omitting it leaves the editor without
connector widgets, wire drawing, or line GPU allocations; compilation and memory resolution continue independently.

The plugin derives pointer inputs and public non-pointer outputs from the compiler memory plan, including inherited
shape declarations and exposed memory on nested project groups. Layout subscriptions keep geometry private in a
per-editor WeakMap. After each completed layout batch, the plugin rebuilds its byte-address index from the current
project slice. Runtime pointer values are read on every frame, so wires follow live memory without recompilation.

Connectors use the existing code-block drawer. Wires use `drawers.registerRenderLayer`: the renderer supplies its
WebGL context and resolved palette after initialization, draws the pass above sprites and below configured RGBA
overlays, forwards palette updates and memory release, and destroys the layer before the WebGL context. Each pass
resets and fills one retained CPU buffer, then uploads the used range once. Dialogs suppress wires; selected input
blocks highlight their connections. The pass includes offscreen endpoints independently of block culling.

Input `[ ]` and output `[*]` connectors are composed at runtime from the shared fill and font sprites. Both use a
three-cell `surfaceOverlay` background; input brackets use `primaryBase`, and output brackets use `secondaryBase`.
The output star selects `primaryDark3`, `primaryDark2`, `primaryDark1`, `primaryBase`, `warningBase`, or `negativeBase`
using the existing calibrated value scale. Each input submits three sprites and each output four, in the same sprite
batch. The generator does not prerender connector icons.

## Wire rasterization

Wires follow a Bresenham staircase with one pixel per column for shallow angles or per row for steep angles.
Thickness must be a positive integer number of pixels; fractional and non-positive widths throw a `RangeError`.
Selected wires expand the staircase along its minor axis. Both endpoints snap to the nearest pixel and are included;
reversing the endpoints preserves the same pixels. The comparison below enlarges pixels 3×, with the previous
rectangle coverage on the left and Bresenham rendering on the right.

![Wire rendering before and after Bresenham rasterization](images/bresenham-comparison.png)

## Verification

- `npx nx run @8f4e/editor-plugin-connectors:build`
- `npx nx run @8f4e/editor-plugin-connectors:test`
- `npx nx run @8f4e/editor-plugin-connectors:typecheck`
- `npx nx run @8f4e/editor-plugin-connectors:test:screenshot`
