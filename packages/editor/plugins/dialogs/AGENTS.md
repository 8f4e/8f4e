# Dialogs Plugin

- Own dialog sizing, text wrapping/title clipping, button layout and hit testing, hover state, and drawing here.
- Keep derived geometry private to each plugin installation. Editor-state owns `DialogContent`, `DialogState`,
  the stack, add/remove/clear operations, button actions, and modal input blocking.
- Use editor-forwarded `dialogPointerDown`/`dialogPointerMove` events. Request button activation through
  `activateDialogButton` with `{ id, buttonIndex }`; the editor resolves the active button and its close behavior.
  Do not activate buttons during capture-only touch probes or subscribe directly to DOM input.
- Register through `registerModalOverlay`, above ordinary canvas overlays and independent of `canvasOverlays`.
- Read existing dialogs on setup and refresh cached layout after stack changes, resize, and `gridSizeChanged`.
  Keep layout calculation out of the frame path. Dispose all subscriptions, input listeners, and the drawer.
- Both compositions import `dialogsPlugin` unconditionally through their deferred registries after core's `ready` event.
- Verify with `npx nx run @8f4e/editor-plugin-dialogs:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-dialogs:test:screenshot` for desktop/portrait rendering.
