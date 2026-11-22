import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { type DrawContext, type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';

// Prefer filled pointers, then arrows, and retain ASCII for fonts missing both.
const [RIGHT, LEFT, DOWN, UP] = ['►→>', '◄←<', '▼↓v', '▲↑^'].map(textToGlyphIds);

function selectArrow(draw: DrawContext, [pointer, arrow, ascii]: GlyphIds): number {
	return draw.hasVisibleGlyph(pointer) ? pointer : draw.hasVisibleGlyph(arrow) ? arrow : ascii;
}

export const offscreenBlockArrowsPlugin: EditorPlugin = {
	id: 'offscreen-block-arrows',
	setup: ({ drawers }) =>
		drawers.registerOffscreenCodeBlockDrawer((draw, renderedBlock, state) => {
			const { width, height, vGrid, hGrid } = state.viewport;
			const centerX = Math.round(width / 2);
			const centerY = Math.round(height / 2);
			const deltaX = renderedBlock.x - centerX;
			const deltaY = renderedBlock.y - centerY;
			const horizontalDistance = deltaX >= 0 ? width - centerX : centerX;
			const verticalDistance = deltaY >= 0 ? height - centerY : centerY;
			const horizontalScale = horizontalDistance / Math.abs(deltaX);
			const verticalScale = verticalDistance / Math.abs(deltaY);
			const scale = Math.min(horizontalScale, verticalScale);
			const arrowX = Math.round(centerX + deltaX * scale);
			const arrowY = Math.round(centerY + deltaY * scale);
			if (horizontalScale < verticalScale) {
				draw.drawSprite(
					arrowX - (deltaX >= 0 ? vGrid : 0),
					arrowY,
					selectArrow(draw, deltaX >= 0 ? RIGHT : LEFT),
					PALETTE_INDICES.secondaryBase
				);
			} else {
				draw.drawSprite(
					arrowX,
					arrowY - (deltaY >= 0 ? hGrid : 0),
					selectArrow(draw, deltaY >= 0 ? DOWN : UP),
					PALETTE_INDICES.secondaryBase
				);
			}
		}),
};
