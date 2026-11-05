# Connectors plugin

`@8f4e/editor-plugin-connectors` owns input/output connectors, expanded declaration labels, and the complete wire
renderer. The default, minimal, and landing compositions load `connectorsPlugin` after the first render. Omitting it
leaves the editor without connectors, expanded labels/rows, wire drawing, or line GPU allocations; compilation and
memory resolution continue independently.

The plugin expands compiler-reported `shape` declarations and `paramShape` function parameters for display, reserving
rows through the generic layout contribution API. Labels stay private and draw with connectors through the ordered
block drawer registry. Inherited declaration labels and connector endpoints use the same ordered memory rows. Hidden source and
disabled blocks reserve no expansion rows. Source edits, recompilation, font changes, and group navigation refresh
the layout; disposal removes its labels and reserved space. The compiler owns all language semantics.

The plugin derives pointer inputs and public non-pointer outputs from the compiler memory plan, including inherited
shape declarations and exposed memory on nested project groups. One derivation pass produces both connector lists.
Module connectors belong only to the block selected by the compiler's `projectBlockId`, so overridden definitions do
not add duplicate endpoints and selecting a same-named block cannot redirect wires.
Layout subscriptions keep geometry private in a per-editor WeakMap. After each completed layout batch, the plugin
rebuilds its byte-address index from the current
project slice. Runtime pointer values are read on every frame, so wires follow live memory without recompilation.
Fixed reference slots such as `float& input &source:output` also produce input connectors, positioned at their
declaration rows. Their wires use the target byte address retained in `compiledModules[id].referenceSlots`, without
reading a pointer slot from runtime memory. Every compiled module supplies a reference-slot map, empty when it has no
fixed declarations. Target type and buffer metadata come from the backing declaration in the allocation plan.

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
Normal connections use a one-pixel thickness; selected input blocks use two pixels.
Selected wires expand the staircase along its minor axis. Both endpoints snap to the nearest pixel and are included;
reversing the endpoints preserves the same pixels. The comparison below enlarges pixels 3×, with the previous
rectangle coverage on the left and Bresenham rendering on the right.

![Wire rendering before and after Bresenham rasterization](images/bresenham-comparison.png)

## Verification

- `npx nx run @8f4e/editor-plugin-connectors:build`
- `npx nx run @8f4e/editor-plugin-connectors:test`
- `npx nx run @8f4e/editor-plugin-connectors:typecheck`
- `npx nx run @8f4e/editor-plugin-connectors:test:screenshot`
