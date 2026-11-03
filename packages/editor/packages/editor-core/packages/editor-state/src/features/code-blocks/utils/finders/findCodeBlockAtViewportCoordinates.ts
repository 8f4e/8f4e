import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';

/**
 * Searches all code blocks (topmost first) for the one that contains the viewport-relative coordinates.
 * This is used to forward click/drag gestures to the correct block while respecting z-order determined
 * by the rendering stack (`codeBlocks` is iterated in reverse so later blocks, which render on top, win).
 * @param state State providing the current viewport origin and code block rendering state.
 * @param searchX Viewport-relative x coordinate to test.
 * @param searchY Viewport-relative y coordinate to test.
 * @returns The foremost block containing the point, or `undefined` when none overlap it.
 */
export default function findCodeBlockAtViewportCoordinates(
	state: State,
	searchX: number,
	searchY: number
): CodeBlockGraphicData | undefined {
	for (let index = state.codeBlockRendering.currentProject.blocks.length - 1; index >= 0; index -= 1) {
		const graphicData = state.codeBlockRendering.currentProject.blocks[index];
		const { width, height, x, y } = graphicData;
		if (
			searchX >= x - state.viewport.x &&
			searchX <= x + width - state.viewport.x &&
			searchY >= y - state.viewport.y &&
			searchY <= y + height - state.viewport.y
		) {
			return graphicData;
		}
	}
}
