# Third-Party Fonts

This package includes converted and/or derived bitmap fonts based on upstream open source font projects.

The converted fonts are stored in the editor sprite-generator font sources under:

- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/`

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
- Local license text: `packages/editor/licenses/terminus-OFL-1.1.txt`

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
- Local license text: `packages/editor/licenses/spleen-BSD-2-Clause.txt`

Notes:

- Redistributions should retain the copyright notice, license conditions, and disclaimer.

## Cozette

- Upstream project: Cozette
- Local derived fonts:
  - `kana12x13`
- License: MIT
- Local license text: `packages/editor/licenses/cozette-MIT.txt`
- Upstream project: [the-moonwitch/Cozette](https://github.com/the-moonwitch/Cozette)

Notes:

- `kana12x13` is a stylistic derivative built from glyphs extracted from Cozette.
- Redistributions should keep the MIT license text with this derivative.

## X11 Misc Fixed

- Upstream project: [Markus Kuhn's Unicode fonts for X11](https://www.cl.cam.ac.uk/~mgk25/ucs-fonts.html)
- Local converted font: `x11miscfixed6x10`
- Source bitmap: `6x10.bdf` from the upstream [X11 font archive](https://www.cl.cam.ac.uk/~mgk25/download/ucs-fonts.tar.gz)
- License: Public domain
- Local notice: `packages/editor/packages/editor-core/licenses/x11-misc-fixed-public-domain.txt`

The bundled ASCII glyphs are converted from the upstream 6×10 BDF font.
