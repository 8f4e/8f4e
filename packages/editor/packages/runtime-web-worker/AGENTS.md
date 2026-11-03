# Repository Guidelines

## Package Scope & Layout
- Path: `packages/editor/packages/runtime-web-worker`; source in `src/`, output in `dist/`.
- Alias: `@8f4e/runtime-web-worker`.

## Build, Test, Dev
- From root: `npx nx run @8f4e/runtime-web-worker:build|test|typecheck`.
- From package directory: use `npx nx run @8f4e/runtime-web-worker:<target>` (e.g., `npx nx run @8f4e/runtime-web-worker:dev`).

## Coding Style
- TypeScript + Biome (`npx biome check --write <files>` for fixes). Avoid DOM APIs in worker code.

## Testing
- Vitest (via Nx). Test message handling and utilities; mock `postMessage`.

## Commits & PRs
- Commits: `runtime-web-worker: <change>`; PRs describe protocol changes.

- Page-side editor integration and lifecycle tests live in `packages/editor/plugins/worker-runtime`. This package owns execution code and its message protocol.
