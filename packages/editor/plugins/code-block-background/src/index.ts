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
		}),
};
