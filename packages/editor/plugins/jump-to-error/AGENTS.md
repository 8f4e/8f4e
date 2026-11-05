# Jump to error

- Own the fixed button, target selection, pointer ownership, and navigation here. Keep raw errors in `state.codeErrors`.
- Use core's raw-error matching and a required `getErrorBounds` factory dependency; never import another feature plugin or derive message presentation geometry.
- The host composition wires the bounds reader. Load the plugin as an unconditional deferred entry.
- Subscribe to normalized pointer events in capture with priority 1. Own visibility/modal/menu guards and claimed move/release/cancel handling. Keep pointer routing feature-neutral.
- Keep target lookup out of the frame path. Own subscriptions, input handlers, and drawer disposal explicitly.
- Feature tests live here and use core services with a local supplied-rectangle fixture. Real combinations belong in composition tests.
- Verify with the package's Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
