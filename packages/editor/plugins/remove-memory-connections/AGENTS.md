# Remove Memory Connections Plugin

- Own the Remove connections block-menu contribution, `removeConnections` action, and source transformation here.
- Export `removeMemoryConnectionsPlugin` as an `EditorPlugin`.
- Keep the removal algorithm private to this package. Core must not inspect source to decide this action's availability.
- Require an explicit block target and respect edit mode. Apply replacement source through `applyCodeBlockSourceEdits`
  with `affectsCompilation: true` so refreshes precede the completed project and compiler-input notifications.
- Do not publish an edit or schedule compilation when there are no intermodular memory defaults to remove.
- Dispose the action handler and menu registration.
- Run `npx nx run @8f4e/editor-plugin-remove-memory-connections:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-remove-memory-connections:test:browser` for real-editor contribution/action integration without a sibling menu presentation.
