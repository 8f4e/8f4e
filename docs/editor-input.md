# Editor input

Mouse and touch plugins translate browser input into editor interactions. Feature plugins handle shared pointer
events, without browser listeners or knowledge of the input device.

Controls listen for `codeBlockPointerDown` in capture order, hit-test their own geometry, and set `stopPropagation`
when they claim the pointer. Slider and crossfade drags consume `codeBlockPointerMove`; held controls release on
`codeBlockPointerUp`. Mouse input reaches these events through core's ordinary input effects. The touch adapter
dispatches the same events and prevents native defaults only after a control claims the touch. Extra fingers,+cancellation, project replacement, and disposal release a held touch control.

## Touch panning

`createTouchViewportNavigationPlugin` accepts `fingerCount: 1 | 2` (default `2`) and
`axis: 'both' | 'horizontal' | 'vertical'` (default `'both'`). Only gestures with the configured finger count pan
the viewport; control gestures take priority. Two-finger panning follows the midpoint between the fingers.

Both editor compositions expose the settings through their mount options:

```ts
await mountMinimalEditor(canvas, {
	touchNavigation: { fingerCount: 1, axis: 'horizontal' },
});
```

The product landing page uses these settings. Horizontal drags pan the editor and vertical swipes scroll the page.
The adapter allows the disabled direction through `touch-action` and rejects gestures starting primarily in that
direction. Only enabled axes move or snap to the grid. Full-screen editors default to two fingers on both axes.

The website stylesheets disable native tap highlighting on editor canvases with
`-webkit-tap-highlight-color: transparent`. Embedding hosts can apply the same CSS rule. Dialogs fit within the
viewport with a grid-cell margin, wrap body text and buttons, and constrain titles to the available text width on
portrait screens.
