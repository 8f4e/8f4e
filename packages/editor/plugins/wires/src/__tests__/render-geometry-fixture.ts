import type { State } from '@8f4e/editor-state-types';
import type { RenderGeometry } from '@8f4e/web-ui';

/** Supply unanimated viewport-relative positions to wire tests without a renderer. */
export function createRenderGeometryFixture(state: State): RenderGeometry {
	const { x, y } = state.viewport;
	const blocks = state.project.activeLevel.blocks.map(codeBlock => ({
		codeBlock,
		x: codeBlock.x - x,
		y: codeBlock.y - y,
	}));
	return { blocks, blocksByCodeBlock: new Map(blocks.map(block => [block.codeBlock, block])) };
}
