# Keyboard editing

- Own edit-mode caret movement and drawing, typing, Tab, newline, backspace, and edit-only undo/redo shortcuts. The entry point buffers keyboard input while its mode-triggered implementation import is pending.
- Browser dependencies enter through the factory. Own listeners and disposal explicitly.
- Keep this plugin independent of other keyboard plugins; use core services and local fixtures in tests.
- All three compositions omit this plugin on coarse-pointer browsers. Keep device policy in compositions.
- Run the build, test, and typecheck Nx targets for this package.

- Keep caret direction policy and mutation caret adjustments private to this plugin. Use core tab/source geometry.
- Register its caret with `registerCodeBlockDrawer`; the lazy bridge forwards drawing only after the
  implementation loads. Remove the registration explicitly on disposal. Keep generic source positions in core.
- Prepare the caret's horizontal drawing position privately after lazy loading and on `codeBlockLayoutsChanged`,
  using shared tab/source geometry; core retains shared vertical geometry. Drawing only consumes prepared
  coordinates. Own and remove the layout listener on disposal.

- Handle native `paste` events only through the loaded editing implementation. Insert plain text with `insertText`, preserving multiline content and moving the caret to the insertion end. Apply one source batch. Never queue pasted text or add special loading-race handling.
