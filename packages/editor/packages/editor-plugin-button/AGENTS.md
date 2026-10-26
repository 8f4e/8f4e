# Button Plugin

- Own button directive arguments, memory resolution, press/release state, hit-testing, and rendering here.
- Keep rendering in `src/drawer/`, directive layout and interaction in `src/state/`, and argument helpers in
  `src/helpers/`. Keep tests beside their implementations.
- Export an `EditorPlugin` without installing it as an import side effect. Editor-default selects the standard plugins.
- Keep button widgets in a per-instance WeakMap, using public workspace APIs. Do not share button models or drawers
  with core or other plugins.
- Leave generic directive parsing and layout in editor-state. Use `onBlockLayoutReady` for shared drawing and hit-test geometry.
- Own cleanup of the directive, drawer, and press/release listeners. Release a held button during disposal.
- Use the existing palette roles.
- Run `npx nx run @8f4e/editor-plugin-button:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-button:test:screenshot` for browser rendering tests.
- Cover actual pointer events, memory writes, layout, source changes, group exposures, cleanup, and editor isolation.
