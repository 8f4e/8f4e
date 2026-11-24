import type { State } from '@8f4e/editor-state-types';
import type { MemoryViews } from '../memoryViews';
import type { DrawContext } from '../sprites/drawContext';
import type { FrameBlockPositions } from './blockPositions';
import type { EditorRenderHost } from './renderRegistry';

export default function drawCodeBlocks(
	draw: DrawContext,
	state: State,
	memoryViews: MemoryViews,
	renderRegistry: EditorRenderHost,
	blockPositions: FrameBlockPositions
): void {
	const { width, height } = state.viewport;

	for (const blockPosition of blockPositions.ordered) {
		const { codeBlock, x, y } = blockPosition;
		if (x > -codeBlock.width && y > -codeBlock.height && x < width && y < height) {
			draw.startGroup(x, y);
			renderRegistry.drawCodeBlock({ draw, state, codeBlock, memoryViews });
			draw.endGroup();
		} else if (state.featureFlags.canvasOverlays) {
			renderRegistry.drawOffscreenCodeBlock(draw, blockPosition, state);
		}
	}
}
