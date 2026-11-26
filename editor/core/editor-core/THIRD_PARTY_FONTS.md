# Third-Party Fonts

This package includes converted and/or derived bitmap fonts based on upstream open source font projects.

The converted fonts are stored in the editor sprite-generator font sources under:

- `editor/core/sprite-generator/src/fonts/`

This file documents the upstream projects, the local derived font names, and the committed license texts that should be kept with redistributions of this package.

## Terminus

- Upstream project: Terminus Font
- Local derived fonts:
  - `terminus8x16`
  - `terminus8x16bold`
  - `terminus10x18`
  - `terminus12x24`
  - `terminus12x24bold`
- License: SIL Open Font License 1.1
- Local license text: `editor/licenses/terminus-OFL-1.1.txt`

Notes:

- Terminus is distributed with the Reserved Font Name "Terminus Font".
- These editor font assets are converted derivatives used inside the application sprite pipeline.
- Redistributions should keep the OFL copyright and license text.

## Spleen

- Upstream project: Spleen
- Local derived fonts:
  - `spleen5x8`
  - `spleen6x12`
  - `spleen8x16`
  - `spleen16x32`
- License: BSD 2-Clause
- Local license text: `editor/licenses/spleen-BSD-2-Clause.txt`

Notes:

- Redistributions should retain the copyright notice, license conditions, and disclaimer.

## Cozette

- Upstream project: Cozette
- Local derived fonts:
  - `kana12x13`
- License: MIT
- Local license text: `editor/licenses/cozette-MIT.txt`
- Upstream project: [the-moonwitch/Cozette](https://github.com/the-moonwitch/Cozette)

Notes:

- `kana12x13` is a stylistic derivative built from glyphs extracted from Cozette.
- Redistributions should keep the MIT license text with this derivative.

## X11 Misc Fixed

- Upstream project: [Markus Kuhn's Unicode fonts for X11](https://www.cl.cam.ac.uk/~mgk25/ucs-fonts.html)
- Local converted font: `x11miscfixed6x10`
- Source bitmap: `6x10.bdf` from the upstream [X11 font archive](https://www.cl.cam.ac.uk/~mgk25/download/ucs-fonts.tar.gz)
- License: Public domain
- Local notice: `editor/core/editor-core/licenses/x11-misc-fixed-public-domain.txt`

The bundled glyphs are converted from the upstream 6×10 BDF font.

## Oldschool PC fonts

- Upstream project: [VileR's Ultimate Oldschool PC Font Pack v2.2](https://int10h.org/oldschool-pc-fonts/)
- Local converted fonts: `ibmvga8x16`, `olivettithin8x16`, `eaglespcgaalt38x8`
- Source bitmaps: `Bm437_IBM_VGA_8x16.otb`, `Bm437_OlivettiThin_8x16.otb`, `Bm437_EagleSpCGA_Alt3.otb`
- License: Creative Commons Attribution-ShareAlike 4.0 International
- Local license text: `editor/core/editor-core/licenses/oldschool-pc-CC-BY-SA-4.0.txt`

The CP437 glyphs are converted derivatives of VileR's bitmap reproductions. Existing printable ASCII designs are
retained. Redistributions must preserve attribution and follow the upstream license.

EagleSpCGA Alt3 uses the pack's original 8×8 bitmap strike. Its source SHA-256 is
`27a6a80f72b0e541c655cd7085f255c258a0a7b655203afebd994bdc7ff8989f`.
`tools/bitmap-sfnt-to-bdf.py` exports that strike with its Unicode cmap explicitly, preserving character identities
despite the source also containing a Macintosh cmap. The converted pixels were compared against the independent
Windows `.FON` strike from the same release.

## Star Trek 25th Anniversary

- Upstream: [Patrick H. Lauke's recreation of the 1992 DOS game font](https://www.fontstruct.com/fontstructions/show/724564/star_trek_25th_anniversary)
- Local converted font: `startrek25th8x9`
- Source: `star-trek-25th-anniversary.otf`, Copyright Patrick H. Lauke 2012
- Source SHA-256: `6c33f1d0ea5b52d6268b0fee9ea019968817b488fda6a84d9b9336c4c01bdd70`
- License: Creative Commons Attribution 3.0 Unported
- Local license and original archive notices: `editor/core/editor-core/licenses/startrek25th-CC-BY-3.0.txt`

The outlines use a 250-unit pixel grid. The conversion preserves the pixels and packs them into fixed 8×9 cells,
including the wider ampersand and sharp S. This normalizes the original font's mostly six-pixel character advances
without clipping its wider glyphs. No smoothing or rescaling is applied.

## Dilithium Pixels NBP

- Upstream: [Nate Halley's pixel interpretation of the original Star Trek title lettering](https://www.fontspace.com/dilithium-pixels-nbp-font-f14471)
- Local converted font: `dilithiumpixels7x10`
- Source: `DilithiumPixelsNbpRegular-B5jd.ttf`, Copyright Nate Halley 2012
- Source SHA-256: `1b8e23f929eefc5b570077166b64c6c00ebf431b0aec6da0dd35a149b5ec4a55`
- License declared in the font: Creative Commons Attribution-ShareAlike 3.0 Unported
- Local notice and license: `editor/core/editor-core/licenses/dilithium-pixels-CC-BY-SA-3.0.txt`

The downloaded font's embedded license fields (name IDs 13 and 14) specify CC BY-SA 3.0; the download site's
non-commercial summary differs from that declaration. The conversion follows the font's declared license and
preserves its 64-unit pixel grid and seven-pixel advance in 7×10 cells.

## Departure Mono 14

- Original font: [Departure Mono](https://github.com/rektdeckard/departure-mono), Copyright 2022–2024 Helena Zhang
- Bitmap derivative: [Andor Polgar's Departure Mono 14](https://github.com/andorthehood/departure-mono-14)
- Local converted font: `departuremono7x14`
- Source: `DepartureMono14-Regular.bdf` from [v1.500.14](https://github.com/andorthehood/departure-mono-14/releases/tag/v1.500.14)
- Source SHA-256: `77174d50938d683b962f6b5c86e4ba1a0e10d86cc6303f0cc69892f716b57459`
- License: SIL Open Font License 1.1
- Local license text: `editor/core/editor-core/licenses/departure-mono-OFL-1.1.txt`

The conversion uses the corrected 7×14 BDF directly, retaining its glyph pixels and cell metrics. Unencoded
OpenType alternates are not used by the editor's fixed CP437 glyph mapping.

## PixelCode

- Upstream: [Qwerasd's Pixel Code](https://github.com/qwerasd205/PixelCode)
- Local converted font: `pixelcode6x12`
- Source: regular `PixelCode.otf` from [v2.2](https://github.com/qwerasd205/PixelCode/releases/tag/v2.2), commit `c76d751bf0fe8a992f97ea2a3447b6ce25926406`
- Source SHA-256: `940e8182f913be2f1f080848514515dbfd201c138cf40c4ca1f13d7914573342`
- License: SIL Open Font License 1.1
- Local license: `editor/core/editor-core/licenses/pixelcode-OFL-1.1.txt`

The regular outline uses 112 font units per design pixel, six-pixel character advances, and a 6×12 cell with
ten pixels above the baseline and two below. Conversion samples that original pixel grid without smoothing.
The editor uses individual CP437 glyphs; OpenType ligatures, contextual substitutions, and other weights are not applied.

## Sergamon

- Upstream: [Sergamon Contributors](https://github.com/sgmonda/sergamon)
- Local converted font: `sergamon8x16`
- Source: `.glyph` grids and `font-config.json` from [v2.2.3](https://github.com/sgmonda/sergamon/releases/tag/v2.2.3), commit `d2ad073fb1718287696fc679eada481984edde48`
- License: SIL Open Font License 1.1
- Local license: `editor/core/editor-core/licenses/sergamon-OFL-1.1.txt`

`tools/sergamon-to-bdf.mjs` preserves the native 8×16 grids and the configured baseline (13 pixels above, three below).
The single upstream weight is used directly, with no synthetic bold or outline rasterization.

## Scientifica

- Upstream: [Akshay Oppiliappan's Scientifica](https://github.com/oppiliappan/scientifica)
- Local converted font: `scientifica5x11`
- Source: regular `scientifica-11.bdf` from [v2.3](https://github.com/oppiliappan/scientifica/releases/tag/v2.3), commit `6b31fa5d24df2949c7987f6fa349e6ef86e2fc00`
- Source SHA-256: `d298f1fe8ce2234a1ecaeff7ab7c9db7cf47b74b658f4e8d614a7f4e8e702049`
- License: SIL Open Font License 1.1
- Local license: `editor/core/editor-core/licenses/scientifica-OFL-1.1.txt`

The conversion uses the native five-pixel advance and eleven-pixel line metrics (ascent nine, descent two).
Before import, the BDF's global `FONTBOUNDINGBOX 6 12 -1 -2` is normalized to `5 11 0 -2`; all imported CP437
pixels fit within that cell, so no selected glyph pixels are clipped. Bold, italic, and editor-specific ligature
substitutions are not used.

Scientifica credits [romeovs's Creep](https://github.com/romeovs/creep) for most Basic Latin characters,
[Raymond W. Ko's Creep2](https://github.com/raymond-w-ko/creep2) for terminal optimizations, and
[Lemon/artwiz](https://artwizaleczapka.sourceforge.net/) as the basis of some characters.

## Tom Thumb

- Upstream: [Robey Pointer's Tom Thumb](https://robey.lag.net/2010/01/23/tiny-monospace-font.html), based on Brian Swetland's 4×6 font
- Local converted font: `tomthumb4x6`
- Source: [`tom-thumb.bdf`](https://github.com/fontpixel/fontpixel.com/blob/b9fb9cec467b828d07a6bf711f9980237f036fe9/fonts/tom-thumb/tom-thumb.bdf), mirrored by FontPixel
- Source SHA-256: `d07edd9d110a5106d6a19c6bac4897650f1b1a0fba2c6923b75e51dcc2b7ea0b`
- License: CC0 1.0 Universal (the 2015 update to the upstream release also permits CC BY 3.0)
- Local license: `editor/core/editor-core/licenses/tom-thumb-CC0-1.0.txt`

The global BDF bounding box is expanded from three to four pixels wide to retain the four-pixel advance,
with five pixels above the baseline and one below. Existing glyph pixels are unchanged.

## Not Jam Mono Prophet and Mono Crooked

- Upstream: [Not Jam Mono Prophet 8](https://not-jam.itch.io/not-jam-mono-prophet-8) and [Not Jam Mono Crooked 8](https://not-jam.itch.io/not-jam-mono-crooked-8)
- Local converted fonts: `notjammonoprophet8x8`, `notjammonocrooked8x8`
- Source: FontPixel's BDF conversions of the 8-pixel TTFs, at commit `b9fb9cec467b828d07a6bf711f9980237f036fe9`:
  - [`Not-Jam-Mono-Prophet-8-8px.bdf`](https://github.com/fontpixel/fontpixel.com/blob/b9fb9cec467b828d07a6bf711f9980237f036fe9/fonts/not-jam-mono-prophet/Not-Jam-Mono-Prophet-8-8px.bdf), SHA-256 `6e86829b1d825e5884172f843449460d424ea7e76d04197b09faffe57ea4390d`
  - [`Not-Jam-Mono-Crooked-8-8px.bdf`](https://github.com/fontpixel/fontpixel.com/blob/b9fb9cec467b828d07a6bf711f9980237f036fe9/fonts/not-jam-mono-crooked/Not-Jam-Mono-Crooked-8-8px.bdf), SHA-256 `5708fd190e249086e519f969ce1d473fa2a11813065d9b3e723835bcd46ca903`
- License: CC0 1.0 Universal
- Local license: `editor/core/editor-core/licenses/not-jam-CC0-1.0.txt`

The BDFs retain the native eight-pixel design grid. Their seven-pixel global glyph bounding boxes are
expanded to match the eight-pixel advances; the line height remains eight pixels. Missing CP437 glyphs,
including most box-drawing and interface symbols, are blank.

## Kirsch

- Upstream: [The kirsch Project Authors](https://github.com/molarmanful/kirsch)
- Local converted font: `kirsch6x16`
- Source: [`src/kirsch.bdf`](https://github.com/molarmanful/kirsch/blob/53d7a955172cdd34be61eced03c7d4d08a3fd05c/src/kirsch.bdf), version 0.7.3 source snapshot, commit `53d7a955172cdd34be61eced03c7d4d08a3fd05c`
- Source SHA-256: `f7b9d5761beaf4195232d623e9c7ae448423085f8a2302828e8ec4f1c7a2cd0d`
- License: SIL Open Font License 1.1
- Local license: `editor/core/editor-core/licenses/kirsch-OFL-1.1.txt`

The BDF's global bounding box is normalized to its six-pixel advance and sixteen-pixel line height
(ascent twelve, descent four). Printable ASCII fits without clipping. The fixed-cell import clips pixels that
extend beyond the cell in 52 extended CP437 glyphs, including box-drawing characters.

## Unscii Fantasy

- Upstream: [Viznut's Unscii](https://viznut.fi/unscii/)
- Local converted font: `unsciifantasy8x8`
- Source: [`unscii-8-fantasy.hex`](https://github.com/viznut/unscii/blob/257b4dfeb50651510fe8b9cf4f151a148a4490e4/fontfiles/unscii-8-fantasy.hex), commit `257b4dfeb50651510fe8b9cf4f151a148a4490e4`
- Source SHA-256: `7fbda7ebec089ac10ba9b8888b8ca1cad97e0e84788cb7d2b4fbd5bff1d20cc4`
- License: Public domain (or CC0, per the upstream README)
- Local notice: `editor/core/editor-core/licenses/unscii-public-domain.txt`

The upstream HEX-to-BDF converter retains the eight-pixel square bitmap strikes before the CP437 import.
The GPL-licensed `unscii-16-full` variant is not used.

## CP437 conversion sources

Each bundled font contains 256 CP437 slots. Extended glyphs come from the upstream BDF sources for Terminus,
Spleen, Cozette, and X11 Misc Fixed, and the Oldschool PC bitmap fonts listed above. TempleOS uses
[Rendello's bitmap conversion](https://github.com/rendello/templeos_font). The two larger bundled Spleen faces use
the upstream CP437 BDFs, which include the graphical control-range symbols. Existing printable ASCII designs
are retained, and unavailable glyphs are blank. The remaining conversion sources above also map their available
Unicode characters into those slots. Upstream font files are downloaded separately and are not bundled in this
repository.
