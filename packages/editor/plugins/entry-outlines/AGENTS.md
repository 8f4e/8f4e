# Entry outlines

- Own entry bounds, padding, labels, hit testing, and drawing in this package. Keep prepared outlines out of core state.
- Draw through generic `registerCanvasBackgroundDrawer` in viewport coordinates, below code blocks.
- Contribute spatial entry selection through `resolveCodeBlockInsertionEntry`. Core owns default entry allocation,
  insertion, entry membership, and execution semantics; it must not read plugin geometry.
- Prepare bounds on geometry/project notifications and installation, outside the drawing callback.
- Dispose drawing, listeners, and subscriptions explicitly. Both compositions defer installation until `ready`.
- Keep tests independent of sibling plugins. Use local drawing fixtures for browser screenshots.
- Verify through Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
