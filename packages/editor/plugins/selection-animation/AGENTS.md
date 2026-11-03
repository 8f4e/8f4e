# Selection animation

- Own the selected block's circling segment, timing, glyphs, and palette choice here. Use current block/grid geometry
  through `registerCodeBlockForegroundDrawer`; keep selection state and generic drawing hooks in core.
- Register and unregister the drawer explicitly. Use the existing render loop without subscriptions or timers.
- Both editor compositions load this as an unconditional deferred plugin. Add no core flag or compatibility drawer.
- Test this plugin against core services. Do not install sibling plugins to supply fixture text or preserve screenshots.
- Run the package's Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
