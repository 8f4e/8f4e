# Stack Plugin

- Own `@stack`, its arguments, layout, private derived data, and drawer in this package.
- Export `createStackPlugin`. Keep feature data in a per-installation WeakMap, outside core code-block state.
- Use public editor-state helpers and editor-core plugin contracts; do not import core source files.
- Return an explicit disposer for every directive, drawer, and interaction listener.
- Receive the reduced-motion preference through the factory; keep browser globals in the host.
- Run `npx nx run @8f4e/editor-plugin-stack:build|test|typecheck` and `npx nx run @8f4e/editor-plugin-stack:test:screenshot`.
