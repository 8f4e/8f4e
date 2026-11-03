# Keyboard navigation plugin

`@8f4e/editor-plugin-keyboard-navigation` exports `createKeyboardNavigationPlugin({ inputTarget })`.
The browser host supplies its canvas; the shared plugin context remains browser independent.

Own line selection in view mode, caret movement in edit mode, and Cmd/Ctrl+Arrow block navigation. Use the shared core tab/caret geometry.

Each installation owns its listener and cleanup. This plugin does not install or depend on another keyboard plugin.
Default and minimal import its factory only for browsers whose primary pointer is not coarse.

Verify with `npx nx run @8f4e/editor-plugin-keyboard-navigation:build|test|typecheck`.
