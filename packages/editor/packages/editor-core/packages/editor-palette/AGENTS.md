# Editor Palette

- Own the base palette, validation, fixed shades, generic aliases, and normalized RGBA values here.
- Own stable token-to-index mapping and straight-alpha RGBA8 palette encoding; equal colors retain distinct indices.
- Keep this package pure and independent of browsers, sprite generation, editor state, and plugins.
- Preserve base-color alpha from hex, rgb/rgba, and transparent inputs. Generate fixed opacity variants centrally.
- Do not add feature-specific color keys. Drawers select from the shared catalog.
- Run `npx nx run @8f4e/editor-palette:build|test|typecheck` after changes.
