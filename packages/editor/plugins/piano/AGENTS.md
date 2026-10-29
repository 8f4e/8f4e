# Piano Plugin

- Own `@piano` arguments, keyboard layout, runtime note toggling, drawing, and saving notes to source here.
- Keep directive and interaction code in `src/state/`, drawing in `src/drawer/`, and argument and serialization helpers
  in `src/helpers/`. Keep tests beside their implementations.
- Export an `EditorPlugin` without installation as an import side effect. Editor-default selects the standard plugins.
- Keep keyboard data in a per-instance `keyboardsByBlock` WeakMap. Do not attach piano models to core state.
- Use owned layout contributions and `layout.subscribe`, with public memory APIs for resolution and
  generic declaration edits. Keep syntax parsing and source ownership routing in core.
- Own the save menu action and every layout, drawer, and event registration; return an explicit disposer.
- Save default-value edits through `applyCodeBlockSourceEdits` with `affectsCompilation: true`, including edits to
  multiple backing owners in one operation. Do not publish a second project or compiler change.
- Use the shared palette catalog for fills and text; keep shade choices local to this plugin.
- Run `npx nx run @8f4e/editor-plugin-piano:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-piano:test:screenshot` for browser rendering tests.
- Cover real pointer events, runtime memory, exposed addresses, saving, source edits, cleanup, and editor isolation.

- Receive a required `writeMemory(address, value, isInteger)` through the plugin factory. Do not route writes through editor state. The injected writer must use the current memory after recompilation or growth.

- Keep layout independent of directive registration. Match cached `codeBlock.parsedDirectives` through `matchEditorDirectives`; own contribution
  updates and `layout.subscribe` geometry. Unsubscribe before disposing requests. Do not attach layout to directive drafts.
