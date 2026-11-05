import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

/** Presents the shared list of active loads without blocking editor input. */
export const loadingIndicatorsPlugin: EditorPlugin = {
	id: 'loading-indicators',
	setup: ({ drawers }) =>
		drawers.registerCanvasOverlay(({ draw, state }) => {
			const { width, height, vGrid, hGrid } = state.viewport;
			const columns = Math.max(0, Math.floor(width / vGrid) - 2);
			const rows = Math.max(0, Math.floor(height / hGrid) - 1);
			const lines = state.loadingIndicators
				.slice(0, rows)
				.map(indicator => `Loading ${indicator.name}...`.slice(0, columns));
			if (!columns || !lines.length) return;
			draw.startGroup(0, height - (lines.length + 1) * hGrid);
			for (const [row, line] of lines.entries()) {
				draw.drawFill(0, row * hGrid, PALETTE_INDICES.floatingSurface, (line.length + 2) * vGrid, hGrid);
				draw.drawText(vGrid, row * hGrid, line, PALETTE_INDICES.floatingInk);
			}
			draw.endGroup();
		}),
};
