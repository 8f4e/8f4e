# Repository Guidelines

## Package Scope & Layout
- Path: `packages/editor/packages/compiler-worker`; source in `src/`, output in `dist/`.
- Consumed via alias `@8f4e/compiler-worker` or by the editor package.

## Build, Test, Dev
- From root: `npx nx run @8f4e/compiler-worker:build|test|typecheck`.
- From package directory: use `npx nx run @8f4e/compiler-worker:<target>` (e.g., `npx nx run @8f4e/compiler-worker:dev`).

## Coding Style
- TypeScript; use Biome as the fixer (`npx biome check --write <files>`) with repo rules.
- Keep worker boundaries explicit; prefer message types in a shared module.

## Testing
- Vitest (via Nx). Test message handling and compile orchestration with unit tests.

## Commits & PRs
- Commits: `compiler-worker: <change>`; PRs describe protocol changes and include tests.

- Return the compilation artifacts using `memoryRef` consistently across the worker boundary. Do not add redundant size or instance-reset flags; memory lifecycle is described by `memoryAction`.
