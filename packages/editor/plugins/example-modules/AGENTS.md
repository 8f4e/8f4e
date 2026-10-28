# Example Modules Plugin

- Own the Add Built-in Module menu, category navigation, catalog metadata, loading/cache, public-block selection,
  and dependency insertion here.
- Export `createExampleModulesPlugin({ sources })`; receive lazy source loaders from the host, keyed by paths
  relative to the module directory without the extension. Keep Vite discovery in the default editor.
- Keep generic menu generation, navigation, and drawing in core. Use `menus.registerMenu` for the plugin submenu.
- Insert source through `addCodeBlock`. Use public editor-state parsers and measurement helpers; keep ordinary
  block creation, unique naming, entry assignment, and persistence in core.
- Own registrations and pending-load disposal explicitly. Keep catalog/cache state per installation.
- Verify with `npx nx run @8f4e/editor-plugin-example-modules:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-example-modules:test:screenshot`.
