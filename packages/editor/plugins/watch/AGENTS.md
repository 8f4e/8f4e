# Watch Plugin

- Own `@watch`, its arguments, layout, private derived data, and drawer in this package.
- Export `createWatchPlugin`. Keep feature data in a per-installation WeakMap, outside core code-block state.
- Use public editor-state helpers and editor-core plugin contracts; do not import core source files.
- Return an explicit disposer for every layout, drawer, and interaction listener.
- Receive the reduced-motion preference through the factory; keep browser globals in the host.
- Run `npx nx run @8f4e/editor-plugin-watch:build|test|typecheck` and `npx nx run @8f4e/editor-plugin-watch:test:screenshot`.

- Keep layout independent of directive registration. Read source through `parseEditorDirectives`; own contribution
  updates and `layout.subscribe` geometry. Unsubscribe before disposing requests. Do not attach layout to directive drafts.
