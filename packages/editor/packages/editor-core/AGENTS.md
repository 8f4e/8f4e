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
- Plugins own their registrations, listeners, private widget data, and disposal. Do not add automatic tracking.
- Keep browser resources out of the shared plugin context. Browser plugins receive instance dependencies through
  factories composed by the browser host. `Editor.renderFrame()` provides generic immediate rendering.

- Meter, plot, bars, crossfade, watch, and stack own their data and drawers in plugin packages. Keep memory scope,
  typed-value resolution, tab layout, and compiler lookups generic and available through public helper exports.
- Keep project serialization under editor-state's `pureHelpers/projectSerialization`, filename configuration under
  `features/editor-config`, and session persistence as its own core feature.
  Project-file and WebAssembly export actions, menus, and the save shortcut belong to their plugins.
