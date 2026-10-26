---
title: 'TODO: Rebuild editor colors from a small base palette'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Open
completed: null
---

# TODO: Rebuild editor colors from a small base palette

## Problem Description

The editor color system defines many colors around individual features, including controls, waveforms, and tooltips.
Each new feature adds palette configuration and rendering entries. Extracted plugins still depend on these
feature-specific declarations in core, even when they own the rest of their drawing behavior.

Rewrite the color system around a few shared base colors. Generate lighter and darker shades from those colors and
let drawers select the shades they need. Theme configuration should describe the base palette rather than enumerate
the colors of every feature.

## Proposed Direction

- Define a small base palette with names independent of particular features or plugins.
- Generate a consistent set of lighter and darker versions of each base color in the shared color system.
- Expose the resolved shades to core and plugin drawers through the rendering and sprite APIs.
- Use the same palette for fills, text, and other drawer colors. A drawer chooses a base color and shade for each
  visual state instead of requiring a dedicated theme key.
- Keep shade generation centralized so drawers do not implement separate lightening and darkening rules.

This replaces the cancelled plugin fill-color contribution proposal in
[TODO 507](archived/507-design-plugin-fill-color-contributions.md). Plugins should use the shared palette; they do
not need a registry for declaring their own feature-specific colors.

## Implementation Plan

1. Inventory the existing color configuration, palette types, sprite entries, and drawer consumers.
2. Choose the base colors, shade levels, and generation rules, with clear names for selecting resolved shades.
3. Replace feature-specific configuration and palette types, and update sprite generation and lookups to use the
   generated shades.
4. Migrate core and plugin drawers, bundled themes, examples, and color documentation to the new palette.
5. Verify theme changes and font/atlas rebuilds, and review screenshots of the migrated drawers.

## Open Questions

- Which small set of base colors is sufficient for the editor?
- How many lighter and darker shades should each color provide, and how should drawers name them?
- Which color space and lightness rules should generate the shades?
- How should the shared shade catalog be represented in text, fill, and other sprite lookups?

## Success Criteria

- [ ] Theme authors configure a small base palette instead of feature-specific colors.
- [ ] Lighter and darker shades are generated consistently from the configured base colors.
- [ ] Core and plugin drawers use the same resolved shade catalog.
- [ ] Adding a feature or plugin does not require adding a feature-specific color key to core.
- [ ] Feature-specific palette declarations and their old configuration paths are removed from the migrated system.
- [ ] Theme changes and atlas rebuilds refresh the shades used by all drawers.
- [ ] Tests cover shade generation and theme updates, and drawer screenshots are reviewed.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/color/` - Color configuration and validation.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/` - Palette types, shade generation,
  atlas entries, and sprite lookups.
- `packages/editor/packages/editor-core/packages/web-ui/src/` - Core drawers and rendering primitives.
- `packages/editor/packages/editor-plugin-*/` - Plugin drawers that currently use feature-specific palette entries.
- `packages/editor/packages/editor-core/src/` - Initial sprite generation and theme/font rebuilds.
- Bundled themes, example projects, color documentation, and rendering fixtures.

## Related Items

- [TODO 504: Add a color-theme contrast audit tool](504-add-color-theme-contrast-audit-tool.md)
- [TODO 508: Design lazy loading for editor plugins](508-design-editor-plugin-lazy-loading.md)

## References

- [Current color configuration paths](../../packages/editor/packages/editor-core/docs/color-paths.md)
- [Editor plugin contract](../../packages/editor/packages/editor-core/README.md#plugins)
