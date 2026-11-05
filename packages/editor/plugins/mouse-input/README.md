# Mouse input

`@8f4e/editor-plugin-mouse-input` translates DOM `mousedown`, `mousemove`, `mouseup`, `contextmenu`, and wheel input
into normalized `pointerdown`, `pointermove`, `pointerup`, and context-menu/scroll events. Core owns selection, dragging, menus, and viewport effects; this plugin owns
browser coordinates, canvas focus, default-action cancellation, the wheel-end timer, and listener disposal.

```ts
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';

const plugin = createMouseInputPlugin({ inputTarget: canvas, captureWheel: true });
```

All three editor compositions import it after their first render, on every device. It also forwards browser-generated mouse
events from touch taps. `captureWheel: false` leaves wheel scrolling to the surrounding page. Wheel input is captured
only while `viewportDragging` is enabled; after scrolling pauses for 120 ms, the plugin emits `viewportscrollend` and
core snaps the viewport to the grid. Disposal removes listeners and cancels pending timer work.

Run the Nx `build`, `test`, `typecheck`, and `test:screenshot` targets. Unit tests cover translation and cleanup;
native browser tests cover focusing, viewport panning, and page scrolling.
