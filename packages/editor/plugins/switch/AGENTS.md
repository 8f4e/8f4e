# Switch Plugin

- Own the switch directive's arguments, memory resolution, click behavior, and drawer here.
- Keep generic directive parsing and layout in editor-state. Register the switch handler through `directives.register`.
- Export an `EditorPlugin` without installing it as an import side effect. Editor-default selects the standard plugins.
- Keep switch widget data inside setup, scoped to one editor instance. Use public workspace APIs.
- Derive widget geometry through `onBlockLayoutReady` and share it between the drawer and click hit-testing.
- Own the widget type and drawing implementation here; do not share feature-specific types or drawers with core.
- Return a disposer that unregisters the directive, drawer, and pointer-down listener; the host does not track them.
- Run `npx nx run @8f4e/editor-plugin-switch:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-switch:test:screenshot` for its browser rendering test.
- Cover actual state derivation, memory toggling, drawing, source updates, cleanup, and instance isolation.

- Receive a required `writeMemory(address, value, isInteger)` through the plugin factory. Do not route writes through editor state. The injected writer must use the current memory after recompilation or growth.
