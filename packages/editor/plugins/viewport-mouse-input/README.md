# Viewport mouse input

`@8f4e/editor-plugin-viewport-mouse-input` captures primary-button mouse presses that start on a canvas so the
canvas keeps receiving mouse movement and release after the pointer leaves it. Use it in place of
[`@8f4e/editor-plugin-mouse-input`](../mouse-input/README.md). It reuses that plugin to translate mouse and wheel
events, including mouse events from touch taps.

```ts
import { createViewportMouseInputPlugin } from '@8f4e/editor-plugin-viewport-mouse-input';

const plugin = createViewportMouseInputPlugin({ inputTarget: canvas, captureWheel: false });
```

The landing composition loads this plugin after its first render. Capture is enabled only for mouse presses on
devices with a fine primary pointer; the plugin does not capture touch or pen input. A captured drag ends on
release, loss of capture, or window blur. Disposal removes listeners and releases any remaining capture.

Run the Nx `build`, `lint`, and `typecheck` targets for this package. The website's `test:browser` target covers
desktop dragging outside the landing canvas and unchanged touch panning.
