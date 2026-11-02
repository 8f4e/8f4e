# Code rendering plugin

- Own code/notes highlighting, visible text preparation, line-number drawing, glyph resolution, and cached rows here.
- Export `codeRenderingPlugin`; default and minimal compositions install it eagerly.
- Keep source/display geometry, tab parsing/advance rules, gaps, cursor placement, and hit testing in editor-state.
- Use the content drawer hook, before cursor/diagnostics. Keep generic sprite packing and drawing in web-ui.
- Prepare cells after `codeBlockLayoutsChanged`, outside the frame loop. Keep the cache private per installation.
- Dispose the event listener, drawer, and cache explicitly. Add no core-owned text snapshots or compatibility aliases.
- Run the build, test, typecheck, and test:screenshot Nx targets for this package.
