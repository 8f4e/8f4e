# Keyboard mode switching

- Own `e` to enter editing, Escape to return to viewing, and their mode hint, gated by `modeToggling`.
- Register the hint with `drawers.registerCanvasOverlay` and unregister it explicitly. Core owns generic overlay visibility.
- Browser dependencies enter through the factory. Own listeners and disposal explicitly.
- Keep this plugin independent of other keyboard plugins; use core services and local fixtures in tests.
- Both hosts omit this plugin on coarse-pointer browsers. Keep device policy in compositions.
- Run the build, test, and typecheck Nx targets for this package.
