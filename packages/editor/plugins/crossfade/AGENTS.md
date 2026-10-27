# Crossfade Plugin

- Own `@crossfade`, its arguments, layout, private derived data, and drawer in this package.
- Export `crossfadePlugin`. Keep feature data in a per-installation WeakMap, outside core code-block state.
- Use public editor-state helpers and editor-core plugin contracts; do not import core source files.
- Return an explicit disposer for every directive, drawer, and interaction listener.
- Capture pointer movement during a crossfade drag and release pointer handlers on disposal.
- Run `npx nx run @8f4e/editor-plugin-crossfade:build|test|typecheck` and `npx nx run @8f4e/editor-plugin-crossfade:test:screenshot`.
