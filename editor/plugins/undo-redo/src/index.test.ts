import { EventEmitter } from 'node:events';
import initState, {
	applyCodeBlockSourceEdits,
	deleteCodeBlocks,
	EMPTY_DEFAULT_PROJECT,
	insertCodeBlocks,
	serializeToProject,
	setGridSize,
} from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { EditorCodeBlock, EditorProjectSnapshot, ProjectChange, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { undoRedoPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

function createHistoryEditor(project: ProjectObjectModel = EMPTY_DEFAULT_PROJECT) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const disposeHistory = undoRedoPlugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry: createEditorRenderRegistry(),
	});
	cleanups.push(store.dispose, disposeHistory);
	const state = store.getState();
	setGridSize(state, events, TEST_GRID_SIZE);
	events.dispatch('loadProject', { project });
	events.dispatch('enterEditMode');
	return { store, events, state, disposeHistory };
}

function expectNoHistoryAction(
	{ events, state }: Pick<ReturnType<typeof createHistoryEditor>, 'events' | 'state'>,
	action: 'undo' | 'redo'
) {
	const revision = state.projectChange.revision;
	events.dispatch(action);
	expect(state.projectChange.revision).toBe(revision);
}

describe('history tracking effect', () => {
	beforeEach(() => {
		vi.useFakeTimers();
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
		expectNoHistoryAction({ state, events }, 'undo');
		events.dispatch('redo');
		expect(serializeToProject(state)).toEqual(edited);
		expectNoHistoryAction({ state, events }, 'redo');
	});

	it('cancels a pending history snapshot when disposed', async () => {
		const { state, store, events, disposeHistory } = createHistoryEditor({
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, entry: 'main', code: ['module test', 'moduleEnd'] }],
		});
		const block = state.project.rootLevel.blocks.find(candidate => candidate.name === 'test')!;
		const capture = vi.spyOn(store.projectTransactions, 'capture');

		store.projectTransactions.apply({ updates: [{ codeBlock: block, code: ['module test', 'push 1', 'moduleEnd'] }] });
		disposeHistory();
		await vi.advanceTimersByTimeAsync(1000);
		expect(capture).not.toHaveBeenCalled();
		expectNoHistoryAction({ state, events }, 'undo');
		expectNoHistoryAction({ state, events }, 'redo');
		expect(block.code).toContain('push 1');
	});

	it('does not share history between installations', () => {
		const first = createHistoryEditor();
		const second = createHistoryEditor();
		first.store.projectTransactions.apply(
			{ inserts: [{ targetLevel: first.state.project.rootLevel, source: { code: ['note first', 'noteEnd'] } }] },
			{ history: 'checkpoint' }
		);
		second.store.projectTransactions.apply(
			{ inserts: [{ targetLevel: second.state.project.rootLevel, source: { code: ['note second', 'noteEnd'] } }] },
			{ history: 'checkpoint' }
		);
		first.events.dispatch('undo');
		expect(first.state.project.rootLevel.blocks.some(block => block.name === 'first')).toBe(false);
		expect(second.state.project.rootLevel.blocks.some(block => block.name === 'second')).toBe(true);
		expectNoHistoryAction(second, 'redo');
		second.events.dispatch('undo');
		first.events.dispatch('redo');
		expect(first.state.project.rootLevel.blocks.some(block => block.name === 'first')).toBe(true);
		expect(second.state.project.rootLevel.blocks.some(block => block.name === 'second')).toBe(false);
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

	it('restores an edit undone before the debounce fires, via redo (case a)', async () => {
		replaceLine(1, 'push 12');
		expect(block.code[1]).toBe('push 12');

		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		expectNoHistoryAction({ state, events }, 'undo');

		dispatch('redo');
		expect(selectedBlockCode()[1]).toBe('push 12');
		await vi.advanceTimersByTimeAsync(2000);
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		expectNoHistoryAction({ state, events }, 'undo');
	});

	it('keeps redo alive across selection and navigation after undo (case b)', async () => {
		replaceLine(1, 'push 12');
		await vi.advanceTimersByTimeAsync(1000);
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');

		// Re-selecting the same block was the original bug trigger: it used to
		// schedule a history snapshot that wiped the redo stack after 1s.
		store.set('project.selectedCodeBlock', currentModule());
		store.set('project.selectedCodeBlock.code', currentModule().code);
		store.set('project.selectedCodeBlock.cursor.row', 2);
		await vi.advanceTimersByTimeAsync(2000);

		expectNoHistoryAction({ state, events }, 'undo');

		dispatch('redo');
		expect(selectedBlockCode()[1]).toBe('push 12');
	});

	it('invalidates redo immediately when a new edit follows an undo (case c)', async () => {
		replaceLine(1, 'push 12');
		await vi.advanceTimersByTimeAsync(1000);
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');

		const restored = currentModule();
		state.project.selectedCodeBlock = restored;
		restored.cursor = { row: 1, col: 6, y: 16 };
		replaceLine(1, 'push 13');

		// The redo stack is gone before the debounce timer fires.
		expectNoHistoryAction({ state, events }, 'redo');
		await vi.advanceTimersByTimeAsync(1000);
		expect(selectedBlockCode()[1]).toBe('push 13');
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		expectNoHistoryAction({ state, events }, 'undo');
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
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		capture.mockClear();

		store.set('envConstantContributions.test', ['const GENERATED 43']);
		expect(capture).not.toHaveBeenCalled();
		expectNoHistoryAction({ state, events }, 'undo');
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
		dispatch('undo');
		expect(selectedBlockCode()).not.toContain('; @config test 42');
		expectNoHistoryAction({ state, events }, 'undo');
	});

	it('keeps a pending typing step open across contribution refresh and a read-only checkpoint request', async () => {
		const capture = vi.spyOn(store.projectTransactions, 'capture');
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
		expect(capture).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(400);
		expect(capture).toHaveBeenCalledOnce();
		const snapshot: EditorProjectSnapshot = capture.mock.results[0].value;
		expect(snapshot.rootLevel.blocks.map(block => block.code[0])).not.toContain('constants env');
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
		expectNoHistoryAction({ state, events }, 'undo');
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
		expect(environment().code).toContain('const GENERATED 42');
		dispatch('undo');
		expect(selectedBlockCode()[1]).toBe('push 1');
		expect(environment().code).toContain('; @pos 0 0');
		expect(environment().code).not.toContain('const GENERATED 42');
		expectNoHistoryAction({ state, events }, 'undo');
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
		dispatch('undo');
		expect(selectedBlockCode()).toEqual(['module main', 'push 1', 'drop', 'moduleEnd']);
		expectNoHistoryAction({ state, events }, 'undo');
	});

	it('creates no history entry when an edit returns to the committed content (case e)', async () => {
		expect(state.project.rootLevel.entries).toEqual(['main']);
		replaceLine(1, 'push 12');
		replaceLine(1, 'push 1');
		await vi.advanceTimersByTimeAsync(2000);

		expect(block.code[1]).toBe('push 1');
		expectNoHistoryAction({ state, events }, 'undo');
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
		expectNoHistoryAction({ state, events }, 'undo');
		expectNoHistoryAction({ state, events }, 'redo');
		expect(selectedBlockCode()).toEqual(['module other', 'moduleEnd']);

		// The next edit is measured against the loaded project as its baseline.
		const loaded = currentModule();
		state.project.selectedCodeBlock = loaded;
		loaded.cursor = { row: 0, col: 11, y: 0 };
		replaceLine(0, 'module other;');
		await vi.advanceTimersByTimeAsync(1000);
		dispatch('undo');
		expect(selectedBlockCode()).toEqual(['module other', 'moduleEnd']);
		expectNoHistoryAction({ state, events }, 'undo');
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
		expect(state.project.rootLevel.blocks.map(block => block.name)).toEqual(expect.arrayContaining(['one', 'two']));

		insertCodeBlocks(store, { x: 0, y: 0, blocks: [] });
		await vi.advanceTimersByTimeAsync(1000);
		dispatch('undo');
		expect(state.project.rootLevel.blocks.map(block => block.name)).not.toContain('one');
		expect(state.project.rootLevel.blocks.map(block => block.name)).not.toContain('two');
		expectNoHistoryAction({ state, events }, 'undo');
	});

	it('does not create a snapshot for allocation without a net content change', async () => {
		const { insertedBlocks } = store.projectTransactions.apply({
			inserts: [{ targetLevel: state.project.rootLevel, source: { code: ['note test', 'noteEnd'] } }],
		});
		store.projectTransactions.apply({ deletes: insertedBlocks });
		await vi.advanceTimersByTimeAsync(1000);
		expectNoHistoryAction({ state, events }, 'undo');
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
		dispatch('undo');
		expect(selectedBlockCode()).toContain('; @pos 0 0');
		expectNoHistoryAction({ state, events }, 'undo');
	});

	it('records nothing for selection, caret movement, or repeated selection alone', async () => {
		store.set('project.selectedCodeBlock', block);
		store.set('project.selectedCodeBlock', block);
		store.set('project.selectedCodeBlock.cursor.row', 2);
		store.set('project.selectedCodeBlock.cursor.row', 1);
		await vi.advanceTimersByTimeAsync(3000);

		expect(state.projectChange.revision).toBe(baselineRevision);
		expectNoHistoryAction({ state, events }, 'undo');
		expectNoHistoryAction({ state, events }, 'redo');
	});

	it('records nothing for an empty deletion batch', async () => {
		deleteCodeBlocks(store, []);
		await vi.advanceTimersByTimeAsync(2000);

		expect(state.projectChange.revision).toBe(baselineRevision);
		expectNoHistoryAction({ state, events }, 'undo');
	});

	it('retains only the ten latest undo steps and can redo each retained step', () => {
		for (let value = 2; value <= 13; value++) {
			applyCodeBlockSourceEdits(
				store,
				[{ codeBlock: currentModule(), code: ['module main', `push ${value}`, 'drop', 'moduleEnd'] }],
				{ history: 'checkpoint' }
			);
		}
		for (let value = 12; value >= 3; value--) {
			dispatch('undo');
			expect(selectedBlockCode()[1]).toBe(`push ${value}`);
		}
		expectNoHistoryAction({ state, events }, 'undo');
		for (let value = 4; value <= 13; value++) {
			dispatch('redo');
			expect(selectedBlockCode()[1]).toBe(`push ${value}`);
		}
		expectNoHistoryAction({ state, events }, 'redo');
	});
});
