import type { Position, Viewport, ViewportBlockAlignment } from '@8f4e/editor-state-types';
import roundToGrid from './roundToGrid';

/**
 * Minimal positional data required for viewport centering
 */
export interface CodeBlockBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CenterViewportOnCodeBlockOptions {
	alignment?: ViewportBlockAlignment;
}

/**
 * Calculates the viewport position needed to center a given code block, with optional viewport anchor hints.
 *
 * For blocks smaller than the viewport, centering is rounded to the nearest grid lines. For blocks
 * larger than the viewport, the block is aligned near the top with a margin equal
 * to 25% of the viewport height, rounded to whole rows, while the bottom may
 * extend beyond the viewport.
 *
 * @param viewport - The viewport dimensions and grid sizing to center within
 * @param codeBlock - The code block to center on
 * @returns The nearest grid-aligned viewport position that centers the code block
 *
 * @remarks
 * **Centering Behavior:**
 * - `center` centers both axes, while oversized blocks keep a 25% top margin
 * - `left` and `right` shift the block center to the left or right quarter of the viewport
 * - `top` and `bottom` shift the block center to the top or bottom quarter of the viewport
 *
 * **Constraints:**
 * - Oversized blocks get `round((viewport.height * 0.25) / viewport.hGrid) * viewport.hGrid` padding above their top edge
 * - For large blocks (taller than viewport), only the bottom may be clipped
 * **Implementation Notes:**
 * - This function is pure and does not mutate the viewport parameter
 * - Coordinates use pixels, not grid units (grid conversion happens elsewhere)
 * - The returned coordinates are rounded to the nearest grid lines
 * - Negative viewport coordinates are allowed (viewport can pan anywhere)
 */
export default function centerViewportOnCodeBlock<T extends CodeBlockBounds>(
	viewport: Viewport,
	codeBlock: T,
	{ alignment = 'center' }: CenterViewportOnCodeBlockOptions = {}
): Position {
	const blockCenterX = codeBlock.x + codeBlock.width / 2;
	const blockCenterY = codeBlock.y + codeBlock.height / 2;

	const viewportCenterX =
		alignment === 'left' ? viewport.width * 0.25 : alignment === 'right' ? viewport.width * 0.75 : viewport.width / 2;
	const viewportCenterY =
		alignment === 'top'
			? viewport.height * 0.25
			: alignment === 'bottom'
				? viewport.height * 0.75
				: viewport.height / 2;

	const idealViewportX = blockCenterX - viewportCenterX;
	const idealViewportY = blockCenterY - viewportCenterY;

	const blockTop = codeBlock.y;
	const oversizedBlockPadding = Math.round((viewport.height * 0.25) / viewport.hGrid) * viewport.hGrid;
	const oversizedBlockTop = blockTop - oversizedBlockPadding;
	const constrainedViewportY =
		alignment === 'top' || alignment === 'bottom'
			? idealViewportY
			: codeBlock.height > viewport.height
				? oversizedBlockTop
				: Math.min(blockTop, idealViewportY);

	const [x, y] = roundToGrid(idealViewportX, constrainedViewportY, viewport);

	return { x, y };
}
