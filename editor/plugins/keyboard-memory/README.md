# Keyboard-to-Memory Input Plugin

`@8f4e/editor-plugin-keyboard-memory` exports `createKeyboardMemoryPlugin({ inputTarget, writeMemory })`. The browser host supplies
the editor's canvas as the input target; the returned plugin uses the regular browser-independent setup context.

The plugin contributes these configuration paths:

```text
; @config keyboard.keyCodeMemory keys:code
; @config keyboard.keyPressedMemory keys:pressed
```

For lazy installation, match raw `@config keyboard.*` directives with project scope, including unopened groups
and configuration added during editing. Leave the plugin unloaded when keyboard configuration is absent to avoid
installing unused schema contributions and input listeners. Once loaded, it stays installed until the editor is
disposed, following the shared lazy-loader lifecycle.

Key presses write USB HID usages, rather than character codes, to `keyCodeMemory`. `keyPressedMemory` is `1` while
a key is held and `0` after the last key is released. Releasing the latest key restores the most recently pressed
key that remains held. Unmapped keys use usage `0`. Blur and disposal clear the pressed state.

Targets are resolved through the public memory resolver on each write, including exposed project-memory aliases.
Held-key tracking is private to each installation. The plugin owns its configuration schema and listeners; the separate keyboard-editing, keyboard-navigation, and keyboard-mode-switching plugins handle ordinary editor keys.

Verify with `npx nx run @8f4e/editor-plugin-keyboard-memory:build|test|typecheck`.

The host injects `writeMemory(address, value, isInteger)` directly. The writer must follow current compiler memory after replacement or growth.
