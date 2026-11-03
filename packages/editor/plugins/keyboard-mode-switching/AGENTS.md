# Keyboard mode switching

- Own `e` to enter editing and Escape to return to viewing, gated by `modeToggling`.
- Browser dependencies enter through the factory. Own listeners and disposal explicitly.
- Keep this plugin independent of other keyboard plugins; use core services and local fixtures in tests.
- Both hosts omit this plugin on coarse-pointer browsers. Keep device policy in compositions.
- Run the build, test, and typecheck Nx targets for this package.
