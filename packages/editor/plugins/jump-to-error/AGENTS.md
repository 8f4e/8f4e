# Jump to error

- Own the fixed button, target selection, pointer ownership, and navigation here. Keep raw errors in `state.codeErrors`.
- Consume every contributor uniformly. Use error-messages' public matching and world-bounds queries; do not duplicate wrapping or gap placement.
- Load as an unconditional deferred plugin. The plugin needs no browser objects or compiler handles.
- Use `canvasOverlayPointerDown` for presses before block controls. Consume the claimed move/release; respect modal/menu input priority and `canvasOverlays`.
- Keep target lookup out of the frame path. Own subscriptions, input handlers, and drawer disposal explicitly.
- Test against core services only; combined error presentation and browser input belong in composition tests.
- Verify with the package's Nx `build`, `test`, and `typecheck` targets.
