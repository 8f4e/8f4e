# Base Palette

Projects configure a small palette with `; @config color.<name> <value>`. The editor generates a fixed catalog of shades
and opacity variants before building its sprite atlas. No colors are lightened, darkened, or tinted during drawing.

```txt
; @config color.canvas #660099
; @config color.surface #1a0b24
; @config color.ink #f6eff8
; @config color.primary #d9a6ff
; @config color.muted #b79ad0
; @config color.secondary #f2c879
; @config color.tertiary #a99bcb
; @config color.highlight #f2c879
; @config color.detail #78bceb
; @config color.stroke rgba(227,175,255,0.6)
```

## Configurable Colors

| Path | Purpose | Default |
| --- | --- | --- |
| `color.canvas` | Canvas behind code blocks | `transparent` |
| `color.surface` | Code blocks and panels | `rgba(0,0,0,0.9)` |
| `color.ink` | Main foreground | `#cccccc` |
| `color.primary` | Main accent | `#ffffff` |
| `color.muted` | Subdued foreground | Generated from ink, primary, and surface |
| `color.secondary` | Additional accent | Resolved `primary` |
| `color.tertiary` | Supporting accent, including comments | Generated from muted and surface |
| `color.highlight` | Bright accent for visualizations | Resolved `secondary` (including alpha) |
| `color.detail` | Additional contrasting accent | Resolved `primary` |
| `color.stroke` | Shared lines and outlines | Primary at 30% opacity |
| `color.positive` | Positive states | `#00ff00` |
| `color.warning` | Caution states | `#ffff00` |
| `color.negative` | Negative states | `#ff0000` |

Four colors establish the main theme. Optional accents retain an existing theme's independent hues without adding
feature-specific configuration. For example, Aurora uses mint primary, yellow secondary and highlight, purple tertiary,
blue detail, and translucent mint strokes. Every field is optional and has a shared fallback. Canvas and surface remain
independent. Accents are authored directly; the resolver does not invent complementary or hue-rotated colors.

Accepts `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, comma-separated `rgb()` / `rgba()`, and `transparent`.
Base alpha is preserved in generated shades. For example, `color.stroke rgba(69,89,160,0.38)` retains that exact line
color and opacity; `color.canvas transparent` preserves the host background behind the editor.

The former `color.text.*`, `color.fill.*`, and `color.icons.*` paths are removed. Features and plugins do not register
additional configurable palette colors.

## Predefined Shades and Opacity

Every base provides `Dark4`, `Dark3`, `Dark2`, `Dark1`, `Base`, `Light1`, `Light2`, `Light3`, and `Light4`.
`Base` preserves the configured color and alpha. Lightness changes use fixed amounts of 10%, 25%, 50%, and 75% in Oklab.
Darkening preserves chroma until gamut mapping requires reducing it; lighter shades gradually reduce chroma toward white.
This retains stronger accent colors in shaded controls instead of washing them out.

Every base also has `Alpha30`, `Alpha60`, and `Alpha90` variants. These use the base RGB with fixed absolute alpha levels;
they do not multiply the configured alpha. Standard source-over blending combines the prepared RGBA pixels with whatever
is beneath them. Transparency and darker shades serve different purposes.

## Shared Surface and Foreground Catalog

Generic material colors derive from the anchors with predefined blending rules. Surface polarity and derived materials
use the visible, composited surface, so translucent white panels over a dark canvas retain the canvas tint:

- `canvasDetail1/2` retain the canvas hue while adding visible detail.
- `surfaceRaised1/2/3` are subtle accent-tinted surfaces; saturated surfaces retain their own hue.
- `mutedBase` is the configured subdued foreground; `inkFaint` blends it toward the surface.
- Syntax highlighting uses the authored `primaryBase`, `secondaryBase`, and `tertiaryBase` unchanged.
- `secondaryReadable` chooses a shade with at least 4.5:1 contrast on the composited base surface.
- `primarySoft` blends a small accent into the surface; `primaryStrong` supplies stronger emphasis in light themes.
- `floatingSurface`, `floatingInk`, `floatingMuted`, and `floatingAccent` supply contrasting floating materials.
- `selectionSurface` and `selectionInk` supply the selected floating material.
- `darkSurface` and `onDarkAccent` keep dark regions available in both light and dark themes.
- `inverseSurface`, `inverseInk`, and `inverseAccent` provide an inverted material, including a dark material in light themes.
- `positiveSoft` and `negativeSoft` provide status backgrounds appropriate to the inverse material.
- `inkOn` and `negativeOn` provide contrasting foregrounds; `strokeStrong` supplies an opaque outline.
- `lightBase`, `darkBase`, `black`, and `white` supply neutral endpoints and contrast fallbacks.
- `darkOverlay`, `darkOverlaySoft`, `primaryOverlay`, and `transparent` supply fixed RGBA overlays.

All rules run once during palette resolution. `secondaryReadable` applies to its documented background; drawers must still
choose contrasting pairs for other shades. This does not replace a complete contrast audit.

## Drawing API

Fill sprites expose all nine tonal shades. Fonts expose `Dark2`, `Base`, and `Light2` for each base, plus the shared
foreground materials listed in `FONT_ALIASES`: `sprites.fillColors.primaryDark2`,
`sprites.fillColors.inkBase`, and `sprites.fontInkOn` can be reused across unrelated controls. Local visual choices belong
to drawers rather than theme configuration. The primary font catalog also includes `Dark3` and `Dark1` so the
six-step output scale can use ordinary glyphs without changing its colors.

Connector icons are composed at runtime: a `surfaceRaised2` fill sits behind input brackets in `primaryBase` or output
brackets in `secondaryBase`. Output stars select `primaryDark3`, `primaryDark2`, `primaryDark1`, `primaryBase`,
`warningBase`, or `negativeBase` from the calibrated value. There are no dedicated input or feedback-scale atlas entries.

All shades and opacity variants are baked into the atlas. The extra `Alpha30/60/90` swatches are fill-only to avoid
duplicating entire font strips; text retains source alpha and the shared prepared overlays. The bounded font catalog
keeps metadata within an 8192-entry lookup texture. [TODO 510](../../../../../docs/todos/510-use-glyph-masks-and-gpu-color-palette.md)
will separate glyph masks from colors so every shade can be used for text without duplicating glyph sprites. Identical
concrete font colors share an atlas row, and fill swatches wrap within the existing atlas width.
`@8f4e/editor-palette` owns the pure color model and conversion math.
The atlas result carries its resolved palette so line-rendered wires use that exact palette, including alpha.
Theme and font changes replace the atlas and lookups together; stale asynchronous builds are ignored.
