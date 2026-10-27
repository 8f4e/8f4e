# Toggle Favorite Plugin

- Own the Favorite/Unfavorite block-menu contribution and `toggleFavoriteDirective` action here.
- Export `toggleFavoritePlugin` as an `EditorPlugin`; editor-default installs it in the standard set.
- Keep generic directive parsing, favorite derivation, and favorite navigation in editor-state. Use public helpers.
- Favorite changes are editor metadata: publish the source edit without advancing the compiler revision.
- Require an explicit block target and respect edit mode. Dispose the action handler and menu registration.
- Run `npx nx run @8f4e/editor-plugin-toggle-favorite:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-toggle-favorite:test:screenshot` for the real-canvas menu test.
