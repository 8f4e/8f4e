# Loading Indicators Plugin

`@8f4e/editor-plugin-loading-indicators` draws active loads from `state.loadingIndicators` as
`Loading {name}...` lines at the bottom left of the viewport. It uses the canvas-overlay hook, respects
`canvasOverlays`, and does not block input. Text and row counts are limited to the available viewport.

Install `loadingIndicatorsPlugin` through the ordinary plugin contract. It has no factory dependencies,
configuration schema, or project directive. Install it eagerly before the deferred loader so the initial
feature imports can be shown. It reads the current list on each frame.
Disposal unregisters its drawer without changing the list.

Plugins contribute independently of presentation through `loading` in their setup context:

```ts
const finishLoading = loading.add({ name: 'sound' });
try {
	await loadSound();
} finally {
	finishLoading();
}
```

The state is one unified `LoadingIndicator[]`; each object currently contains only `name: string`.
Each call creates a separate entry, including when an input object is reused. The returned remover is idempotent,
so equal names and late completions cannot remove another operation's indicator. Producers also call their
removers immediately when work is superseded or the producer is disposed, even if its promise is still pending.
Loading failures are reported separately through the producer's existing error reporting.

Verify with `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
Run real-editor overlay coverage with `npx nx run @8f4e/editor-plugin-loading-indicators:test:screenshot`.
The browser cases and their baselines live in `screenshot-tests/` in this package.
