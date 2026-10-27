# Toggle Favorite Plugin

`@8f4e/editor-plugin-toggle-favorite` owns the Favorite/Unfavorite block-menu item and its action. It is included in
`@8f4e/editor-default`; custom hosts can install it through the core plugin list:

```ts
import { toggleFavoritePlugin } from '@8f4e/editor-plugin-toggle-favorite';

initEditor(canvas, { ...options, plugins: [toggleFavoritePlugin] });
```

In edit mode, the action adds `; @favorite` after the block opener or removes the existing directive while retaining
other directives on the same line. The menu targets the clicked block. The source update refreshes derived state
and session persistence without scheduling compilation, since favorites are editor metadata.

The `@favorite` directive and the Jump to submenu remain core features and work without this editing plugin.
The plugin uses the public `removeDirective` helper and canonical project opener recognition. It owns no browser
resources or drawing data, and unregisters its action and menu item when disposed.
