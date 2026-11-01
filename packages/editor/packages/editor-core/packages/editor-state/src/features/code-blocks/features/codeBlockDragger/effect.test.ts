import { createMockState } from '@8f4e/editor-state-testing';
import type { EventDispatcher, InternalMouseEvent, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCodeBlockGraphicData } from '../../utils/createCodeBlockGraphicData';
import codeBlockDragger from './effect';

describe('codeBlockDragger', () => {
	let state: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let events: EventDispatcher;
	let mousedownHandlers: Array<(event: InternalMouseEvent) => void>;
	let mousemoveHandlers: Array<(event: InternalMouseEvent) => void>;
	let mouseupHandlers: Array<() => void>;

	beforeEach(() => {
		// Initialize state
		state = createMockState({
			editorMode: 'edit',
			featureFlags: {
				moduleDragging: true,
			},
			codeBlockRendering: {
				currentProject: { entries: [], path: '', blocks: [] },
				viewportAnchoredCodeBlocks: [],
				draggedCodeBlock: undefined,
				selectedCodeBlock: undefined,
				nextCodeBlockCreationIndex: 0,
			},
			contextMenu: {
				highlightedItem: 0,
				itemWidth: 200,
				items: [],
				open: false,
				x: 0,
				y: 0,
				menuStack: [],
			},
			viewport: {
				x: 0,
				y: 0,
				vGrid: 10,
				hGrid: 20,
				width: 800,
				height: 600,
				gridCoordinates: { x: 0, y: 0 },
			},
		});

		store = createStateManager(state);

		mousedownHandlers = [];
		mousemoveHandlers = [];
		mouseupHandlers = [];

		events = {
			on: vi.fn((eventName: string, callback: (event: InternalMouseEvent | void) => void) => {
				if (eventName === 'mousedown') mousedownHandlers.push(callback as (event: InternalMouseEvent) => void);
				if (eventName === 'mousemove') mousemoveHandlers.push(callback as (event: InternalMouseEvent) => void);
				if (eventName === 'mouseup') mouseupHandlers.push(callback as () => void);
			}),
			off: vi.fn(),
			dispatch: vi.fn(),
		};
	});

	describe('single block drag', () => {
		it('drags the clicked block by default', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
			});

			state.codeBlockRendering.currentProject.blocks = [block1];

			codeBlockDragger(store, events);

			// Mousedown without Alt key
			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			expect(state.codeBlockRendering.draggedCodeBlock).toBe(block1);

			// Mousemove
			mousemoveHandlers[0]({
				x: 60,
				y: 110,
				movementX: 10,
				movementY: 10,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			expect(block1.x).toBe(60);
			expect(block1.y).toBe(110);

			// Mouseup
			mouseupHandlers[0]();

			expect(block1.gridX).toBe(6); // Math.round(60 / 10)
			expect(block1.gridY).toBe(6); // Math.round(110 / 20)
			expect(block1.x).toBe(60); // 6 * 10
			expect(block1.y).toBe(120); // 6 * 20
			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		});
	});

	it('moves plugin-selected targets and persists their positions with one change', () => {
		const first = createCodeBlockGraphicData({
			code: ['module first', 'moduleEnd'],
			gridX: 5,
			gridY: 5,
			x: 50,
			y: 100,
		});
		const second = createCodeBlockGraphicData({
			code: ['module second', 'moduleEnd'],
			gridX: 20,
			gridY: 10,
			x: 200,
			y: 200,
		});
		state.codeBlockRendering.currentProject.blocks = [first, second];
		vi.mocked(events.dispatch).mockImplementation((name, payload) => {
			if (name !== 'resolveCodeBlockDragTargets') return;
			const request = payload as import('./effect').ResolveCodeBlockDragTargetsEvent;
			expect(request).toEqual({ codeBlock: first, altKey: true, targets: [first] });
			request.targets = [first, second];
		});
		codeBlockDragger(store, events);
		const pointer = {
			x: 50,
			y: 100,
			altKey: true,
			buttons: 1,
			movementX: 0,
			movementY: 0,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
		};
		mousedownHandlers[0](pointer);
		mousemoveHandlers[0]({ ...pointer, movementX: 10, movementY: 20 });
		mouseupHandlers[0]();
		expect(first.code).toContain('; @pos 6 6');
		expect(second.code).toContain('; @pos 21 11');
		expect(state.projectChange.revision).toBe(1);
		expect(state.compilerInputRevision).toBe(0);
	});

	describe('stopPropagation behavior', () => {
		it('should set stopPropagation to true while dragging', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
			});

			state.codeBlockRendering.currentProject.blocks = [block1];

			codeBlockDragger(store, events);

			// Mousedown
			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			// Mousemove
			const moveEvent = {
				x: 60,
				y: 110,
				movementX: 10,
				movementY: 10,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			};
			mousemoveHandlers[0](moveEvent);

			expect(moveEvent.stopPropagation).toBe(true);
		});
	});

	describe('feature flag', () => {
		it('should not drag if moduleDragging feature is disabled', () => {
			state.featureFlags.moduleDragging = false;

			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
			});

			state.codeBlockRendering.currentProject.blocks = [block1];

			codeBlockDragger(store, events);

			// Mousedown
			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		});

		it('should dispatch clicks without dragging when editing is disabled', () => {
			state.editorMode = 'view';

			const blockBehind = createCodeBlockGraphicData({
				code: ['module behind', 'moduleEnd'],
				gridX: 20,
				gridY: 20,
				x: 200,
				y: 200,
				creationIndex: 1,
				blockType: 'module',
			});
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
			});

			state.codeBlockRendering.currentProject.blocks = [block1, blockBehind];

			codeBlockDragger(store, events);

			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			mousemoveHandlers[0]({
				x: 60,
				y: 110,
				movementX: 10,
				movementY: 10,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});
			mouseupHandlers[0]();

			expect(events.dispatch).toHaveBeenCalledWith(
				'codeBlockPointerDown',
				expect.objectContaining({ codeBlock: block1 })
			);
			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
			expect(block1.x).toBe(50);
			expect(block1.y).toBe(100);
			expect(state.codeBlockRendering.currentProject.blocks).toEqual([blockBehind, block1]);
		});
	});

	describe('selected code block', () => {
		it('should set selected code block on mousedown', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
			});

			state.codeBlockRendering.currentProject.blocks = [block1];

			codeBlockDragger(store, events);

			// Mousedown
			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			expect(state.codeBlockRendering.selectedCodeBlock).toBe(block1);
		});

		it('should not update block position metadata on click without drag', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				lastUpdated: 1234,
				creationIndex: 0,
				blockType: 'module',
			});
			const originalCode = [...block1.code];

			state.codeBlockRendering.currentProject.blocks = [block1];

			codeBlockDragger(store, events);

			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			mouseupHandlers[0]();

			expect(block1.lastUpdated).toBe(1234);
			expect(block1.code).toEqual(originalCode);
			expect(block1.gridX).toBe(5);
			expect(block1.gridY).toBe(5);
			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		});

		it('should clear selected code block when mousedown is on empty space', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
			});

			state.codeBlockRendering.currentProject.blocks = [block1];
			state.codeBlockRendering.selectedCodeBlock = block1;

			codeBlockDragger(store, events);

			// Mousedown outside any block
			mousedownHandlers[0]({
				x: 400,
				y: 400,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		});
	});

	describe('alwaysOnTop z-order partitioning', () => {
		it('brings a normal block forward without crossing into the always-on-top partition', () => {
			const normal1 = createCodeBlockGraphicData({
				code: ['module normal1', 'moduleEnd'],
				name: 'normal1',
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				width: 100,
				height: 100,
				creationIndex: 0,
				blockType: 'module',
				alwaysOnTop: false,
			});
			const normal2 = createCodeBlockGraphicData({
				code: ['module normal2', 'moduleEnd'],
				name: 'normal2',
				gridX: 25,
				gridY: 5,
				x: 250,
				y: 100,
				width: 100,
				height: 100,
				creationIndex: 1,
				blockType: 'module',
				alwaysOnTop: false,
			});
			const top1 = createCodeBlockGraphicData({
				code: ['module top1', '; @alwaysOnTop', 'moduleEnd'],
				name: 'top1',
				gridX: 45,
				gridY: 5,
				x: 450,
				y: 100,
				width: 100,
				height: 100,
				creationIndex: 2,
				blockType: 'module',
				alwaysOnTop: true,
			});

			state.codeBlockRendering.currentProject.blocks = [normal1, normal2, top1];

			codeBlockDragger(store, events);

			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			expect(state.codeBlockRendering.currentProject.blocks).toEqual([normal2, normal1, top1]);
		});

		it('brings an always-on-top block forward within the always-on-top partition', () => {
			const normal1 = createCodeBlockGraphicData({
				code: ['module normal1', 'moduleEnd'],
				name: 'normal1',
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				width: 100,
				height: 100,
				creationIndex: 0,
				blockType: 'module',
				alwaysOnTop: false,
			});
			const top1 = createCodeBlockGraphicData({
				code: ['module top1', '; @alwaysOnTop', 'moduleEnd'],
				name: 'top1',
				gridX: 25,
				gridY: 5,
				x: 250,
				y: 100,
				width: 100,
				height: 100,
				creationIndex: 1,
				blockType: 'module',
				alwaysOnTop: true,
			});
			const top2 = createCodeBlockGraphicData({
				code: ['module top2', '; @alwaysOnTop', 'moduleEnd'],
				name: 'top2',
				gridX: 45,
				gridY: 5,
				x: 450,
				y: 100,
				width: 100,
				height: 100,
				creationIndex: 2,
				blockType: 'module',
				alwaysOnTop: true,
			});

			state.codeBlockRendering.currentProject.blocks = [normal1, top1, top2];

			codeBlockDragger(store, events);

			mousedownHandlers[0]({
				x: 250,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: false,
			});

			expect(state.codeBlockRendering.currentProject.blocks).toEqual([normal1, top2, top1]);
		});
	});
});
