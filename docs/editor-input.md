# Editor input

Mouse and touch plugins translate browser input into `pointerdown`, `pointermove`, `pointerup`, and
`pointercancel` editor events with the shared `InternalPointerEvent` payload. Pointer contracts live in
`@8f4e/editor-state-types`. Feature plugins have no browser listeners or knowledge of the input device.

Core's pointer-input feature handles block lookup and routes both adapters through the same control interactions.
Dialogs and menus get priority, then controls can claim `codeBlockPointerDown` in capture order by setting
`stopPropagation`. Unclaimed presses continue to default selection and dragging; ordinary block listeners run after
selection. Control routing is independent of the block-dragging feature flag. Sliders and crossfaders consume
`codeBlockPointerMove`, and held controls release on `codeBlockPointerUp`.

Event dispatch can select the capture or normal phase with `{ phase: 'capture' | 'normal' }`; omitting the option
runs both phases. Touch input probes the capture phase before committing a viewport gesture. Core decides whether
an interaction claims the pointer; probes leave dialog and menu activation to the completed press. The adapter
cancels native defaults only for claimed interactions or completed
pans. Extra fingers, cancellation, project replacement, and disposal release a held touch. Unclaimed taps retain
native tap handling.

## Viewport navigation

Directional block navigation, jumping to a block, and going home request a 500 ms viewport animation. Editor-state
stores the start and target positions and exposes `advanceViewportAnimation(state, frameTime, events)` for each
rendered frame. Editor-core advances the animation before asking web-ui to draw, updating the shared
viewport coordinates, border geometry, and `viewportChanged` listeners throughout the pan.

Editor-core owns frame scheduling and pause/resume coordination. State has no animation-frame callbacks, and
web-ui draws the supplied viewport without advancing navigation state. Other hosts and headless consumers advance
animations explicitly. The editor's `renderFrame()` also advances an animation while automatic rendering is
paused. The next frame uses elapsed time, including any time spent paused.

## Touch panning

`createTouchInputPlugin` accepts `fingerCount: 1 | 2` (default `2`) and
`axis: 'both' | 'horizontal' | 'vertical'` (default `'both'`). Only gestures with the configured finger count pan
the viewport; control gestures take priority. Two-finger panning follows the midpoint between the fingers.

Both editor compositions expose the settings through their mount options:

```ts
await mountMinimalEditor(canvas, {
	touchNavigation: { fingerCount: 1, axis: 'horizontal' },
});
```

The product landing page uses these settings. Horizontal drags pan the editor and vertical swipes scroll the page.
In one-finger mode, the adapter allows the disabled direction through `touch-action` and rejects gestures starting
primarily in that direction. In two-finger mode, unclaimed one-finger swipes scroll the surrounding page; adding the
second finger reserves the gesture for viewport panning. Only enabled axes move or snap to the grid. Editors default
to two fingers on both axes, including the product galleries.

The website stylesheets disable native tap highlighting on editor canvases with
`-webkit-tap-highlight-color: transparent`. Embedding hosts can apply the same CSS rule. Dialogs fit within the
viewport with a grid-cell margin, wrap body text and buttons, and constrain titles to the available text width on
portrait screens.
