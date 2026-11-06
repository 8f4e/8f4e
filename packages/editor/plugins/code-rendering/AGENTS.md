# Code rendering plugin

- Own code/notes highlighting, nested block parsing/backgrounds, visible text preparation, line-number/selection drawing, glyph
  resolution, and cached rows/rectangles here.
- Export `codeRenderingPlugin`; install it eagerly in the composition.
- Keep source/display geometry, tab parsing/advance rules, gaps, cursor placement, and hit testing in editor-state.
- Register one block drawer: nested highlights first, selected-line fill next, and cached text last. The host installs
  block backgrounds before this plugin. Keep generic sprite packing and drawing in web-ui.
- Prepare cells and highlight rectangles only for the blocks supplied by `codeBlockLayoutsChanged { project, codeBlocks }`,
  outside the frame loop. Those blocks belong to one group and have settled positions and layout contributions; other
  blocks can be mid-update. Keep the cache private per installation and weakly keyed by block.
- Dispose the event listener, drawers, and cache explicitly. Add no core-owned text snapshots or compatibility aliases.
- Run the build, test, typecheck, and test:screenshot Nx targets for this package.
