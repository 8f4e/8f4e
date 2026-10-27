# Keyboard-to-Memory Input Plugin

- Own keyboard target configuration, HID mapping, held-key tracking, DOM listeners, and memory writes here.
- Receive `inputTarget` through `createKeyboardMemoryPlugin`; keep browser resources out of shared plugin context.
- Resolve current target memory with the public memory helper. Keep ordinary editing/navigation keyboard events in core.
- Remove listeners, clear held keys, and unregister the owned schema on disposal.
- Verify with `npx nx run @8f4e/editor-plugin-keyboard-memory:build|test|typecheck`.
