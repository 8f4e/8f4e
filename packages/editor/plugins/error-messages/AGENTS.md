# Error messages

- Own error wrapping, heading/padding, palette choice, layout reservation, and drawing here. Keep prepared messages
  private. Core retains only raw `CodeError` contributions in `state.codeErrors`, keyed by contributor.
- Use existing layout subscriptions/contributions and the ordinary block drawer. Reserve and draw only visible
  source lines, stacking messages on the same display row after other reserved content.
- Consume every contributor uniformly. Assertion failures are published by test-runtime; do not interpret compiler
  or runtime results here.
- Own subscription, contribution, and drawer disposal explicitly. Disposing the renderer preserves raw errors.
- Load this as an unconditional deferred entry.
- Test only this plugin against core services. Combined plugin rendering belongs in editor-default tests.
- Run the package's Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
