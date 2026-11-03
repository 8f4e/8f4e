# Keyboard editing plugin

`@8f4e/editor-plugin-keyboard-editing` exports `createKeyboardEditingPlugin({ inputTarget })`.
The browser host supplies its canvas; the shared plugin context remains browser independent.

Own typing, Tab, newline, backspace, and edit-only undo/redo shortcuts. The entry point buffers keyboard input while its mode-triggered implementation import is pending.

Each installation owns its listener and cleanup. This plugin does not install or depend on another keyboard plugin.
Default and minimal import its factory only for browsers whose primary pointer is not coarse.

Verify with `npx nx run @8f4e/editor-plugin-keyboard-editing:build|test|typecheck`.

The input bridge listens during capture. While the editing module loads, it queues keydown events and stops their
propagation. It replays fresh events through the input target after loading, so navigation and mode switching keep
working in the original order without dependencies on their implementations. External mode exit, project replacement,
and disposal discard pending inputs. Once loaded, the implementation stays available until disposal and checks edit
mode before processing keys. Core history remains available to programmatic editing independently of keyboard input.
