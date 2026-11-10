import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { textToGlyphIds } from '@8f4e/web-ui';

const CORNER = textToGlyphIds('+');

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
			draw.drawGlyphs(0, 0, CORNER, cornerColor);
			draw.drawGlyphs(right, 0, CORNER, cornerColor);
			draw.drawGlyphs(0, bottom, CORNER, cornerColor);
			draw.drawGlyphs(right, bottom, CORNER, cornerColor);
		}),
};
