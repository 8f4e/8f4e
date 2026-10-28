import type { EventDispatcher } from '@8f4e/editor-state-types';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DEFAULT_PROJECT } from './features/project-loading/emptyDefaultProject';
import animateViewport from './features/viewport/animateViewport';
import initState from './index';
import { createMockCodeBlock } from './pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from './pureHelpers/testingUtils/vitestTestUtils';

describe('editor state lifecycle', () => {
	it.each(['view', 'edit'] as const)('cancels active viewport animation when disposing in %s mode', editorMode => {
		const frames: Array<(time: number) => void> = [];
		const cancelAnimationFrame = vi.fn();
		const events = createMockEventDispatcherWithVitest();
		const store = initState(events, {
			callbacks: {
				requestAnimationFrame: callback => {
					frames.push(callback);
					return frames.length;
				},
				cancelAnimationFrame,
			},
			initialEditorMode: editorMode,
			runtimeRegistry: {},
		});
		const state = store.getState();
		animateViewport(state, 80, 160, events);
		expect(state.viewportAnimation.active).toBe(true);

		store.dispose();
		expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
		expect(state.viewportAnimation.active).toBe(false);

		frames[0](250);
		expect(state.viewport.x).toBe(0);
		expect(state.viewport.y).toBe(0);
	});

	it('initializes the requested editor mode and synchronizes editing', () => {
		const events = createMockEventDispatcherWithVitest();
		const store = initState(events, {
			callbacks: {},
			initialEditorMode: 'edit',
			runtimeRegistry: {},
		});

		expect(store.getState().editorMode).toBe('edit');
		expect(store.getState().featureFlags.editing).toBe(true);

		store.dispose();
	});

	it('keeps configuration notes in their project and clears them when an empty project is loaded', () => {
		const events = createMockEventDispatcherWithVitest();
		const store = initState(events, {
			callbacks: {},
			runtimeRegistry: {},
		});
		const code = ['note local.editorConfig', '; @config font terminus8x16', 'noteEnd'];

		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code }] });

		expect(
			store
				.getState()
				.codeBlockRendering.rootCodeBlocks.filter(block => block.blockType === 'note')
				.map(block => block.code)
		).toEqual([code]);
		expect(store.getState().editorConfig.font).toBe('terminus8x16');

		store.set('initialProjectState', EMPTY_DEFAULT_PROJECT);

		expect(store.getState().codeBlockRendering.rootCodeBlocks.filter(block => block.blockType === 'note')).toEqual([]);
		expect(store.getState().editorConfig.font).toBeUndefined();
		store.dispose();
	});

	it('disposes initialized effects and their active runtime exactly once', async () => {
		const runtimeDestroyer = vi.fn();
		const runtimeFactory = vi.fn(() => runtimeDestroyer);
		const events = createMockEventDispatcherWithVitest();
		const store = initState(events, {
			callbacks: {},
			runtimeRegistry: {
				TestRuntime: {
					id: 'TestRuntime',
					factory: runtimeFactory,
				},
			},
		});

		store.getState().editorConfig.runtime = 'TestRuntime';
		store.set('compiler.isCompiling', false);
		await Promise.resolve();
		store.dispose();
		store.dispose();

		expect(runtimeFactory).toHaveBeenCalledOnce();
		expect(runtimeDestroyer).toHaveBeenCalledOnce();
	});
	it.each([0, Infinity])(
		'consumes a menu click before dispatching to a code block (highlighted item: %s)',
		highlightedItem => {
			const handlers = new Map<string, Array<(event: unknown) => void>>();
			const events: EventDispatcher = {
				on: (name, handler) => {
					handlers.set(name, [...(handlers.get(name) ?? []), handler as (event: unknown) => void]);
				},
				off: (name, handler) => {
					handlers.set(
						name,
						(handlers.get(name) ?? []).filter(candidate => candidate !== handler)
					);
				},
				dispatch: (name, event) => {
					for (const handler of handlers.get(name) ?? []) {
						if ((event as { stopPropagation?: boolean } | undefined)?.stopPropagation) break;
						handler(event);
					}
				},
			};
			const store = initState(events, {
				callbacks: {},
				initialEditorMode: 'edit',
				runtimeRegistry: {},
			});
			const state = store.getState();
			const codeBlock = createMockCodeBlock({
				x: 0,
				y: 0,
				width: 192,
				height: 96,
				blockType: 'module',
				code: ['module synth', 'int value 2', 'moduleEnd'],
			});
			state.viewport.x = 0;
			state.viewport.y = 0;
			state.codeBlockRendering.codeBlocks = [codeBlock];
			state.codeBlockRendering.selectedCodeBlock = codeBlock;
			state.contextMenu.open = true;
			state.contextMenu.highlightedItem = highlightedItem;
			state.contextMenu.items = [
				{
					title: 'Test action',
					action: 'testMenuAction',
					payload: { codeBlock },
					close: true,
				},
			];
			const onCodeBlockPointerDown = vi.fn();
			events.on('codeBlockPointerDown', onCodeBlockPointerDown);
			const onMenuAction = vi.fn();
			events.on('testMenuAction', onMenuAction);
			const click = {
				x: 17,
				y: 1,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				altKey: false,
				canvasWidth: 800,
				canvasHeight: 600,
				stopPropagation: false,
			};

			events.dispatch('mousedown', click);

			expect(state.contextMenu.open).toBe(false);
			expect(click.stopPropagation).toBe(true);
			expect(onCodeBlockPointerDown).not.toHaveBeenCalled();
			expect(onMenuAction).toHaveBeenCalledTimes(highlightedItem === 0 ? 1 : 0);
			expect(codeBlock.code[1]).toBe('int value 2');
			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();

			store.dispose();
		}
	);
});
