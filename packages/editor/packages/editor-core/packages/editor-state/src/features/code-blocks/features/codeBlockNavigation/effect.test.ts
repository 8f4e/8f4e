import type { CodeBlockGraphicData, NavigateCodeBlockEvent } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import buildDisplayModel from '../../buildDisplayModel';
import codeBlockNavigation, { jumpToCodeBlock, navigateToCodeBlockInDirection } from './effect';

describe('codeBlockNavigation', () => {
	let state: ReturnType<typeof createMockState>;
	let events: ReturnType<typeof createMockEventDispatcherWithVitest>;
	let onNavigateCodeBlockHandler: (event: NavigateCodeBlockEvent) => void;
	let selectedBlock: CodeBlockGraphicData;
	let leftBlock: CodeBlockGraphicData;
	let rightBlock: CodeBlockGraphicData;
	let upBlock: CodeBlockGraphicData;
	let downBlock: CodeBlockGraphicData;

	beforeEach(() => {
		// Create mock code blocks using shared utility
		selectedBlock = createMockCodeBlock({
			x: 200,
			y: 200,
			creationIndex: 0,
			name: 'selected',
		});
		leftBlock = createMockCodeBlock({
			x: 0,
			y: 200,
			creationIndex: 1,
			name: 'left',
		});
		rightBlock = createMockCodeBlock({
			x: 400,
			y: 200,
			creationIndex: 2,
			name: 'right',
		});
		upBlock = createMockCodeBlock({ x: 200, y: 0, creationIndex: 3, name: 'up' });
		downBlock = createMockCodeBlock({
			x: 200,
			y: 400,
			creationIndex: 4,
			name: 'down',
		});

		// Create mock state using shared utility
		state = createMockState({
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
				currentProject: { entries: [], path: '', blocks: [selectedBlock, leftBlock, rightBlock, upBlock, downBlock] },
			},
		});

		// Create mock event dispatcher using shared utility
		events = createMockEventDispatcherWithVitest();
		(events.on as ReturnType<typeof vi.fn>).mockImplementation(
			(eventName: string, callback: (event: NavigateCodeBlockEvent) => void) => {
				if (eventName === 'navigateCodeBlock') {
					onNavigateCodeBlockHandler = callback;
				}
			}
		);
	});

	it('should register a navigateCodeBlock event handler', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		expect(events.on).toHaveBeenCalledWith('navigateCodeBlock', expect.any(Function));
	});

	it('should do nothing when no code block is selected', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		state.codeBlockRendering.selectedCodeBlock = undefined;
		onNavigateCodeBlockHandler({ direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(undefined);
	});

	it('should navigate left when navigateCodeBlock event with left direction is dispatched', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		onNavigateCodeBlockHandler({ direction: 'left' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(leftBlock);
	});

	it('should navigate right when navigateCodeBlock event with right direction is dispatched', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		onNavigateCodeBlockHandler({ direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(rightBlock);
	});

	it('should align the target highlighted line during horizontal navigation', () => {
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
		selectedBlock.displayModel = buildDisplayModel(selectedBlock.code, { isExpandedForEditing: true });
		selectedBlock.cursor.row = 2;
		selectedBlock.cursor.col = 3;
		selectedBlock.cursor.y = 2 * state.viewport.hGrid;

		rightBlock.code = ['a', 'bb', 'ccc', 'dddd', 'eeeee'];
		rightBlock.displayModel = buildDisplayModel(rightBlock.code, { isExpandedForEditing: true });
		rightBlock.cursor.row = 0;
		rightBlock.cursor.col = 0;

		codeBlockNavigation(createStateManager(state), events);

		onNavigateCodeBlockHandler({ direction: 'right' });

		expect(state.codeBlockRendering.selectedCodeBlock).toBe(rightBlock);
		expect(rightBlock.cursor.row).toBe(2);
		expect(rightBlock.cursor.col).toBe(3);
		expect(rightBlock.cursor.y).toBe(2 * state.viewport.hGrid);
	});

	it('should navigate up when navigateCodeBlock event with up direction is dispatched', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);
		selectedBlock.cursor.row = 0;
		selectedBlock.cursor.y = 0;

		onNavigateCodeBlockHandler({ direction: 'up' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(upBlock);
	});

	it('should navigate down when navigateCodeBlock event with down direction is dispatched', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
		selectedBlock.displayModel = buildDisplayModel(selectedBlock.code, { isExpandedForEditing: true });
		selectedBlock.cursor.row = 3;
		selectedBlock.cursor.y = 3 * state.viewport.hGrid;

		onNavigateCodeBlockHandler({ direction: 'down' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(downBlock);
	});

	it('should move to the first line of the current block before navigating upward', () => {
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
		selectedBlock.displayModel = buildDisplayModel(selectedBlock.code, { isExpandedForEditing: true });
		selectedBlock.cursor.row = 2;
		selectedBlock.cursor.col = 2;
		selectedBlock.cursor.y = 2 * state.viewport.hGrid;

		const result = navigateToCodeBlockInDirection(createStateManager(state), 'up', events);

		expect(result).toBe(true);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(selectedBlock);
		expect(selectedBlock.cursor.row).toBe(0);
		expect(selectedBlock.cursor.y).toBe(0);
		expect(state.viewport.y).toBe(-176);
		expect(events.dispatch).toHaveBeenCalledWith(
			'viewportChanged',
			expect.objectContaining({
				y: state.viewport.y,
			})
		);
	});

	it('should update the selected block cursor through the store during vertical navigation', () => {
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
		selectedBlock.displayModel = buildDisplayModel(selectedBlock.code, { isExpandedForEditing: true });
		selectedBlock.cursor.row = 2;
		selectedBlock.cursor.col = 2;
		selectedBlock.cursor.y = 2 * state.viewport.hGrid;

		const store = createStateManager(state);
		const onSelectedRowChanged = vi.fn();
		store.subscribe('codeBlockRendering.selectedCodeBlock.cursor.row', onSelectedRowChanged);

		const result = navigateToCodeBlockInDirection(store, 'up', events);

		expect(result).toBe(true);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(selectedBlock);
		expect(selectedBlock.cursor.row).toBe(0);
		expect(onSelectedRowChanged).toHaveBeenCalledWith(0);
	});

	it('should move to the last line of the current block before navigating downward', () => {
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
		selectedBlock.displayModel = buildDisplayModel(selectedBlock.code, { isExpandedForEditing: true });
		selectedBlock.cursor.row = 1;
		selectedBlock.cursor.col = 1;
		selectedBlock.cursor.y = state.viewport.hGrid;

		const result = navigateToCodeBlockInDirection(createStateManager(state), 'down', events);

		expect(result).toBe(true);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(selectedBlock);
		expect(selectedBlock.cursor.row).toBe(3);
		expect(selectedBlock.cursor.y).toBe(3 * state.viewport.hGrid);
		expect(state.viewport.y).toBe(-128);
		expect(events.dispatch).toHaveBeenCalledWith(
			'viewportChanged',
			expect.objectContaining({
				y: state.viewport.y,
			})
		);
	});

	it('should select the bottom row of the block above after the current top row is highlighted', () => {
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
		selectedBlock.displayModel = buildDisplayModel(selectedBlock.code, { isExpandedForEditing: true });
		selectedBlock.cursor.row = 0;
		selectedBlock.cursor.col = 2;
		selectedBlock.cursor.y = 0;

		upBlock.code = ['a', 'bb', 'ccc'];
		upBlock.displayModel = buildDisplayModel(upBlock.code, { isExpandedForEditing: true });
		upBlock.cursor.row = 0;
		upBlock.cursor.col = 0;
		upBlock.cursor.y = 0;

		const result = navigateToCodeBlockInDirection(createStateManager(state), 'up', events);

		expect(result).toBe(true);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(upBlock);
		expect(upBlock.cursor.row).toBe(2);
		expect(upBlock.cursor.col).toBe(2);
		expect(upBlock.cursor.y).toBe(2 * state.viewport.hGrid);
	});

	it('should select the top row of the block below after the current bottom row is highlighted', () => {
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
		selectedBlock.displayModel = buildDisplayModel(selectedBlock.code, { isExpandedForEditing: true });
		selectedBlock.cursor.row = 3;
		selectedBlock.cursor.col = 3;
		selectedBlock.cursor.y = 3 * state.viewport.hGrid;

		downBlock.code = ['a', 'bb', 'ccc'];
		downBlock.displayModel = buildDisplayModel(downBlock.code, { isExpandedForEditing: true });
		downBlock.cursor.row = 2;
		downBlock.cursor.col = 1;
		downBlock.cursor.y = 2 * state.viewport.hGrid;

		const result = navigateToCodeBlockInDirection(createStateManager(state), 'down', events);

		expect(result).toBe(true);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(downBlock);
		expect(downBlock.cursor.row).toBe(0);
		expect(downBlock.cursor.col).toBe(1);
		expect(downBlock.cursor.y).toBe(0);
	});

	it('should center viewport on the newly selected highlighted line', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		selectedBlock.cursor.y = state.viewport.hGrid;
		rightBlock.cursor.y = 5 * state.viewport.hGrid;

		onNavigateCodeBlockHandler({ direction: 'right' });

		expect(Math.abs(state.viewport.x % state.viewport.vGrid)).toBe(0);
		expect(Math.abs(state.viewport.y % state.viewport.hGrid)).toBe(0);
		expect(state.viewport.y).toBe(-176);
	});

	it.each(['view', 'edit'] as const)('commits the viewport once during navigation in %s mode', editorMode => {
		state = createMockState({
			editorMode,
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
				currentProject: { entries: [], path: '', blocks: [selectedBlock, leftBlock, rightBlock, upBlock, downBlock] },
			},
			viewport: {
				x: 0,
				y: 0,
				width: 800,
				height: 600,
				vGrid: 8,
				hGrid: 16,
			},
		});

		const store = createStateManager(state);
		const onSelectionChanged = vi.fn();
		store.subscribe('codeBlockRendering.selectedCodeBlock', onSelectionChanged);
		codeBlockNavigation(store, events);

		onNavigateCodeBlockHandler({ direction: 'right' });

		expect(state.codeBlockRendering.selectedCodeBlock).toBe(rightBlock);
		expect(onSelectionChanged).toHaveBeenCalledWith(rightBlock);
		expect(state.viewport).toMatchObject({ x: 48, y: -96 });
		expect(events.dispatch).toHaveBeenCalledExactlyOnceWith('viewportChanged', {
			previousX: 0,
			previousY: 0,
			x: 48,
			y: -96,
			source: 'navigation',
		});
	});

	it('should not change selection if no block found in direction', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		// Remove all blocks except selected
		state.codeBlockRendering.currentProject.blocks = [selectedBlock];

		onNavigateCodeBlockHandler({ direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(selectedBlock);
		expect(events.dispatch).not.toHaveBeenCalled();
	});

	describe('jumpToCodeBlock', () => {
		it('should jump to code block by creationIndex', () => {
			const result = jumpToCodeBlock(createStateManager(state), 2, events);
			expect(result).toBe(true);
			expect(state.codeBlockRendering.selectedCodeBlock).toBe(rightBlock);
			expect(events.dispatch).toHaveBeenCalledExactlyOnceWith(
				'viewportChanged',
				expect.objectContaining({
					x: state.viewport.x,
					y: state.viewport.y,
					source: 'navigation',
				})
			);
		});

		it('should return false when creationIndex does not match', () => {
			const result = jumpToCodeBlock(createStateManager(state), 999, events);
			expect(result).toBe(false);
			// selectedCodeBlock should remain unchanged
			expect(state.codeBlockRendering.selectedCodeBlock).toBe(selectedBlock);
		});

		it('should center viewport on the jumped-to code block', () => {
			downBlock.cursor.y = 3 * state.viewport.hGrid;

			jumpToCodeBlock(createStateManager(state), 4, events);

			expect(state.viewport.y).toBe(downBlock.y + downBlock.cursor.y - state.viewport.height / 2);
		});
	});
});
