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
	sprites: { x: number; y: number; id: GlyphIds[number]; color: PaletteIndex }[];
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
		const sprites: FontNoticeLayout['sprites'] = [];
		const prepareText = (x: number, y: number, glyphs: GlyphIds, color: PaletteIndex) => {
			for (let index = 0; index < glyphs.length; index++) {
				sprites.push({ x: x + index * cellWidth, y, id: glyphs[index], color });
			}
		};
		for (const x of [0, panelWidth - cellWidth]) {
			for (const y of [0, panelHeight - cellHeight]) prepareText(x, y, CORNER, PALETTE_INDICES.floatingMuted);
		}
		for (let index = 0; index < title.length; index++) {
			prepareText(cellWidth, (index + 1) * cellHeight, textToGlyphIds(title[index]), PALETTE_INDICES.floatingAccent);
		}
		for (let index = 0; index < credits.length; index++) {
			prepareText(
				cellWidth,
				(index + title.length + 2) * cellHeight,
				textToGlyphIds(credits[index]),
				PALETTE_INDICES.floatingInk
			);
		}
		for (let index = 0; index < CHARACTER_IDS.length; index++) {
			sprites.push({
				x: charactersX + (index % CHARACTER_COLUMNS) * cellWidth,
				y: charactersY + Math.floor(index / CHARACTER_COLUMNS) * cellHeight,
				id: CHARACTER_IDS[index],
				color: PALETTE_INDICES.floatingInk,
			});
		}
		layout = {
			x: Math.floor((width - panelWidth) / 2),
			y: Math.floor(Math.min(hGrid, (height - panelHeight) / 2)),
			width: panelWidth,
			height: panelHeight,
			cellWidth,
			cellHeight,
			sprites,
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
		draw.startGroup(layout.x, layout.y);
		draw.drawFill(0, 0, PALETTE_INDICES.floatingSurface, layout.width, layout.height);
		for (const sprite of layout.sprites) {
			draw.drawSprite(sprite.x, sprite.y, sprite.id, sprite.color, layout.cellWidth, layout.cellHeight);
		}
		draw.endGroup();
	});
	events.on('fontChanged', show);
	events.on('resize', prepare);
	events.on('loadProject', hide, { capture: true });
	return () => {
		hide();
		removeDrawer();
		events.off('fontChanged', show);
		events.off('resize', prepare);
		events.off('loadProject', hide);
	};
}
