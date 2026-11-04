# Code block background

`codeBlockBackgroundPlugin` draws the normal, disabled, and dragged code-block base rectangles through
`drawers.registerCodeBlockDrawer`. Dragged styling takes precedence over disabled styling. Coordinates and dimensions
come from the shared block geometry; the plugin owns palette selection and its drawer registration.

Both editor compositions install it eagerly before code rendering, so later drawers appear above the rectangle.
It has no state effects or browser dependencies. Disposal unregisters its drawer. Web-ui keeps the block loop,
culling, corner markers, and offscreen arrows; code rendering owns selected-line fill.

Test this plugin independently. Combined drawing order belongs in editor composition tests. Run its Nx `build`,
`test`, `typecheck`, and `test:screenshot` targets.
