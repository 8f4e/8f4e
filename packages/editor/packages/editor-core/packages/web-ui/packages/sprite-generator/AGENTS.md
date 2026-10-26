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
- Generate one R8 glyph set, one fully covered fill texel, and one reusable background pattern mask.
- Keep shapes and lookup IDs independent of theme values. Return only masks, source identifiers, and font metrics.
- Input and output connectors are composed by web-ui from fills and font glyphs; do not add prerendered connector sprites.
- Tests build package dependencies before running.

## Testing
- Vitest (via Nx). Prefer unit tests and golden/snapshot tests for outputs.
- To update snapshots after intentional changes, use `npx nx run @8f4e/sprite-generator:test -- --update` (or the `:update` variant for screenshot tests).

## Commits & PRs
- Commits: `sprite-generator: <change>`; PRs include rationale and test notes.
