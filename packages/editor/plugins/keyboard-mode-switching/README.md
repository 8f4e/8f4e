# Keyboard mode switching plugin

`@8f4e/editor-plugin-keyboard-mode-switching` exports `createKeyboardModeSwitchingPlugin({ inputTarget })`.
The browser host supplies its canvas; the shared plugin context remains browser independent.

Own `e` to enter editing, Escape to return to viewing, and their mode hint, gated by `modeToggling`.
The hint uses `drawers.registerCanvasOverlay` in viewport coordinates. Core renders these overlays after menus and
before dialogs; `canvasOverlays` controls their visibility, including during screenshot capture.

Each installation owns its listener and cleanup. This plugin does not install or depend on another keyboard plugin.
Default and minimal import its factory only for browsers whose primary pointer is not coarse.

Verify with `npx nx run @8f4e/editor-plugin-keyboard-mode-switching:build|test|typecheck`.
