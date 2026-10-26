# Tooltips Plugin

- Own selected-line documentation, stack analysis, live values, layout, animation, and overlay drawing here.
- Keep rendering in `src/drawer/`, synchronization and layout in `src/state/`, and content-building utilities in
  `src/helpers/`. Keep shared types and plugin setup at the source root, with tests beside their implementations.
- Export an `EditorPlugin` without installing it as an import side effect. Editor-default selects the standard plugins.
- Keep tooltip state inside setup, scoped to one editor instance, and use public workspace APIs.
- Register drawing through `drawers.registerCodeBlockOverlay` so tooltips appear above built-in block widgets.
- Return a disposer that removes every store subscription, event listener, and drawer registration.
- Keep generic parsing, memory resolution, and compiler metadata in core. Theme contribution remains deferred.
- Run `npx nx run @8f4e/editor-plugin-tooltips:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-tooltips:test:screenshot` for browser rendering tests.
- Cover content, compiler updates, selection changes, atlas reloads, drawing, cleanup, and instance isolation.
