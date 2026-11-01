# Lazy Plugin Loader

- Own automatic signal matching, per-editor imports/installation, and loaded-plugin disposal.
- Accept `LazyEditorPlugin` entries with `id`, required `scope: 'view' | 'project'`, `matches(directives)`, and
  `load()`. Keep feature signals and browser dependencies in the host registry; imports belong inside loader callbacks.
- Scan at setup and schedule scans on completed `projectChange` notifications and `codeBlockRendering.currentProject.blocks`
  changes. Coalesce synchronous notifications in a microtask so API edits finish restoring their current group first.
- Match cached `parsedDirectives`; do not serialize or reparse source. View scope covers the current project level
  without descending into groups. Project scope covers root blocks and all nested groups. Match raw `@config` records
  before schemas load. The loader contributes no manual scan action or menu item.
- Keep loaded plugins until editor disposal. Deduplicate pending imports per editor; retain ordinary plugin setup
  and explicit cleanup. Ignore import completion after disposal. Layout recalculation belongs to the independent
  layout service, never to the loader or directive registry.
- Plugins install in completion order. There is no dependency resolver, unloading policy, or async setup contract.
- Log import failures and retry on the next matching automatic scan. Setup errors propagate through activation
  under the trusted-plugin contract.
- Run `npx nx run @8f4e/editor-plugin-lazy-loader:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-lazy-loader:test:screenshot`.
- Browser tests use a real editor and dynamically imported plot. Keep plot-specific rendering details in plot's tests.
