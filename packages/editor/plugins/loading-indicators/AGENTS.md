# Loading Indicators Plugin

- Own only the presentation of the unified `state.loadingIndicators` list through `registerCanvasOverlay`.
- Keep indicators as `{ name: string }` objects. Producers use `loading.add({ name })` from their plugin setup context
  and own cleanup on success, failure, cancellation, supersession, and disposal. Do not group by contributor.
- Draw at the bottom left, limit output to the viewport, and keep input unblocked. Use shared palette tokens.
- Install eagerly before the deferred loader so its first imports are visible. Read the current list each frame.
  Disposal removes only the drawer.
- Run `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
  Run `npx nx run @8f4e/editor-plugin-loading-indicators:test:screenshot` for the loading-indicator browser cases
  and their owned screenshot baselines, including concurrent producer contributions and the initial deferred import.
