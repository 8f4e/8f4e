# Loading Indicators Plugin

- Own presentation of `state.loadingIndicators` through `registerCanvasOverlay`, plus demand-driven cleanup.
- Contributors supply `{ id, message }` through `loading.add` and own `done()`, `fail()`, or `cancel()` outcomes.
  State records `status`, epoch-millisecond `startedAt`, and nullable `finishedAt`. Reusing an ID replaces its entry;
  stale handles cannot update the replacement. Do not concatenate a loading prefix or group by contributor.
- Draw elapsed time in ms or seconds and freeze it at completion. Use shared positive/negative palette tokens for
  done/failed labels and muted text for cancelled. Clip messages to reserve room for status/time within the viewport.
- Prepare text spans, clipping, colors, and positions on indicator/viewport/font changes. The render callback only
  draws cached rows. Refresh elapsed labels outside rendering every 100 ms only while pending rows are visible.
- Install eagerly before deferred imports. Cleanup sleeps until the next five-second expiry, removes the oldest
  finished entry, and spaces further removals by at least 100 ms. Do not poll when no finished entries exist.
  Pending work survives cleanup, including when drawing is disabled. Dispose timers, subscriptions, and the drawer.
- Run `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
  Run `npx nx run @8f4e/editor-plugin-loading-indicators:test:screenshot` for the loading-indicator browser cases
  and their owned screenshot baselines, including concurrent producer contributions and the initial deferred import.
