# Favorites Plugin

`@8f4e/editor-plugin-favorites` owns `@favorite` detection, Favorite/Unfavorite block editing, and the Jump to navigation
menu. The default editor installs it eagerly so blocks can be favorited before any directive exists. The minimal
editor omits it.

```ts
import { favoritesPlugin } from '@8f4e/editor-plugin-favorites';

initEditor(canvas, { ...options, plugins: [favoritesPlugin] });
```

In edit mode, the block-menu action adds `; @favorite` after the block opener or removes the existing directive while
retaining other source and directives. These metadata edits participate in project revisions, undo, and session
persistence without scheduling compilation.

The background menu's **Jump to...** submenu lists favorites in the current project level, ordered by creation index
and labeled with block type and name. Navigation works in edit and view modes through core's generic block-jump helper.
Favorites are read directly from cached parsed directives; no favorite flag or separate state model is stored in core.
The plugin also contributes `; @favorite` to the generated environment source, keeping the env block in that menu.

Disposal removes both menu contributions, the submenu, action listeners, and the environment-source contribution.
Without the plugin, source directives are retained but provide no favorite menus or navigation.
