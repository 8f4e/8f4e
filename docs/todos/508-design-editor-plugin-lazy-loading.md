---
title: 'TODO: Design lazy loading for editor plugins'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Open
completed: null
---

# TODO: Design lazy loading for editor plugins

## Problem Description

The default editor eagerly imports its selected plugins, and editor-core installs them synchronously before
rendering and project loading. As more features move into plugins, editors may download and initialize features
that their projects never use.

Work out a lazy-loading contract as a separate follow-up to the initial plugin extraction. This concerns plugins
that contribute state effects, directives, menus, and drawers. It is related to loading authoring features on entering
edit mode, but should also cover plugins used in view mode.

## Proposed Idea

Explore plugin loaders based on dynamic imports, with a clear point at which each editor awaits or activates a
plugin. Keep implementation loading separate from per-editor setup: sharing a loaded module must not share state,
registrations, or disposers between editors.

Measure the production dependency graph before choosing an approach. Establish which plugins can actually leave
the initial bundle and whether the download savings justify the added asynchronous lifecycle.

## Open Questions

- What triggers loading: host composition, project directives, editor mode, or a combination?
- How can a plugin be discovered without eagerly importing its implementation or hardcoding feature names in core?
- Is asynchronous initialization sufficient initially, or must plugins activate after startup too?
- What must be ready before configuration validation, project loading, rendering, or the first user interaction?
- How should pending imports, load failures, project changes, and editor disposal interact?
- How should declaration order be preserved when plugins finish loading in a different order?
- Which shared palette and sprite resources must be ready before a lazy-loaded drawer can render?

## Success Criteria

- [ ] Agree on and document the loading, activation, and readiness contract.
- [ ] Production builds demonstrate that optional plugin implementations can be excluded from initial loading.
- [ ] Plugins retain ownership of their contributions and cleanup, with independent setup for each editor.
- [ ] Delayed loading preserves project behavior and the first supported interaction.
- [ ] Cover load failure, concurrent editors, registration order, and disposal during loading.

## Affected Components

- `packages/editor/packages/editor-default/src/index.ts` - Standard plugin composition and import boundaries.
- `packages/editor/packages/editor-core/src/plugins.ts` - Installation order and plugin lifecycle.
- `packages/editor/packages/editor-core/src/index.ts` - Initialization and readiness of editor services.
- `packages/editor/plugins/*/` - Plugin entry points and loading boundaries.
- Editor website builds - Emitted chunks, initial downloads, and activation timing.

## Related Items

- [TODO 486: Lazy-load editing features on entering edit mode](486-lazy-load-editing-features-on-edit-mode.md)
- [TODO 483: Lazy-load WASM overlay rendering](483-lazy-load-wasm-overlay-rendering.md)
- [TODO 509: Rebuild editor colors from a small base palette](archived/509-rebuild-editor-colors-from-base-palette.md)

## References

- [Editor plugin contract](../../packages/editor/packages/editor-core/README.md#plugins)
- [Plugin extraction PR #1218](https://github.com/8f4e/8f4e/pull/1218)

## Notes

The loader API and activation policy remain open. Implementation is outside the current plugin extraction scope.
