# Loading Indicators Plugin

`@8f4e/editor-plugin-loading-indicators` draws active loads from `state.loadingIndicators` as
`Loading {name}...` lines at the bottom left of the viewport. It uses the canvas-overlay hook, respects
`canvasOverlays`, and does not block input. Text and row counts are limited to the available viewport.

Install `loadingIndicatorsPlugin` through the ordinary plugin contract. It has no factory dependencies,
configuration schema, or project directive. An unconditional deferred entry can load it after core's `ready`
event; it reads the current list on each frame, including operations that started before installation.
Disposal unregisters its drawer without changing the list.

Plugins contribute independently of presentation through the shared editor-state helper:

```ts
import { addLoadingIndicator } from '@8f4e/editor-state';

const finishLoading = addLoadingIndicator(store, { name: 'sound' });
try {
	await loadSound();
} finally {
	finishLoading();
}
```

The state is one unified `LoadingIndicator[]`; each object currently contains only `name: string`.
Create a fresh object for each operation. The returned remover is idempotent and removes that exact object,
so equal names and late completions cannot remove another operation's indicator. Producers also call their
removers immediately when work is superseded or the producer is disposed, even if its promise is still pending.
Loading failures are reported separately through the producer's existing error reporting.

Verify with `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
Real-editor overlay coverage belongs in the editor-default composition's `test:screenshot` target.
