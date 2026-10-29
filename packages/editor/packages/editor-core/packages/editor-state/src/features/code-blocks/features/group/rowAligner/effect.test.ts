import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import groupRowAligner from './effect';

describe('groupRowAligner', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	function getAlignCallback(): (payload: { codeBlock: CodeBlockGraphicData }) => void {
		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const alignCall = onCalls.find(call => call[0] === 'alignGroupBlocksInRow');
		expect(alignCall).toBeDefined();
		return alignCall![1];
	}

	function createGroupBlock(overrides: Partial<CodeBlockGraphicData>): CodeBlockGraphicData {
		const block = createMockCodeBlock({
			code: ['module test', '; @group myGroup', '', 'moduleEnd'],
			blockType: 'module',
			...overrides,
		});
		block.groupName = 'myGroup';
		return block;
	}

	it('aligns all group blocks to the gridY of the leftmost block', () => {
		const block1 = createGroupBlock({ gridX: 0, gridY: 5 });
		const block2 = createGroupBlock({ gridX: 30, gridY: 9 });
		const block3 = createGroupBlock({ gridX: 60, gridY: 2 });
		const outsider = createMockCodeBlock({ gridX: 15, gridY: 7 });

		mockState.codeBlockRendering.codeBlocks = [block1, block2, block3, outsider];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: block2 });

		expect(block1.gridY).toBe(5);
		expect(block2.gridY).toBe(5);
		expect(block3.gridY).toBe(5);
		expect(outsider.gridY).toBe(7);
		expect(mockState.projectChange.revision).toBe(1);
		expect(mockState.compilerInputRevision).toBe(0);
		getAlignCallback()({ codeBlock: block2 });
		expect(mockState.projectChange.revision).toBe(1);
	});

	it('preserves the original left-to-right order of the blocks', () => {
		const rightmost = createGroupBlock({ gridX: 40, gridY: 0, minGridWidth: 10 });
		const leftmost = createGroupBlock({ gridX: 0, gridY: 3, minGridWidth: 10 });
		const middle = createGroupBlock({ gridX: 20, gridY: 6, minGridWidth: 10 });

		// Deliberately scrambled array order; sorting must be by gridX, not array order.
		mockState.codeBlockRendering.codeBlocks = [rightmost, leftmost, middle];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: middle });

		// The leftmost block anchors the row and keeps its position.
		expect(leftmost.gridX).toBe(0);
		expect(leftmost.gridY).toBe(3);

		// Relative order is unchanged: leftmost < middle < rightmost.
		expect(leftmost.gridX).toBeLessThan(middle.gridX);
		expect(middle.gridX).toBeLessThan(rightmost.gridX);
		expect([leftmost, middle, rightmost].map(block => block.gridY)).toEqual([3, 3, 3]);
	});

	it('separates neighbouring blocks by the previous block width plus a fixed gap of 4 columns', () => {
		// Short code lines keep the content width below minGridWidth, so each
		// block's grid width is exactly its minGridWidth: 30, 12, and 20.
		const blockA = createGroupBlock({ code: ['a'], gridX: 0, gridY: 1, minGridWidth: 30 });
		const blockB = createGroupBlock({ code: ['b'], gridX: 100, gridY: 2, minGridWidth: 12 });
		const blockC = createGroupBlock({ code: ['c'], gridX: 200, gridY: 3, minGridWidth: 20 });

		mockState.codeBlockRendering.codeBlocks = [blockA, blockB, blockC];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: blockA });

		expect(blockA.gridX).toBe(0);
		expect(blockB.gridX).toBe(0 + 30 + 4);
		expect(blockC.gridX).toBe(34 + 12 + 4);
	});

	it('keeps the relative order of blocks that share the same gridX', () => {
		const first = createGroupBlock({ code: ['a'], gridX: 10, gridY: 4, minGridWidth: 10 });
		const second = createGroupBlock({ code: ['b'], gridX: 10, gridY: 8, minGridWidth: 10 });

		mockState.codeBlockRendering.codeBlocks = [first, second];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: second });

		// The stable sort keeps the array order on ties: `first` anchors the row.
		expect(first.gridX).toBe(10);
		expect(first.gridY).toBe(4);
		expect(second.gridY).toBe(4);
		expect(second.gridX).toBe(10 + 10 + 4);
	});

	it('persists moved positions in the ; @pos directive and syncs pixel coordinates', () => {
		const blockA = createGroupBlock({ code: ['a'], gridX: 0, gridY: 5, minGridWidth: 10 });
		const blockB = createGroupBlock({ gridX: 90, gridY: 9, minGridWidth: 10 });

		mockState.codeBlockRendering.codeBlocks = [blockA, blockB];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: blockA });

		expect(blockB.gridX).toBe(14);
		expect(blockB.gridY).toBe(5);
		expect(blockB.code).toContain('; @pos 14 5');
		// Mock viewport: vGrid = 8, hGrid = 16.
		expect(blockB.x).toBe(14 * 8);
		expect(blockB.y).toBe(5 * 16);
		expect(store.getState().codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBe(blockB);
	});

	it('does nothing when the group has fewer than 2 blocks', () => {
		const only = createGroupBlock({ gridX: 10, gridY: 3 });
		const outsider = createMockCodeBlock({ gridX: 40, gridY: 6 });
		const codeBefore = [...only.code];

		mockState.codeBlockRendering.codeBlocks = [only, outsider];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: only });

		expect(only.gridX).toBe(10);
		expect(only.gridY).toBe(3);
		expect(only.code).toEqual(codeBefore);
	});

	it('does nothing when the code block has no groupName', () => {
		const block1 = createMockCodeBlock({ gridX: 0, gridY: 1 });
		const block2 = createGroupBlock({ gridX: 50, gridY: 2 });

		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: block1 });

		expect(block2.gridX).toBe(50);
		expect(block2.gridY).toBe(2);
	});

	it('does nothing when editing is disabled', () => {
		const block1 = createGroupBlock({ gridX: 0, gridY: 5 });
		const block2 = createGroupBlock({ gridX: 90, gridY: 9 });

		mockState.codeBlockRendering.codeBlocks = [block1, block2];
		mockState.featureFlags.editing = false;

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: block1 });

		expect(block2.gridX).toBe(90);
		expect(block2.gridY).toBe(9);
	});

	it('does not move blocks that belong to a different group', () => {
		const blockA = createGroupBlock({ gridX: 0, gridY: 5, minGridWidth: 10 });
		const blockB = createGroupBlock({ gridX: 90, gridY: 9, minGridWidth: 10 });
		const otherGroupBlock = createMockCodeBlock({ gridX: 10, gridY: 1 });
		otherGroupBlock.groupName = 'otherGroup';

		mockState.codeBlockRendering.codeBlocks = [blockA, blockB, otherGroupBlock];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: blockA });

		expect(blockB.gridY).toBe(5);
		expect(otherGroupBlock.gridX).toBe(10);
		expect(otherGroupBlock.gridY).toBe(1);
	});

	it('leaves an already aligned row untouched', () => {
		const blockA = createGroupBlock({ code: ['a'], gridX: 0, gridY: 5, minGridWidth: 10 });
		const blockB = createGroupBlock({ code: ['b'], gridX: 14, gridY: 5, minGridWidth: 10 });
		const codeABefore = [...blockA.code];
		const codeBBefore = [...blockB.code];
		const lastUpdatedB = blockB.lastUpdated;

		mockState.codeBlockRendering.codeBlocks = [blockA, blockB];

		groupRowAligner(store, mockEvents);
		getAlignCallback()({ codeBlock: blockA });

		expect(blockA.code).toEqual(codeABefore);
		expect(blockB.code).toEqual(codeBBefore);
		expect(blockB.lastUpdated).toBe(lastUpdatedB);
		expect(store.getState().codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBeUndefined();
	});
});
