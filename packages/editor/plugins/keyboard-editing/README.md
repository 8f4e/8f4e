# Keyboard editing plugin

`@8f4e/editor-plugin-keyboard-editing` exports `createKeyboardEditingPlugin({ inputTarget })`.
The browser host supplies its canvas; the shared plugin context remains browser independent.

Own edit-mode caret movement and drawing, typing, Tab, newline, backspace, and edit-only undo/redo shortcuts. The entry point buffers keyboard input while its mode-triggered implementation import is pending.

Each installation owns its listener and cleanup. This plugin does not install or depend on another keyboard plugin.
Default and minimal import its factory only for browsers whose primary pointer is not coarse.

Verify with `npx nx run @8f4e/editor-plugin-keyboard-editing:build|test|typecheck`.

The input bridge listens during capture. While the editing module loads, it queues keydown, keyup, and blur events and stops their
propagation. It replays fresh events through the input target after loading, so navigation and mode switching keep
working in the original order without dependencies on their implementations. External mode exit, project replacement,
and disposal discard pending presses while still delivering queued releases and blur events. Once loaded, the implementation stays available until disposal and checks edit
mode before processing keys. Core history remains available to programmatic editing independently of keyboard input.

The loaded implementation handles all unmodified arrow keys, preserving visual columns across tabs on vertical
movement. Mutations calculate their resulting caret position directly. Shared source positions and tab geometry
remain core services. The caret draws through `registerCodeBlockDrawer`, with layering determined by registration
order. Both compositions install code rendering before the input plugins. The input bridge owns this registration
and removes it on disposal; it draws only
once the implementation has loaded and only for the selected block in edit mode.

The loaded implementation handles native `paste` events using `clipboardData` plain text. `insertText` splices single- or multiline text at the caret, preserving the current line prefix/suffix and placing the caret at the inserted text's end. Paste submits one source-edit batch, using the same history and compiler notifications as typing. Paste events are not buffered during loading.
