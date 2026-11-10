#!/usr/bin/env python3
"""Convert pixel-grid TTF/OTF outlines to a fixed-cell BDF without antialiasing.

Requires fontTools. Callers provide the original design grid and desired cell
metrics; this tool trusts that the outlines describe pixels on that grid.
"""

import argparse
import json
from pathlib import Path

from fontTools.pens.pointInsidePen import PointInsidePen
from fontTools.ttLib import TTFont


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--units-per-pixel', type=int, required=True)
    parser.add_argument('--width', type=int, required=True)
    parser.add_argument('--height', type=int, required=True)
    parser.add_argument('--ascent', type=int, required=True)
    args = parser.parse_args()

    font = TTFont(args.source)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    descent = args.height - args.ascent
    padded_width = ((args.width + 7) // 8) * 8
    lines = [
        'STARTFONT 2.1',
        'COMMENT Exact pixel-grid conversion; fixed-cell spacing',
        f'FONT {font["name"].getDebugName(6)}',
        f'SIZE {args.height} 75 75',
        f'FONTBOUNDINGBOX {args.width} {args.height} 0 {-descent}',
        'STARTPROPERTIES 5',
        f'FONT_ASCENT {args.ascent}',
        f'FONT_DESCENT {descent}',
        'CHARSET_REGISTRY "ISO10646"',
        'CHARSET_ENCODING "1"',
        f'COPYRIGHT {json.dumps(font["name"].getDebugName(0))}',
        'ENDPROPERTIES',
        f'CHARS {len(cmap)}',
    ]
    for codepoint, name in sorted(cmap.items()):
        lines.extend([
            f'STARTCHAR uni{codepoint:04X}',
            f'ENCODING {codepoint}',
            'SWIDTH 500 0',
            f'DWIDTH {args.width} 0',
            f'BBX {args.width} {args.height} 0 {-descent}',
            'BITMAP',
        ])
        for row in range(args.height):
            bits = 0
            for column in range(args.width):
                point = (
                    (column + 0.5) * args.units_per_pixel,
                    (args.ascent - row - 0.5) * args.units_per_pixel,
                )
                pen = PointInsidePen(glyphs, point)
                glyphs[name].draw(pen)
                if pen.getResult():
                    bits |= 1 << (padded_width - column - 1)
            lines.append(f'{bits:0{padded_width // 4}X}')
        lines.append('ENDCHAR')
    lines.append('ENDFONT')
    args.output.write_text('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
