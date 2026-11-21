# Keyboard navigation plugin

`@8f4e/editor-plugin-keyboard-navigation` exports `createKeyboardNavigationPlugin({ inputTarget })`.
The browser host supplies its canvas; the shared plugin context remains browser independent.

The plugin handles Up/Down line selection in view mode and Cmd/Ctrl+Arrow block navigation in both modes. Like pointer
selection, navigating to a different block brings it to the front of its stacking layer without overriding
`@alwaysOnTop`. Navigation uses core source-position bounds; edit-mode caret behavior belongs to keyboard editing.

Each installation owns its listener and cleanup. This plugin does not install or depend on another keyboard plugin.

Verify with `npx nx run @8f4e/editor-plugin-keyboard-navigation:build|test|typecheck`.
