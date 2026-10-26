import { FONT_PALETTE_TOKENS, PALETTE_TOKENS, type PaletteColors } from '@8f4e/editor-palette';

export const TEXT_COLOR_NAMES = FONT_PALETTE_TOKENS;
export const FILL_COLOR_NAMES = PALETTE_TOKENS;

const FONT_COLUMNS = 128;
const BACKGROUND_COLUMNS = 64;
export const FILL_COLOR_COLUMNS = 64;
const BACKGROUND_ROWS = 32;
const FEEDBACK_SCALE_SLOT_COUNT = 6;
const FEEDBACK_SCALE_ITEM_COLUMNS = 3;
const ICON_CHARACTER_WIDTHS = [3] as const;

function columnsToPixels(columns: number, characterWidth: number): number {
	return columns * characterWidth;
}

function rowsToPixels(rows: number, characterHeight: number): number {
	return rows * characterHeight;
}

function createSection(
	xColumns: number,
	yRows: number,
	widthColumns: number,
	heightRows: number,
	characterWidth: number,
	characterHeight: number
) {
	const x = columnsToPixels(xColumns, characterWidth);
	const y = rowsToPixels(yRows, characterHeight);
	const width = columnsToPixels(widthColumns, characterWidth);
	const height = rowsToPixels(heightRows, characterHeight);

	return {
		xColumns,
		yRows,
		widthColumns,
		heightRows,
		x,
		y,
		width,
		height,
		right: x + width,
		bottom: y + height,
	};
}

export function createAtlasLayout(characterWidth: number, characterHeight: number, colors: PaletteColors) {
	const fontRows = new Set(TEXT_COLOR_NAMES.map(token => colors[token])).size;
	const backgroundYRows = fontRows;
	const sidebarXColumns = BACKGROUND_COLUMNS;
	const feedbackScaleYRows = backgroundYRows;
	const fillColorsYRows = feedbackScaleYRows + 1;
	const fillColorRows = Math.ceil(FILL_COLOR_NAMES.length / FILL_COLOR_COLUMNS);
	const iconsYRows = fillColorsYRows + fillColorRows;

	const feedbackScaleWidthColumns = FEEDBACK_SCALE_SLOT_COUNT * FEEDBACK_SCALE_ITEM_COLUMNS;
	const fillColorsWidthColumns = Math.min(FILL_COLOR_NAMES.length, FILL_COLOR_COLUMNS);
	const iconsWidthColumns = ICON_CHARACTER_WIDTHS.reduce((sum, width) => sum + width, 0);
	const sidebarWidthColumns = Math.max(feedbackScaleWidthColumns, fillColorsWidthColumns, iconsWidthColumns);

	const font = createSection(0, 0, FONT_COLUMNS, fontRows, characterWidth, characterHeight);
	const background = createSection(
		0,
		backgroundYRows,
		BACKGROUND_COLUMNS,
		BACKGROUND_ROWS,
		characterWidth,
		characterHeight
	);
	const feedbackScale = createSection(
		sidebarXColumns,
		feedbackScaleYRows,
		feedbackScaleWidthColumns,
		1,
		characterWidth,
		characterHeight
	);
	const fillColors = createSection(
		sidebarXColumns,
		fillColorsYRows,
		fillColorsWidthColumns,
		fillColorRows,
		characterWidth,
		characterHeight
	);
	const icons = createSection(sidebarXColumns, iconsYRows, iconsWidthColumns, 1, characterWidth, characterHeight);

	return {
		canvasWidth: Math.max(
			font.right,
			background.right,
			columnsToPixels(sidebarXColumns + sidebarWidthColumns, characterWidth)
		),
		canvasHeight: Math.max(background.bottom, icons.bottom),
		font,
		background,
		feedbackScale,
		fillColors,
		icons,
	};
}
