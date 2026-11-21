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

	const geometry = createRenderGeometry().prepare(state);
	expect(geometry.blocks).toEqual([
		{ codeBlock: visible, x: 24, y: 16 },
		{ codeBlock: offscreen, x: -536, y: 1232 },
	]);
	expect(geometry.blocksByCodeBlock.get(visible)).toBe(geometry.blocks[0]);
	expect(geometry.blocksByCodeBlock.get(offscreen)).toBe(geometry.blocks[1]);
	expect(geometry.blocks[0].codeBlock).toBe(visible);
	expect(geometry.blocks[1].codeBlock).toBe(offscreen);
});

it('reuses the geometry, array, lookup map, and block records while preparing updated positions', () => {
	const block = createMockCodeBlock({ x: 40, y: 32 });
	const state = createMockState({
		viewport: { x: 8, y: 16 },
		codeBlockRendering: { currentProject: { blocks: [block] } },
	});

	const storage = createRenderGeometry();
	const first = storage.prepare(state);
	const { blocks, blocksByCodeBlock } = first;
	const renderedBlock = blocks[0];
	expect(renderedBlock).toMatchObject({ x: 32, y: 16 });
	state.viewport.x = 12;
	block.y = 56;
	expect(renderedBlock).toMatchObject({ x: 32, y: 16 });
	const next = storage.prepare(state);

	expect(next).toBe(first);
	expect(next.blocks).toBe(blocks);
	expect(next.blocksByCodeBlock).toBe(blocksByCodeBlock);
	expect(next.blocksByCodeBlock.get(block)).toBe(renderedBlock);
	expect(next.blocks[0]).toBe(renderedBlock);
	expect(renderedBlock).toMatchObject({ x: 28, y: 40 });
	expect(block).toMatchObject({ x: 40, y: 56 });

	block.x = 80;
	storage.prepare(state);
	expect(renderedBlock).toMatchObject({ x: 68, y: 40 });
});

it('preserves the records for surviving blocks after an in-place reorder, addition and removal', () => {
	const first = createMockCodeBlock({ x: 10 });
	const second = createMockCodeBlock({ x: 20 });
	const third = createMockCodeBlock({ x: 30 });
	const added = createMockCodeBlock({ x: 40 });
	const state = createMockState({
		codeBlockRendering: { currentProject: { blocks: [first, second, third] } },
	});
	const storage = createRenderGeometry();
	const { blocks, blocksByCodeBlock } = storage.prepare(state);
	const firstRecord = blocks[0];
	const secondRecord = blocks[1];
	const codeBlocks = state.codeBlockRendering.currentProject.blocks;
	codeBlocks.splice(0, 3, second, added, first);

	const geometry = storage.prepare(state);
	expect(geometry.blocks).toBe(blocks);
	expect(geometry.blocksByCodeBlock).toBe(blocksByCodeBlock);
	expect(blocks[0]).toBe(secondRecord);
	expect(blocks[1].codeBlock).toBe(added);
	expect(blocks[2]).toBe(firstRecord);
	expect(blocksByCodeBlock.get(second)).toBe(secondRecord);
	expect(blocksByCodeBlock.get(added)).toBe(blocks[1]);
	expect(blocksByCodeBlock.get(first)).toBe(firstRecord);
	expect(blocksByCodeBlock.has(third)).toBe(false);

	codeBlocks.length = 1;
	storage.prepare(state);
	expect(blocks).toEqual([secondRecord]);
	expect(blocksByCodeBlock.size).toBe(1);
	expect(blocksByCodeBlock.has(first)).toBe(false);
	expect(blocksByCodeBlock.has(added)).toBe(false);
});

it('drops references to the old project when the active level changes or empties', () => {
	const first = createMockCodeBlock({ x: 48 });
	const second = createMockCodeBlock({ x: 96 });
	const state = createMockState({ codeBlockRendering: { currentProject: { blocks: [first] } } });
	const storage = createRenderGeometry();
	const geometry = storage.prepare(state);
	state.codeBlockRendering.currentProject = { entries: [], path: 'nested', blocks: [second] };
	storage.prepare(state);
	expect(geometry.blocks[0].codeBlock).toBe(second);
	expect(geometry.blocksByCodeBlock.size).toBe(1);
	expect(geometry.blocksByCodeBlock.has(first)).toBe(false);
	expect(geometry.blocksByCodeBlock.get(second)).toBe(geometry.blocks[0]);

	state.codeBlockRendering.currentProject.blocks.length = 0;
	storage.prepare(state);
	expect(geometry.blocks).toEqual([]);
	expect(geometry.blocksByCodeBlock.size).toBe(0);
});

it('keeps geometry storage isolated between renderers', () => {
	const block = createMockCodeBlock({ x: 40, y: 32 });
	const state = createMockState({ codeBlockRendering: { currentProject: { blocks: [block] } } });
	const first = createRenderGeometry();
	const second = createRenderGeometry();
	const firstGeometry = first.prepare(state);
	const secondGeometry = second.prepare(state);
	expect(firstGeometry.blocks[0]).not.toBe(secondGeometry.blocks[0]);
	const oldX = secondGeometry.blocks[0].x;
	state.viewport.x += 16;
	first.prepare(state);
	expect(firstGeometry.blocks[0].x).toBe(oldX - 16);
	expect(secondGeometry.blocks[0].x).toBe(oldX);
});
