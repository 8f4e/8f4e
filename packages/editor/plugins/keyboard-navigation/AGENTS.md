# Keyboard navigation

- Own Up/Down line selection in view mode and Cmd/Ctrl+Arrow block navigation in both modes. Use core source-position bounds; edit-mode caret behavior belongs to keyboard-editing.
- Browser dependencies enter through the factory. Own listeners and disposal explicitly.
- Keep this plugin independent of other keyboard plugins; use core services and local fixtures in tests.
- Keep pointer-capability checks and device policy in compositions.
- Run the build, test, and typecheck Nx targets for this package.
