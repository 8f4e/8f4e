# Editor Packages

This directory owns the reusable editor core, embedded and full product compositions, and the deployable editor website.

## Package Layout

- `packages/editor-default/` composes the core with the compiler worker, runtimes, standard library, examples, and
  browser storage.
- `packages/editor-minimal/` supplies the embedded composition used by the product homepage and example/test
  galleries, with live editing, controls, runtimes, and URL loading. Each mount starts fresh.
- `packages/editor-website/` contains the HTML page and thin Vite entry point that mounts the default composition.
- `packages/editor-core/` contains the reusable core editor and its state and UI packages.
- `packages/compiler-worker/` contains the editor-specific Web Worker wrapper around the compiler.
- `packages/runtime-audio-worklet/` and `packages/runtime-web-worker/` contain the
  editor runtime implementations.

## Development

From the workspace root:

```bash
npx nx run @8f4e/editor-website:dev
npx nx run @8f4e/editor-website:build
npx nx run @8f4e/editor-default:test
npx nx run @8f4e/editor-minimal:test
```

The development server runs at <http://localhost:3000>.
