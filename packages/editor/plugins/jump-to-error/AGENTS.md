# Jump to error

- Own the fixed button, target selection, pointer ownership, and navigation here. Keep raw errors in `state.codeErrors`.
- Use core's indexed raw-error matching and shared source/display geometry. Center the block horizontally and the error's source row vertically, accounting for preceding gaps.
- The host composition passes a plain numeric input layer. Navigation is independent of message presentation. Load the plugin as an unconditional deferred entry.
- Subscribe to normalized pointer events in capture using the injected layer; newer handlers in that layer run first. Own visibility/modal/menu guards and claimed move/release/cancel handling. Keep pointer routing feature-neutral.
- Keep target lookup out of the frame path. Own subscriptions, input handlers, and drawer disposal explicitly.
- Feature tests live here and use core services with a local plain-source fixture. Real combinations belong in composition tests.
- Verify with the package's Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
