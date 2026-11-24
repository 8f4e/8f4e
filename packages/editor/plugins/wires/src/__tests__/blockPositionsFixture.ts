import type { State } from '@8f4e/editor-state-types';
import type { FrameBlockPositions } from '@8f4e/web-ui';

/** Supply unanimated viewport-relative positions to wire tests without a renderer. */
export function createFrameBlockPositionsFixture(state: State): FrameBlockPositions {
	const { x, y } = state.viewport;
	const ordered = state.project.activeLevel.blocks.map(codeBlock => ({
		codeBlock,
		x: codeBlock.x - x,
		y: codeBlock.y - y,
	}));
	return { ordered, byCodeBlock: new Map(ordered.map(position => [position.codeBlock, position])) };
}
