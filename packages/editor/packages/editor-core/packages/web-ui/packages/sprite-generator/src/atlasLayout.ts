export const FONT_COLUMNS = 16;
export const GLYPH_COUNT = 128;

/** Shape-only layout; colors never affect atlas dimensions or source rectangles. */
export function createAtlasLayout(characterWidth: number, characterHeight: number) {
	return {
		width: FONT_COLUMNS * characterWidth,
		height: Math.ceil((GLYPH_COUNT + 1) / FONT_COLUMNS) * characterHeight,
		fill: {
			x: (GLYPH_COUNT % FONT_COLUMNS) * characterWidth,
			y: Math.floor(GLYPH_COUNT / FONT_COLUMNS) * characterHeight,
		},
	};
}
