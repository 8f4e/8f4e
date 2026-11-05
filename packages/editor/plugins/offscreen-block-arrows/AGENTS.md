# Offscreen block arrows

- Own arrow projection, edge/glyph offsets, colors, and drawing here. Read current viewport dimensions directly.
- Use the single replaceable `registerOffscreenCodeBlockDrawer` callback, in world coordinates. Web-ui owns the
  block traversal, visibility checks, viewport translation, and generic `canvasOverlays` visibility.
- Return drawer unregistration as disposal. Do not add uniqueness validation or a callback restoration stack.
- The default and minimal compositions load this plugin unconditionally after `ready`.
- Keep arrow tests here; core tests only generic callback dispatch, replacement, and visibility.
- The typecheck target covers both `src/` and `screenshot-tests/`; production builds compile only source.
- Verify through Nx `build`, `test`, `typecheck`, and `test:screenshot`. Install no sibling plugins in tests.
