# Landing Editor Package Guidelines

- Own the independent composition for product landing-page demos. Build directly on editor-core using the same
  compiler, URL loading, standard-library resolution, live editing, controls, and runtimes as editor-minimal.
- Omit `entry-outlines`, `offscreen-block-arrows`, and `context-menu` from imports, plugin registries, and dependencies.
  Keep core's `contextMenu` feature disabled even when hosts override other feature flags, so no invisible menu opens.
- Omit `project-save`, `code-block-copy-paste`, and `editor-file-session` from the composition and dependencies.
  Plain-text paste at the caret belongs to keyboard editing; the landing composition does not intercept Cmd/Ctrl+S.
- Keep compiler coordination, URL loading, block backgrounds, code rendering, and loading indicators eager.
  Install block backgrounds before code rendering. Gate every optional import on core's `ready` event through
  `src/deferred-plugins.ts`; add no frame callbacks, visibility gates, or timers. Keep font payloads lazy.
- Install `loadingIndicatorsPlugin` eagerly before the deferred loader. It draws the unified
  `state.loadingIndicators` list and expires finished results after five seconds; producers own terminal outcomes.
- Keep optional plugins as individual deferred entries. Load mouse input on all devices, touch input on coarse
  pointers, and keyboard navigation/editing/mode switching on non-coarse pointers. Forward host wheel, touch,
  and mode-switching preferences without implementing input behavior in the composition.
- Keep directive-based loading in `src/lazy-plugins.ts`, with visual/control plugins scoped to the view and
  runtime/MIDI/asset plugins scoped to the project. Pass live compiler handles into dependent factories.
- Load keyboard-memory only for raw `@config keyboard.*` directives, with project scope. Supply the canvas and live
  compiler memory writer; projects without keyboard configuration must not import it or install its listeners/schema.
- Keep session storage, Open From Disk, built-in modules, and additional authoring actions in editor-default.
  Hosts own page URLs, loading UI, and visibility.
- Verify with `npx nx run @8f4e/editor-landing:build|test|typecheck`; the product website's `test:browser` target
  covers real landing-editor startup, compilation, controls, context-menu suppression, and disposal.
