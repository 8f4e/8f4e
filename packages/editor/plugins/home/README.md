# Home

`@8f4e/editor-plugin-home` supports `; @home [center|left|right|top|bottom]` and the **Go @home** action.
Install `homePlugin` before the initial project loads. It has no browser, renderer or other plugin dependencies.

On the first visit to a project level, the plugin contributes a position centered or aligned on the first block
with a valid home directive, using settled block geometry. A remembered viewport takes precedence. If no valid
directive exists, the default position is the origin. When a block contains multiple valid home directives, the
last valid one supplies its alignment.

Each project level may declare one home. Every additional `@home` declaration in that level receives a
source-located error in `state.codeErrors.home`, including repeated declarations within one block. Diagnostics
follow block creation order so raising blocks does not move errors between declarations. These errors update with
project changes and do not change which block or alignment is used for navigation.

The Go @home main menu item appears in edit mode. Activating it selects the first home block and navigates to it,
or navigates to the origin without changing the selection when no home block exists. It leaves project source and
history unchanged. Disposal unregisters the menu contribution and navigation handlers and removes the plugin's errors.

Verify with `npx nx run @8f4e/editor-plugin-home:build|test|typecheck`.
