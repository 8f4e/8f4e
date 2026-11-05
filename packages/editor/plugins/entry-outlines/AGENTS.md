# Entry outlines

- Own borders, label offsets, palette selection, and drawing here. Editor-state owns entry bounds, padding, updates,
  and insertion hit testing in `codeBlockRendering.entryBounds`.
- Read current bounds from core and draw through generic `registerCanvasBackgroundDrawer` below code blocks.
- Return drawer unregistration as disposal. This drawing plugin can be deferred until `ready`.
- Keep tests focused on presentation with prepared bounds. Bounds and insertion belong to editor-state tests.
- Use local block fixtures for browser screenshots; install no sibling presentation plugins.
- Verify through Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
