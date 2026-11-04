import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

export const codeBlockBackgroundPlugin: EditorPlugin = {
	id: 'code-block-background',
	setup: ({ drawers }) =>
		drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
			const color =
				codeBlock === state.codeBlockRendering.draggedCodeBlock
					? PALETTE_INDICES.surfaceRaised1
					: codeBlock.disabled
						? PALETTE_INDICES.surfaceSubdued
						: PALETTE_INDICES.surfaceBase;
			draw.drawFill(0, 0, color, codeBlock.width, codeBlock.height);
			const cornerColor =
				state.codeBlockRendering.selectedCodeBlock === codeBlock
					? PALETTE_INDICES.secondaryBase
					: PALETTE_INDICES.inkBase;
			const right = codeBlock.width - state.viewport.vGrid;
			const bottom = codeBlock.height - state.viewport.hGrid;
			draw.drawText(0, 0, '+', cornerColor);
			draw.drawText(right, 0, '+', cornerColor);
			draw.drawText(0, bottom, '+', cornerColor);
			draw.drawText(right, bottom, '+', cornerColor);
		}),
};
