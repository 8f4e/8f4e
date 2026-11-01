import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import { getProjectModules } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '../../pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '../../pureHelpers/testingUtils/vitestTestUtils';
import rendering from '../code-blocks/effect';
import codeBlockCreator from '../code-blocks/features/codeBlockCreator/effect';
import { pasteMultipleBlocks } from '../code-blocks/features/codeBlockCreator/pasteMultipleBlocks';
import codeBlockDragger from '../code-blocks/features/codeBlockDragger/effect';
import { directiveDefinitions } from '../code-blocks/features/directives/registry';
import { createLayoutRegistry } from '../code-blocks/layout/registry';
import codeEditing from '../code-editing/effect';
import projectImport from '../project-loading/effect';
import { EMPTY_DEFAULT_PROJECT } from '../project-loading/emptyDefaultProject';
import historyTracking from './effect';

describe('history tracking effect', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('restores undo and redo snapshots within the current project', () => {
		const state = createMockState({ featureFlags: { historyTracking: true } });
		state.historyStack.push(EMPTY_DEFAULT_PROJECT);
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const dispose = historyTracking(store, events);
		vi.mocked(events.on).mock.calls.find(([name]) => name === 'undo')![1](undefined);
		expect(state.initialProjectState).toBe(EMPTY_DEFAULT_PROJECT);
		expect(state.redoStack).toHaveLength(1);
		const redoSnapshot = state.redoStack[0];
		vi.mocked(events.on).mock.calls.find(([name]) => name === 'redo')![1](undefined);
		expect(state.initialProjectState).toBe(redoSnapshot);
		expect(state.historyStack).toHaveLength(1);
		dispose?.();
	});

	it('cancels a pending history snapshot when disposed', async () => {
		const state = createMockState({
			featureFlags: { historyTracking: true },
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const dispose = historyTracking(store, events);

		store.set('projectChange', { revision: 1, kind: 'edit' });
		dispose?.();
		await vi.advanceTimersByTimeAsync(1000);

		expect(state.historyStack).toEqual([]);
	});
});

describe('history tracking with real project mutations', () => {
	let state: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let events: EventDispatcher;
	let block: ReturnType<typeof createMockCodeBlock>;

	function dispatch(name: string, payload: unknown = {}): void {
		for (const [eventName, handler] of vi.mocked(events.on).mock.calls) {
			if (eventName === name) handler(payload);
		}
	}

	function selectedBlockCode(): string[] {
		return state.codeBlockRendering.codeBlocks[0].code;
	}

	beforeEach(() => {
		vi.useFakeTimers();
		state = createMockState({ featureFlags: { historyTracking: true } });
		store = createStateManager(state);
		events = createMockEventDispatcherWithVitest();
		events.dispatch = vi.fn(dispatch);
		block = createMockCodeBlock({
			name: 'main',
			code: ['module main', 'push 1', 'drop', 'moduleEnd'],
			blockType: 'module',
			entry: 'main',
			cursor: { row: 1, col: 6, x: 0, y: 16 },
		});
		state.codeBlockRendering.rootCodeBlocks.push(block);
		state.codeBlockRendering.codeBlocks = state.codeBlockRendering.rootCodeBlocks;
		state.codeBlockRendering.selectedCodeBlock = block;
		projectImport(store, events);
		rendering(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		historyTracking(store, events);
	});

	afterEach(() => {
		store.dispose();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('restores an edit undone before the debounce fires, via redo (case a)', async () => {
		codeEditing(store, events);
		dispatch('insertText', { text: '2' });
		expect(block.code[1]).toBe('push 12');

		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		expect(state.historyStack).toHaveLength(0);
		expect(state.redoStack).toHaveLength(1);

		dispatch('redo');
		expect(selectedBlockCode()[1]).toBe('push 12');
		await vi.advanceTimersByTimeAsync(2000);
		expect(state.historyStack).toHaveLength(1);
	});

	it('keeps redo alive across selection and navigation after undo (case b)', async () => {
		codeEditing(store, events);
		dispatch('insertText', { text: '2' });
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);

		dispatch('undo');
		expect(state.redoStack).toHaveLength(1);

		// Re-selecting the same block was the original bug trigger: it used to
		// schedule a history snapshot that wiped the redo stack after 1s.
		store.set('codeBlockRendering.selectedCodeBlock', state.codeBlockRendering.codeBlocks[0]);
		store.set('codeBlockRendering.selectedCodeBlock.code', state.codeBlockRendering.codeBlocks[0].code);
		dispatch('moveCaret', { direction: 'down' });
		await vi.advanceTimersByTimeAsync(2000);

		expect(state.historyStack).toHaveLength(0);
		expect(state.redoStack).toHaveLength(1);

		dispatch('redo');
		expect(selectedBlockCode()[1]).toBe('push 12');
	});

	it('invalidates redo immediately when a new edit follows an undo (case c)', async () => {
		codeEditing(store, events);
		dispatch('insertText', { text: '2' });
		await vi.advanceTimersByTimeAsync(1000);
		dispatch('undo');
		expect(state.redoStack).toHaveLength(1);

		const restored = state.codeBlockRendering.codeBlocks[0];
		state.codeBlockRendering.selectedCodeBlock = restored;
		restored.cursor = { row: 1, col: 6, x: 0, y: 16 };
		dispatch('insertText', { text: '3' });

		// The redo stack is gone before the debounce timer fires.
		expect(state.redoStack).toEqual([]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);
		expect(selectedBlockCode()[1]).toBe('push 13');
	});

	it('creates exactly one undo step for a typing burst (case d)', async () => {
		codeEditing(store, events);
		dispatch('insertText', { text: '2' });
		dispatch('insertText', { text: '3' });
		dispatch('deleteBackward');
		await vi.advanceTimersByTimeAsync(1000);

		expect(block.code[1]).toBe('push 12');
		expect(state.historyStack).toHaveLength(1);
		expect(getProjectModules(state.historyStack[0])[0].code).toEqual(['module main', 'push 1', 'drop', 'moduleEnd']);
	});

	it('creates no history entry when an edit returns to the committed content (case e)', async () => {
		codeEditing(store, events);
		dispatch('insertText', { text: '2' });
		dispatch('deleteBackward');
		await vi.advanceTimersByTimeAsync(2000);

		expect(block.code[1]).toBe('push 1');
		expect(state.historyStack).toEqual([]);
	});

	it('cancels pending work and resets the baseline when another project loads (case f)', async () => {
		codeEditing(store, events);
		dispatch('insertText', { text: '2' });
		expect(state.projectChange.revision).toBe(1);

		const otherProject = {
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 7, code: ['module other', 'moduleEnd'], entry: 'other' }],
		};
		dispatch('loadProject', { project: otherProject });
		store.set('editorMode', 'edit');
		await vi.advanceTimersByTimeAsync(2000);

		// The pending edit to the previous project produced no history entry.
		expect(state.historyStack).toEqual([]);
		expect(selectedBlockCode()).toEqual(['module other', 'moduleEnd']);

		// The next edit is measured against the loaded project as its baseline.
		const loaded = state.codeBlockRendering.codeBlocks[0];
		state.codeBlockRendering.selectedCodeBlock = loaded;
		loaded.cursor = { row: 0, col: 11, x: 0, y: 0 };
		dispatch('insertText', { text: ';' });
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);
		expect(getProjectModules(state.historyStack[0])[0].code).toEqual(['module other', 'moduleEnd']);
	});

	it('records exactly one entry for pasting several blocks, and none for an empty paste', async () => {
		pasteMultipleBlocks(store, events, {
			x: 0,
			y: 0,
			blocks: ['one', 'two'].map(name => ({
				code: [`module ${name}`, 'moduleEnd'],
				gridCoordinates: { x: 0, y: 0 },
			})),
		});
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);

		pasteMultipleBlocks(store, events, { x: 0, y: 0, blocks: [] });
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);
	});

	it('records one entry for a programmatic position commit from dragging', async () => {
		dispatch('loadProject', {
			project: {
				...EMPTY_DEFAULT_PROJECT,
				execution: [
					{ type: 'module', id: 0, code: ['module main', '; @pos 0 0', 'push 1', 'drop', 'moduleEnd'], entry: 'main' },
				],
			},
		});
		const loaded = state.codeBlockRendering.codeBlocks[0];
		store.set('editorMode', 'edit');
		codeBlockDragger(store, events);
		store.set('codeBlockRendering.codeBlocks', state.codeBlockRendering.codeBlocks);
		const compilerRevisionAfterLoad = state.compilerInputRevision;

		dispatch('mousedown', { x: 32, y: 8 });
		dispatch('mousemove', { movementX: 16, movementY: 32 });
		dispatch('mouseup');
		await vi.advanceTimersByTimeAsync(1000);

		expect(loaded.code).toContain('; @pos 2 2');
		expect(state.compilerInputRevision).toBe(compilerRevisionAfterLoad);
		expect(state.historyStack).toHaveLength(1);

		dispatch('undo');
		expect(selectedBlockCode()).toContain('; @pos 0 0');
	});

	it('records nothing for selection, caret movement, or repeated selection alone', async () => {
		codeEditing(store, events);
		store.set('codeBlockRendering.selectedCodeBlock', block);
		store.set('codeBlockRendering.selectedCodeBlock', block);
		dispatch('moveCaret', { direction: 'down' });
		dispatch('moveCaret', { direction: 'up' });
		await vi.advanceTimersByTimeAsync(3000);

		expect(state.projectChange.revision).toBe(0);
		expect(state.historyStack).toEqual([]);
		expect(state.redoStack).toEqual([]);
	});

	it('records nothing when deleting a block that is not in the project', async () => {
		codeBlockCreator(store, events);
		const stranger = createMockCodeBlock({ code: ['module stranger', 'moduleEnd'], blockType: 'module' });
		dispatch('deleteCodeBlock', { codeBlock: stranger });
		await vi.advanceTimersByTimeAsync(2000);

		expect(state.projectChange.revision).toBe(0);
		expect(state.historyStack).toEqual([]);
	});
});
