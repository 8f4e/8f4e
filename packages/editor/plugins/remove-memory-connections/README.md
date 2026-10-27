# Remove Memory Connections Plugin

`@8f4e/editor-plugin-remove-memory-connections` owns the Remove connections block-menu item, its enabled state, and
the source edit. It is included in `@8f4e/editor-default`; custom hosts can install it through the core plugin list:

```ts
import { removeMemoryConnectionsPlugin } from '@8f4e/editor-plugin-remove-memory-connections';

initEditor(canvas, { ...options, plugins: [removeMemoryConnectionsPlugin] });
```

In edit mode, the action removes intermodular default values from scalar and array memory declarations in the
clicked block. It retains local defaults, array sizes, comments, and unrelated instructions. The action is disabled
when there is nothing to remove. The plugin publishes changed source, updates session persistence, and advances
the compiler input revision once. Repeating removal without a source change does nothing.

The action receives an explicit `{ codeBlock }` payload. The transformation and its syntax inspection stay private
to the plugin, using the language specification and tokenizer APIs. Incomplete lines are left alone so other
declarations can still be disconnected while editing. Disposal unregisters the menu and action handler.
