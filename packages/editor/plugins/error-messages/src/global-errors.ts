import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createCodeErrorBlockLookup, wrapText } from '@8f4e/editor-state';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';

/** Keep errors without navigable source visible for as long as their contributor reports them. */
export function installGlobalErrors({ store, drawers }: Pick<EditorPluginContext, 'store' | 'drawers'>): () => void {
	const state = store.getState();
	let lines: GlyphIds[] = [];
	const refresh = () => {
		const findBlock = createCodeErrorBlockLookup(state.codeBlockRendering.rootProject);
		const width = Math.max(1, Math.floor(state.viewport.width / state.viewport.vGrid) - 2);
		lines = Object.values(state.codeErrors)
			.flat()
			.flatMap(error => {
				const block = findBlock(error);
				if (block && error.lineNumber !== undefined && error.lineNumber >= 0 && error.lineNumber < block.code.length)
					return [];
				return wrapText(`Error: ${error.message}`, width).map(textToGlyphIds);
			});
	};
	const selectors = [
		'codeErrors',
		'projectChange',
		'codeBlockRendering.rootProject',
		'viewport.width',
		'viewport.vGrid',
	] as const;
	for (const selector of selectors) store.subscribe(selector, refresh);
	const removeDrawer = drawers.registerCanvasOverlay(({ draw }) => {
		if (!lines.length || !state.featureFlags.canvasOverlays) return;
		draw.startGroup(0, 0);
		draw.drawFill(
			0,
			0,
			PALETTE_INDICES.negativeSurface,
			state.viewport.width,
			(lines.length + 1) * state.viewport.hGrid
		);
		for (const [index, line] of lines.entries())
			draw.drawGlyphs(state.viewport.vGrid, index * state.viewport.hGrid, line, PALETTE_INDICES.negativeOn);
		draw.endGroup();
	});
	refresh();
	return () => {
		for (const selector of selectors) store.unsubscribe(selector, refresh);
		removeDrawer();
	};
}
