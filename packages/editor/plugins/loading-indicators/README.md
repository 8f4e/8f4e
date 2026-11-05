# Loading Indicators Plugin

`@8f4e/editor-plugin-loading-indicators` draws `state.loadingIndicators` at the bottom left without blocking input.
Messages come directly from contributors; the drawer adds elapsed time in milliseconds below one second and seconds
with one decimal place otherwise. Done and failed results receive green and red labels; cancelled results use a
neutral label. Elapsed time stops at completion. Message and row counts are clipped to the viewport, reserving room
for status and time.

Install `loadingIndicatorsPlugin` through the ordinary plugin contract. It has no factory dependencies,
configuration schema, or project directive. Install it eagerly before the deferred loader so the initial feature
imports can be shown. `canvasOverlays` controls drawing.

Text, clipping, colors, and positions are prepared when indicators, viewport size, or font metrics change. Frames
only draw those prepared rows. Visible pending rows refresh their elapsed labels every 100 ms outside rendering;
completed rows retain their prepared text. The elapsed timer stops when no pending rows are visible.

Plugins contribute through `loading` in their setup context:

```ts
const indicator = loading.add({ id: 'compiler', message: 'Compiling...' });
try {
	await compile();
	indicator.done();
} catch (error) {
	indicator.fail();
	throw error;
}
```

Call `indicator.cancel()` when pending work is interrupted, superseded, or disposed. Each handle settles only its
own attempt, and its first terminal call wins. A new contribution with the same ID replaces the previous entry in
place; late calls through the previous handle cannot affect it. Different IDs remain independent, even when their
messages match.

Each state record contains `id`, `message`, `status` (`loading`, `done`, `failed`, or `cancelled`), `startedAt`, and
`finishedAt`. Timestamps are milliseconds since the Unix epoch; `finishedAt` is null while loading. The registry
records timestamps and terminal results without removing entries.

Cleanup sleeps until the oldest finished entry becomes more than five seconds old. It then removes that entry
and spaces further removals by at least 100 ms, oldest finish timestamp first. With no finished entries it schedules
no cleanup work. Pending operations remain. Cleanup runs independently of drawing, including while overlays or
rendering are disabled. Disposal stops both timers, releases subscriptions, and unregisters the drawer without
clearing the list. Without this plugin, contributions and terminal results still work, but no scheduled cleanup
or presentation runs.

Verify with `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
Run real-editor overlay coverage with `npx nx run @8f4e/editor-plugin-loading-indicators:test:screenshot`.
The browser cases and their baselines live in `screenshot-tests/` in this package.
