import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { expect, it } from 'vitest';
import { createFrameBlockPositions } from './blockPositions';

it('prepares the current project blocks in draw order, including offscreen blocks', () => {
	const visible = createMockCodeBlock({ x: 48, y: -16 });
	const offscreen = createMockCodeBlock({ x: -512, y: 1200 });
	const state = createMockState({
		viewport: { x: 24, y: -32 },
		project: { activeLevel: { blocks: [visible, offscreen] } },
	});

	const geometry = createFrameBlockPositions().prepare(state);
	expect(geometry.ordered).toEqual([
		{ codeBlock: visible, x: 24, y: 16 },
		{ codeBlock: offscreen, x: -536, y: 1232 },
	]);
	expect(geometry.byCodeBlock.get(visible)).toBe(geometry.ordered[0]);
	expect(geometry.byCodeBlock.get(offscreen)).toBe(geometry.ordered[1]);
	expect(geometry.ordered[0].codeBlock).toBe(visible);
	expect(geometry.ordered[1].codeBlock).toBe(offscreen);
});

it('reuses the geometry, array, lookup map, and block records while preparing updated positions', () => {
	const block = createMockCodeBlock({ x: 40, y: 32 });
	const state = createMockState({
		viewport: { x: 8, y: 16 },
		project: { activeLevel: { blocks: [block] } },
	});

	const storage = createFrameBlockPositions();
	const first = storage.prepare(state);
	const { ordered, byCodeBlock } = first;
	const renderedBlock = ordered[0];
	expect(renderedBlock).toMatchObject({ x: 32, y: 16 });
	state.viewport.x = 12;
	block.y = 56;
	expect(renderedBlock).toMatchObject({ x: 32, y: 16 });
	const next = storage.prepare(state);

	expect(next).toBe(first);
	expect(next.ordered).toBe(ordered);
	expect(next.byCodeBlock).toBe(byCodeBlock);
	expect(next.byCodeBlock.get(block)).toBe(renderedBlock);
	expect(next.ordered[0]).toBe(renderedBlock);
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
		project: { activeLevel: { blocks: [first, second, third] } },
	});
	const storage = createFrameBlockPositions();
	const { ordered, byCodeBlock } = storage.prepare(state);
	const firstRecord = ordered[0];
	const secondRecord = ordered[1];
	const codeBlocks = state.project.activeLevel.blocks;
	codeBlocks.splice(0, 3, second, added, first);

	const geometry = storage.prepare(state);
	expect(geometry.ordered).toBe(ordered);
	expect(geometry.byCodeBlock).toBe(byCodeBlock);
	expect(ordered[0]).toBe(secondRecord);
	expect(ordered[1].codeBlock).toBe(added);
	expect(ordered[2]).toBe(firstRecord);
	expect(byCodeBlock.get(second)).toBe(secondRecord);
	expect(byCodeBlock.get(added)).toBe(ordered[1]);
	expect(byCodeBlock.get(first)).toBe(firstRecord);
	expect(byCodeBlock.has(third)).toBe(false);

	codeBlocks.length = 1;
	storage.prepare(state);
	expect(ordered).toEqual([secondRecord]);
	expect(byCodeBlock.size).toBe(1);
	expect(byCodeBlock.has(first)).toBe(false);
	expect(byCodeBlock.has(added)).toBe(false);
});

it('drops references to the old project when the active level changes or empties', () => {
	const first = createMockCodeBlock({ x: 48 });
	const second = createMockCodeBlock({ x: 96 });
	const state = createMockState({ project: { activeLevel: { blocks: [first] } } });
	const storage = createFrameBlockPositions();
	const geometry = storage.prepare(state);
	state.project.activeLevel = { entries: [], path: 'nested', blocks: [second] };
	storage.prepare(state);
	expect(geometry.ordered[0].codeBlock).toBe(second);
	expect(geometry.byCodeBlock.size).toBe(1);
	expect(geometry.byCodeBlock.has(first)).toBe(false);
	expect(geometry.byCodeBlock.get(second)).toBe(geometry.ordered[0]);

	state.project.activeLevel.blocks.length = 0;
	storage.prepare(state);
	expect(geometry.ordered).toEqual([]);
	expect(geometry.byCodeBlock.size).toBe(0);
});

it('keeps geometry storage isolated between renderers', () => {
	const block = createMockCodeBlock({ x: 40, y: 32 });
	const state = createMockState({ project: { activeLevel: { blocks: [block] } } });
	const first = createFrameBlockPositions();
	const second = createFrameBlockPositions();
	const firstGeometry = first.prepare(state);
	const secondGeometry = second.prepare(state);
	expect(firstGeometry.ordered[0]).not.toBe(secondGeometry.ordered[0]);
	const oldX = secondGeometry.ordered[0].x;
	state.viewport.x += 16;
	first.prepare(state);
	expect(firstGeometry.ordered[0].x).toBe(oldX - 16);
	expect(secondGeometry.ordered[0].x).toBe(oldX);
});
