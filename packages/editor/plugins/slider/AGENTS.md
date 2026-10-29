# Slider Plugin

- Own `@slider` arguments, memory resolution, layout, pointer dragging, drawing, and saving values to source here.
- Keep layout and interaction in `src/state/`, drawing in `src/drawer/`, and argument and serialization helpers in
  `src/helpers/`. Keep tests beside their implementations.
- Export an `EditorPlugin` without installation as an import side effect. Editor-default selects the standard plugins.
- Keep slider data in a per-instance `slidersByBlock` WeakMap; do not attach it to core state.
- Use owned layout contributions, `layout.subscribe`, and public memory APIs. Generic parsing and declaration
  editing remain in core.
- Consume active drags with a capture listener so viewport panning and block dragging do not run for slider moves.
- Own every layout, drawer, menu, and event registration. Return an explicit disposer.
- Save default-value edits through `applyCodeBlockSourceEdits` with `affectsCompilation: true`, including edits to
  multiple backing owners in one operation. Do not publish a second project or compiler change.
- Select shared base-palette shades; do not add feature-specific configurable colors.
- Run `npx nx run @8f4e/editor-plugin-slider:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-slider:test:screenshot` for browser rendering tests.
- Cover actual pointer events, live memory, ranges and steps, aliases, source edits, saving, cleanup, and isolation.

- Receive a required `writeMemory(address, value, isInteger)` through the plugin factory. Do not route writes through editor state. The injected writer must use the current memory after recompilation or growth.

- Keep layout independent of directive registration. Read source through `parseEditorDirectives`; own contribution
  updates and `layout.subscribe` geometry. Unsubscribe before disposing requests. Do not attach layout to directive drafts.
