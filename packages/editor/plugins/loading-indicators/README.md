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

The plugin never deletes contributions. It tracks hidden attempts privately by object identity, so a new
contribution with the same ID becomes visible again. Done results become eligible to hide based on how long the
operation took:

| Operation duration | Visible after completion |
| --- | --- |
| Up to 100 ms | 1 second |
| Over 100 ms, up to 500 ms | 2 seconds |
| Over 500 ms | 3 seconds |

Failed and cancelled results remain visible for five seconds. Pending operations stay visible. Among eligible
results, the oldest finish timestamp hides first, with at least 25 ms between hides. An older failure still in its grace period
does not prevent a newer done result from hiding.

The visibility timer sleeps until the next expiry and stops when no visible finished entries remain. Hiding works
independently of drawing, including while overlays or rendering are disabled. Disposal stops both timers, releases
subscriptions, and unregisters the drawer without changing contributions. Without this plugin, state and terminal
results still work, with no automatic presentation or visibility timers.

Verify with `npx nx run @8f4e/editor-plugin-loading-indicators:build|test|typecheck`.
Run real-editor overlay coverage with `npx nx run @8f4e/editor-plugin-loading-indicators:test:screenshot`.
The browser cases and their baselines live in `screenshot-tests/` in this package.
They use a local contributor to control messages, outcomes, elapsed time, clipping, and visibility. Combined
asset/lazy-loader contributions and eager presentation of initial deferred imports are covered by the default
editor's composition screenshot tests.
