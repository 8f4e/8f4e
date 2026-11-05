import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

export const offscreenBlockArrowsPlugin: EditorPlugin = {
	id: 'offscreen-block-arrows',
	setup: ({ drawers }) =>
		drawers.registerOffscreenCodeBlockDrawer((draw, codeBlock, state) => {
			const { x, y, width, height, vGrid, hGrid } = state.viewport;
			const centerX = x + Math.round(width / 2);
			const centerY = y + Math.round(height / 2);
			const deltaX = codeBlock.x - centerX;
			const deltaY = codeBlock.y - centerY;
			const horizontalDistance = deltaX >= 0 ? x + width - centerX : centerX - x;
			const verticalDistance = deltaY >= 0 ? y + height - centerY : centerY - y;
			const horizontalScale = horizontalDistance / Math.abs(deltaX);
			const verticalScale = verticalDistance / Math.abs(deltaY);
			const scale = Math.min(horizontalScale, verticalScale);
			const arrowX = Math.round(centerX + deltaX * scale);
			const arrowY = Math.round(centerY + deltaY * scale);
			if (horizontalScale < verticalScale) {
				draw.drawText(
					arrowX - (deltaX >= 0 ? vGrid : 0),
					arrowY,
					deltaX >= 0 ? '>' : '<',
					PALETTE_INDICES.secondaryBase
				);
			} else {
				draw.drawText(
					arrowX,
					arrowY - (deltaY >= 0 ? hGrid : 0),
					deltaY >= 0 ? 'v' : '^',
					PALETTE_INDICES.secondaryBase
				);
			}
		}),
};
