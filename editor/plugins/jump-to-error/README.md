# Jump to Error

`@8f4e/editor-plugin-jump-to-error` provides a fixed **Jump to error** button in the bottom-right corner of the canvas.
Create it with `createJumpToErrorPlugin({ layer })` and install it through an unconditional deferred registry.
The host passes a plain numeric input layer; `INPUT_LAYERS.canvasOverlay` matches the button's drawer stage.
No browser objects, compiler handles, or error-presenter callbacks are required.

The button appears while `state.codeErrors` contains an error with a source location in the project tree.
A primary press selects the first such error in contributor/list order and opens its project level if needed.
Selection reveals source folded by `@hide`, preserving editor mode and source. Navigation centers the block
horizontally and the error's source row vertically, using core's source-to-display mapping, preceding layout gaps,
and current grid size. It works independently of inline error-message presentation.

The overlay respects `canvasOverlays` and leaves input to open modal dialogs and context menus. It subscribes to
normalized pointer events in capture with its supplied `layer`. Higher layers run first; handlers in the same layer
run in reverse registration order. Claimed movement and release are consumed to prevent viewport dragging or
release snapping. Clearing the errors hides the button; stale locations are skipped.

Target bookkeeping stays private and refreshes on error or project changes. Each refresh indexes the project tree
once and scans errors in contributor/list order. Rendering reads the cached target. Disposal removes the drawer,
subscriptions, and input handlers; raw errors remain unchanged. Navigation does not change source, compiler input
revisions, project revisions, or history.

Verify with `npx nx run @8f4e/editor-plugin-jump-to-error:build|test|typecheck|test:screenshot`.
The browser suite uses core services and local plain-source fixtures without sibling plugins.
