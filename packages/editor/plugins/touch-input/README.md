# Touch input

`@8f4e/editor-plugin-touch-input` translates native touches into shared `pointerdown`, `pointermove`,
`pointerup`, and `pointercancel` editor events and owns touch viewport gestures. Core handles block targeting, modal
priority, and control routing for both input adapters. Feature plugins receive device-independent block pointer
events, with no browser listeners or device checks. A consumer claims a press by setting `stopPropagation`; the adapter
then owns that touch until release, cancellation, an extra finger, or project replacement. Unclaimed taps retain native
tap handling.

```ts
import { createTouchInputPlugin } from '@8f4e/editor-plugin-touch-input';

const plugin = createTouchInputPlugin({
	inputTarget: canvas,
	axis: 'horizontal',
});
```

Panning uses one finger. `axis` accepts `'both'`, `'horizontal'`, or `'vertical'` and defaults to `'both'`.
Both editor compositions expose the setting through `touchNavigation`. The product landing page and galleries use
horizontal panning, leaving vertical swipes available for native page scrolling.

A 6-pixel threshold distinguishes panning from a tap. Panning follows the finger position and snaps only the enabled
axes to the editor grid when finished. Adding another finger ends the gesture; removing it does not resume panning.
Axis-restricted gestures yield to page scrolling when the initial movement is primarily in the disabled direction;
`touch-action: pan-y` or `pan-x` permits that native scrolling. Panning on both axes uses `touch-action: none`.
Disabling viewport dragging or disposing the plugin restores the original inline touch action. Controls remain usable
when viewport dragging is disabled.

Both default and minimal compositions load this plugin after their first render on `(pointer: coarse)` devices.
The plugin has no capability checks and synthesizes no DOM mouse events. It does not edit block positions, source,
history, or project revisions. The touch target keeps receiving a gesture outside its bounds. Disposal removes all
listeners and releases any held control.

Run the Nx `build`, `test`, `typecheck`, and `test:screenshot` targets. Tests cover configurable gestures, native page
scrolling, cancellation, cleanup, and taps. Combined control interactions are covered by editor-default browser tests.
