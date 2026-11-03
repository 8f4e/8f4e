# Touch viewport navigation

- Own single-finger gesture state, its tap threshold, native default-action handling, and canvas touch-action cleanup here.
- Receive the target through the factory; keep capability detection in each composition's deferred registry.
- Use core's generic viewport helpers. Add no touch fields, browser events, or gesture state to editor-state.
- Keep taps available for controls. Do not synthesize mouse input or depend on the mouse-input plugin.
- Respect viewportDragging, clear gestures on project replacement, and stop pending viewport animations when touching.
- Test native touch and tap behavior here without installing sibling plugins; combined behavior belongs to editor-default.
- Run `npx nx run @8f4e/editor-plugin-touch-viewport-navigation:build|test|typecheck|test:screenshot`.
