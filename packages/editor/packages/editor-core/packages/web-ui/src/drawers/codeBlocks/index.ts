import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../drawContext';
import type { RenderGeometry } from '../../render-geometry';
import type { MemoryViews } from '../../types';
import type { EditorDrawerHost } from '../registry';

export default function drawCodeBlocks(
	draw: DrawContext,
	state: State,
	memoryViews: MemoryViews,
	drawers: EditorDrawerHost,
	renderGeometry: RenderGeometry
): void {
	const { width, height } = state.viewport;

	for (const renderedBlock of renderGeometry.blocks) {
		const { codeBlock, x, y } = renderedBlock;
		if (x > -codeBlock.width && y > -codeBlock.height && x < width && y < height) {
			draw.startGroup(x, y);
			drawers.drawCodeBlock({ draw, state, renderedBlock, memoryViews });
			draw.endGroup();
		} else if (state.featureFlags.canvasOverlays) {
			drawers.drawOffscreenCodeBlock(draw, renderedBlock, state);
		}
	}
}
