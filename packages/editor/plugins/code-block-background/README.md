# Code block background

`codeBlockBackgroundPlugin` draws normal, disabled, and dragged code-block base rectangles and corner markers
through `drawers.registerCodeBlockDrawer`. Dragged styling takes precedence over disabled styling. Selected blocks
use the secondary color for their corners. Coordinates and dimensions come from the shared block/grid geometry;
the plugin owns palette selection and its drawer registration.

Both editor compositions install it eagerly before code rendering, so later drawers appear above the rectangle and corners.
It has no state effects or browser dependencies. Disposal unregisters its drawer. Web-ui keeps the block loop,
culling, entry outlines, and offscreen arrows; code rendering owns selected-line fill.

Test this plugin independently. Combined drawing order belongs in editor composition tests. Run its Nx `build`,
`test`, `typecheck`, and `test:screenshot` targets.
