# Crossfade Plugin

- Own `@crossfade`, its arguments, layout, private derived data, and drawer in this package.
- Export `createCrossfadePlugin`. Keep feature data in a per-installation WeakMap, outside core code-block state.
- Use public editor-state helpers and editor-core plugin contracts; do not import core source files.
- Return an explicit disposer for every directive, drawer, and interaction listener.
- Capture pointer movement during a crossfade drag and release pointer handlers on disposal.
- Run `npx nx run @8f4e/editor-plugin-crossfade:build|test|typecheck` and `npx nx run @8f4e/editor-plugin-crossfade:test:screenshot`.

- Receive a required `writeMemory(address, value, isInteger)` through the plugin factory. Do not route writes through editor state. The injected writer must use the current memory after recompilation or growth.
