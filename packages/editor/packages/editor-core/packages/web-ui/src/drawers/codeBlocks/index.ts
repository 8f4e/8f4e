import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../drawContext';
import type { MemoryViews } from '../../types';
import type { EditorDrawerHost } from '../registry';
import drawArrow from './drawArrow';

export default function drawCodeBlocks(
	draw: DrawContext,
	state: State,
	memoryViews: MemoryViews,
	drawers: EditorDrawerHost
): void {
	const { x, y } = state.viewport;

	const offsetX = -x;
	const offsetY = -y;

	draw.startGroup(offsetX, offsetY);

	for (const codeBlock of state.codeBlockRendering.currentProject.blocks) {
		if (
			codeBlock.x + offsetX > -1 * codeBlock.width &&
			codeBlock.y + offsetY > -1 * codeBlock.height &&
			codeBlock.x + offsetX < state.viewport.width &&
			codeBlock.y + offsetY < state.viewport.height
		) {
			draw.startGroup(codeBlock.x, codeBlock.y);
			drawers.drawCodeBlock({ draw, state, codeBlock, memoryViews });
			draw.endGroup();
		} else if (state.featureFlags.offscreenBlockArrows) {
			drawArrow(draw, codeBlock, state);
		}
	}

	draw.endGroup();
}
