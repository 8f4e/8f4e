# Lazy Plugin Loader

- Own project-triggered imports, per-editor installation, the manual scan menu action, and loaded-plugin disposal.
- Accept `LazyEditorPlugin` entries with `id`, `matches(project)`, and `load()`. Keep feature names and browser
  dependencies in the host registry; imports belong inside each loader callback.
- Scan at setup and on `projectChange.kind === 'replace'`, plus `loadPluginsUsedByProject`. Do not watch edits,
  paste, navigation, or history for automatic scans.
- Match the current serialized root project, including nested groups. Reuse core's generic directive parser in
  `hasDirective`; do not import the matched plugin to discover its signals.
- Keep loaded plugins until editor disposal. Deduplicate pending imports per editor; retain ordinary plugin setup
  and explicit cleanup. Ignore import completion after disposal and refresh core layout after successful setup.
- Plugins install in completion order. There is no dependency resolver, unloading policy, or async setup contract.
- Run `npx nx run @8f4e/editor-plugin-lazy-loader:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-lazy-loader:test:screenshot`.
- Browser tests use a real editor and dynamically imported plot. Keep plot-specific rendering details in plot's tests.
