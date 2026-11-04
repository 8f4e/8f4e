# Assertion Markers Plugin

- Own assertion site aggregation, marker geometry, and pass/fail drawing here. Keep marker data out of core state.
- Use the existing code-block drawer registration and current layout. Test-runtime publishes assertion results and
  raw errors centrally; error-messages owns inline message layout and drawing.
- Dispose the drawer registration explicitly. No browser dependencies are needed.
- Verify with `npx nx run @8f4e/editor-plugin-assertion-markers:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-assertion-markers:test:screenshot`.
