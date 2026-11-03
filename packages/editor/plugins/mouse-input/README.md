# Mouse input

`@8f4e/editor-plugin-mouse-input` translates DOM `mousedown`, `mousemove`, `mouseup`, `contextmenu`, and wheel input
into the editor's core input events. Core owns selection, dragging, menus, and viewport effects; this plugin owns
browser coordinates, canvas focus, default-action cancellation, the wheel-end timer, and listener disposal.

```ts
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';

const plugin = createMouseInputPlugin({ inputTarget: canvas, captureWheel: true });
```

Both editor compositions import it after their first render, on every device. It also forwards browser-generated mouse
events from touch taps. `captureWheel: false` leaves wheel scrolling to the surrounding page. Wheel input is captured
only while `viewportDragging` is enabled: each tick emits `viewportscroll` (not a pressed `mousemove`, so held blocks
are not dragged), and after scrolling pauses for 120 ms the plugin emits `viewportscrollend` so core can snap the
viewport to the grid. Disposal removes listeners and cancels pending timer work.

Run the Nx `build`, `test`, `typecheck`, and `test:screenshot` targets. Unit tests cover translation and cleanup;
native browser tests cover focusing, viewport panning, and page scrolling.
