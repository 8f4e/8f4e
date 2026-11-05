# Context-menu presentation

- Own decorated labels, submenu indicators, sizing, snapping/clamping, hover state, hit testing, and drawing here.
- Keep all prepared data private to one installation. Core owns raw items, anchors, navigation, contributions, input
  blocking, and action/selector dispatch. Do not put presentation fields back into core state.
- Listen only to forwarded `contextMenuPointerMove` / `contextMenuPointerDown`; request activation with
  `activateContextMenuItem { index, x, y }` or closure with `closeContextMenu`. Do not handle DOM events or capture probes.
- Draw through generic `registerCanvasDrawer`, below canvas/modal overlays and independent of `canvasOverlays`.
- Refresh on menu, resize, grid, and viewport changes. Do not calculate layout in the frame callback.
- Dispose subscriptions, input listeners, and drawing explicitly. The default and minimal compositions defer this plugin until `ready`.
- Keep feature-plugin tests independent; test presentation here and real combinations in editor composition tests.
- Verify through Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
