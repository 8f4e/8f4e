# Keyboard mode switching

- Own `e` to enter editing, Escape to return to viewing, and their mode hint. Installing this plugin enables its bindings and hint.
- Register the hint with `drawers.registerCanvasOverlay` and unregister it explicitly. Core owns generic overlay visibility.
- Browser dependencies enter through the factory. Own listeners and disposal explicitly.
- Keep this plugin independent of other keyboard plugins; use core services and local fixtures in tests.
- Keep pointer-capability checks and device policy in compositions.
- Run the build, test, and typecheck Nx targets for this package.

- Presence controls availability. Keep enable flags out of core and out of this plugin; browser compositions decide whether to import/install it.
