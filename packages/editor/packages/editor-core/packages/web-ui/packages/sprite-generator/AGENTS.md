# Repository Guidelines

## Package Scope & Layout
- Path: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator`; source in `src/`, output in `dist/`.
- Alias: `@8f4e/sprite-generator`.

## Build, Test, Dev
- From root: `npx nx run @8f4e/sprite-generator:build|test|typecheck`.
- From package directory: use `npx nx run @8f4e/sprite-generator:<target>` (e.g., `npx nx run @8f4e/sprite-generator:dev`).
- Screenshot tests: `npx nx run @8f4e/sprite-generator:test:screenshot` and variants (:ui, :update, :headed, :debug).
- Browser previews use `http://localhost:3102`, separate from the metrics dashboard on port 3002. Playwright starts
  Vite directly as its owned test server with strict port binding; keep its base URL aligned with
  `screenshot-tests/vite.config.ts`. Run the screenshot tasks themselves through Nx.

## Coding Style
- TypeScript; use Biome as the fixer (`npx biome check --write <files>`) per root config. Keep pure, deterministic functions.

## Palette

- Keep production generation independent of palettes; browser previews resolve colors with `@8f4e/editor-palette`.
- Generate one R8 glyph set and one fully covered fill cell on the same fixed-size grid. Return only `{ image, grid }`;
  web-ui owns background dot settings and procedural rendering.
- Font sources contain only `ascii.ts`; `generate-fonts` produces `src/generated/<font>.ts`. The BDF importer takes only
  a source path and font name. Register font dimensions and the lazy payload import once in `src/fonts/catalog.ts`.
- Glyph IDs are character codes 0–127; fill is 128. Do not add per-font lookup tables or palette-dependent data.
- Keep generated payloads compact and lazy. Cached atlas objects and their pixel arrays are shared; consumers must not mutate them.
- Input and output connectors are composed by web-ui from fills and font glyphs; do not add prerendered connector sprites.
- Tests build package dependencies before running.

## Testing
- Vitest (via Nx). Prefer unit tests and golden/snapshot tests for outputs.
- Keep palette sample data in `tests/fixtures/palettes.ts`; unit tests and screenshot previews share these local color directives. Do not import example programs/modules just to provide renderer fixture data or add an examples package dependency.
- `generate-fonts` uses production inputs. Tests and screenshot baselines must not invalidate font generation or downstream editor builds. Run `npx nx run @8f4e/release:audit-build-inputs` after changing these boundaries.
- To update snapshots after intentional changes, use `npx nx run @8f4e/sprite-generator:test -- --update` (or the `:update` variant for screenshot tests).

## Commits & PRs
- Commits: `sprite-generator: <change>`; PRs include rationale and test notes.
