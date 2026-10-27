# Piano Plugin

- Own `@piano` arguments, keyboard layout, runtime note toggling, drawing, and saving notes to source here.
- Keep directive and interaction code in `src/state/`, drawing in `src/drawer/`, and argument and serialization helpers
  in `src/helpers/`. Keep tests beside their implementations.
- Export an `EditorPlugin` without installation as an import side effect. Editor-default selects the standard plugins.
- Keep keyboard data in a per-instance `keyboardsByBlock` WeakMap. Do not attach piano models to core state.
- Use `addVerticalSpaceAfterSourceLine` and `onBlockLayoutReady` for layout, and public memory APIs for resolution and
  generic declaration edits. Keep syntax parsing and source ownership routing in core.
- Own the save menu action and every directive, drawer, and event registration; return an explicit disposer.
- Use the shared palette catalog for fills and text; keep shade choices local to this plugin.
- Run `npx nx run @8f4e/editor-plugin-piano:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-piano:test:screenshot` for browser rendering tests.
- Cover real pointer events, runtime memory, exposed addresses, saving, source edits, cleanup, and editor isolation.
