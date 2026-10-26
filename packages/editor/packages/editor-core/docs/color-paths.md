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

`PALETTE_INDICES` exposes stable numeric indices for every shade, opacity variant, and shared material. Drawers choose
these indices directly: `draw.drawFill(x, y, PALETTE_INDICES.primaryDark2, width, height)` and
`draw.drawText(x, y, text, PALETTE_INDICES.inkOn)` reuse the same fill mask and glyph table across unrelated controls.
Local visual choices belong to drawers rather than theme configuration. Equal resolved colors keep separate indices
so a theme change can make them diverge without rebuilding projections.

Connector icons are composed at runtime: a `surfaceRaised2` fill sits behind input brackets in `primaryBase` or output
brackets in `secondaryBase`. Output stars select `primaryDark3`, `primaryDark2`, `primaryDark1`, `primaryBase`,
`warningBase`, or `negativeBase` from the calibrated value. There are no dedicated input or feedback-scale atlas entries.

The sprite atlas contains color-independent R8 coverage masks: one glyph set, one fully covered fill texel, and one
background pattern. All palette entries can color text, including `Alpha30/60/90` variants. Background rendering draws
a `canvasBase` fill and layers the same pattern mask in `canvasDetail2` and `canvasDetail1`, offset by one character cell.
The vertex shader fetches the selected RGBA8 entry and premultiplies it; the fragment shader applies red-channel mask
coverage. Sprite instances retain the 20-byte position/size/uint16-shape/uint16-palette layout.

`@8f4e/editor-palette` owns the pure color model, stable indices, and `toPaletteBytes()` conversion. The editor installs
the generated masks and separately resolved palette. Theme changes upload only palette colors and refresh line-rendered wire colors;
font changes rebuild masks and source lookups. Font builds leave the active palette untouched, and
stale asynchronous font builds are ignored.
