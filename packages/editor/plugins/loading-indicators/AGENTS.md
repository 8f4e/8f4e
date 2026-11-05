# Loading Indicators Plugin

- Own presentation of `state.loadingIndicators` through `registerCanvasOverlay`, plus a 100 ms cleanup timer.
- Contributors supply `{ id, message }` through `loading.add` and own `done()`, `fail()`, or `cancel()` outcomes.
  State records `status`, epoch-millisecond `startedAt`, and nullable `finishedAt`. Reusing an ID replaces its entry;
  stale handles cannot update the replacement. Do not concatenate a loading prefix or group by contributor.
- Draw elapsed time in ms or seconds and freeze it at completion. Use shared positive/negative palette tokens for
  done/failed labels and muted text for cancelled. Clip messages to reserve room for status/time within the viewport.
- Install eagerly before deferred imports. Remove at most one record per tick, oldest finish time first, and only when its finish
  time is older than five seconds. Pending work must survive cleanup. Cleanup runs even when drawing is disabled.
  Dispose the timer and drawer.
- Run `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
  Run `npx nx run @8f4e/editor-plugin-loading-indicators:test:screenshot` for the loading-indicator browser cases
  and their owned screenshot baselines, including concurrent producer contributions and the initial deferred import.
