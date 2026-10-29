# Toggle Favorite Plugin

- Own the Favorite/Unfavorite block-menu contribution and `toggleFavoriteDirective` action here.
- Export `toggleFavoritePlugin` as an `EditorPlugin`; editor-default installs it in the standard set.
- Keep generic directive parsing, favorite derivation, and favorite navigation in editor-state. Use public helpers.
- Favorite changes use `applyCodeBlockSourceEdits` with `affectsCompilation: false`. Build replacement source without
  mutating the live array; the helper refreshes the block and publishes the completed metadata edit.
- Require an explicit block target and respect edit mode. Dispose the action handler and menu registration.
- Run `npx nx run @8f4e/editor-plugin-toggle-favorite:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-toggle-favorite:test:screenshot` for the real-canvas menu test.
