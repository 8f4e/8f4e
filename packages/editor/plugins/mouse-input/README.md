# Mouse input

`@8f4e/editor-plugin-mouse-input` translates DOM `mousedown`, `mousemove`, `mouseup`, `contextmenu`, and wheel input
into normalized `pointerdown`, `pointermove`, `pointerup`, and `contextmenu` events. Core owns selection, dragging,
menus, and viewport effects; this plugin owns browser coordinates, canvas focus, default-action cancellation, and
listener disposal.

```ts
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';

const plugin = createMouseInputPlugin({ inputTarget: canvas, captureWheel: true });
```

The plugin can load after the first render on fine- and coarse-pointer devices. It also forwards browser-generated mouse
events from touch taps. `captureWheel: false` leaves wheel scrolling to the surrounding page. Wheel input is captured
only while `viewportDragging` is enabled. Each wheel event is forwarded as `pointermove`; the viewport stays at its
last position when scrolling pauses. Disposal removes listeners.

Run the Nx `build`, `test`, `typecheck`, and `test:screenshot` targets. Unit tests cover translation and cleanup;
native browser tests cover focusing, viewport panning, and page scrolling.
