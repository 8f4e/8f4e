import type { CodeBlockGraphicData, NavigateCodeBlockEvent } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import codeBlockNavigation, { goHome, jumpToCodeBlock, navigateToCodeBlockInDirection } from './effect';

describe('codeBlockNavigation', () => {
	let state: ReturnType<typeof createMockState>;
	let events: ReturnType<typeof createMockEventDispatcherWithVitest>;
	let onNavigateCodeBlockHandler: (event: NavigateCodeBlockEvent) => void;
	let onGoHomeHandler: () => void;
	let selectedBlock: CodeBlockGraphicData;
	let leftBlock: CodeBlockGraphicData;
	let rightBlock: CodeBlockGraphicData;
	let upBlock: CodeBlockGraphicData;
	let downBlock: CodeBlockGraphicData;

	beforeEach(() => {
		// Clear all timers before each test
		vi.clearAllTimers();
		vi.useFakeTimers();

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
				currentProject: { path: '', blocks: [selectedBlock, leftBlock, rightBlock, upBlock, downBlock] },
			},
		});

		// Create mock event dispatcher using shared utility
		events = createMockEventDispatcherWithVitest();
		(events.on as ReturnType<typeof vi.fn>).mockImplementation(
			(eventName: string, callback: ((event: NavigateCodeBlockEvent) => void) | (() => void)) => {
				if (eventName === 'navigateCodeBlock') {
					onNavigateCodeBlockHandler = callback as (event: NavigateCodeBlockEvent) => void;
				} else if (eventName === 'goHome') {
					onGoHomeHandler = callback as () => void;
				}
			}
		);
	});

	it('should register a navigateCodeBlock event handler', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		expect(events.on).toHaveBeenCalledWith('navigateCodeBlock', expect.any(Function));
	});

	it('should register a goHome event handler', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		expect(events.on).toHaveBeenCalledWith('goHome', expect.any(Function));
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

	it('should skip viewport-anchored blocks during directional navigation', () => {
		const anchoredRight = createMockCodeBlock({
			x: 300,
			y: 200,
			creationIndex: 5,
			name: 'anchored-right',
			viewportAnchor: 'top-right',
		});
		state.codeBlockRendering.currentProject.blocks = [selectedBlock, anchoredRight, rightBlock];

		codeBlockNavigation(createStateManager(state), events);

		onNavigateCodeBlockHandler({ direction: 'right' });

		expect(state.codeBlockRendering.selectedCodeBlock).toBe(rightBlock);
	});

	it('should navigate from a viewport-anchored selected block to a world-space block', () => {
		const anchoredSelected = createMockCodeBlock({
			x: 200,
			y: 200,
			creationIndex: 0,
			name: 'anchored-selected',
			viewportAnchor: 'top-left',
		});
		state.codeBlockRendering.selectedCodeBlock = anchoredSelected;
		state.codeBlockRendering.currentProject.blocks = [anchoredSelected, rightBlock];

		codeBlockNavigation(createStateManager(state), events);

		onNavigateCodeBlockHandler({ direction: 'right' });

		expect(state.codeBlockRendering.selectedCodeBlock).toBe(rightBlock);
	});

	it('should align the target highlighted line during horizontal navigation', () => {
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
		selectedBlock.cursor.row = 2;
		selectedBlock.cursor.col = 3;
		selectedBlock.cursor.y = 2 * state.viewport.hGrid;

		rightBlock.code = ['a', 'bb', 'ccc', 'dddd', 'eeeee'];
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
		selectedBlock.cursor.row = 3;
		selectedBlock.cursor.y = 3 * state.viewport.hGrid;

		onNavigateCodeBlockHandler({ direction: 'down' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(downBlock);
	});

	it('should move to the first line of the current block before navigating upward', () => {
		selectedBlock.code = ['zero', 'one', 'two', 'three'];
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
		selectedBlock.cursor.row = 0;
		selectedBlock.cursor.col = 2;
		selectedBlock.cursor.y = 0;

		upBlock.code = ['a', 'bb', 'ccc'];
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
		selectedBlock.cursor.row = 3;
		selectedBlock.cursor.col = 3;
		selectedBlock.cursor.y = 3 * state.viewport.hGrid;

		downBlock.code = ['a', 'bb', 'ccc'];
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

	it.each(['view', 'edit'] as const)('animates viewport navigation in %s mode', editorMode => {
		const frameCallbacks: Array<(time: number) => void> = [];
		state = createMockState({
			editorMode,
			callbacks: {
				requestAnimationFrame: vi.fn(callback => {
					frameCallbacks.push(callback);
					return frameCallbacks.length;
				}),
				cancelAnimationFrame: vi.fn(),
			},
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
				currentProject: { path: '', blocks: [selectedBlock, leftBlock, rightBlock, upBlock, downBlock] },
			},
			viewport: {
				x: 0,
				y: 0,
				width: 800,
				height: 600,
				roundedWidth: 800,
				roundedHeight: 600,
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
		expect(state.viewportAnimation.active).toBe(true);
		expect(state.viewportAnimation.targetX).toBe(48);
		expect(state.viewportAnimation.targetY).toBe(-96);
		expect(state.viewport.x).toBe(0);
		expect(state.viewport.y).toBe(0);

		frameCallbacks[0](0);
		frameCallbacks[1](250);

		expect(state.viewport.x).toBe(24);
		expect(state.viewport.y).toBe(-48);
		expect(state.viewportAnimation.active).toBe(true);

		frameCallbacks[2](500);

		expect(state.viewport.x).toBe(state.viewportAnimation.targetX);
		expect(state.viewport.y).toBe(state.viewportAnimation.targetY);
		expect(state.viewportAnimation.active).toBe(false);
		expect(events.dispatch).toHaveBeenCalledWith(
			'viewportChanged',
			expect.objectContaining({
				x: state.viewport.x,
				y: state.viewport.y,
			})
		);
	});

	it('should not change selection if no block found in direction', () => {
		// Initialize the effect
		codeBlockNavigation(createStateManager(state), events);

		// Remove all blocks except selected
		state.codeBlockRendering.currentProject.blocks = [selectedBlock];

		onNavigateCodeBlockHandler({ direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(selectedBlock);
	});

	describe('jumpToCodeBlock', () => {
		it('should jump to code block by creationIndex', () => {
			const result = jumpToCodeBlock(createStateManager(state), 2, events);
			expect(result).toBe(true);
			expect(state.codeBlockRendering.selectedCodeBlock).toBe(rightBlock);
			expect(events.dispatch).toHaveBeenCalledWith(
				'viewportChanged',
				expect.objectContaining({
					x: state.viewport.x,
					y: state.viewport.y,
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

	describe('goHome', () => {
		it('should center viewport on the first home block and select it', () => {
			const firstHome = createMockCodeBlock({
				name: 'home-1',
				x: 100,
				y: 100,
				isHome: true,
				homeAlignment: 'center',
			});
			const secondHome = createMockCodeBlock({
				name: 'home-2',
				x: 400,
				y: 400,
				isHome: true,
			});

			state = createMockState({
				codeBlockRendering: { currentProject: { path: '', blocks: [firstHome, secondHome] } },
				viewport: {
					x: 10,
					y: 20,
					width: 200,
					height: 200,
					roundedWidth: 200,
					roundedHeight: 200,
				},
			});

			goHome(createStateManager(state), events);

			expect(state.codeBlockRendering.selectedCodeBlock).toBe(firstHome);
			expect(state.viewport.x).toBe(48);
			expect(state.viewport.y).toBe(48);
		});

		it('should honor home alignment hints when centering the viewport', () => {
			const homeBlock = createMockCodeBlock({
				name: 'home-bottom',
				x: 100,
				y: 200,
				width: 100,
				height: 100,
				isHome: true,
				homeAlignment: 'bottom',
			});
			state = createMockState({
				codeBlockRendering: { currentProject: { path: '', blocks: [homeBlock] } },
				viewport: {
					x: 0,
					y: 0,
					width: 200,
					height: 200,
					roundedWidth: 200,
					roundedHeight: 200,
				},
			});

			goHome(createStateManager(state), events);

			expect(state.codeBlockRendering.selectedCodeBlock).toBe(homeBlock);
			expect(state.viewport.x).toBe(48);
			expect(state.viewport.y).toBe(96);
		});

		it('should dispatch viewportChanged after goHome changes the viewport', () => {
			const homeBlock = createMockCodeBlock({
				name: 'home-dispatch',
				isHome: true,
				homeAlignment: 'center',
				x: 100,
				y: 100,
			});
			state = createMockState({
				codeBlockRendering: { currentProject: { path: '', blocks: [homeBlock] } },
			});

			goHome(createStateManager(state), events);

			expect(events.dispatch).toHaveBeenCalledWith(
				'viewportChanged',
				expect.objectContaining({
					x: state.viewport.x,
					y: state.viewport.y,
				})
			);
		});

		it('should use a disabled home block if it is first', () => {
			const disabledHome = createMockCodeBlock({
				name: 'home-disabled',
				isHome: true,
				disabled: true,
			});
			const otherHome = createMockCodeBlock({ name: 'home-other', isHome: true });

			state = createMockState({
				codeBlockRendering: { currentProject: { path: '', blocks: [disabledHome, otherHome] } },
			});

			goHome(createStateManager(state), events);

			expect(state.codeBlockRendering.selectedCodeBlock).toBe(disabledHome);
		});

		it('should center on origin when no home block exists', () => {
			state = createMockState({
				viewport: { x: 25, y: -10 },
				codeBlockRendering: {
					currentProject: { path: '', blocks: [selectedBlock] },
					selectedCodeBlock: selectedBlock,
				},
			});

			goHome(createStateManager(state), events);

			expect(state.viewport.x).toBe(0);
			expect(state.viewport.y).toBe(0);
			expect(state.codeBlockRendering.selectedCodeBlock).toBe(selectedBlock);
		});

		it('should respond to goHome event', () => {
			const homeBlock = createMockCodeBlock({
				name: 'home-event',
				isHome: true,
				x: 160,
				y: 80,
			});
			state.codeBlockRendering.currentProject.blocks = [homeBlock, ...state.codeBlockRendering.currentProject.blocks];

			codeBlockNavigation(createStateManager(state), events);

			onGoHomeHandler();

			expect(state.codeBlockRendering.selectedCodeBlock).toBe(homeBlock);
		});
	});
});
