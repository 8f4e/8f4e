# Touch viewport navigation

`@8f4e/editor-plugin-touch-viewport-navigation` pans the viewport with one finger. A 6-pixel movement threshold keeps
taps available for existing controls. Panning follows the finger and snaps to the editor grid when the gesture ends
or is cancelled. A second finger ends the gesture; movement resumes only after a new single-finger touch starts.

```ts
import { createTouchViewportNavigationPlugin } from '@8f4e/editor-plugin-touch-viewport-navigation';

const plugin = createTouchViewportNavigationPlugin({ inputTarget: canvas });
```

Both default and minimal compositions import this plugin after their first render, only when `(pointer: coarse)`
matches. The plugin itself has no capability checks. It uses the existing generic viewport helpers, without
synthesizing mouse drags or modifying source, block positions, history, or project revisions.

While viewport dragging is enabled it sets the canvas's `touch-action` to `none`; disabling dragging or disposing the
plugin restores the original value. Completed drags cancel `touchend` so they do not click a control. Taps are left to
the browser and the separate mouse-input plugin. Project replacement clears any active gesture. The touch-event target
continues receiving a gesture after the finger leaves its bounds, as specified by [Touch Events](https://www.w3.org/TR/touch-events/#the-touchmove-event).

Run the Nx `build`, `test`, `typecheck`, and `test:screenshot` targets. Unit tests cover gesture state and cleanup;
native browser tests cover dragging and mouse-compatible taps. Combined plugin behavior is tested in editor-default.
