---
title: 'TODO: Separate browser-dependent plugin lists'
priority: Low
effort: TBD
created: 2026-10-27
issue: null
status: Open
completed: null
---

# TODO: Separate browser-dependent plugin lists

## Problem Description

Browser-independent plugins and plugins that require browser APIs currently share one composition list. Hosts
cannot see that distinction where they choose the editor's features. A browser-dependent plugin may use browser
globals directly or receive browser objects through factory arguments; dependency injection alone does not make
it browser-independent.

## Proposed Solution

Expose separate `plugins` and `browserPlugins` lists at the browser editor's composition boundary:

```ts
mountDefaultEditor(canvas, {
	plugins: [toggleFavoritePlugin, removeMemoryConnectionsPlugin],
	browserPlugins: [binaryAssetsPlugin, screenshotPlugin],
});
```

The example browser plugins are instances constructed with any resources needed for that editor. Keep the shared
`EditorPlugin` setup/disposal contract and browser-independent setup context. The browser composition combines the
two lists for the existing installer. The distinction should be visible at the call site without requiring plugin
name suffixes or a `requiresBrowser` flag.

## Implementation Plan

1. Classify the standard plugins by their actual API dependencies and split the default composition accordingly.
2. Add the two host-facing lists and decide how overriding or omitting each default list works.
3. Define installation order across the lists, update host examples, and cover composition and disposal behavior.

## Success Criteria

- [ ] Host configuration visibly separates browser-independent and browser-dependent plugins.
- [ ] The shared plugin contract and context remain browser-independent.
- [ ] Default composition, explicit overrides, and empty lists have documented behavior.
- [ ] Installation order preserves required menu, directive, and drawing relationships.
- [ ] Each editor retains independent plugin instances and plugin-owned cleanup.

## Affected Components

- `packages/editor/packages/editor-default/src/index.ts` - Default plugin composition and host options.
- `packages/editor/packages/editor-core/src/plugins.ts` - Shared installation contract and lifecycle.
- Editor host examples and plugin documentation - Show the separate lists.

## Risks & Considerations

Splitting a previously interleaved list must account for order-sensitive registrations, particularly overlays.
Keep classification visible without introducing a second installation lifecycle. Type or dependency enforcement
can be considered separately from the initial composition change.

## Related Items

- [TODO 508: Design lazy loading for editor plugins](archived/508-design-editor-plugin-lazy-loading.md)

## References

- [Editor plugin contract](../../packages/editor/packages/editor-core/README.md#plugins)
- [Default editor composition](../../packages/editor/packages/editor-default/README.md)

## Notes

The separate-list approach was preferred during plugin extraction discussions. Implementation is deferred.

## Archive Instructions

When completed, set `status: Completed` and the completion date, move this file to `archived/`, and update
`_index.md` to move its entry to Completed TODOs.
