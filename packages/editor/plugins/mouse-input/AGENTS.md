# Mouse input

- Own DOM mouse/wheel adaptation and its wheel-end timer here. Receive the target and wheel-capture preference through the factory.
- Forward the existing core input events. Keep selection, block dragging, menus, viewport state, and snapping in editor-state.
- All three compositions load this plugin after `ready` on all devices, including coarse-pointer browsers for touch-compatible taps.
- Keep `captureWheel` out of editor-core. Honor `viewportDragging` without retaining listeners or timers after disposal.
- Test native browser translation here; other feature plugins should dispatch core input events without installing this plugin.
- Run `npx nx run @8f4e/editor-plugin-mouse-input:build|test|typecheck|test:screenshot`.
