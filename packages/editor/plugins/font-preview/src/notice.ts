import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { wrapText } from '@8f4e/editor-state';
import { FONT_CATALOG, type Font, type GlyphIds, textToGlyphIds } from '@8f4e/sprite-generator';
import type { FontChangedEvent } from '@8f4e/web-ui';

const VISIBLE_MS = 3000;
const CORNER = textToGlyphIds('+');

/** Keep the transient font credit panel outside modal state, source and history. */
export function installFontNotice({ store, events, drawers }: EditorPluginContext): () => void {
	const state = store.getState();
	let visibleFont: Font | undefined;
	let layout:
		| { x: number; y: number; width: number; height: number; title: GlyphIds[]; credits: GlyphIds[] }
		| undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const prepare = () => {
		layout = undefined;
		if (!visibleFont) return;
		const { name, credits: creditText } = FONT_CATALOG[visibleFont];
		const { width, height, vGrid, hGrid } = state.viewport;
		const columns = Math.min(60, Math.floor(width / vGrid) - 4);
		if (columns < 1) return;
		const title = wrapText(name, columns);
		const credits = wrapText(creditText, columns);
		const panelWidth = (Math.max(...[...title, ...credits].map(line => line.length)) + 2) * vGrid;
		const panelHeight = (title.length + credits.length + 3) * hGrid;
		layout = {
			x: Math.floor((width - panelWidth) / 2 / vGrid) * vGrid,
			y: Math.max(0, Math.min(hGrid, height - panelHeight)),
			width: panelWidth,
			height: panelHeight,
			title: title.map(textToGlyphIds),
			credits: credits.map(textToGlyphIds),
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
		const { vGrid, hGrid } = state.viewport;
		draw.startGroup(layout.x, layout.y);
		draw.drawFill(0, 0, PALETTE_INDICES.floatingSurface, layout.width, layout.height);
		for (const x of [0, layout.width - vGrid]) {
			for (const y of [0, layout.height - hGrid]) draw.drawGlyphs(x, y, CORNER, PALETTE_INDICES.floatingMuted);
		}
		for (let index = 0; index < layout.title.length; index++) {
			draw.drawGlyphs(vGrid, (index + 1) * hGrid, layout.title[index], PALETTE_INDICES.floatingAccent);
		}
		for (let index = 0; index < layout.credits.length; index++) {
			draw.drawGlyphs(
				vGrid,
				(index + layout.title.length + 2) * hGrid,
				layout.credits[index],
				PALETTE_INDICES.floatingInk
			);
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
