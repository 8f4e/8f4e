---
title: 'TODO: Design lazy loading for editor plugins'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Completed
completed: 2026-10-29
---

# TODO: Design lazy loading for editor plugins

## Problem Description

The default editor previously imported every selected plugin eagerly. As features moved into plugins, editors
downloaded and initialized optional features even when their projects did not use them.

The first implementation establishes a loading contract with plot as the initial lazy plugin. Other plugins remain
fixed. It works in both edit and view modes; loading authoring features on entering edit mode remains separate work.

## Implemented Design

`@8f4e/editor-plugin-lazy-loader` is an ordinary fixed plugin. It accepts registry entries with an ID, a synchronous
`matches(project)` predicate, and a `load(): Promise<EditorPlugin>` callback. The default editor keeps the lightweight
registry separate from implementation imports and matches plot through core's generic directive parser.

The loader scans the current canonical root project at setup and after project replacement, including URL and session
loads. Nested groups participate. The **Load plugins used by project** menu action triggers later scans; typing,
pasting, module insertion, and history changes do not scan automatically.

Imports run in the background without delaying mount or project-load notifications. Loaded plugins use the existing
synchronous setup contract. Independent layout contributions automatically rederive the current slice and rendered
source when their requests change, without source edits or compilation. The loader has no layout refresh policy. Plugins installed late must read current state rather than expect startup events to replay.

Overlapping scans share pending imports per editor. Requested plugins remain installed until editor disposal,
including if the project changes during import. Entries install as imports complete; order-dependent plugins stay
fixed. Import failures are logged and another scan can retry. Disposal prevents pending imports from installing and
calls installed plugins' disposers in reverse installation order, without automatic listener tracking.

Plot uses existing generic palette tokens and drawing resources. Production build manifests and source maps place its
implementation exclusively in a dynamic chunk, outside the static entry dependency graph.

## Success Criteria

- [x] Agree on and document the loading, activation, and readiness contract.
- [x] Production builds demonstrate that optional plugin implementations can be excluded from initial loading.
- [x] Plugins retain ownership of their contributions and cleanup, with independent setup for each editor.
- [x] Delayed loading preserves project behavior and the first supported interaction.
- [x] Cover load failure, concurrent editors, registration order, and disposal during loading.

## Affected Components

- `packages/editor/packages/editor-default/src/index.ts` - Standard plugin composition and import boundaries.
- `packages/editor/plugins/lazy-loader/` - Matching, installation, menu, lifecycle, and tests.
- Editor state and web-ui render projection - Generic late layout refresh.
- `packages/editor/plugins/plot/` - First dynamically imported plugin, retaining its ordinary plugin contract.
- Editor website builds - Emitted chunks, initial downloads, and activation timing.

## Related Items

- [TODO 486: Lazy-load editing features on entering edit mode](../486-lazy-load-editing-features-on-edit-mode.md)
- [TODO 483: Lazy-load WASM overlay rendering](../483-lazy-load-wasm-overlay-rendering.md)
- [TODO 509: Rebuild editor colors from a small base palette](509-rebuild-editor-colors-from-base-palette.md)

## References

- [Loader contract](../../../packages/editor/plugins/lazy-loader/README.md)
- [Editor plugin contract](../../../packages/editor/packages/editor-core/README.md#plugins)
- [Plugin extraction PR #1218](https://github.com/8f4e/8f4e/pull/1218)

## Notes

Converting additional plugins, automatic unloading, continuous scanning, and dependency management remain outside
this first implementation.
