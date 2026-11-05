# Repository Guidelines

## Package Scope & Layout
- Path: `packages/editor/packages/editor-core`; source in `src/`, output in `dist/`.
- Alias: `@8f4e/editor-core`. Consumed by the default editor composition and runtime plugins.

## Build, Bundle, Dev
- From root: `npx nx run @8f4e/editor-core:build|test|typecheck`.
- Run `npx nx run @8f4e/editor-core:test:screenshot` for the real-editor viewport animation/culling regression;
  use `test:screenshot:update` to update its baseline.
- From package directory: use `npx nx run @8f4e/editor-core:<target>` (e.g., `npx nx run @8f4e/editor-core:dev`).
- Ensure `dist/` exists before building the default editor composition after API changes.
- The nested editor-state build clears `dist/` once before emitting declarations and then bundling with Vite.
  Its TypeScript build excludes unit tests and `__tests__` helpers.

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

- Editor-state owns entry bounds, their padding/updates, and insertion hit testing in `codeBlockRendering.entryBounds`.
  Entry assignment works without drawing plugins. `editor-plugin-entry-outlines` only draws borders and labels from
  those bounds through generic `registerCanvasBackgroundDrawer`, below blocks with the existing canvas context types.
- Context-menu presentation belongs to `editor-plugin-context-menu`. Keep only raw items, requested world anchors,
  menu requests/Back navigation, pointer blocking/forwarding, and action/selector dispatch in core. Forward completed
  presses through `contextMenuPointerDown`, movement through `contextMenuPointerMove`, and activate raw items through
  `activateContextMenuItem { index, x, y }`. `closeContextMenu` closes without activating. Keep decorated titles,
  geometry, and highlighted rows out of core state. Generic `registerCanvasDrawer` draws before canvas/modal overlays.
- Keep dialog content, the stack, opening/closing, button actions, and modal input blocking in editor-state.
  Forward completed modal presses through `dialogPointerDown`; check
  `activateDialogButton { id, buttonIndex }` against the visible dialog. `editor-plugin-dialogs` owns private
  presentation geometry, hit testing, and drawing. Web-ui provides `registerModalOverlay` after ordinary overlays,
  independently of `canvasOverlays`.
- DOM mouse/wheel adaptation belongs to `editor-plugin-mouse-input`; touch adaptation and panning belong to
  `editor-plugin-touch-input`. Core keeps the event dispatcher and state effects, with no DOM input
  listeners or `captureWheel` option. Export existing generic viewport update, animation-stop, and grid-snap helpers.
- Font/color schemas, validators, defaults, and subscriptions belong to web-ui. Register them through
  `registerWebUiConfig(store)` before plugins/project loading. Initialize the view with the store and events; do not
  restore core font-atlas or palette management. State reacts only to `gridSizeChanged` and shared grid dimensions.
- Install plugins in editor-core so one setup receives state, event, menu, directive, layout, and drawer services.
- Keep generic directive parsing and layout in editor-state, and generic drawing hooks in web-ui.
- Keep project-tree reconstruction and same-project reconciliation in code-blocks/reconstructProject.ts; the block
  effect installs results and coordinates notifications. Shared source positions and vertical geometry remain in
  core; keyboard-editing privately derives horizontal caret placement.
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
- Project levels use `ProjectLevel { path, blocks, entries, viewport?, selectedBlock? }`, with `rootProject` and
  `currentProject` references in code-block rendering state and `childProject` on group blocks. Keep remembered views
  and selections in browser memory only; serializers omit them. Same-project restoration preserves active levels and
  views by path and resolves remembered selections to rebuilt blocks. Share tree operations through
  `pureHelpers/projectTree` and home/remembered viewport placement through `getProjectViewportPosition`.
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
  The code-rendering plugin refreshes prepared text and nested block backgrounds only after `codeBlockLayoutsChanged`; keep input invalidation owned by editor-state.
- Use `applyCodeBlockSourceEdits(store, edits, { affectsCompilation })` for plugin source-edit batches and
  `deleteCodeBlocks(store, blocks)` for removing blocks from the current slice. These helpers own refreshes,
  deleted-block reference cleanup, and one completed project/compiler notification. Callers own edit-mode policy;
  do not publish the same operation again or mutate the live source array before passing replacement code.
- Editor `@group` behavior belongs to `editor-plugin-grouping`, including membership, dragging policy, copying,
  and all group actions/menus. Keep only generic drag-target events and source insertion in core;
  nested language-level project groups, navigation, and memory scopes remain core-owned.
- Create drawer registrations with `createEditorDrawerRegistry`; it covers code-block drawing, viewport overlays, and canvas-wide
  GPU layers. Keep renderer invocation on the internal `EditorDrawerHost` interface.
- Input/output connectors and the complete GPU line renderer belong to `editor-plugin-connectors`. Keep connector
  fields and address indexes out of core. Expose GPU passes through `drawers.registerRenderLayer`; the renderer owns
  layer initialization, palette notifications, memory-release notifications, and disposal before context destruction.
- Keep browser resources out of the shared plugin context. Browser plugins receive instance dependencies through
  factories composed by the browser host. `Editor.renderFrame()` provides generic immediate rendering.

- Meter, plot, bars, crossfade, watch, and stack own their data and drawers in plugin packages. Keep memory scope,
  typed-value resolution, tab layout, and compiler lookups generic and available through public helper exports.
  Source-specific module views use `getCompiledModuleForCodeBlock` or `getModuleCompilationForCodeBlock`; logical names
  may identify multiple source blocks. Inherited declaration positioning belongs to the connectors plugin.
- Preserve root and group entry tables through loading, editing/history, clipboard, and serialization, including empty
  entries and groups without `main`. Keep module entry membership local to its owning project scope.
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
- Assertion marker geometry and drawing belong to `editor-plugin-assertion-markers`. Retain raw runtime results and
  contributor-owned `CodeError` lists in core; test-runtime publishes assertion errors and error-messages owns
  inline message layout/drawing. Keep prepared message and marker fields out of `CodeBlockGraphicData`.
- Keyboard-to-memory and MIDI input belong to their plugin packages. The default host supplies their browser and
  compiler resources through factories; core owns no input-specific schemas, WASM export services, or environment-plugin manager.
- Example module browsing and loading belong to `editor-plugin-example-modules`. Core exposes complete menu
  registration with opaque payloads and generic source parsing/measurement helpers. Keep category trees, module
  catalogs, public-block selection, and dependency insertion out of core; plugins dispatch `insertCodeBlock`.
- Session persistence and project URL loading belong to `editor-plugin-session-persistence` and
  `editor-plugin-project-url-loader`. Core owns no storage, quota, session callbacks, or URL fetch callbacks.
- `EditorOptions.initialProject` provides generic initial content. Load it (or an empty project) after sizing the
  viewport, then pass the `init` handlers' completion promise to web-ui for project fetching, parsing, and session
  restoration alongside the default ibmvga font download. Render only after both are ready, using the project's
  configured font. Emit `ready` after drawing; optional imports start there.

- Memory writes belong to injected plugin factory dependencies. Keep `getWordFromMemory` for core pointer dereferencing; do not restore a state-level write callback.

- Keep accepted metadata in `state.compiler.result`, separate from `compiler.isCompiling` progress.
- Core emits `compilationInputChanged` after its compiler input revision advances. Compilation scheduling and worker ownership belong to `editor-plugin-compiler`; do not restore a compile callback or built-in compiler effect.
- `EditorOptions` has no public callbacks bag. Construct the internal memory callback in core. Clipboard access belongs to feature factories.
- Editor-core owns the single frame loop and pause/resume coordination. Advance viewport animations through
  `advanceViewportAnimation` before calling web-ui's `renderFrame`, including on-demand and resize frames. Keep
  animation data and synchronous coordinate updates in editor-state; it owns no frame scheduler. Web-ui initializes
  without drawing or scheduling frames and owns only drawing, rendering statistics, and GPU resource lifecycle.
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
  `@texture <address> <magnification> <width> <height> [<x> <y>]` defines a full or cropped view. Both use pointer sources,
  resolved to byte addresses after entry execution each frame. Discover uploads throughout the project and share one
  upload per visible address, with one GPU program for all formats. Views reserve fixed layout space from explicit dimensions, independent of compiler state and pointer changes.
  All three compositions match raw runtime config and either directive with project scope. Keep parsing outside the frame
  path and release storage without visible views. The overlay remains above editor content without block occlusion.

- Ordinary keyboard input belongs to keyboard-navigation, keyboard-editing, and keyboard-mode-switching plugins.
  Keep generic history, project editing, mode actions, and text/pointer geometry in core. Text geometry lives under
  `features/text-geometry`; no core text-insertion actions or compatibility event aliases remain.

- Keyboard hints belong to keyboard-mode-switching. Expose only generic canvas overlay drawing and the
  `canvasOverlays` visibility flag in core; screenshots suppress this layer without knowing its contributors.

- Keyboard-editing owns edit-mode caret movement, mutation caret adjustments, and its block drawer. Core keeps
  source-position state and bounds/tab geometry; do not restore direction-based caret movement or a built-in glyph.
- All block plugins use `registerCodeBlockDrawer`, called once per visible block in registration order. Keep one
  registry, without stage aliases or priority sorting. Install block backgrounds before code rendering in all three compositions.
  Code rendering draws nested highlights, selected-line fill, and text together. The background plugin owns corner
  markers and their selected colors. Web-ui keeps traversal and visibility. Offscreen blocks use a single replaceable
  `registerOffscreenCodeBlockDrawer` callback with world coordinates, gated by `canvasOverlays`. Arrow geometry and
  drawing belong to `editor-plugin-offscreen-block-arrows`. Connectors keeps expansion labels private through this same
  registry and generic layout contributions.
- The circling selected-block animation belongs to `editor-plugin-selection-animation`. Keep its timing, glyphs,
  and drawing out of core; retain selection state. The background plugin owns corner colors; code rendering owns line highlighting.

- Export generic `insertCodeBlocks` and pure `serializeCodeBlocks`/`SerializedCodeBlock` helpers. Source batches retain their names, references, grouping directives and entries; insertion updates only placement directives and fresh editor identities. Do not restore name uniquifying, clipboard callbacks, clipboard format parsing, copy/paste menus, or paste-transform events in core.

- Shared pointer routing belongs to editor-state's `features/pointer-input`. Input adapters emit normalized pointer
  events; core owns block targeting and control dispatch before default block selection/dragging. Keep pointer event
  contracts in editor-state-types. Controls use shared types and remain independent of platform and moduleDragging.
