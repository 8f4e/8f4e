# Favorites Plugin

- Own `@favorite` detection, Favorite/Unfavorite editing, the Jump to submenu, and its navigation action here.
- Export `favoritesPlugin` as an `EditorPlugin`; editor-default installs it eagerly, and editor-minimal omits it.
- Read cached `parsedDirectives` directly. Keep favorite state private; do not add flags or a metadata model to core.
- Use the generic `jumpToCodeBlock` helper for selection and viewport movement in the current project level.
- Preserve the generated env block's default favorite through the owned `envConstantContributions.favorites` source.
- Favorite edits use `applyCodeBlockSourceEdits` with `affectsCompilation: false`. Build replacement source without
  mutating the live array; the helper refreshes the block and publishes the completed metadata edit.
- Respect edit mode for toggling; navigation remains available in view mode. Dispose menus, listeners, and source contributions.
- Run `npx nx run @8f4e/editor-plugin-favorites:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-favorites:test:screenshot` after changes.
