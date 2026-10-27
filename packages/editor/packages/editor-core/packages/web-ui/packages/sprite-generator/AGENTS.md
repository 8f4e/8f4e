# Repository Guidelines

## Package Scope & Layout
- Path: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator`; source in `src/`, output in `dist/`.
- Alias: `@8f4e/sprite-generator`.

## Build, Test, Dev
- From root: `npx nx run @8f4e/sprite-generator:build|test|typecheck`.
- From package directory: use `npx nx run @8f4e/sprite-generator:<target>` (e.g., `npx nx run @8f4e/sprite-generator:dev`).
- Screenshot tests: `npx nx run @8f4e/sprite-generator:test:screenshot` and variants (:ui, :update, :headed, :debug).

## Coding Style
- TypeScript; use Biome as the fixer (`npx biome check --write <files>`) per root config. Keep pure, deterministic functions.

## Palette

- Keep production generation independent of palettes; browser previews resolve colors with `@8f4e/editor-palette`.
- Generate one R8 glyph set and one fully covered fill cell on the same fixed-size grid. Return font-specific
  background dot metrics; web-ui renders the background procedurally without an atlas entry.
- Font sources contain only `ascii.ts`; `generate-fonts` produces `generated/ascii.ts`. The BDF importer takes only
  a source path and font name. Configure background dot position and rectangle size in `FONT_DEFINITIONS`; do not
  add special editor glyph tables.
- Keep shapes and grid-cell indices independent of theme values. Return only masks, grid dimensions, cell indices, and font metrics.
- Input and output connectors are composed by web-ui from fills and font glyphs; do not add prerendered connector sprites.
- Tests build package dependencies before running.

## Testing
- Vitest (via Nx). Prefer unit tests and golden/snapshot tests for outputs.
- To update snapshots after intentional changes, use `npx nx run @8f4e/sprite-generator:test -- --update` (or the `:update` variant for screenshot tests).

## Commits & PRs
- Commits: `sprite-generator: <change>`; PRs include rationale and test notes.
