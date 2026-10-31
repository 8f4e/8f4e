# Repository Guidelines

## Package Scope & Layout
- Path: `packages/editor/packages/editor-core`; source in `src/`, output in `dist/`.
- Alias: `@8f4e/editor-core`. Consumed by the default editor composition and runtime plugins.

## Build, Bundle, Dev
- From root: `npx nx run @8f4e/editor-core:build|test|typecheck`.
- From package directory: use `npx nx run @8f4e/editor-core:<target>` (e.g., `npx nx run @8f4e/editor-core:dev`).
- Ensure `dist/` exists before building the default editor composition after API changes.
- The nested editor-state build clears `dist/` once before emitting declarations and then bundling with Vite.

## Coding Style
- TypeScript (ESM). Use Biome as the fixer (`npx biome check --write <files>`); it owns formatting and import organization.
- Prefer alias imports for internal packages.

## Testing
- Vitest (via Nx). Tests under `__tests__` or `*.test.ts`.
- Favor unit tests for view-models and utilities; snapshot tests acceptable.
- Tests consume built dependency exports through workspace aliases; the test target builds dependencies first.
  Do not add source-file aliases to preserve test imports across package boundaries.

## Commits & PRs
- Commits: `editor: <change>` (e.g., `editor: fix drag selection`).
- PRs: add screenshots/gifs for UI changes, include test notes, link issues.

## Plugins
- Install plugins in editor-core so one setup receives state, event, menu, directive, layout, and drawer services.
- Keep generic directive parsing and layout in editor-state, and generic drawing hooks in web-ui.
- Source updates use `features/code-blocks/sourceUpdates.ts`: refresh source metadata, regenerate environment source,
  resolve global configuration, then refresh layouts. Add source-derived work to that path instead of relying on
  effect subscription order. Same-project edits retain existing positions while `@pos` is incomplete or invalid;
  replacement projects and newly inserted blocks have no previous position to retain.
- Expose revision tracking and validated commands through `Editor.editing`, and shared project view navigation through `Editor.navigation`. Consumers read the existing `Editor.state` directly and use `editing.getRevision()` to track source changes. Validate edit batches before applying them as one undo step, and retain revision checks across human edits, history changes, and project replacement. WebMCP remains in its external adapter package.
- Keep API revisions, history, and session persistence on `state.projectChange`, with one revision and operation kind.
  Source and metadata actions call `publishProjectChange(store)` once after a completed change; no-ops and navigation
  do not publish. Project loading and history restore snapshots through the shared project-changes helper, which
  publishes after derived state is ready. API batches, undo/redo, and project replacement all advance the shared
  revision. Keep `compilerInputRevision` independent and avoid separate API fingerprints or revision counters.
- Project operations own `applyProjectEdit`, including canonical no-op comparison and snapshot application. History
  listens to `beforeProjectEdit` to flush pending typing and to completed changes for checkpoint bookkeeping; API
  writes must work without the history effect installed.
- The existing project serializers return detached models with canonical field and grid/creation ordering, including
  nested source arrays. Retain those snapshots directly and compare their canonical JSON without extra deep cloning
  or generic key-sorting adapters.
- Do not add a parallel project snapshot API. Consumers can use `getEditorBlockId(block)` to target existing validated commands with blocks read from state. Keep code authoritative for derived properties and avoid a parallel, hand-picked block metadata model. Agent-specific projections belong in the external WebMCP bridge. Editing commands accept source with `@pos` directives; derive positions from code without overriding or injecting coordinate directives.
- Plugins own their registrations, listeners, private widget data, and disposal. Do not add automatic tracking.
- Keep lazy loading policy in `editor-plugin-lazy-loader` and feature signals/imports in host registries. Late
  layout contributions use the independent `layout` service, with owned update/remove/dispose handles and layout
  subscriptions. Changed requests automatically rederive affected visible blocks without source changes, project
  revisions, or compilation. Unchanged values are no-ops; callbacks can update requests and settle synchronously.
  Keep all layout requests/callbacks out of directive drafts, and layout refresh policy out of the lazy loader.
- Use `applyCodeBlockSourceEdits(store, edits, { affectsCompilation })` for plugin source-edit batches and
  `deleteCodeBlocks(store, blocks)` for removing blocks from the current slice. These helpers own refreshes,
  deleted-block reference cleanup, and one completed project/compiler notification. Callers own edit-mode policy;
  do not publish the same operation again or mutate the live source array before passing replacement code.
- Editor `@group` behavior belongs to `editor-plugin-grouping`, including membership, dragging policy, clipboard
  collision handling, and all group actions/menus. Keep only generic drag-target and paste-source events in core;
  nested language-level project groups, navigation, and memory scopes remain core-owned.
- Create drawer registrations with `createEditorDrawerRegistry`; it covers both code-block drawing and canvas-wide
  GPU layers. Keep renderer invocation on the internal `EditorDrawerHost` interface.
- Input/output connectors and the complete GPU line renderer belong to `editor-plugin-connectors`. Keep connector
  fields and address indexes out of core. Expose GPU passes through `drawers.registerRenderLayer`; the renderer owns
  layer initialization, palette notifications, memory-release notifications, and disposal before context destruction.
- Keep browser resources out of the shared plugin context. Browser plugins receive instance dependencies through
  factories composed by the browser host. `Editor.renderFrame()` provides generic immediate rendering.

- Meter, plot, bars, crossfade, watch, and stack own their data and drawers in plugin packages. Keep memory scope,
  typed-value resolution, tab layout, and compiler lookups generic and available through public helper exports.
- Keep canonical project-model serialization under editor-state's `pureHelpers/projectSerialization`, filename
  configuration under `features/editor-config`, and `.8f4e` text formatting private to project-save.
  Session persistence belongs to its plugin. Project-open owns reading/parsing; project-save owns Save/Export,
  Cmd/Ctrl+S, permissions, and writes. Their per-editor file session holds only the handle and reset lifecycle.
  WASM writing belongs to wasm-export. Keep file callbacks and association flags out of core. Undo/redo restore
  snapshots within the current project; unrelated replacements dispatch loadProject.
- Favorites belong entirely to `editor-plugin-favorites`: cached directive detection, toggling, navigation menus,
  and the generated env block's favorite marker. Keep favorite flags and event handlers out of core. Export generic
  block jumping and directive editing through public helpers. Memory-connection removal belongs to its plugin.
- Binary assets belong to `editor-plugin-binary-assets`, including their schema, fetching/cache, private state, dialog,
  and size constants. Keep only generic `envConstantContributions`, schema registration, dialogs, and memory resolution
  in core. Environment constants refresh when blocks are populated as well as when contributions change.
- Assertion marker geometry and drawing belong to `editor-plugin-assertion-markers`; retain runtime results and
  inline assertion error messages in core. Do not add marker fields to `CodeBlockGraphicData`.
- Keyboard-to-memory and MIDI input belong to their plugin packages. The default host supplies their browser and
  compiler resources through factories; core owns no input-specific schemas, WASM export services, or environment-plugin manager.
- Example module browsing and loading belong to `editor-plugin-example-modules`. Core exposes complete menu
  registration with opaque payloads and generic source parsing/measurement helpers. Keep category trees, module
  catalogs, public-block selection, and dependency insertion out of core; plugins dispatch `insertCodeBlock`.
- Session persistence and project URL loading belong to `editor-plugin-session-persistence` and
  `editor-plugin-project-url-loader`. Core owns no storage, quota, session callbacks, or URL fetch callbacks.
- `EditorOptions.initialProject` provides generic initial content. Load it (or an empty project) after the first
  resize, then dispatch `init` so installed plugins can perform their own startup work.

- Memory writes belong to injected plugin factory dependencies. Keep `getWordFromMemory` for core pointer dereferencing; do not restore a state-level write callback.

- Core emits `compilationInputChanged` after its compiler input revision advances. Compilation scheduling and worker ownership belong to `editor-plugin-compiler`; do not restore a compile callback or built-in compiler effect.
- `EditorOptions` has no public callbacks bag. Construct internal memory, clipboard, and animation callbacks in core.
- Consume accepted `compilationSucceeded` program artifacts (`memoryRef`) to update generic memory views before metadata consumers react. Dispose plugins in reverse installation order so execution plugins stop before compiler resources are released. Drain cleanup stacks even when a disposer throws.
- Render environment-constant contributions uniformly; each plugin owns its contribution key.

- Audio, worker, test, and texture execution are ordinary lazy plugins in `packages/editor/plugins/audio-runtime`,
  `worker-runtime`, `test-runtime`, and `texture-runtime`. The default editor matches their raw `@config` roots before their schemas load.
  Each owns `enabled` (default false), schema registration, compiler readiness, execution, and cleanup. They may run
  together against shared compiler memory. Keep worker/worklet execution code in the existing runtime packages.
- Audio and worker runtime constant names are configured with `sampleRateConstantName` (default `SAMPLE_RATE`) and audio's
  `bufferSizeConstantName` (default `AUDIO_BUFFER_SIZE`). Each contributes under its own environment key. Keep info
  namespaces fixed: `info.audioRuntime`, `info.workerRuntime`, and `info.testRuntime`. Core has no runtime registry,
  selector, factory contract, or runtime values bag. Use `memoryValuesChanged` to refresh externally changed memory.

- Per-frame WASM execution and texture upload/view directives belong entirely to `editor-plugin-texture-runtime`.
  `textureRuntime` config owns `enabled` and `entry`. `@textureUpload <address> <format> <width> <height>` defines a source;
  `@texture <address> <magnification> [<x> <y> <width> <height>]` defines a full or cropped view. Both use pointer sources,
  resolved to byte addresses after entry execution each frame. Discover uploads throughout the project and share one
  upload per visible address, with one GPU program for all formats. Views own reserved layout space and cropping.
  Both compositions match raw runtime config and either directive with project scope. Keep parsing outside the frame
  path and release storage without visible views. The overlay remains above editor content without block occlusion.
