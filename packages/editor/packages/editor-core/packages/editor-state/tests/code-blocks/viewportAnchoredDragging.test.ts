import type { EventDispatcher, InternalMouseEvent, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import codeBlockDragger from '../../src/features/code-blocks/features/codeBlockDragger/effect';
import { createCodeBlockGraphicData } from '../../src/features/code-blocks/utils/createCodeBlockGraphicData';
import { createMockState } from '../../src/pureHelpers/testingUtils/testUtils';

describe('viewport-anchored dragging', () => {
	let state: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let events: EventDispatcher;
	let mousedownHandlers: Array<(event: InternalMouseEvent) => void>;
	let mousemoveHandlers: Array<(event: InternalMouseEvent) => void>;
	let mouseupHandlers: Array<() => void>;

	beforeEach(() => {
		state = createMockState({
			featureFlags: { moduleDragging: true },
			viewport: { vGrid: 10, hGrid: 20, width: 800, height: 600, roundedWidth: 800, roundedHeight: 600 },
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

	it('writes back @pos in anchored coordinates for top-left anchor', () => {
		const block = createCodeBlockGraphicData({
			code: ['module test1', '; @viewport top-left', '; @pos 1 1', 'moduleEnd'],
			gridX: 1,
			gridY: 1,
			x: 10,
			y: 20,
			width: 50,
			height: 40,
			viewportAnchor: 'top-left',
			creationIndex: 0,
			blockType: 'module',
		});

		state.codeBlockRendering.currentProject.blocks = [block];

		codeBlockDragger(store, events);

		mousedownHandlers[0]({
			x: 10,
			y: 20,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
			altKey: false,
		});

		mousemoveHandlers[0]({
			x: 30,
			y: 40,
			movementX: 20,
			movementY: 20,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
			altKey: false,
		});

		expect(block.x).toBe(30);
		expect(block.y).toBe(40);

		mouseupHandlers[0]();

		expect(block.gridX).toBe(3);
		expect(block.gridY).toBe(2);
		expect(block.code).toContain('; @pos 3 2');
		expect(block.code).toContain('; @viewport top-left');
	});

	it('writes back @pos in anchored coordinates for top-right anchor', () => {
		const block = createCodeBlockGraphicData({
			code: ['module test1', '; @viewport top-right', '; @pos 2 1', 'moduleEnd'],
			gridX: 2,
			gridY: 1,
			x: 730,
			y: 20,
			width: 50,
			height: 40,
			viewportAnchor: 'top-right',
			creationIndex: 0,
			blockType: 'module',
		});

		state.codeBlockRendering.currentProject.blocks = [block];

		codeBlockDragger(store, events);

		mousedownHandlers[0]({
			x: 730,
			y: 20,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
			altKey: false,
		});

		mousemoveHandlers[0]({
			x: 720,
			y: 20,
			movementX: -10,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
			altKey: false,
		});

		mouseupHandlers[0]();

		expect(block.gridX).toBe(3);
		expect(block.gridY).toBe(1);
		expect(block.code).toContain('; @pos 3 1');
		expect(block.code).toContain('; @viewport top-right');
	});

	it('does not snap viewport-anchored blocks to world-space grid on drag end', () => {
		const block = createCodeBlockGraphicData({
			code: ['module test1', '; @viewport top-left', '; @pos 1 1', 'moduleEnd'],
			gridX: 1,
			gridY: 1,
			x: 10,
			y: 20,
			width: 50,
			height: 40,
			viewportAnchor: 'top-left',
			creationIndex: 0,
			blockType: 'module',
		});

		state.codeBlockRendering.currentProject.blocks = [block];

		codeBlockDragger(store, events);

		mousedownHandlers[0]({
			x: 10,
			y: 20,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
			altKey: false,
		});

		mousemoveHandlers[0]({
			x: 25,
			y: 35,
			movementX: 15,
			movementY: 15,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
			altKey: false,
		});

		mouseupHandlers[0]();

		expect(block.gridX).toBe(3);
		expect(block.gridY).toBe(2);
		expect(block.code).toContain('; @pos 3 2');
	});
});
