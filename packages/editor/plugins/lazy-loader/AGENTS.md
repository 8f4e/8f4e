# Lazy Plugin Loader

- Own automatic signal matching, per-editor imports/installation, and loaded-plugin disposal.
- `createDeferredPluginLoaderPlugin({ load })` starts on core's `ready` event, after initial project loading/parsing,
  font-atlas loading, and rendering. This is the only readiness gate; add no frame callbacks or timing delays. Return
  one lazy-loader plugin through this boundary; the deferred wrapper owns its single disposer.
  Ordinary optional features use individual entries with unconditional or capability predicates; input plugins have
  no separate loading group. Initialize loaded plugins from current state and ignore completion after disposal.
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
- Contribute `{ name: entry.id }` to the unified loading list for each pending import/setup. The deferred wrapper
  contributes `{ name: 'editor plugins' }`. Use `loading.add` removers on completion, failure, and disposal;
  imports completing after disposal must not affect other indicators.
- Log import failures and retry on the next matching automatic scan. Setup errors propagate through activation
  under the trusted-plugin contract.
- Run `npx nx run @8f4e/editor-plugin-lazy-loader:build|test|typecheck`.
- Keep loader tests independent of feature plugins. Browser composition coverage with dynamically imported plot
  belongs to editor-default's `test:screenshot` target.
