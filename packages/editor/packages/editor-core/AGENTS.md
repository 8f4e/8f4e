# Repository Guidelines

## Package Scope & Layout
- Path: `packages/editor/packages/editor-core`; source in `src/`, output in `dist/`.
- Alias: `@8f4e/editor-core`. Consumed by the default editor composition and runtime definitions.

## Build, Bundle, Dev
- From root: `npx nx run @8f4e/editor-core:build|test|typecheck`.
- From package directory: use `npx nx run @8f4e/editor-core:<target>` (e.g., `npx nx run @8f4e/editor-core:dev`).
- Ensure `dist/` exists before building the default editor composition after API changes.

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
- Install plugins in editor-core so one setup receives state, event, menu, directive, and drawer services.
- Keep generic directive parsing and layout in editor-state, and generic drawing hooks in web-ui.
- Expose transport-independent reads and commands through `Editor.editing`. Validate edit batches before applying them as one undo step, and retain revision checks across human edits, history changes, and project replacement. WebMCP remains in its external adapter package.
- Plugins own their registrations, listeners, private widget data, and disposal. Do not add automatic tracking.
- Keep browser resources out of the shared plugin context. Browser plugins receive instance dependencies through
  factories composed by the browser host. `Editor.renderFrame()` provides generic immediate rendering.

- Meter, plot, bars, crossfade, watch, and stack own their data and drawers in plugin packages. Keep memory scope,
  typed-value resolution, tab layout, and compiler lookups generic and available through public helper exports.
- Keep project serialization under editor-state's `pureHelpers/projectSerialization`, filename configuration under
  `features/editor-config`. Session persistence belongs to its plugin.
  Project Open/Save/Export, browser file access, and file associations belong to the project-files plugin; WASM file
  writing belongs to the wasm-export plugin. Keep file callbacks and association flags out of core. Undo/redo restore
  snapshots within the current project; unrelated replacements dispatch loadProject.
- Favorite toggling and memory-connection removal belong to their plugins, including menu labels and availability.
  Favorite directive derivation and navigation stay in core. Export shared directive editing through public helpers.
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

- Runtime factories and lazy loaders are initialization dependencies passed directly to the runtime coordinator. `state.runtimeRegistry` contains IDs and schemas only. Publish runtime-derived constants through `envConstantContributions.runtime`.
- Memory writes belong to injected plugin factory dependencies. Keep `getWordFromMemory` for core pointer dereferencing; do not restore a state-level write callback.

- Core emits `compilationInputChanged` after its compiler input revision advances. Compilation scheduling and worker ownership belong to `editor-plugin-compiler`; do not restore a compile callback or built-in compiler effect.
- `EditorOptions` has no public callbacks bag. Construct internal memory, clipboard, and animation callbacks in core.
- Consume accepted `compilationSucceeded` program artifacts (`memoryRef` and `codeBuffer`) to update memory views and renderer artifacts before metadata consumers react. Dispatch `dispose` before plugin cleanup so core runtimes stop before compiler resources are released. Drain cleanup stacks even when a disposer throws.
- Render environment-constant contributions uniformly. The `runtime` contributor has no special formatting or ordering.
