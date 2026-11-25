# Editor Packages

This directory owns the reusable editor core, independent plugins, embedded and full product compositions, and the
WebMCP adapter. The deployable [editor web app](../../apps/editor-webapp/README.md) lives under `apps/` at the workspace root.

## Package Layout

- `core/` groups the reusable editor core, state, UI, graphics and testing libraries.
- `plugins/` contains independently built editor features. The compiler, audio runtime, worker runtime and test
  runtime plugins each own a nested package for execution in a Web Worker or AudioWorklet environment.
- `compositions/editor-default/` composes the core with the compiler worker, runtimes, standard library, examples, and
  browser storage.
- `compositions/editor-gallery/` supplies the embedded composition used by the example/test
  galleries, with live editing, controls, runtimes, and URL loading. Each mount starts fresh.
- `compositions/editor-landing/` supplies the product homepage composition with live editing, slider controls, the worker
  runtime, and URL loading for self-contained projects, while omitting standard-library discovery, gallery authoring
  menus, and project saving/export.
- `editor-webmcp/` adapts one live editor to browser agents; it is installed by the page host.

## Development

From the workspace root:

```bash
npx nx run @8f4e/editor-webapp:dev
npx nx run @8f4e/editor-webapp:build
npx nx run @8f4e/editor-default:test
npx nx run @8f4e/editor-gallery:test
```

The development server runs at <http://localhost:3000>.
