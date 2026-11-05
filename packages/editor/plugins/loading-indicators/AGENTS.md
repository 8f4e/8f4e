# Loading Indicators Plugin

- Own presentation of `state.loadingIndicators` through `registerCanvasOverlay`, plus private, demand-driven visibility bookkeeping.
- Expose optional row limits and timings through `createLoadingIndicatorsPlugin(options)`. Apply defaults in the
  factory and keep `loadingIndicatorsPlugin` as its default instance so existing compositions need no changes.
  Defaults: at most 20 rows, 100 ms elapsed refresh, 25 ms hide spacing, 100/500 ms successful-duration thresholds,
  1/2/3 second done-result lifetimes, and five-second failed/cancelled lifetimes.
- Contributors supply `{ id, message }` through `loading.add` and own `done()`, `fail()`, or `cancel()` outcomes.
  State records `status`, epoch-millisecond `startedAt`, and nullable `finishedAt`. Reusing an ID replaces its entry;
  stale handles cannot update the replacement. Do not concatenate a loading prefix or group by contributor.
- Draw elapsed time in ms or seconds and freeze it at completion. Use shared positive/negative palette tokens for
  done/failed labels and muted text for cancelled. Clip messages to reserve room for status/time within the viewport.
- Prepare text spans, clipping, colors, and positions on indicator/viewport/font changes. The render callback only
  draws cached rows. Refresh elapsed labels outside rendering at the configured interval only while pending rows are visible.
- Never delete or mutate contributions to hide them. Keep hidden attempts private by object identity, so same-ID
  replacements become visible again. Respect the configured duration thresholds and outcome-specific lifetimes.
- Install eagerly before deferred imports. Sleep until the next expiry, then hide the oldest eligible finish first,
  spacing hides by the configured interval. Do not poll without visible finished entries. Pending operations stay visible.
  Hiding runs when drawing is disabled. Dispose timers, subscriptions, and the drawer.
- Run `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
  Run `npx nx run @8f4e/editor-plugin-loading-indicators:test:screenshot` for the loading-indicator browser cases
  and their owned screenshot baselines. Use local contributors for messages, terminal results, elapsed time,
  clipping, and visibility. Combined producer and deferred-loader rendering belongs in composition tests.
