import type { CanvasDrawerContext, EditorRenderHost } from './renderRegistry';

export default function drawCodeBlocks(
	{ draw, state, memoryViews, viewport, blockPositions }: CanvasDrawerContext,
	renderRegistry: EditorRenderHost
): void {
	const { width, height } = viewport;

	for (const blockPosition of blockPositions.ordered) {
		const { codeBlock, x, y } = blockPosition;
		if (x > -codeBlock.width && y > -codeBlock.height && x < width && y < height) {
			draw.startGroup(x, y);
			renderRegistry.drawCodeBlock({ draw, state, codeBlock, memoryViews });
			draw.endGroup();
		} else if (state.featureFlags.canvasOverlays) {
			renderRegistry.drawOffscreenCodeBlock(draw, blockPosition, viewport);
		}
	}
}
