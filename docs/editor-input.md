# Editor input

Mouse and touch plugins translate browser input into `pointerdown`, `pointermove`, `pointerup`, and
`pointercancel` editor events with the shared `InternalPointerEvent` payload. Pointer contracts live in
`@8f4e/editor-state-types`. Feature plugins have no browser listeners or knowledge of the input device.

Core's pointer-input feature handles block lookup and routes both adapters through the same control interactions.
Dialogs and menus get priority, then controls can claim `codeBlockPointerDown` in capture order by setting
`stopPropagation`. Unclaimed presses continue to default selection and dragging; ordinary block listeners run after
selection. Sliders and crossfaders consume
`codeBlockPointerMove`, and held controls release on `codeBlockPointerUp`.

Event dispatch can select the capture or normal phase with `{ phase: 'capture' | 'normal' }`; omitting the option
runs both phases. Touch input probes the capture phase before committing a viewport gesture. Core decides whether
an interaction claims the pointer; probes leave dialog and menu activation to the completed press. The adapter
cancels native defaults only for claimed interactions or completed
pans. Extra fingers, cancellation, project replacement, and disposal release a held touch. Unclaimed taps retain
native tap handling.

## Viewport navigation

Dragging, wheel scrolling, and touch panning leave the viewport at its last pixel position. They do not snap to
the text grid when the gesture ends. Block placement still uses the grid.

Directional block navigation, jumping to a block, and going home commit the destination immediately in editor-state.
Web-ui responds to the navigation-tagged `viewportChanged` event by gliding the whole scene to that destination over
200 ms. Repeated navigation starts the next glide from the last drawn position. Reduced-motion preferences make the
jump immediate. New pointer presses are ignored during the glide so they cannot act on a block drawn elsewhere;
pointer releases still get through. Manual panning does not use the navigation glide.

Editor-core owns the single frame loop and passes its timestamp to web-ui, including for on-demand `renderFrame()`
calls. Editor-state has no animation timing or frame callbacks. Hosts without a renderer see the destination immediately.

## Touch panning

`createTouchInputPlugin` pans with one finger and accepts
`axis: 'both' | 'horizontal' | 'vertical'` (default `'both'`). Control gestures take priority over viewport panning.
Adding another finger ends the gesture; removing it does not resume panning.

Both editor compositions expose the axis through their mount options:

```ts
await mountGalleryEditor(canvas, {
	touchNavigation: { axis: 'horizontal' },
});
```

The product landing page and both galleries use horizontal panning. Horizontal drags pan the editor and vertical
swipes scroll the page. The adapter allows the disabled direction through `touch-action` and rejects gestures starting
primarily in that direction. Only enabled axes move. The full-screen editor defaults to panning on both axes.

The website stylesheets disable native tap highlighting on editor canvases with
`-webkit-tap-highlight-color: transparent`. Embedding hosts can apply the same CSS rule. Dialogs fit within the
viewport with a grid-cell margin, wrap body text and buttons, and constrain titles to the available text width on
portrait screens.
