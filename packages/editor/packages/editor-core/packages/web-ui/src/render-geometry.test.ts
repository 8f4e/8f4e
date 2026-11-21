import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { expect, it } from 'vitest';
import { createRenderGeometry } from './render-geometry';

it('prepares the current project blocks in draw order, including offscreen blocks', () => {
	const visible = createMockCodeBlock({ x: 48, y: -16 });
	const offscreen = createMockCodeBlock({ x: -512, y: 1200 });
	const state = createMockState({
		viewport: { x: 24, y: -32 },
		codeBlockRendering: { currentProject: { blocks: [visible, offscreen] } },
	});

	const geometry = createRenderGeometry(state);
	expect(geometry.blocks).toEqual([
		{ codeBlock: visible, x: 24, y: 16 },
		{ codeBlock: offscreen, x: -536, y: 1232 },
	]);
	expect(geometry.blocksByCodeBlock.get(visible)).toBe(geometry.blocks[0]);
	expect(geometry.blocksByCodeBlock.get(offscreen)).toBe(geometry.blocks[1]);
	expect(geometry.blocks[0].codeBlock).toBe(visible);
	expect(geometry.blocks[1].codeBlock).toBe(offscreen);
});

it('retains prepared positions for a frame and uses the updated editor state for the next frame', () => {
	const block = createMockCodeBlock({ x: 40, y: 32 });
	const state = createMockState({
		viewport: { x: 8, y: 16 },
		codeBlockRendering: { currentProject: { blocks: [block] } },
	});

	const first = createRenderGeometry(state);
	state.viewport.x = 12;
	block.y = 56;
	const next = createRenderGeometry(state);

	expect(first.blocksByCodeBlock.get(block)).toMatchObject({ x: 32, y: 16 });
	expect(next.blocksByCodeBlock.get(block)).toMatchObject({ x: 28, y: 40 });
	expect(block).toMatchObject({ x: 40, y: 56 });
	state.codeBlockRendering.currentProject.blocks.length = 0;
	expect(createRenderGeometry(state).blocksByCodeBlock.size).toBe(0);
});
