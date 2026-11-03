# Touch viewport navigation

`@8f4e/editor-plugin-touch-viewport-navigation` translates native touches into editor control interactions and viewport
panning. Controls receive the same `codeBlockPointerDown`, `codeBlockPointerMove`, and `codeBlockPointerUp` events as
mouse input, with no browser listeners or device checks in feature plugins. A control claims a pointer down by setting
`stopPropagation`; the adapter then owns that touch until release, cancellation, an extra finger, or project replacement.
Unclaimed taps remain available to the browser and the mouse-input adapter.

```ts
import { createTouchViewportNavigationPlugin } from '@8f4e/editor-plugin-touch-viewport-navigation';

const plugin = createTouchViewportNavigationPlugin({
	inputTarget: canvas,
	fingerCount: 1,
	axis: 'horizontal',
});
```

`fingerCount` accepts `1` or `2` and defaults to `2`. `axis` accepts `'both'`, `'horizontal'`, or `'vertical'` and defaults
to `'both'`. Both editor compositions expose these settings through `touchNavigation`. The landing page uses one-finger
horizontal panning, leaving vertical swipes available for native page scrolling.

A 6-pixel threshold distinguishes panning from a tap. Panning follows the finger position, or the midpoint of two
fingers, and snaps only the enabled axes to the editor grid when finished. Changing the finger count ends the gesture.
Axis-restricted gestures yield to page scrolling when the initial movement is primarily in the disabled direction;
`touch-action: pan-y` or `pan-x` permits that native scrolling. Unrestricted panning uses `touch-action: none`.
Disabling viewport dragging or disposing the plugin restores the original inline touch action. Controls remain usable
when viewport dragging is disabled.

Both default and minimal compositions load this plugin after their first render on `(pointer: coarse)` devices.
The plugin has no capability checks and synthesizes no DOM mouse events. It does not edit block positions, source,
history, or project revisions. The touch target keeps receiving a gesture outside its bounds. Disposal removes all
listeners and releases any held control.

Run the Nx `build`, `test`, `typecheck`, and `test:screenshot` targets. Tests cover configurable gestures, native page
scrolling, cancellation, cleanup, and taps. Combined control interactions are covered by editor-default browser tests.
