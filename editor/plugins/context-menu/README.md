# Context-menu presentation

`contextMenuPlugin` owns menu label decoration, submenu indicators, grid snapping, viewport clamping, row geometry,
hover state, hit testing, and drawing. Raw menu items and requested world anchors remain in core, together with
contributions, menu navigation, input blocking, and action/selector dispatch.

The plugin uses core-forwarded `contextMenuPointerMove` and `contextMenuPointerDown` events. It requests raw item
activation through `activateContextMenuItem { index, x, y }`, or closure through `closeContextMenu`. A press is
hit-tested directly, including taps without a preceding pointer move. Geometry and labels remain private to each
installation and refresh on menu, grid, viewport, and resize changes, outside the frame loop.

Drawing uses `registerContextMenuOverlay`, above editor overlays and below modal dialogs. Menus remain
visible when `canvasOverlays` is false. The plugin can load through an unconditional
deferred entry after `ready`; the plugin needs no browser globals or injected browser resources.

Test menu presentation here without sibling plugins. Feature plugins test their own menu contributions and request
activation through core's raw-item event. Real menu pointer interactions belong in this package or composition tests.
Run this package's Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
