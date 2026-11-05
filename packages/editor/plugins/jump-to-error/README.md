# Jump to Error

`@8f4e/editor-plugin-jump-to-error` provides a fixed **Jump to error** button in the bottom-right corner of the canvas.
Create it with `createJumpToErrorPlugin({ getErrorBounds, layer })` and install it through an unconditional deferred registry.
The host passes a plain numeric input layer; `INPUT_LAYERS.canvasOverlay` matches the button's drawer stage.
No browser objects or compiler handles are required.

`getErrorBounds(state, codeBlock, error)` supplies the displayed message's world-space `{ x, y, width, height }`
rectangle, or `undefined` when no message is presented. The host composition owns this dependency: it supplies a
reader from its chosen error presenter. This plugin imports no other feature plugin or presentation geometry.

The button appears while `state.codeErrors` contains an error with a source location in the project tree.
A primary press selects the first such error in contributor/list order, opens its project level if needed, and
centers the supplied rectangle in the viewport. Selecting the block reveals source folded by `@hide`, preserving
editor mode and source. Raw error matching uses core's indexed `createCodeErrorBlockLookup` helper.

The overlay respects `canvasOverlays` and leaves input to open modal dialogs and context menus. It subscribes to
ordinary normalized pointer events in capture with its supplied `layer`. Higher layers run first; handlers in the
same layer run in reverse registration order, so
underlying controls cannot activate. It consumes movement and release for its claimed press to prevent viewport
dragging or release snapping. Clearing the errors hides the button; stale locations are skipped.

Target bookkeeping stays private and refreshes on error or project changes. Each refresh indexes the project tree
once and scans errors in contributor/list order. Rendering reads the cached target.
Disposal removes the drawer, subscriptions, and input handlers; raw errors remain unchanged. Navigation does not
change source, compiler input revisions, project revisions, or history.

Verify with `npx nx run @8f4e/editor-plugin-jump-to-error:build|test|typecheck|test:screenshot`.
The browser suite uses core services and a local supplied-rectangle fixture, without sibling plugins.
