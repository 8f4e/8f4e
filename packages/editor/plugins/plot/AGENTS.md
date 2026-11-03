# Plot Plugin

- Own `@plot`, its arguments, layout, private derived data, and drawer in this package.
- Export `plotPlugin`. Keep feature data in a per-installation WeakMap, outside core code-block state.
- Use public editor-state helpers and editor-core plugin contracts; do not import core source files.
- Return an explicit disposer for every layout, drawer, and interaction listener.
- Run `npx nx run @8f4e/editor-plugin-plot:build|test|typecheck` and `npx nx run @8f4e/editor-plugin-plot:test:screenshot`.

- Keep layout independent of directive registration. Match cached `codeBlock.parsedDirectives` through `matchEditorDirectives`; own contribution
  updates and `layout.subscribe` geometry. Unsubscribe before disposing requests. Do not attach layout to directive drafts.
