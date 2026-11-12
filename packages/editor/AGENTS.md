# Editor Guidelines

## Ownership

- `packages/editor-core` owns reusable editor setup and lifecycle. Its editor-state library owns generic project,
  editing, layout and input behavior. Web-ui owns drawing and GPU resources.
- Feature logic lives in `plugins/<feature>` as independent `@8f4e/editor-plugin-<feature>` packages. Keep feature
  state, config schemas, directive interpretation, presentation and actions in the owning plugin.
- Default, gallery and landing compose core and choose plugins, startup policy and browser dependencies. Websites
  own page layout, hosting and deployment. WebMCP is a page-owned adapter to one editor's public API.
- The compiler plugin coordinates compilation and provides live artifact and memory handles. Runtime plugins own
  configuration, readiness and execution lifecycle independently. Publish runtime info and environment
  constants under each runtime's own key. Worker and worklet packages own execution code.
- Plugin READMEs document factory dependencies, loading signals and lifecycle. Composition READMEs document plugin
  selection.

## Plugin Contracts

- Use public workspace exports. Keep imports side-effect free and inject host resources through factories. Each
  installation owns its state and disposes its registrations, listeners and resources.
- Match cached directives with `matchEditorDirectives`. Use the independent layout service for contributions and
  settled geometry. Unsubscribe before disposing contributions. Keep layout work out of directive drafts.
- Use shared pointer events for controls and consume handled gestures before default selection and dragging. DOM
  listeners and pointer capability checks belong to input adapters and compositions.
- Use generic drawer hooks and shared palette tokens. Prepare static glyph IDs outside the render path and retain
  them with the owning feature. Use ASCII IDs directly for live numeric text.
- Use live compiler handles for memory access. Inject the current writer into memory controls and use
  `memoryValuesChanged` to refresh externally changed memory.
- Use generic schema, error and environment constant contributions. Use `loading.add` for operations that
  surface loading status. Producers report outcomes and cancel superseded or disposed work.
- Batch source changes with `applyCodeBlockSourceEdits`. Pass replacement source; the helper determines
  compilation invalidation and publishes the change. Only in-place ordinary comment text edits skip compilation.

## Composition and Validation

- Install the compiler first. Keep project startup and first-render drawing eager, with block backgrounds before
  code rendering. Gate all optional imports on core's `ready` event after the first render. Keep font payloads lazy.
- Keep independent optional entries in `src/deferred-plugins.ts` and signal-driven imports in `src/lazy-plugins.ts`.
  Use view scope for visual/control signals and project scope for runtime, keyboard-memory, MIDI and asset signals.
  Match raw configuration before the relevant schema loads.
- Load mouse input on all devices, touch input on coarse pointers and selected keyboard plugins on non-coarse
  pointers. Forward host input options to the owning plugin.
- Share one file session per editor that supports source files. Install it before project loaders and inject it
  into the file plugins.
- Keep shared libraries external in editor library bundles, including imported dependency subpaths.
- Test individual features against core services and exercise combined real plugins in composition suites. Test
  native input in the adapter or composition. Use `@8f4e/editor-default:test:screenshot` for full-editor composition
  and `@8f4e/8f4e-website:test:browser` for landing/gallery integration.
