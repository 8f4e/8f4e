# Jump to Error

`@8f4e/editor-plugin-jump-to-error` provides a fixed **Jump to error** button in the bottom-right corner of the canvas.
Install `jumpToErrorPlugin` through an unconditional deferred registry alongside `errorMessagesPlugin`.
No browser objects or compiler handles are required.

The button appears while `state.codeErrors` contains an error with a source location in the project tree.
A primary press selects the first such error in contributor/list order, opens its project level if needed, and
centers its inline message rectangle in the viewport. It uses `getErrorMessageBounds` from the error-messages plugin,
including wrapping, stacked messages, other layout reservations, and the current font grid. Selecting the block reveals
source folded by `@hide`, preserving editor mode and source.

The overlay respects `canvasOverlays`. Modal dialogs and context menus take input priority. The button claims
`canvasOverlayPointerDown` before block hit testing, so underlying controls cannot activate. It consumes movement
and release for its claimed press to prevent viewport dragging or release snapping. Mouse and touch input plugins
forward the same core events. Clearing the errors hides the button; stale locations are skipped.

Error/target bookkeeping stays private and refreshes on error or project changes. Rendering only reads the cached
target. Disposal removes the drawer, subscriptions, and input handlers; error contributions remain unchanged.
Navigation does not change source, compiler input revisions, project revisions, or history.

Verify with `npx nx run @8f4e/editor-plugin-jump-to-error:build|test|typecheck`.
Real input, compiler diagnostics, and combined rendering are covered by editor-default's `test:screenshot` target.
