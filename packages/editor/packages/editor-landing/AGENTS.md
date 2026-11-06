# Landing Editor Package Guidelines

- Own the independent composition for product landing-page demos. Build directly on editor-core with compiler
  coordination, URL loading, live editing, slider controls, and the worker runtime.
- Keep projects self-contained. Omit standard-library discovery, include resolution, the stdlib resolver and its
  tests, virtual-source declarations, and source-collection dependencies from this composition.
- Omit `assertion-markers`, `keyboard-mode-switching`, `dialogs`, `test-runtime`, `audio-runtime`, `texture-runtime`,
  `binary-assets`, `midi-input`, `keyboard-memory`, `bars`, `meter`, `wave`, `crossfade`, `switch`, `button`, and `piano`
  from imports, plugin registries, and dependencies. Keep audio-context and mode-switching options out of the mount API.
- Omit `entry-outlines`, `offscreen-block-arrows`, and `context-menu` from imports, plugin registries, and dependencies.
  Keep core's `contextMenu` feature disabled even when hosts override other feature flags, so no invisible menu opens.
- Omit `block-authoring`; this menu-free composition has no New/Delete block commands. Generic editing APIs remain available.
- Omit `project-save`, `code-block-copy-paste`, and `editor-file-session` from the composition and dependencies.
  Plain-text paste at the caret belongs to keyboard editing; the landing composition does not intercept Cmd/Ctrl+S.
- Keep compiler coordination, URL loading, block backgrounds, and code rendering eager.
  Install block backgrounds before code rendering. Gate every optional import on core's `ready` event through
  `src/deferred-plugins.ts`; add no frame callbacks, visibility gates, or timers. Keep font payloads lazy.
- Omit `jump-to-error`; the landing editor has no error-navigation button.
- Omit the loading-indicators plugin and its presentation/visibility timers. Hosts own loading UI; producers still
  publish operation status in state.
- Keep optional plugins as individual deferred entries. Load mouse input on all devices, touch input on coarse
  pointers, and keyboard navigation/editing on non-coarse pointers. Forward host wheel and touch preferences
  without implementing input behavior in the composition. The source's `@mode` directive selects the initial mode.
- Keep directive-based loading in `src/lazy-plugins.ts`, with visual/control plugins scoped to the view and
  `worker-runtime` scoped to the project. Keep watch/stack aliases, plot, and slider in this
  registry. Pass live compiler handles into dependent factories.
- Keep session storage, Open From Disk, built-in modules, and additional authoring actions in editor-default.
  Hosts own page URLs, loading UI, and visibility.
- Verify with `npx nx run @8f4e/editor-landing:build|test|typecheck`; the product website's `test:browser` target
  covers real landing-editor startup, compilation, controls, context-menu suppression, and disposal.
