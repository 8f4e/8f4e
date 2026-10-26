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
			featureFlags: {
				moduleDragging: true,
				editing: true,
			},
			codeBlockRendering: {
				codeBlocks: [],
				viewportAnchoredCodeBlocks: [],
				draggedCodeBlock: undefined,
				selectedCodeBlock: undefined,
				nextCodeBlockCreationIndex: 0,
				outputsByWordAddress: new Map(),
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

	describe('single block drag (ungrouped blocks)', () => {
		it('should drag a single ungrouped block without Alt key', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
			});

			state.codeBlockRendering.codeBlocks = [block1];

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

	describe('grouped drag (default behavior without Alt)', () => {
		it('should drag grouped blocks together without Alt key (default group drag)', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', '; @group audio', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
				groupName: 'audio',
			});

			const block2 = createCodeBlockGraphicData({
				code: ['module test2', '; @group audio', 'moduleEnd'],
				gridX: 10,
				gridY: 10,
				x: 100,
				y: 200,
				creationIndex: 1,
				blockType: 'module',
				groupName: 'audio',
			});

			state.codeBlockRendering.codeBlocks = [block1, block2];

			codeBlockDragger(store, events);

			// Mousedown on block1 without Alt key - should drag whole group
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

			// Both block1 and block2 should move together
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(110);
			expect(block2.x).toBe(110);
			expect(block2.y).toBe(210);
		});

		it('should drag all blocks in same group by default (without Alt key)', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', '; @group audio', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
				groupName: 'audio',
			});

			const block2 = createCodeBlockGraphicData({
				code: ['module test2', '; @group audio', 'moduleEnd'],
				gridX: 10,
				gridY: 10,
				x: 100,
				y: 200,
				creationIndex: 1,
				blockType: 'module',
				groupName: 'audio',
			});

			const block3 = createCodeBlockGraphicData({
				code: ['module test3', 'moduleEnd'],
				gridX: 15,
				gridY: 15,
				x: 150,
				y: 300,
				creationIndex: 2,
				blockType: 'module',
			});

			state.codeBlockRendering.codeBlocks = [block1, block2, block3];

			codeBlockDragger(store, events);

			// Mousedown on block1 without Alt key (default group drag)
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

			// Both block1 and block2 should move
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(110);
			expect(block2.x).toBe(110);
			expect(block2.y).toBe(210);
			// block3 should not move (different group)
			expect(block3.x).toBe(150);
			expect(block3.y).toBe(300);

			// Mouseup
			mouseupHandlers[0]();

			// Both blocks should snap to grid
			expect(block1.gridX).toBe(6);
			expect(block1.gridY).toBe(6);
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(120);

			expect(block2.gridX).toBe(11);
			expect(block2.gridY).toBe(11);
			expect(block2.x).toBe(110);
			expect(block2.y).toBe(220);

			// block3 unchanged
			expect(block3.gridX).toBe(15);
			expect(block3.gridY).toBe(15);

			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		});

		it('should not group drag if block has no group name even without Alt key', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
			});

			const block2 = createCodeBlockGraphicData({
				code: ['module test2', 'moduleEnd'],
				gridX: 10,
				gridY: 10,
				x: 100,
				y: 200,
				creationIndex: 1,
				blockType: 'module',
			});

			state.codeBlockRendering.codeBlocks = [block1, block2];

			codeBlockDragger(store, events);

			// Mousedown on block1 without Alt key but no group
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

			// Only block1 should move (no group)
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(110);
			expect(block2.x).toBe(100);
			expect(block2.y).toBe(200);
		});

		it('should drag blocks in different groups separately (without Alt)', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', '; @group audio', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
				groupName: 'audio',
			});

			const block2 = createCodeBlockGraphicData({
				code: ['module test2', '; @group visual', 'moduleEnd'],
				gridX: 10,
				gridY: 10,
				x: 100,
				y: 200,
				creationIndex: 1,
				blockType: 'module',
				groupName: 'visual',
			});

			state.codeBlockRendering.codeBlocks = [block1, block2];

			codeBlockDragger(store, events);

			// Mousedown on block1 without Alt key
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

			// Only block1 should move (different groups)
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(110);
			expect(block2.x).toBe(100);
			expect(block2.y).toBe(200);
		});
	});

	describe('single block override (Alt key on grouped blocks)', () => {
		it('should drag only selected block with Alt key (override group drag)', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', '; @group audio', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
				groupName: 'audio',
			});

			const block2 = createCodeBlockGraphicData({
				code: ['module test2', '; @group audio', 'moduleEnd'],
				gridX: 10,
				gridY: 10,
				x: 100,
				y: 200,
				creationIndex: 1,
				blockType: 'module',
				groupName: 'audio',
			});

			state.codeBlockRendering.codeBlocks = [block1, block2];

			codeBlockDragger(store, events);

			// Mousedown on block1 WITH Alt key - should override group drag
			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: true,
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
				altKey: true,
			});

			// Only block1 should move (Alt override)
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(110);
			// block2 should NOT move despite being in same group
			expect(block2.x).toBe(100);
			expect(block2.y).toBe(200);

			// Mouseup
			mouseupHandlers[0]();

			// Only block1 should snap
			expect(block1.gridX).toBe(6);
			expect(block1.gridY).toBe(6);
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(120);

			// block2 unchanged
			expect(block2.gridX).toBe(10);
			expect(block2.gridY).toBe(10);
			expect(block2.x).toBe(100);
			expect(block2.y).toBe(200);

			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		});

		it('should drag single block by default for nonstick groups (Alt reverses to group drag)', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', '; @group audio nonstick', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
				groupName: 'audio',
				groupNonstick: true,
			});

			const block2 = createCodeBlockGraphicData({
				code: ['module test2', '; @group audio nonstick', 'moduleEnd'],
				gridX: 10,
				gridY: 10,
				x: 100,
				y: 200,
				creationIndex: 1,
				blockType: 'module',
				groupName: 'audio',
				groupNonstick: true,
			});

			state.codeBlockRendering.codeBlocks = [block1, block2];

			codeBlockDragger(store, events);

			// Mousedown on block1 WITHOUT Alt key - nonstick should drag single block
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

			// Only block1 should move (nonstick default behavior)
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(110);
			// block2 should NOT move
			expect(block2.x).toBe(100);
			expect(block2.y).toBe(200);
		});

		it('should drag group together with Alt key for nonstick groups', () => {
			const block1 = createCodeBlockGraphicData({
				code: ['module test1', '; @group audio nonstick', 'moduleEnd'],
				gridX: 5,
				gridY: 5,
				x: 50,
				y: 100,
				creationIndex: 0,
				blockType: 'module',
				groupName: 'audio',
				groupNonstick: true,
			});

			const block2 = createCodeBlockGraphicData({
				code: ['module test2', '; @group audio nonstick', 'moduleEnd'],
				gridX: 10,
				gridY: 10,
				x: 100,
				y: 200,
				creationIndex: 1,
				blockType: 'module',
				groupName: 'audio',
				groupNonstick: true,
			});

			state.codeBlockRendering.codeBlocks = [block1, block2];

			codeBlockDragger(store, events);

			// Mousedown on block1 WITH Alt key - nonstick should reverse to group drag
			mousedownHandlers[0]({
				x: 50,
				y: 100,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				stopPropagation: false,
				canvasWidth: 800,
				canvasHeight: 600,
				altKey: true,
			});

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
				altKey: true,
			});

			// Both blocks should move together (nonstick Alt reverses behavior)
			expect(block1.x).toBe(60);
			expect(block1.y).toBe(110);
			expect(block2.x).toBe(110);
			expect(block2.y).toBe(210);
		});
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

			state.codeBlockRendering.codeBlocks = [block1];

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

			state.codeBlockRendering.codeBlocks = [block1];

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
			state.featureFlags.editing = false;

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

			state.codeBlockRendering.codeBlocks = [block1, blockBehind];

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
			expect(state.codeBlockRendering.codeBlocks).toEqual([blockBehind, block1]);
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

			state.codeBlockRendering.codeBlocks = [block1];

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

			state.codeBlockRendering.codeBlocks = [block1];

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

			state.codeBlockRendering.codeBlocks = [block1];
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

			state.codeBlockRendering.codeBlocks = [normal1, normal2, top1];

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

			expect(state.codeBlockRendering.codeBlocks).toEqual([normal2, normal1, top1]);
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

			state.codeBlockRendering.codeBlocks = [normal1, top1, top2];

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

			expect(state.codeBlockRendering.codeBlocks).toEqual([normal1, top2, top1]);
		});
	});
});
