# Mouse input

`@8f4e/editor-plugin-mouse-input` translates DOM `mousedown`, `mousemove`, `mouseup`, and `contextmenu` into normalized
`pointerdown`, `pointermove`, `pointerup`, and `contextmenu` events, and wheel input into `viewportscroll`. Core owns
selection, dragging, menus, and viewport effects; this plugin owns browser coordinates, canvas focus, default-action
cancellation, and listener disposal.

```ts
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';

const plugin = createMouseInputPlugin({ inputTarget: canvas, captureWheel: true });
```

The plugin can load after the first render on fine- and coarse-pointer devices. It also forwards browser-generated mouse
events from touch taps. `captureWheel: false` leaves wheel scrolling to the surrounding page. Each captured wheel event
forwards its signed `deltaX` and `deltaY` to pan the viewport independently of block dragging, unless a menu or modal
dialog blocks input. The viewport stays at its last pixel position when scrolling pauses. Disposal removes listeners.

Run the Nx `build`, `test`, `typecheck`, and `test:screenshot` targets. Unit tests cover translation and cleanup;
native browser tests cover focusing, viewport panning while a block is held, and page scrolling.
