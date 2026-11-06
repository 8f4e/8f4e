#!/usr/bin/env python3
"""Export a single-strike bitmap SFNT with its Unicode cmap to BDF.

Requires monobit and fontTools. Use the Unicode cmap explicitly so a legacy
Macintosh subtable cannot change the imported character identities.
"""

import argparse
from pathlib import Path

from fontTools.ttLib import TTFont
from monobit import Char, Codepoint, load, save


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    font, = load(args.source)
    glyphs = tuple(
        font.get_glyph(tag=name).modify(labels=(Char(chr(codepoint)), Codepoint(codepoint)))
        for codepoint, name in sorted(TTFont(args.source).getBestCmap().items())
    )
    save(font.modify(glyphs=glyphs, encoding='unicode'), args.output, format='bdf', overwrite=True)


if __name__ == '__main__':
    main()
