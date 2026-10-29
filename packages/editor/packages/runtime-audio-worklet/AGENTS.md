# Repository Guidelines

## Package Scope & Layout
- Path: `packages/editor/packages/runtime-audio-worklet`; source in `src/`, output in `dist/`.
- Alias: `@8f4e/runtime-audio-worklet` for the app/editor.

## Build, Test, Dev
- From root: `npx nx run @8f4e/runtime-audio-worklet:build|test|typecheck`.
- From package directory: use `npx nx run @8f4e/runtime-audio-worklet:<target>` (e.g., `npx nx run @8f4e/runtime-audio-worklet:dev`).
- Build before integrating in the default editor composition to ensure alias resolution.

## Coding Style
- TypeScript. Use Biome as the fixer (`npx biome check --write <files>`); it owns formatting rules such as tabs, single quotes, semicolons, and width 120.
- Keep worklet entrypoints small and dependency-free; avoid DOM APIs.

## Testing
- Vitest (via Nx). Unit-test helpers; integration tests can mock AudioWorklet.

## Commits & PRs
- Commits: `runtime-audio-worklet: <change>`; PRs should describe audio thread implications.

- Page-side editor integration and lifecycle tests live in `packages/editor/plugins/audio-runtime`. This package owns execution code and its message protocol.
