# Keyboard-to-Memory Input Plugin

`@8f4e/editor-plugin-keyboard-memory` exports `createKeyboardMemoryPlugin({ inputTarget })`. The browser host supplies
the editor's canvas as the input target; the returned plugin uses the regular browser-independent setup context.

The plugin contributes these configuration paths:

```text
; @config keyboard.keyCodeMemory keys:code
; @config keyboard.keyPressedMemory keys:pressed
```

Key presses write USB HID usages, rather than character codes, to `keyCodeMemory`. `keyPressedMemory` is `1` while
a key is held and `0` after the last key is released. Releasing the latest key restores the most recently pressed
key that remains held. Unmapped keys use usage `0`. Blur and disposal clear the pressed state.

Targets are resolved through the public memory resolver on each write, including exposed project-memory aliases.
Held-key tracking is private to each installation. The plugin owns its configuration schema and listeners; the core
still handles keyboard input for normal editing and navigation.

Verify with `npx nx run @8f4e/editor-plugin-keyboard-memory:build|test|typecheck`.
