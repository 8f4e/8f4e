# Code block background

`codeBlockBackgroundPlugin` draws normal and disabled code-block base rectangles and corner markers
through `drawers.registerCodeBlockDrawer`. Blocks keep their background color while being dragged. Selected blocks
use the secondary color for their corners. Coordinates and dimensions come from the shared block/grid geometry;
the plugin owns palette selection and its drawer registration.

Install it eagerly before code rendering, so later drawers appear above the rectangle and corners.
It has no state effects or browser dependencies. Disposal unregisters its drawer. Web-ui keeps the block loop,
culling and offscreen arrows; code rendering owns selected-line fill. Entry outlines belong to their own plugin.

Test this plugin independently. Combined drawing order belongs in editor composition tests. Run its Nx `build`,
`test`, `typecheck`, and `test:screenshot` targets.
