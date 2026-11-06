# Keyboard mode switching plugin

`@8f4e/editor-plugin-keyboard-mode-switching` exports `createKeyboardModeSwitchingPlugin({ inputTarget })`.
The browser host supplies its canvas; the shared plugin context remains browser independent.

Own `e` to enter editing, Escape to return to viewing, and their mode hint. Installing this plugin enables its bindings and hint.
The hint uses `drawers.registerCanvasOverlay` in viewport coordinates. Core renders these overlays after menus and
before dialogs; `canvasOverlays` controls their visibility, including during screenshot capture.

Omit the plugin to disable its bindings and hint. There is no mode-switching
feature flag in core or a runtime enable switch inside this plugin.

Each installation owns its listener and cleanup. This plugin does not install or depend on another keyboard plugin.
Default and gallery import its factory only for browsers whose primary pointer is not coarse.

Verify with `npx nx run @8f4e/editor-plugin-keyboard-mode-switching:build|test|typecheck`.
