# Keyboard editing

- Own typing, Tab, newline, backspace, and edit-only undo/redo shortcuts. The entry point buffers keyboard input while its mode-triggered implementation import is pending.
- Browser dependencies enter through the factory. Own listeners and disposal explicitly.
- Keep this plugin independent of other keyboard plugins; use core services and local fixtures in tests.
- Both hosts omit this plugin on coarse-pointer browsers. Keep device policy in compositions.
- Run the build, test, and typecheck Nx targets for this package.
