import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';

export const entryOutlinesPlugin: EditorPlugin = {
	id: 'entry-outlines',
	setup: ({ drawers, store }) => {
		const state = store.getState();
		let glyphsByName = new Map<string, GlyphIds>();
		const prepare = () => {
			const nextGlyphsByName = new Map<string, GlyphIds>();
			const entries = state.codeBlockRendering.entryBounds.map(bounds => {
				const glyphs = glyphsByName.get(bounds.entryName) ?? textToGlyphIds(bounds.entryName);
				nextGlyphsByName.set(bounds.entryName, glyphs);
				return { bounds, glyphs };
			});
			glyphsByName = nextGlyphsByName;
			return entries;
		};
		let entries = prepare();
		const update = () => {
			entries = prepare();
		};
		store.subscribe('codeBlockRendering.entryBounds', update);
		const unregister = drawers.registerCanvasBackgroundDrawer(({ draw, state }) => {
			draw.startGroup(-state.viewport.x, -state.viewport.y);
			for (const {
				bounds: { x, y, width, height },
				glyphs,
			} of entries) {
				draw.drawFill(x, y, PALETTE_INDICES.strokeBase, width, 1);
				draw.drawFill(x, y + height - 1, PALETTE_INDICES.strokeBase, width, 1);
				draw.drawFill(x, y, PALETTE_INDICES.strokeBase, 1, height);
				draw.drawFill(x + width - 1, y, PALETTE_INDICES.strokeBase, 1, height);
				draw.drawGlyphs(x + state.viewport.vGrid, y, glyphs, PALETTE_INDICES.inkStrong);
			}
			draw.endGroup();
		});
		return () => {
			unregister();
			store.unsubscribe('codeBlockRendering.entryBounds', update);
		};
	},
};
