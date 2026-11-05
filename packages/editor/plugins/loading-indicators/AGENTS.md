# Loading Indicators Plugin

- Own only the presentation of the unified `state.loadingIndicators` list through `registerCanvasOverlay`.
- Keep indicators as `{ name: string }` objects. Producers use editor-state's `addLoadingIndicator` helper
  and own cleanup on success, failure, cancellation, supersession, and disposal. Do not group by contributor.
- Draw at the bottom left, limit output to the viewport, and keep input unblocked. Use shared palette tokens.
- Install through an unconditional deferred entry after core's `ready` event. Read current state so loads
  that began before installation are visible. Disposal removes only the drawer.
- Run `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
  Real plugin combinations and screenshots belong in editor-default's `test:screenshot` target.
