# Home

`@8f4e/editor-plugin-home` supports `; @home [center|left|right|top|bottom]` and the **Go @home** action.
Install `homePlugin` before the initial project loads. It has no browser, renderer or other plugin dependencies.

On the first visit to a project level, the plugin contributes a position centered or aligned on the first block
with a valid home directive, using settled block geometry. A remembered viewport takes precedence. If no valid
directive exists, the default position is the origin. When a block contains multiple valid home directives, the
last valid one supplies its alignment.

The Go @home main menu item appears in edit mode. Activating it selects the first home block and navigates to it,
or navigates to the origin without changing the selection when no home block exists. It leaves project source and
history unchanged. Disposal unregisters the menu contribution and both navigation handlers.

Verify with `npx nx run @8f4e/editor-plugin-home:build|test|typecheck`.
