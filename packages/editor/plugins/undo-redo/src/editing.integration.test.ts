import { EventEmitter } from 'node:events';
import initState, {
	applyCodeBlockSourceEdits,
	createEditorCommandApi,
	EMPTY_DEFAULT_PROJECT,
	getEditorBlockId,
	insertCodeBlocks,
	serializeCodeBlocks,
	serializeToProject,
	setGridSize,
} from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUndoRedoPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(
	project: ProjectObjectModel = {
		...structuredClone(EMPTY_DEFAULT_PROJECT),
		execution: [{ type: 'module', id: 0, entry: 'main', code: ['module original', 'int value 1', 'moduleEnd'] }],
	}
) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const compilationChanged = vi.fn();
	const store = initState(events, { callbacks: {} });
	const undoRedo = createUndoRedoPlugin();
	const disposeHistory = undoRedo.plugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry: createEditorRenderRegistry(),
	});
	store.subscribe('compilerInputRevision', compilationChanged);
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	events.dispatch('enterEditMode');
	const editing = createEditorCommandApi(store, events);
	events.dispatch('loadProject', { project });
	events.dispatch('enterEditMode');
	compilationChanged.mockClear();
	cleanups.push(() => {
		editing.dispose();
		disposeHistory();
		store.dispose();
		emitter.removeAllListeners();
	});
	const state = store.getState();
	return {
		state,
		store,
		events,
		editing: editing.handle,
		history: undoRedo.createHandle(editing.handle),
		navigation: editing.navigation,
		disposeHistory,
		compilationChanged,
	};
}

function setupGroup(name: string) {
	const test = setup({
		...structuredClone(EMPTY_DEFAULT_PROJECT),
		execution: [
			{
				...structuredClone(EMPTY_DEFAULT_PROJECT),
				type: 'group',
				entry: 'main',
				id: 0,
				name,
				exposures: [],
				code: [`group ${name}`, 'groupEnd'],
				execution: [{ type: 'module', id: 0, entry: 'main', code: ['module sample', 'moduleEnd'] }],
			},
		],
	});
	return { ...test, group: test.state.project.rootLevel.blocks.find(block => block.name === name)! };
}

describe('undo and redo through the plugin history handle', () => {
	it("restores a draft module's historical execution entry across undo and redo", () => {
		const { editing, history, state } = setup({
			...EMPTY_DEFAULT_PROJECT,
			entries: ['main', 'alternate'],
			execution: [{ type: 'module', id: 0, entry: 'alternate', code: ['module test', 'moduleEnd'] }],
		});
		const current = () => state.project.rootLevel.blocks.find(block => block.name === 'test')!;
		const update = (code: string[], entry?: string) =>
			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [{ type: 'update', blockId: getEditorBlockId(current()), code, entry }],
			});
		update(['module test']);
		expect(current()).toMatchObject({ blockType: 'unknown', entry: 'alternate' });
		expect(serializeToProject(state).unknown[0]).not.toHaveProperty('entry');
		update(['module test', 'moduleEnd'], 'main');
		expect(current().entry).toBe('main');
		history.undo({ expectedRevision: editing.getRevision() });
		expect(current()).toMatchObject({ blockType: 'unknown', entry: 'alternate' });
		history.redo({ expectedRevision: editing.getRevision() });
		expect(current().entry).toBe('main');
		history.undo({ expectedRevision: editing.getRevision() });
		update(['module test', 'moduleEnd']);
		expect(current()).toMatchObject({ blockType: 'module', entry: 'alternate' });
		expect(serializeToProject(state).execution[0].entry).toBe('alternate');
	});

	it('restores the historical retained grid position of incomplete position directives', () => {
		const { editing, history, state } = setup({
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, entry: 'main', code: ['module test', '; @pos 10 20', 'moduleEnd'] }],
		});
		const current = () => state.project.rootLevel.blocks.find(block => block.name === 'test')!;
		const update = (position: string) =>
			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [{ type: 'update', blockId: getEditorBlockId(current()), code: ['module test', position, 'moduleEnd'] }],
			});
		update('; @pos incomplete');
		expect(current()).toMatchObject({ gridX: 10, gridY: 20 });
		update('; @pos 30 40');
		expect(current()).toMatchObject({ gridX: 30, gridY: 40 });
		history.undo({ expectedRevision: editing.getRevision() });
		expect(current()).toMatchObject({ code: ['module test', '; @pos incomplete', 'moduleEnd'], gridX: 10, gridY: 20 });
		history.redo({ expectedRevision: editing.getRevision() });
		expect(current()).toMatchObject({ gridX: 30, gridY: 40 });
		history.undo({ expectedRevision: editing.getRevision() });
		expect(current()).toMatchObject({ gridX: 10, gridY: 20 });
	});

	it('preserves separately editable root project-scope blocks and their identities across history', () => {
		const { editing, history, state } = setup();
		const scope = () => state.project.rootLevel.blocks.filter(block => block.isProjectScope);
		const result = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{ type: 'insert', code: ['pass env'] },
				{ type: 'insert', code: ['pass other'] },
			],
		});
		const firstId = result.createdBlockIds[0];
		const secondId = result.createdBlockIds[1];
		expect(scope().map(getEditorBlockId)).toEqual([firstId, secondId]);
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId: firstId, code: ['pass changed'] }],
		});
		history.undo({ expectedRevision: editing.getRevision() });
		expect(scope().map(block => [getEditorBlockId(block), block.code])).toEqual([
			[firstId, ['pass env']],
			[secondId, ['pass other']],
		]);
		history.undo({ expectedRevision: editing.getRevision() });
		expect(scope()).toHaveLength(0);
		history.redo({ expectedRevision: editing.getRevision() });
		expect(scope().map(getEditorBlockId)).toEqual([firstId, secondId]);
		history.redo({ expectedRevision: editing.getRevision() });
		expect(scope().map(block => block.code)).toEqual([['pass changed'], ['pass other']]);
	});

	it('ignores final root env declarations while applying ordinary edits in the same API batch', () => {
		const { editing, history, state } = setup();
		const block = state.project.rootLevel.blocks.find(block => block.name === 'original')!;
		const blockId = getEditorBlockId(block);
		const envCode = ['constants env', 'const GENERATED 42', 'constantsEnd'];
		const originalRevision = editing.getRevision();
		const result = editing.applyEdits({
			expectedRevision: originalRevision,
			edits: [
				{ type: 'update', blockId, code: ['module transient', 'moduleEnd'] },
				{ type: 'update', blockId, code: envCode },
				{ type: 'insert', code: envCode },
			],
		});
		expect(result).toEqual({ revision: originalRevision, createdBlockIds: [] });
		expect(block.code).toEqual(['module original', 'int value 1', 'moduleEnd']);
		const ordinary = editing.applyEdits({
			expectedRevision: originalRevision,
			edits: [
				{ type: 'update', blockId, code: envCode },
				{ type: 'update', blockId, code: ['module changed', 'moduleEnd'] },
				{ type: 'insert', code: envCode },
				{ type: 'insert', code: ['note env', 'noteEnd'] },
			],
		});
		expect(ordinary.createdBlockIds).toHaveLength(1);
		expect(block.code).toEqual(['module changed', 'moduleEnd']);
		expect(serializeToProject(state).constants).toHaveLength(1);
		history.undo({ expectedRevision: ordinary.revision });
		expect(serializeToProject(state).notes).toHaveLength(0);
		history.redo({ expectedRevision: editing.getRevision() });
		expect(serializeToProject(state).notes).toHaveLength(1);
		expect(serializeToProject(state).constants).toHaveLength(1);
	});

	it('preserves mixed module and group order through loading, edits, history, and reloading', () => {
		const module = (id: number, name: string) => ({
			type: 'module' as const,
			id,
			entry: 'main',
			code: [`module ${name}`, 'moduleEnd'],
		});
		const project: ProjectObjectModel = {
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			execution: [
				module(1, 'rootA'),
				{
					entry: 'main',

					...structuredClone(EMPTY_DEFAULT_PROJECT),
					type: 'group',
					id: 2,
					name: 'synth',

					exposures: [],
					code: ['group synth', 'groupEnd'],
					execution: [
						module(3, 'voiceA'),
						{
							entry: 'main',

							...structuredClone(EMPTY_DEFAULT_PROJECT),
							type: 'group',
							id: 4,
							name: 'oscillator',

							exposures: [],
							code: ['group oscillator', 'groupEnd'],
							execution: [module(5, 'tick')],

							entries: ['main'],
						},
						module(6, 'voiceB'),
					],

					entries: ['main'],
				},
				module(7, 'rootB'),
			],
		};
		const { editing, history, events, state } = setup(project);
		const before = serializeToProject(state);
		expect(before.execution).toEqual(project.execution);
		const rootB = state.project.rootLevel.blocks.find(block => block.name === 'rootB')!;
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId: getEditorBlockId(rootB), code: ['module rootB', 'int value 1', 'moduleEnd'] }],
		});
		const edited = serializeToProject(state);
		expect(edited.execution.map(block => block.code[0])).toEqual(['module rootA', 'group synth', 'module rootB']);
		history.undo({ expectedRevision: editing.getRevision() });
		expect(serializeToProject(state)).toEqual(before);
		history.redo({ expectedRevision: editing.getRevision() });
		expect(serializeToProject(state)).toEqual(edited);
		events.dispatch('loadProject', { project: edited });
		expect(serializeToProject(state)).toEqual(edited);
	});

	it('preserves empty root and local entries through edits and history without adding group main', () => {
		const project: ProjectObjectModel = {
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			entries: ['main', 'rootEmpty'],
			execution: [
				{
					...structuredClone(EMPTY_DEFAULT_PROJECT),
					type: 'group',
					id: 1,
					name: 'worker',
					entry: 'main',
					code: ['group worker', 'groupEnd'],
					exposures: [],
					entries: ['foo', 'bar'],
					execution: [{ type: 'module', id: 2, entry: 'foo', code: ['module work', 'moduleEnd'] }],
				},
			],
		};
		const { state, events, editing, history } = setup(project);
		const group = state.project.rootLevel.blocks.find(block => block.name === 'worker')!;
		const work = group.childLevel!.blocks[0];
		const check = () => {
			const saved = serializeToProject(state);
			expect(saved.entries).toEqual(['main', 'rootEmpty']);
			expect(saved.execution[0]).toMatchObject({ entries: ['foo', 'bar'], execution: [{ entry: 'foo' }] });
			return saved;
		};
		check();
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId: getEditorBlockId(work), code: ['module renamed', 'moduleEnd'] }],
		});
		check();
		history.undo({ expectedRevision: editing.getRevision() });
		check();
		history.redo({ expectedRevision: editing.getRevision() });
		const saved = check();
		events.dispatch('loadProject', { project: saved });
		check();
	});

	it('uses state reads and one undo step for a coordinated edit batch', () => {
		const { editing, history, state, events, compilationChanged } = setup();
		const target = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
		const targetId = getEditorBlockId(target);
		const load = vi.fn();
		events.on('loadProject', load);
		state.viewport.x = 124;
		state.viewport.y = 256;
		const result = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: targetId,
					code: ['module original', '; @pos 30 40', 'int value 2', 'moduleEnd'],
				},
				{ type: 'insert', code: ['note', '; @pos 60 40', 'Created through the public API', 'noteEnd'] },
			],
		});
		const changedProject = serializeToProject(state);
		expect(state.project.activeLevel.blocks.find(block => getEditorBlockId(block) === targetId)).toMatchObject({
			code: ['module original', '; @pos 30 40', 'int value 2', 'moduleEnd'],
			gridX: 30,
			gridY: 40,
		});
		expect(state.project.activeLevel.blocks.some(block => getEditorBlockId(block) === result.createdBlockIds[0])).toBe(
			true
		);
		expect(state.viewport).toMatchObject({ x: 124, y: 256 });
		expect(compilationChanged).toHaveBeenCalled();
		expect(load).not.toHaveBeenCalled();
		const undo = history.undo({ expectedRevision: result.revision });
		expect(state.project.activeLevel.blocks.find(block => block.name === 'original')!.code).toContain('int value 1');
		expect(state.project.activeLevel.blocks.filter(block => block.blockType === 'note')).toHaveLength(0);
		history.redo({ expectedRevision: undo.revision });
		expect(serializeToProject(state)).toEqual(changedProject);
	});

	it.each(['disabled', 'customDisabled'])(
		'keeps @%s flags consistent through public edits and skips unchanged batches',
		directive => {
			const { editing, history, state, store, events, compilationChanged } = setup();
			const onCustomDirective = vi.fn();
			cleanups.push(
				store.directives.register({
					name: 'customDisabled',
					apply: (_, draft) => {
						onCustomDirective();
						draft.blockState.disabled = true;
					},
				})
			);
			compilationChanged.mockImplementation(() => serializeToProject(state));
			const disabledCode = ['module flag', `; @${directive}`, 'moduleEnd'];
			const enabledCode = ['module flag', 'moduleEnd'];
			const inserted = editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [{ type: 'insert', code: disabledCode }],
			});
			const blockId = inserted.createdBlockIds[0];
			const expectCompilerInput = (code: string[], disabled: boolean) => {
				const block = state.project.activeLevel.blocks.find(block => getEditorBlockId(block) === blockId)!;
				expect(block).toMatchObject({ code, disabled });
				const project = serializeToProject(state);
				const module = project.execution.find(entry => entry.id === block.creationIndex);
				expect(module).toMatchObject({ code });
				if (disabled) expect(module).toHaveProperty('disabled', true);
				else expect(module).not.toHaveProperty('disabled');
				expect(compilationChanged).toHaveBeenCalledOnce();
				expect(compilationChanged.mock.results[0].value).toEqual(project);
				compilationChanged.mockClear();
			};
			expectCompilerInput(disabledCode, true);

			const before = serializeToProject(state);
			const beforeEdit = vi.fn();
			events.on('beforeProjectEdit', beforeEdit);
			const projectRevision = state.projectChange.revision;
			const compilerRevision = state.compilerInputRevision;
			onCustomDirective.mockClear();
			const unchanged = editing.applyEdits({
				expectedRevision: inserted.revision,
				edits: [{ type: 'update', blockId, code: [...disabledCode] }],
			});
			expect(unchanged.revision).toBe(inserted.revision);
			expect(state.projectChange.revision).toBe(projectRevision);
			expect(state.compilerInputRevision).toBe(compilerRevision);
			expect(serializeToProject(state)).toEqual(before);
			expect(beforeEdit).not.toHaveBeenCalled();
			expect(compilationChanged).not.toHaveBeenCalled();
			expect(onCustomDirective).not.toHaveBeenCalled();

			for (const [code, disabled] of [
				[enabledCode, false],
				[disabledCode, true],
			] as const) {
				editing.applyEdits({
					expectedRevision: editing.getRevision(),
					edits: [{ type: 'update', blockId, code }],
				});
				expectCompilerInput(code, disabled);
			}
			history.undo({ expectedRevision: editing.getRevision() });
			expectCompilerInput(enabledCode, false);
			history.redo({ expectedRevision: editing.getRevision() });
			expectCompilerInput(disabledCode, true);
		}
	);

	it('updates valid positions and retains the last position when @pos is removed, including undo and redo', () => {
		const { editing, history, state } = setup();
		const code = ['module placed', '; @pos -12 34', 'moduleEnd'];
		const inserted = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'insert', code }],
		});
		const findPlaced = () =>
			state.project.activeLevel.blocks.find(block => getEditorBlockId(block) === inserted.createdBlockIds[0])!;
		expect(findPlaced()).toMatchObject({ code, gridX: -12, gridY: 34 });
		const updatedCode = ['module placed', '; @pos 56 -78', 'moduleEnd'];
		const updated = editing.applyEdits({
			expectedRevision: inserted.revision,
			edits: [{ type: 'update', blockId: inserted.createdBlockIds[0], code: updatedCode }],
		});
		expect(findPlaced()).toMatchObject({ code: updatedCode, gridX: 56, gridY: -78 });
		const withoutPos = ['module placed', 'moduleEnd'];
		const removed = editing.applyEdits({
			expectedRevision: updated.revision,
			edits: [{ type: 'update', blockId: inserted.createdBlockIds[0], code: withoutPos }],
		});
		expect(findPlaced()).toMatchObject({ code: withoutPos, gridX: 56, gridY: -78 });
		const undone = history.undo({ expectedRevision: removed.revision });
		expect(findPlaced()).toMatchObject({ code: updatedCode, gridX: 56, gridY: -78 });
		history.redo({ expectedRevision: undone.revision });
		expect(findPlaced()).toMatchObject({ code: withoutPos, gridX: 56, gridY: -78 });
	});

	it('applies a mixed edit plan as one checkpoint without replacing existing block handles', () => {
		const { editing, history, state, compilationChanged, store } = setup({
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			execution: [
				{ type: 'module', id: 0, entry: 'main', code: ['module original', 'moduleEnd'] },
				{ type: 'module', id: 1, entry: 'main', code: ['module removed', 'moduleEnd'] },
			],
		});
		const project = state.project.activeLevel;
		const target = project.blocks.find(block => block.name === 'original')!;
		const removed = project.blocks.find(block => block.name === 'removed')!;
		const prior = serializeToProject(state);
		const changes: ProjectObjectModel[] = [];
		store.subscribe('compilerInputRevision', () => changes.push(serializeToProject(state)));
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		const result = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(target),
					code: ['module updated', 'unknown instruction', 'moduleEnd'],
				},
				{ type: 'delete', blockId: getEditorBlockId(removed) },
				{ type: 'insert', code: ['note new', 'noteEnd'] },
			],
		});
		expect(state.project.activeLevel).toBe(project);
		expect(project.blocks.find(block => block.name === 'updated')).toBe(target);
		expect(project.blocks).not.toContain(removed);
		expect(project.blocks.find(block => block.name === 'new')).toBeDefined();
		expect(result.createdBlockIds).toEqual([getEditorBlockId(project.blocks.find(block => block.name === 'new')!)]);
		expect(state.projectChange).toEqual({ revision: revision + 1, kind: 'edit', history: 'checkpoint' });
		expect(state.compilerInputRevision).toBe(compilerRevision + 1);
		expect(compilationChanged).toHaveBeenCalledOnce();
		expect(changes).toEqual([serializeToProject(state)]);
		history.undo({ expectedRevision: editing.getRevision() });
		expect(serializeToProject(state)).toEqual(prior);
	});

	it('targets duplicate block IDs in nested projects and preserves the currently viewed group', () => {
		const project = structuredClone(EMPTY_DEFAULT_PROJECT);
		project.execution = [
			{ type: 'module', id: 0, entry: 'main', code: ['module outer', 'moduleEnd'] },
			{
				entry: 'main',

				...structuredClone(EMPTY_DEFAULT_PROJECT),
				type: 'group',
				id: 1,
				name: 'voice',
				exposures: [],

				code: ['group voice', 'groupEnd'],
				execution: [{ type: 'module', id: 0, entry: 'local', code: ['module inner', 'moduleEnd'] }],

				entries: ['local', 'localEmpty'],
			},
		];
		const { editing, history, navigation, events, state, store } = setup(project);
		Object.assign(state.viewport, { x: 64, y: 96 });
		const group = state.project.rootLevel.blocks.find(block => block.name === 'voice')!;
		store.set('project.selectedCodeBlock', group);
		events.dispatch('openProjectGroup', { codeBlock: group });
		Object.assign(state.viewport, { x: -320, y: 160 });
		const inner = state.project.activeLevel.blocks.find(block => block.name === 'inner')!;
		store.set('project.selectedCodeBlock', inner);
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(inner),
					code: ['module updatedInner', '; @home left', 'moduleEnd'],
				},
				{ type: 'insert', groupBlockId: getEditorBlockId(group), entry: 'local', code: ['module added', 'moduleEnd'] },
			],
		});
		expect(state.project.rootLevel.blocks.find(block => block.name === 'outer')!.code[0]).toBe('module outer');
		expect(state.project.activeLevel.blocks.some(block => block.name === 'updatedInner')).toBe(true);
		expect(state.project.activeLevel.blocks.some(block => block.name === 'added')).toBe(true);
		expect(state.project.activeLevel.path).toBe('voice');
		expect(state.project.selectedCodeBlock?.name).toBe('updatedInner');
		expect(state.project.selectedCodeBlock).toBe(inner);
		expect(state.viewport).toMatchObject({ x: -320, y: 160 });
		history.undo({ expectedRevision: editing.getRevision() });
		expect(state.project.activeLevel.path).toBe('voice');
		expect(state.project.selectedCodeBlock?.name).toBe('inner');
		expect(state.viewport).toMatchObject({ x: -320, y: 160 });
		history.redo({ expectedRevision: editing.getRevision() });
		expect(state.project.selectedCodeBlock?.name).toBe('updatedInner');
		expect(state.viewport).toMatchObject({ x: -320, y: 160 });
		navigation.goToRoot();
		expect(state.viewport).toMatchObject({ x: 64, y: 96 });
		expect(state.project.selectedCodeBlock).toBe(state.project.rootLevel.blocks.find(block => block.name === 'voice'));
		expect(state.project.selectedCodeBlock).not.toBe(group);
		const snapshot = serializeToProject(state);
		expect(snapshot.execution.find(block => block.type === 'group')).toMatchObject({
			entries: ['local', 'localEmpty'],
		});
		expect(JSON.stringify(snapshot)).not.toContain('viewport');
		expect(JSON.stringify(snapshot)).not.toContain('selectedBlock');
		events.dispatch('loadProject', { project: snapshot });
		expect(state.viewport).toMatchObject({ x: 0, y: 0 });
		expect(state.project.selectedCodeBlock).toBeUndefined();
		const replacementGroup = state.project.rootLevel.blocks.find(block => block.name === 'voice')!;
		expect(replacementGroup.childLevel!.viewport).toBeUndefined();
		navigation.openGroup(getEditorBlockId(replacementGroup));
		expect(state.viewport).not.toMatchObject({ x: -320, y: 160 });
	});

	it('keeps independent views for duplicate sibling groups copied through the editor', () => {
		const { editing, history, navigation, state, store, group: original } = setupGroup('voice');
		const [copy] = insertCodeBlocks(store, { x: 240, y: 80, blocks: serializeCodeBlocks([original], original) });
		const owner = (id: number) => state.project.rootLevel.blocks.find(block => block.creationIndex === id)!;
		expect(original.childLevel!.path).toBe(copy.childLevel!.path);
		navigation.openGroup(getEditorBlockId(original));
		Object.assign(state.viewport, { x: 64, y: 96 });
		store.set('project.selectedCodeBlock', original.childLevel!.blocks[0]);
		navigation.goToRoot();
		store.set('project.selectedCodeBlock', copy);
		navigation.openGroup(getEditorBlockId(copy));
		Object.assign(state.viewport, { x: -320, y: 160 });
		const edited = copy.childLevel!.blocks[0];
		store.set('project.selectedCodeBlock', edited);
		const editedSource = ['module changed', 'moduleEnd'];
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId: getEditorBlockId(edited), code: editedSource }],
		});
		const expectRestoredCopy = (name: string) => {
			const restored = owner(copy.creationIndex).childLevel!;
			expect(state.project.activeLevel).toBe(restored);
			expect(state.project.selectedCodeBlock).toBe(restored.blocks[0]);
			expect(restored.blocks[0].name).toBe(name);
			expect(state.viewport).toMatchObject({ x: -320, y: 160 });
			const originalLevel = owner(original.creationIndex).childLevel!;
			expect(originalLevel.selectedBlock).toBe(originalLevel.blocks[0]);
			expect(originalLevel.blocks[0].name).toBe('sample');
			expect(originalLevel.viewport).toMatchObject({ x: 64, y: 96 });
		};
		history.undo({ expectedRevision: editing.getRevision() });
		expectRestoredCopy('sample');
		history.redo({ expectedRevision: editing.getRevision() });
		expectRestoredCopy('changed');
		navigation.goToRoot();
		expect(state.project.selectedCodeBlock).toBe(owner(copy.creationIndex));
		navigation.openGroup(getEditorBlockId(owner(original.creationIndex)));
		expect(state.viewport).toMatchObject({ x: 64, y: 96 });
		expect(state.project.selectedCodeBlock).toBe(owner(original.creationIndex).childLevel!.blocks[0]);
		navigation.goToRoot();
		navigation.openGroup(getEditorBlockId(owner(copy.creationIndex)));
		history.undo({ expectedRevision: editing.getRevision() });
		expectRestoredCopy('sample');
		history.undo({ expectedRevision: editing.getRevision() });
		expect(state.project.activeLevel).toBe(state.project.rootLevel);
		expect(state.project.rootLevel.blocks.some(block => block.creationIndex === copy.creationIndex)).toBe(false);
		history.redo({ expectedRevision: editing.getRevision() });
		expect(state.project.activeLevel).toBe(state.project.rootLevel);
		const recreatedCopy = owner(copy.creationIndex).childLevel!;
		expect(recreatedCopy.viewport).toBeUndefined();
		expect(recreatedCopy.selectedBlock).toBeUndefined();
	});

	it('keeps the same owning group view when a rename is undone and redone', () => {
		const { editing, history, navigation, state, store, group } = setupGroup('voices');
		store.set('project.selectedCodeBlock', group);
		applyCodeBlockSourceEdits(store, [{ codeBlock: group, code: ['group ensemble', 'groupEnd'] }], {
			history: 'checkpoint',
		});
		navigation.openGroup(getEditorBlockId(group));
		Object.assign(state.viewport, { x: 123, y: 456 });
		store.set('project.selectedCodeBlock', group.childLevel!.blocks[0]);
		const expectRenamedView = (name: string) => {
			const owner = state.project.rootLevel.blocks.find(block => block.creationIndex === group.creationIndex)!;
			expect(owner.name).toBe(name);
			expect(state.project.activeLevel).toBe(owner.childLevel);
			expect(owner.childLevel!.path).toBe(name);
			expect(owner.childLevel!.blocks[0].projectPath).toBe(name);
			expect(state.project.selectedCodeBlock).toBe(owner.childLevel!.blocks[0]);
			expect(state.viewport).toMatchObject({ x: 123, y: 456 });
		};
		history.undo({ expectedRevision: editing.getRevision() });
		expectRenamedView('voices');
		history.redo({ expectedRevision: editing.getRevision() });
		expectRenamedView('ensemble');
	});

	it('keeps pending source edits and an API batch as separate undo steps without delayed duplicates', async () => {
		vi.useFakeTimers();
		try {
			const { editing, history, state, store } = setup();
			const block = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
			store.set('project.selectedCodeBlock', block);
			block.cursor.row = 1;
			block.cursor.col = block.code[1].length;
			applyCodeBlockSourceEdits(store, [
				{ codeBlock: block, code: block.code.map((line, row) => (row === 1 ? `${line}2` : line)) },
			]);
			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [{ type: 'update', blockId: getEditorBlockId(block), code: [...block.code] }],
			});
			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [
					{ type: 'update', blockId: getEditorBlockId(block), code: ['module original', 'int value 3', 'moduleEnd'] },
				],
			});
			await vi.advanceTimersByTimeAsync(2000);
			history.undo({ expectedRevision: editing.getRevision() });
			expect(state.project.activeLevel.blocks.find(block => block.name === 'original')!.code).toContain('int value 12');
			history.undo({ expectedRevision: editing.getRevision() });
			expect(state.project.activeLevel.blocks.find(block => block.name === 'original')!.code).toContain('int value 1');
			expect(history.getAvailability()).toEqual({ canUndo: false, canRedo: true });
			history.redo({ expectedRevision: editing.getRevision() });
			history.redo({ expectedRevision: editing.getRevision() });
			expect(state.project.activeLevel.blocks.find(block => block.name === 'original')!.code).toContain('int value 3');
			expect(history.getAvailability()).toEqual({ canUndo: true, canRedo: false });
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps pending typing separate from ignored env edits and preserves current generated source on restore', async () => {
		vi.useFakeTimers();
		try {
			const { editing, history, state, store, events } = setup();
			const authored = () => state.project.rootLevel.blocks.find(block => block.name === 'original')!;
			const environment = () => state.project.rootLevel.blocks.find(block => block.name === 'env')!;
			const beforeProjectEdit = vi.fn();
			events.on('beforeProjectEdit', beforeProjectEdit);
			applyCodeBlockSourceEdits(store, [
				{ codeBlock: authored(), code: ['module original', 'int value 12', 'moduleEnd'] },
			]);
			await vi.advanceTimersByTimeAsync(500);
			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [
					{
						type: 'update',
						blockId: getEditorBlockId(environment()),
						code: ['constants env', '; @pos 12 15', 'constantsEnd'],
					},
				],
			});
			store.set('envConstantContributions.test', ['const GENERATED 1']);
			expect(beforeProjectEdit).not.toHaveBeenCalled();
			// The original typing timer was not canceled or postponed by generated updates or ignored edits.
			await vi.advanceTimersByTimeAsync(500);
			history.undo({ expectedRevision: editing.getRevision() });
			expect(authored().code).toContain('int value 1');
			expect(environment().code).toContain('; @pos 0 0');
			expect(environment().code).toContain('const GENERATED 1');
			store.set('envConstantContributions.test', ['const GENERATED 2']);
			history.redo({ expectedRevision: editing.getRevision() });
			expect(authored().code).toContain('int value 12');
			expect(environment().code).toContain('; @pos 0 0');
			expect(environment().code).toContain('const GENERATED 2');
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not retain history from a replaced project', () => {
		const { editing, history, state, events } = setup();
		const revision = editing.getRevision();
		const target = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
		editing.applyEdits({
			expectedRevision: revision,
			edits: [{ type: 'delete', blockId: getEditorBlockId(target) }],
		});
		events.dispatch('loadProject', { project: structuredClone(EMPTY_DEFAULT_PROJECT) });
		expect(history.getAvailability()).toEqual({ canUndo: false, canRedo: false });
	});

	it('invalidates the history handle when its plugin is disposed', () => {
		const { editing, history, disposeHistory } = setup();
		const revision = editing.getRevision();
		disposeHistory();
		expect(() => history.getAvailability()).toThrow('History plugin has been disposed');
		expect(() => history.undo({ expectedRevision: revision })).toThrow('History plugin has been disposed');
		expect(editing.getRevision()).toBe(revision);
	});

	it('reports pending undo availability without committing the typing debounce or editing the project', async () => {
		vi.useFakeTimers();
		try {
			const { editing, history, state, store } = setup();
			const block = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
			const original = [...block.code];
			const changed = ['module original', 'int value 2', 'moduleEnd'];
			expect(history.getAvailability()).toEqual({ canUndo: false, canRedo: false });
			applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: changed }]);
			const revision = editing.getRevision();
			expect(history.getAvailability()).toEqual({ canUndo: true, canRedo: false });
			expect(editing.getRevision()).toBe(revision);
			applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: original }]);
			expect(history.getAvailability()).toEqual({ canUndo: false, canRedo: false });
			await vi.advanceTimersByTimeAsync(1000);
			const restoredRevision = editing.getRevision();
			expect(history.undo({ expectedRevision: restoredRevision })).toEqual({ revision: restoredRevision });
		} finally {
			vi.useRealTimers();
		}
	});
});
