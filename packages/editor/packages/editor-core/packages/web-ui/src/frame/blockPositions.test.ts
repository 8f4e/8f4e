import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import { expect, it } from 'vitest';
import { createFrameBlockPositions } from './blockPositions';

it('projects the supplied blocks in draw order through the presented viewport, including offscreen blocks', () => {
	const visible = createMockCodeBlock({ x: 48, y: -16 });
	const offscreen = createMockCodeBlock({ x: -512, y: 1200 });

	const geometry = createFrameBlockPositions().prepare([visible, offscreen], { x: 24, y: -32 });
	expect(geometry.ordered).toEqual([
		{ codeBlock: visible, x: 24, y: 16 },
		{ codeBlock: offscreen, x: -536, y: 1232 },
	]);
	expect(geometry.byCodeBlock.get(visible)).toBe(geometry.ordered[0]);
	expect(geometry.byCodeBlock.get(offscreen)).toBe(geometry.ordered[1]);
	expect(geometry.ordered[0].codeBlock).toBe(visible);
	expect(geometry.ordered[1].codeBlock).toBe(offscreen);
});

it('rounds final block positions to whole pixels after applying visual offsets', () => {
	const block = createMockCodeBlock({ x: 48.25, y: -16.25 });
	const offscreen = createMockCodeBlock({ x: -512.75, y: 1200.75 });
	const viewport = { x: 24, y: -32 };
	const offset = { x: 0.3, y: -0.3 };
	const geometry = createFrameBlockPositions().prepare([block, offscreen], viewport, candidate =>
		candidate === block ? offset : undefined
	);
	expect(geometry.ordered).toEqual([
		{ codeBlock: block, x: 25, y: 15 },
		{ codeBlock: offscreen, x: -537, y: 1233 },
	]);
	expect(geometry.byCodeBlock.get(block)).toBe(geometry.ordered[0]);
	expect(block).toMatchObject({ x: 48.25, y: -16.25 });
	expect(offset).toEqual({ x: 0.3, y: -0.3 });
});

it('reuses the geometry, array, lookup map, and block records while preparing updated positions', () => {
	const block = createMockCodeBlock({ x: 40, y: 32 });
	const blocks = [block];
	const viewport = { x: 8, y: 16 };

	const storage = createFrameBlockPositions();
	const first = storage.prepare(blocks, viewport);
	const { ordered, byCodeBlock } = first;
	const renderedBlock = ordered[0];
	expect(renderedBlock).toMatchObject({ x: 32, y: 16 });
	viewport.x = 12;
	block.y = 56;
	expect(renderedBlock).toMatchObject({ x: 32, y: 16 });
	const next = storage.prepare(blocks, viewport);

	expect(next).toBe(first);
	expect(next.ordered).toBe(ordered);
	expect(next.byCodeBlock).toBe(byCodeBlock);
	expect(next.byCodeBlock.get(block)).toBe(renderedBlock);
	expect(next.ordered[0]).toBe(renderedBlock);
	expect(renderedBlock).toMatchObject({ x: 28, y: 40 });
	expect(block).toMatchObject({ x: 40, y: 56 });

	block.x = 80;
	storage.prepare(blocks, viewport);
	expect(renderedBlock).toMatchObject({ x: 68, y: 40 });
});

it('preserves the records for surviving blocks after an in-place reorder, addition and removal', () => {
	const first = createMockCodeBlock({ x: 10 });
	const second = createMockCodeBlock({ x: 20 });
	const third = createMockCodeBlock({ x: 30 });
	const added = createMockCodeBlock({ x: 40 });
	const codeBlocks = [first, second, third];
	const viewport = { x: 0, y: 0 };
	const storage = createFrameBlockPositions();
	const { ordered, byCodeBlock } = storage.prepare(codeBlocks, viewport);
	const firstRecord = ordered[0];
	const secondRecord = ordered[1];
	codeBlocks.splice(0, 3, second, added, first);

	const geometry = storage.prepare(codeBlocks, viewport);
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
	storage.prepare(codeBlocks, viewport);
	expect(ordered).toEqual([secondRecord]);
	expect(byCodeBlock.size).toBe(1);
	expect(byCodeBlock.has(first)).toBe(false);
	expect(byCodeBlock.has(added)).toBe(false);
});

it('drops references to the previous blocks when the supplied list changes or empties', () => {
	const first = createMockCodeBlock({ x: 48 });
	const second = createMockCodeBlock({ x: 96 });
	const viewport = { x: 0, y: 0 };
	const storage = createFrameBlockPositions();
	const geometry = storage.prepare([first], viewport);
	storage.prepare([second], viewport);
	expect(geometry.ordered[0].codeBlock).toBe(second);
	expect(geometry.byCodeBlock.size).toBe(1);
	expect(geometry.byCodeBlock.has(first)).toBe(false);
	expect(geometry.byCodeBlock.get(second)).toBe(geometry.ordered[0]);

	storage.prepare([], viewport);
	expect(geometry.ordered).toEqual([]);
	expect(geometry.byCodeBlock.size).toBe(0);
});

it('keeps geometry storage isolated between renderers', () => {
	const block = createMockCodeBlock({ x: 40, y: 32 });
	const blocks = [block];
	const viewport = { x: 0, y: 0 };
	const first = createFrameBlockPositions();
	const second = createFrameBlockPositions();
	const firstGeometry = first.prepare(blocks, viewport);
	const secondGeometry = second.prepare(blocks, viewport);
	expect(firstGeometry.ordered[0]).not.toBe(secondGeometry.ordered[0]);
	const oldX = secondGeometry.ordered[0].x;
	viewport.x += 16;
	first.prepare(blocks, viewport);
	expect(firstGeometry.ordered[0].x).toBe(oldX - 16);
	expect(secondGeometry.ordered[0].x).toBe(oldX);
});
