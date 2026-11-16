import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { wrapText } from '@8f4e/editor-state';
import { CP437_CHARACTERS, FONT_CATALOG, type Font, type GlyphIds, textToGlyphIds } from '@8f4e/sprite-generator';
import type { FontChangedEvent } from '@8f4e/web-ui';

const VISIBLE_MS = 3000;
const CORNER = textToGlyphIds('+');
const CHARACTER_IDS = textToGlyphIds(CP437_CHARACTERS);
const CHARACTER_COLUMNS = 16;
const CHARACTER_ROWS = CHARACTER_IDS.length / CHARACTER_COLUMNS;

interface FontNoticeLayout {
	x: number;
	y: number;
	width: number;
	height: number;
	cellWidth: number;
	cellHeight: number;
	title: GlyphIds[];
	credits: GlyphIds[];
	characters: { x: number; y: number; id: GlyphIds[number] }[];
}

/** Keep the transient font credit panel outside modal state, source and history. */
export function installFontNotice({ store, events, drawers }: EditorPluginContext): () => void {
	const state = store.getState();
	let visibleFont: Font | undefined;
	let layout: FontNoticeLayout | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const prepare = () => {
		layout = undefined;
		if (!visibleFont) return;
		const { name, credits: creditText } = FONT_CATALOG[visibleFont];
		const { width, height, vGrid, hGrid } = state.viewport;
		if (width <= 0 || height <= 0) return;
		const columns = Math.min(60, Math.max(CHARACTER_COLUMNS, Math.floor(width / vGrid) - 4));
		const title = wrapText(name, columns);
		const credits = wrapText(creditText, columns);
		const panelColumns = Math.max(CHARACTER_COLUMNS, ...[...title, ...credits].map(line => line.length)) + 2;
		const panelRows = title.length + credits.length + 4 + CHARACTER_ROWS;
		const scale = Math.min(
			1,
			(width - 2 * Math.min(vGrid, width / 4)) / (panelColumns * vGrid),
			(height - 2 * Math.min(hGrid, height / 4)) / (panelRows * hGrid)
		);
		const cellWidth = vGrid * scale;
		const cellHeight = hGrid * scale;
		const panelWidth = panelColumns * cellWidth;
		const panelHeight = panelRows * cellHeight;
		const charactersX = (panelWidth - CHARACTER_COLUMNS * cellWidth) / 2;
		const charactersY = (title.length + credits.length + 3) * cellHeight;
		layout = {
			x: Math.floor((width - panelWidth) / 2),
			y: Math.floor(Math.min(hGrid, (height - panelHeight) / 2)),
			width: panelWidth,
			height: panelHeight,
			cellWidth,
			cellHeight,
			title: title.map(textToGlyphIds),
			credits: credits.map(textToGlyphIds),
			characters: CHARACTER_IDS.map((id, index) => ({
				x: charactersX + (index % CHARACTER_COLUMNS) * cellWidth,
				y: charactersY + Math.floor(index / CHARACTER_COLUMNS) * cellHeight,
				id,
			})),
		};
	};
	const hide = () => {
		clearTimeout(timer);
		timer = undefined;
		visibleFont = undefined;
		layout = undefined;
	};
	const show = ({ font }: FontChangedEvent) => {
		hide();
		visibleFont = font;
		prepare();
		timer = setTimeout(hide, VISIBLE_MS);
	};
	const removeDrawer = drawers.registerCanvasOverlay(({ draw }) => {
		if (!layout) return;
		const { cellWidth, cellHeight } = layout;
		const drawText = (x: number, y: number, glyphs: GlyphIds, color: PaletteIndex) => {
			if (cellWidth === state.viewport.vGrid && cellHeight === state.viewport.hGrid) {
				draw.drawGlyphs(x, y, glyphs, color);
				return;
			}
			for (let index = 0; index < glyphs.length; index++) {
				draw.drawSprite(x + index * cellWidth, y, glyphs[index], color, cellWidth, cellHeight);
			}
		};
		draw.startGroup(layout.x, layout.y);
		draw.drawFill(0, 0, PALETTE_INDICES.floatingSurface, layout.width, layout.height);
		for (const x of [0, layout.width - cellWidth]) {
			for (const y of [0, layout.height - cellHeight]) drawText(x, y, CORNER, PALETTE_INDICES.floatingMuted);
		}
		for (let index = 0; index < layout.title.length; index++) {
			drawText(cellWidth, (index + 1) * cellHeight, layout.title[index], PALETTE_INDICES.floatingAccent);
		}
		for (let index = 0; index < layout.credits.length; index++) {
			drawText(
				cellWidth,
				(index + layout.title.length + 2) * cellHeight,
				layout.credits[index],
				PALETTE_INDICES.floatingInk
			);
		}
		for (const character of layout.characters) {
			draw.drawSprite(character.x, character.y, character.id, PALETTE_INDICES.floatingInk, cellWidth, cellHeight);
		}
		draw.endGroup();
	});
	events.on('fontChanged', show);
	events.on('gridSizeChanged', prepare);
	events.on('resize', prepare);
	events.on('loadProject', hide, { capture: true });
	return () => {
		hide();
		removeDrawer();
		events.off('fontChanged', show);
		events.off('gridSizeChanged', prepare);
		events.off('resize', prepare);
		events.off('loadProject', hide);
	};
}
