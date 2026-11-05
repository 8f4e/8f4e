# Code rendering plugin

- Own code/notes highlighting, nested block parsing/backgrounds, visible text preparation, line-number/selection drawing, glyph
  resolution, and cached rows/rectangles here.
- Export `codeRenderingPlugin`; default, minimal, and landing compositions install it eagerly.
- Keep source/display geometry, tab parsing/advance rules, gaps, cursor placement, and hit testing in editor-state.
- Register one block drawer: nested highlights first, selected-line fill next, and cached text last. The host installs
  block backgrounds before this plugin. Keep generic sprite packing and drawing in web-ui.
- Prepare cells and highlight rectangles after `codeBlockLayoutsChanged`, outside the frame loop. Keep the cache private per installation.
- Dispose the event listener, drawers, and cache explicitly. Add no core-owned text snapshots or compatibility aliases.
- Run the build, test, typecheck, and test:screenshot Nx targets for this package.
