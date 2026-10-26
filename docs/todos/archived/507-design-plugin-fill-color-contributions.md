---
title: 'TODO: Design plugin fill-color contributions'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Cancelled
completed: 2026-10-26
---

# TODO: Design plugin fill-color contributions

## Cancellation

Cancelled on 2026-10-26. Replace feature-specific theme colors with a small shared base palette and generated lighter
and darker shades, used by both core and plugin drawers. This replaces the need for plugin-owned color registration.
The new direction is tracked in [TODO 509](509-rebuild-editor-colors-from-base-palette.md); the proposal below is
retained as history.

## Problem Description

Editor plugins can contribute widget directives and drawers, but their fill colors still depend on the core palette.
The extracted switch plugin uses `fill.switchBackground`, which remains declared in the core color scheme and is
also used by the extracted button plugin. Adding another plugin-owned fill currently requires changes to core types,
configuration validation, and sprite-atlas generation. The tooltips plugin also uses core-owned tooltip background
and stack-highlight fills; its tooltip font colors remain in the core text palette as well. The wave plugin uses
core-owned waveform fills and the shared scan-line fill.

Designing this contribution point spans more of the rendering and configuration pipeline than the initial plugin
extraction. Defer it to a separate follow-up so the current work stays focused on state, directive, and drawer
contributions.

## Proposed Idea

Explore a per-editor fill-color registry exposed during plugin setup. A possible API is
`fillColors.register('switchBackground', '#000')`, returning an unregister function owned by the plugin.

Use the registered names and defaults consistently for:

- Resolving project overrides such as `@config color.fill.switchBackground #223344`.
- Recognizing contributed configuration paths in the existing color validator.
- Allocating fill sprites and generating their lookup entries in the atlas.
- Rebuilding the atlas after font or theme changes, with drawers reading the current resolved sprite IDs.

The switch would own its fill declaration, and the button would have its own background color. Core would retain
generic color configuration and atlas machinery without declaring individual plugin color names in its types.

## Open Questions

- Where should the registry live so configuration validation and both initial and subsequent atlas generation use
  the same catalog?
- What naming convention should distinguish plugin colors, and how should defaults and project overrides combine?
- How should contributed fill names appear in the public sprite lookup types?
- What is the smallest setup-time registration contract that fits plugin-owned cleanup?
- Which existing shared theme roles should remain generic, and which colors belong to individual plugins?

## Success Criteria

- [ ] Agree on and document the registration, configuration, and sprite-lookup contract.
- [ ] Plugins can declare fill colors without adding feature-specific names to the core palette or types.
- [ ] Project color overrides and atlas rebuilds work for contributed fills.
- [ ] Registrations remain isolated between editor instances and are cleaned up by their plugins.
- [ ] Cover defaults, overrides, plugin omission, instance isolation, and font/theme rebuilds.

## Affected Components

- `packages/editor/packages/editor-core/src/` - Plugin context, initial sprite generation, and sprite-sheet rebuilds.
- `packages/editor/packages/editor-core/packages/editor-state/src/features/color/` - Color configuration validation.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/` - Palette types, atlas layout,
  fill generation, and sprite lookups.
- `packages/editor/packages/editor-plugin-switch/` - Plugin-owned fill declaration and drawing.
- `packages/editor/packages/editor-plugin-button/` - Button background and knob fills.
- `packages/editor/packages/editor-plugin-wave/` - Waveform background, samples, and playhead fills.
- `packages/editor/packages/editor-plugin-tooltips/` - Tooltip background and stack-highlight fills.

## References

- [Plugin extraction PR #1218](https://github.com/8f4e/8f4e/pull/1218)
- [Editor plugin contract](../../../packages/editor/packages/editor-core/README.md#plugins)
- [Color configuration paths](../../../packages/editor/packages/editor-core/docs/color-paths.md)

## Notes

The registry API above is a design candidate. Its final shape is intentionally undecided; implementation is outside
the current plugin extraction scope.
