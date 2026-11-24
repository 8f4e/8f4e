import { EventEmitter } from 'node:events';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { EditorCodeBlock, ProjectChange, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import initState, { setGridSize } from '~/index';
import { deleteCodeBlocks } from './deleteCodeBlocks';
import { EMPTY_DEFAULT_PROJECT } from './emptyDefaultProject';
import { insertCodeBlocks } from './insertCodeBlocks';
import { applyCodeBlockSourceEdits } from './replaceBlockSources';
import serializeToProject from './serialization/serializeToProject';

function createHistoryEditor(project: ProjectObjectModel = EMPTY_DEFAULT_PROJECT) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, featureFlags: { historyTracking: true } });
	const state = store.getState();
	setGridSize(state, events, TEST_GRID_SIZE);
	events.dispatch('loadProject', { project });
	events.dispatch('enterEditMode');
	return { store, events, state };
}

describe('history tracking effect', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('restores undo and redo snapshots within the current project', () => {
		const { state, store, events } = createHistoryEditor();
		const original = serializeToProject(state);
		store.projectTransactions.apply(
			{ inserts: [{ targetLevel: state.project.rootLevel, source: { code: ['note test', 'noteEnd'] } }] },
			{ history: 'checkpoint' }
		);
		const edited = serializeToProject(state);
		events.dispatch('undo');
		expect(serializeToProject(state)).toEqual(original);
		expect(state.redoStack).toHaveLength(1);
		events.dispatch('redo');
		expect(serializeToProject(state)).toEqual(edited);
		expect(state.historyStack).toHaveLength(1);
		store.dispose();
	});

	it('cancels a pending history snapshot when disposed', async () => {
		const { state, store } = createHistoryEditor({
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, entry: 'main', code: ['module test', 'moduleEnd'] }],
		});
		const block = state.project.rootLevel.blocks.find(candidate => candidate.name === 'test')!;

		store.projectTransactions.apply({ updates: [{ codeBlock: block, code: ['module test', 'push 1', 'moduleEnd'] }] });
		store.dispose();
		await vi.advanceTimersByTimeAsync(1000);

		expect(state.historyStack).toEqual([]);
	});
});

describe('history tracking with real project mutations', () => {
	let state: State;
	let store: ReturnType<typeof createHistoryEditor>['store'];
	let events: ReturnType<typeof createHistoryEditor>['events'];
	let block: EditorCodeBlock;
	let baselineRevision: number;

	function dispatch(name: string, payload: unknown = {}): void {
		events.dispatch(name, payload);
	}

	function replaceLine(row: number, line: string) {
		const codeBlock = state.project.selectedCodeBlock!;
		applyCodeBlockSourceEdits(store, [
			{ codeBlock, code: codeBlock.code.map((text, index) => (index === row ? line : text)) },
		]);
	}

	function currentModule() {
		return state.project.activeLevel.blocks.find(block => block.blockType === 'module')!;
	}

	function selectedBlockCode(): string[] {
		return currentModule().code;
	}

	function environment() {
		return state.project.rootLevel.blocks.find(block => block.name === 'env' && block.blockType === 'constants')!;
	}

	beforeEach(() => {
		vi.useFakeTimers();
		({ state, store, events } = createHistoryEditor({
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, entry: 'main', code: ['module main', 'push 1', 'drop', 'moduleEnd'] }],
		}));
		block = currentModule();
		store.set('project.selectedCodeBlock', block);
		block.cursor = { row: 1, col: 6, y: 16 };
		baselineRevision = state.projectChange.revision;
	});

	afterEach(() => {
		store.dispose();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('restores an edit undone before the debounce fires, via redo (case a)', async () => {
		replaceLine(1, 'push 12');
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
		replaceLine(1, 'push 12');
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);

		dispatch('undo');
		expect(state.redoStack).toHaveLength(1);

		// Re-selecting the same block was the original bug trigger: it used to
		// schedule a history snapshot that wiped the redo stack after 1s.
		store.set('project.selectedCodeBlock', currentModule());
		store.set('project.selectedCodeBlock.code', currentModule().code);
		store.set('project.selectedCodeBlock.cursor.row', 2);
		await vi.advanceTimersByTimeAsync(2000);

		expect(state.historyStack).toHaveLength(0);
		expect(state.redoStack).toHaveLength(1);

		dispatch('redo');
		expect(selectedBlockCode()[1]).toBe('push 12');
	});

	it('invalidates redo immediately when a new edit follows an undo (case c)', async () => {
		replaceLine(1, 'push 12');
		await vi.advanceTimersByTimeAsync(1000);
		dispatch('undo');
		expect(state.redoStack).toHaveLength(1);

		const restored = currentModule();
		state.project.selectedCodeBlock = restored;
		restored.cursor = { row: 1, col: 6, y: 16 };
		replaceLine(1, 'push 13');

		// The redo stack is gone before the debounce timer fires.
		expect(state.redoStack).toEqual([]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);
		expect(selectedBlockCode()[1]).toBe('push 13');
	});

	it('preserves authored history and redo across idle generated changes', async () => {
		const capture = vi.spyOn(store.projectTransactions, 'capture');
		store.set('envConstantContributions.test', ['const GENERATED 42']);
		expect(state.projectChange).toEqual({
			revision: baselineRevision + 1,
			kind: 'generated',
		});
		expect(environment().code).toContain('const GENERATED 42');
		expect(capture).not.toHaveBeenCalled();

		replaceLine(1, 'push 3');
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		expect(state.redoStack).toHaveLength(1);
		capture.mockClear();

		store.set('envConstantContributions.test', ['const GENERATED 43']);
		expect(capture).not.toHaveBeenCalled();
		expect(state.historyStack).toHaveLength(0);
		expect(state.redoStack).toHaveLength(1);
		dispatch('redo');
		expect(selectedBlockCode()[1]).toBe('push 3');
		expect(environment().code).toContain('const GENERATED 43');
	});

	it('does not capture authored history when a newly available schema generates environment source', () => {
		applyCodeBlockSourceEdits(
			store,
			[{ codeBlock: block, code: ['module main', 'push 1', 'drop', '; @config test 42', 'moduleEnd'] }],
			{ history: 'checkpoint' }
		);
		const capture = vi.spyOn(store.projectTransactions, 'capture');
		const revision = state.projectChange.revision;
		store.subscribe('editorConfig.test', value => {
			store.set('envConstantContributions.test', [`const GENERATED ${value}`]);
		});
		store.set('editorConfigSchemaContributions.test', { root: 'test', schema: { type: 'integer' } });
		expect(state.projectChange).toEqual({ revision: revision + 1, kind: 'generated' });
		expect(environment().code).toContain('const GENERATED 42');
		expect(capture).not.toHaveBeenCalled();
		expect(state.historyStack).toHaveLength(1);
	});

	it('keeps a pending typing step open across contribution refresh and a read-only checkpoint request', async () => {
		replaceLine(1, 'push 12');
		await vi.advanceTimersByTimeAsync(600);
		store.set('envConstantContributions.test', ['const GENERATED 42']);
		expect(state.projectChange).toMatchObject({ kind: 'generated' });
		const beforeProjectEdit = vi.fn();
		events.on('beforeProjectEdit', beforeProjectEdit);
		const generatedChange = state.projectChange;
		expect(
			store.projectTransactions.apply(
				{ updates: [{ codeBlock: environment(), code: ['constants env', '; @pos 3 4', 'constantsEnd'] }] },
				{ history: 'checkpoint' }
			).changed
		).toBe(false);
		expect(state.projectChange).toBe(generatedChange);
		expect(beforeProjectEdit).not.toHaveBeenCalled();
		expect(state.historyStack).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(400);
		expect(state.historyStack).toHaveLength(1);
		expect(state.historyStack[0].rootLevel.blocks.map(block => block.code[0])).not.toContain('constants env');
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		expect(environment().code).toContain('; @pos 0 0');
		expect(environment().code).toContain('const GENERATED 42');
		dispatch('redo');
		expect(selectedBlockCode()[1]).toBe('push 12');
		expect(environment().code).toContain('; @pos 0 0');
		expect(environment().code).toContain('const GENERATED 42');
	});

	it('does not create history when an authored typing burst is reverted even if env was regenerated', async () => {
		replaceLine(1, 'push 12');
		store.set('envConstantContributions.test', ['const GENERATED 42']);
		replaceLine(1, 'push 1');
		await vi.advanceTimersByTimeAsync(2000);
		expect(state.historyStack).toHaveLength(0);
		expect(environment().code).toContain('const GENERATED 42');
	});

	it('records a single authored checkpoint for a mixed authored and managed-environment batch', () => {
		store.set('editorConfigSchemaContributions.test', { root: 'test', schema: { type: 'integer' } });
		store.subscribe('editorConfig.test', value => {
			store.set('envConstantContributions.test', value === undefined ? [] : [`const GENERATED ${value}`]);
		});
		store.projectTransactions.apply(
			{
				updates: [
					{ codeBlock: block, code: ['module main', 'push 12', 'drop', '; @config test 42', 'moduleEnd'] },
					{ codeBlock: environment(), code: ['constants env', '; @pos 6 7', 'constantsEnd'] },
				],
			},
			{ history: 'checkpoint' }
		);
		expect(state.projectChange).toEqual({ revision: baselineRevision + 1, kind: 'edit', history: 'checkpoint' });
		expect(state.historyStack).toHaveLength(1);
		expect(environment().code).toContain('const GENERATED 42');
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		expect(environment().code).toContain('; @pos 0 0');
		expect(environment().code).not.toContain('const GENERATED 42');
		dispatch('redo');
		expect(selectedBlockCode()[1]).toBe('push 12');
		expect(environment().code).toContain('; @pos 0 0');
		expect(environment().code).toContain('const GENERATED 42');
	});

	it.each([
		['debounced', 'compilerInputRevision'],
		['checkpoint', 'compilerInputRevision'],
		['debounced', 'projectChange'],
		['checkpoint', 'projectChange'],
	] as const)(
		'publishes an authored %s before generated changes requested by a %s observer',
		(history, notification) => {
			const capture = vi.spyOn(store.projectTransactions, 'capture');
			const contribute = () => {
				store.unsubscribe(notification, contribute);
				store.set('envConstantContributions.test', ['const GENERATED 42']);
			};
			store.subscribe(notification, contribute);
			const changes: ProjectChange[] = [];
			store.subscribe('projectChange', change => changes.push(change));

			applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: ['module main', 'push 12', 'drop', 'moduleEnd'] }], {
				history,
			});

			expect(changes).toEqual([
				{ revision: baselineRevision + 1, kind: 'edit', history },
				{ revision: baselineRevision + 2, kind: 'generated' },
			]);
			expect(capture).toHaveBeenCalledTimes(history === 'checkpoint' ? 1 : 0);
			dispatch('undo');
			expect(selectedBlockCode()[1]).toBe('push 1');
			expect(environment().code).toContain('const GENERATED 42');
			dispatch('redo');
			expect(selectedBlockCode()[1]).toBe('push 12');
			expect(environment().code).toContain('const GENERATED 42');
		}
	);

	it('creates exactly one undo step for a burst of source edits (case d)', async () => {
		replaceLine(1, 'push 12');
		replaceLine(1, 'push 123');
		replaceLine(1, 'push 12');
		await vi.advanceTimersByTimeAsync(1000);

		expect(block.code[1]).toBe('push 12');
		expect(state.historyStack).toHaveLength(1);
		expect(
			state.historyStack[0].rootLevel.blocks.find(candidate => candidate.creationIndex === block.creationIndex)!.code
		).toEqual(['module main', 'push 1', 'drop', 'moduleEnd']);
	});

	it('creates no history entry when an edit returns to the committed content (case e)', async () => {
		expect(state.project.rootLevel.entries).toEqual(['main']);
		replaceLine(1, 'push 12');
		replaceLine(1, 'push 1');
		await vi.advanceTimersByTimeAsync(2000);

		expect(block.code[1]).toBe('push 1');
		expect(state.historyStack).toEqual([]);
	});

	it('cancels pending work and resets the baseline when another project loads (case f)', async () => {
		replaceLine(1, 'push 12');
		expect(state.projectChange.revision).toBe(baselineRevision + 1);

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
		const loaded = currentModule();
		state.project.selectedCodeBlock = loaded;
		loaded.cursor = { row: 0, col: 11, y: 0 };
		replaceLine(0, 'module other;');
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);
		expect(
			state.historyStack[0].rootLevel.blocks.find(candidate => candidate.creationIndex === loaded.creationIndex)!.code
		).toEqual(['module other', 'moduleEnd']);
	});

	it('records exactly one entry for inserting a block batch, and none for an empty batch', async () => {
		insertCodeBlocks(store, {
			x: 0,
			y: 0,
			blocks: ['one', 'two'].map(name => ({
				code: [`module ${name}`, 'moduleEnd'],
				gridCoordinates: { x: 0, y: 0 },
			})),
		});
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);

		insertCodeBlocks(store, { x: 0, y: 0, blocks: [] });
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(1);
	});

	it('does not create a snapshot for allocation without a net content change', async () => {
		const { insertedBlocks } = store.projectTransactions.apply({
			inserts: [{ targetLevel: state.project.rootLevel, source: { code: ['note test', 'noteEnd'] } }],
		});
		store.projectTransactions.apply({ deletes: insertedBlocks });
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.historyStack).toHaveLength(0);
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
		const loaded = currentModule();
		store.set('editorMode', 'edit');
		const compilerRevisionAfterLoad = state.compilerInputRevision;

		dispatch('pointerdown', { x: 32, y: 8 });
		dispatch('pointermove', { movementX: 16, movementY: 32 });
		dispatch('pointerup');
		await vi.advanceTimersByTimeAsync(1000);

		expect(loaded.code).toContain('; @pos 2 2');
		expect(state.compilerInputRevision).toBe(compilerRevisionAfterLoad + 1);
		expect(state.historyStack).toHaveLength(1);

		dispatch('undo');
		expect(selectedBlockCode()).toContain('; @pos 0 0');
	});

	it('records nothing for selection, caret movement, or repeated selection alone', async () => {
		store.set('project.selectedCodeBlock', block);
		store.set('project.selectedCodeBlock', block);
		store.set('project.selectedCodeBlock.cursor.row', 2);
		store.set('project.selectedCodeBlock.cursor.row', 1);
		await vi.advanceTimersByTimeAsync(3000);

		expect(state.projectChange.revision).toBe(baselineRevision);
		expect(state.historyStack).toEqual([]);
		expect(state.redoStack).toEqual([]);
	});

	it('records nothing for an empty deletion batch', async () => {
		deleteCodeBlocks(store, []);
		await vi.advanceTimersByTimeAsync(2000);

		expect(state.projectChange.revision).toBe(baselineRevision);
		expect(state.historyStack).toEqual([]);
	});
});
