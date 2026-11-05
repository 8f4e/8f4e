import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

export const entryOutlinesPlugin: EditorPlugin = {
	id: 'entry-outlines',
	setup: ({ drawers }) =>
		drawers.registerCanvasBackgroundDrawer(({ draw, state }) => {
			draw.startGroup(-state.viewport.x, -state.viewport.y);
			for (const { x, y, width, height, entryName } of state.codeBlockRendering.entryBounds) {
				draw.drawFill(x, y, PALETTE_INDICES.strokeBase, width, 1);
				draw.drawFill(x, y + height - 1, PALETTE_INDICES.strokeBase, width, 1);
				draw.drawFill(x, y, PALETTE_INDICES.strokeBase, 1, height);
				draw.drawFill(x + width - 1, y, PALETTE_INDICES.strokeBase, 1, height);
				draw.drawText(x + state.viewport.vGrid, y, entryName, PALETTE_INDICES.inkStrong);
			}
			draw.endGroup();
		}),
};
