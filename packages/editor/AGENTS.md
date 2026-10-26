# Repository Guidelines

## Package Scope & Layout

- Path: `packages/editor`; this is an organizational parent for editor-owned packages.
- `@8f4e/editor-core` is the minimal reusable editor.
- `@8f4e/editor-default` composes the core with compiler, worker, runtimes, standard library, examples, and storage.
- `@8f4e/editor-website` is the thin deployable Vite host for the default composition.
- `@8f4e/editor-plugin-toggle-skip-execution` owns the optional single-module execution toggle. The switch widget
  lives in `@8f4e/editor-plugin-switch`, and selected-line tooltips in `@8f4e/editor-plugin-tooltips`. Plugin contracts and
  installation live in `editor-core`, generic directive processing in `editor-state`, and drawer hooks in `web-ui`.
  The standard plugin set is composed in `editor-default`.

## Build, Test, Dev

- Build or test the composition with `npx nx run @8f4e/editor-default:build|test|typecheck`.
- Build or verify the plugins with `npx nx run @8f4e/editor-plugin-toggle-skip-execution:build|test|typecheck` or
  `npx nx run @8f4e/editor-plugin-switch:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-tooltips:build|test|typecheck`.
- Start the website with `npx nx run @8f4e/editor-website:dev`.
- Build or preview it with `npx nx run @8f4e/editor-website:build|serve`.
- Ensure dependency packages are built before relying on workspace aliases in the website.

## Coding Style

- TypeScript (ES modules). Use Biome as the fixer (`npx biome check --write <files>`).
- Keep composition behavior in `editor-default`; keep hosting and deployment concerns in `editor-website`.
- Prefer workspace aliases for inter-package references.

## Testing

- Vitest tests live under `src/__tests__` or alongside source as `*.test.ts`.
- Test composition behavior in `@8f4e/editor-default`; test reusable editor behavior in `@8f4e/editor-core`.

## Pull Requests

- Include test notes and explain any package-boundary changes.
- Add screenshots or GIFs when editor behavior or appearance changes.
