# Selection animation

- Own the selected block's circling segment, timing, glyphs, and palette choice here. Use current block/grid geometry
  through `registerCodeBlockDrawer`; keep selection state and generic drawing hooks in core.
- Register and unregister the drawer explicitly. Use the existing render loop without subscriptions or timers.
- Its deferred entries are commented out in both editor compositions. Keep it available as a standalone plugin;
  add no core flag or compatibility drawer.
- Test this plugin against core services. Do not install sibling plugins to supply fixture text or preserve screenshots.
- Run the package's Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
