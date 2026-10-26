export const FONT_COLUMNS = 16;
export const BACKGROUND_COLUMNS = 32;
export const BACKGROUND_ROWS = 16;

/** Shape-only layout; colors never affect atlas dimensions or source rectangles. */
export function createAtlasLayout(characterWidth: number, characterHeight: number) {
	const font = { x: 0, y: 0, width: FONT_COLUMNS * characterWidth, height: 8 * characterHeight };
	const background = {
		x: 0,
		y: font.height,
		width: BACKGROUND_COLUMNS * characterWidth,
		height: BACKGROUND_ROWS * characterHeight,
	};
	return {
		width: background.width,
		height: background.y + background.height,
		font,
		background,
		fill: { x: font.width, y: 0, spriteWidth: 1, spriteHeight: 1 },
	};
}
