import type { Button, CodeBlockGraphicData, State } from '@8f4e/editor-state-types';

/**
 * Locates the button overlay within a code block that intersects the provided viewport-relative coordinates.
 * The hit test accounts for the code block's absolute position, its offsets, and the current viewport origin
 * so callers can pass raw mouse coordinates straight from pointer events.
 * @param state Current editor state.
 * @param codeBlock Code block whose buttons should be searched.
 * @param x Viewport-relative x coordinate (e.g. pointer clientX adjusted by canvas bounds).
 * @param y Viewport-relative y coordinate.
 * @returns The matching button metadata or `undefined` when no button intersects the point.
 */
export default function findButtonWidgetAtViewportCoordinates(
	state: State,
	codeBlock: CodeBlockGraphicData,
	x: number,
	y: number
): Button | undefined {
	return codeBlock.widgets.buttons.find(button => {
		return (
			x >= codeBlock.x + button.x - state.viewport.x &&
			x <= codeBlock.x + button.width + button.x - state.viewport.x &&
			y >= codeBlock.y + button.y - state.viewport.y &&
			y <= codeBlock.y + button.height + button.y - state.viewport.y
		);
	});
}
