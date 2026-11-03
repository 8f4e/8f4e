# Keyboard navigation

- Own line selection in view mode, caret movement in edit mode, and Cmd/Ctrl+Arrow block navigation. Use the shared core tab/caret geometry.
- Browser dependencies enter through the factory. Own listeners and disposal explicitly.
- Keep this plugin independent of other keyboard plugins; use core services and local fixtures in tests.
- Both hosts omit this plugin on coarse-pointer browsers. Keep device policy in compositions.
- Run the build, test, and typecheck Nx targets for this package.
