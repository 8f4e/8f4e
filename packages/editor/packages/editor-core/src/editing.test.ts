import initState, {
	applyCodeBlockSourceEdits,
	createEditorEditingHandle,
	EMPTY_DEFAULT_PROJECT,
	getEditorBlockId,
	serializeToProject,
	setGridSize,
} from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initEvents from './events';

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
	const events = initEvents();
	const compilationChanged = vi.fn();
	events.on('compilationInputChanged', compilationChanged);
	const store = initState(events, { callbacks: {} });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	events.dispatch('enterEditMode');
	const editing = createEditorEditingHandle(store, events);
	events.dispatch('loadProject', { project });
	events.dispatch('enterEditMode');
	compilationChanged.mockClear();
	cleanups.push(() => {
		editing.dispose();
		store.dispose();
		events.dispose();
	});
	const state = store.getState();
	return {
		state,
		store,
		events,
		editing: editing.handle,
		navigation: editing.navigation,
		dispose: editing.dispose,
		compilationChanged,
	};
}

describe('public editor editing handle', () => {
	it("restores a draft module's historical execution entry across undo and redo", () => {
		const { editing, state } = setup({
			...EMPTY_DEFAULT_PROJECT,
			entries: ['main', 'alternate'],
			execution: [{ type: 'module', id: 0, entry: 'alternate', code: ['module test', 'moduleEnd'] }],
		});
		const current = () => state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'test')!;
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
		editing.undo({ expectedRevision: editing.getRevision() });
		expect(current()).toMatchObject({ blockType: 'unknown', entry: 'alternate' });
		editing.redo({ expectedRevision: editing.getRevision() });
		expect(current().entry).toBe('main');
		editing.undo({ expectedRevision: editing.getRevision() });
		update(['module test', 'moduleEnd']);
		expect(current()).toMatchObject({ blockType: 'module', entry: 'alternate' });
		expect(serializeToProject(state).execution[0].entry).toBe('alternate');
	});

	it('restores the historical retained grid position of incomplete position directives', () => {
		const { editing, state } = setup({
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, entry: 'main', code: ['module test', '; @pos 10 20', 'moduleEnd'] }],
		});
		const current = () => state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'test')!;
		const update = (position: string) =>
			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [{ type: 'update', blockId: getEditorBlockId(current()), code: ['module test', position, 'moduleEnd'] }],
			});
		update('; @pos incomplete');
		expect(current()).toMatchObject({ gridX: 10, gridY: 20 });
		update('; @pos 30 40');
		expect(current()).toMatchObject({ gridX: 30, gridY: 40 });
		editing.undo({ expectedRevision: editing.getRevision() });
		expect(current()).toMatchObject({ code: ['module test', '; @pos incomplete', 'moduleEnd'], gridX: 10, gridY: 20 });
		editing.redo({ expectedRevision: editing.getRevision() });
		expect(current()).toMatchObject({ gridX: 30, gridY: 40 });
		editing.undo({ expectedRevision: editing.getRevision() });
		expect(current()).toMatchObject({ gridX: 10, gridY: 20 });
	});

	it('preserves separately editable root project-scope blocks and their identities across history', () => {
		const { editing, state } = setup();
		const scope = () => state.codeBlockRendering.rootProject.blocks.filter(block => block.isProjectScope);
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
		editing.undo({ expectedRevision: editing.getRevision() });
		expect(scope().map(block => [getEditorBlockId(block), block.code])).toEqual([
			[firstId, ['pass env']],
			[secondId, ['pass other']],
		]);
		editing.undo({ expectedRevision: editing.getRevision() });
		expect(scope()).toHaveLength(0);
		editing.redo({ expectedRevision: editing.getRevision() });
		expect(scope().map(getEditorBlockId)).toEqual([firstId, secondId]);
		editing.redo({ expectedRevision: editing.getRevision() });
		expect(scope().map(block => block.code)).toEqual([['pass changed'], ['pass other']]);
	});

	it('assigns generated environment blocks an identity distinct from root groups', () => {
		const { state } = setup({
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			execution: [
				{
					entry: 'main',

					...structuredClone(EMPTY_DEFAULT_PROJECT),
					type: 'group',
					id: 0,
					name: 'synth',

					exposures: [],
					code: ['group synth', 'groupEnd'],

					entries: ['main'],
				},
			],
		});
		const ids = state.codeBlockRendering.rootProject.blocks.map(block => block.creationIndex);
		expect(ids).toHaveLength(2);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('ignores final root env declarations while applying ordinary edits in the same API batch', () => {
		const { editing, state } = setup();
		const block = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'original')!;
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
		expect(state.historyStack).toHaveLength(1);
		editing.undo({ expectedRevision: ordinary.revision });
		expect(serializeToProject(state).notes).toHaveLength(0);
		editing.redo({ expectedRevision: editing.getRevision() });
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
		const { editing, events, state } = setup(project);
		const before = serializeToProject(state);
		expect(before.execution).toEqual(project.execution);
		const rootB = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'rootB')!;
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId: getEditorBlockId(rootB), code: ['module rootB', 'int value 1', 'moduleEnd'] }],
		});
		const edited = serializeToProject(state);
		expect(edited.execution.map(block => block.code[0])).toEqual(['module rootA', 'group synth', 'module rootB']);
		editing.undo({ expectedRevision: editing.getRevision() });
		expect(serializeToProject(state)).toEqual(before);
		editing.redo({ expectedRevision: editing.getRevision() });
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
		const { state, events, editing } = setup(project);
		const group = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'worker')!;
		const work = group.childProject!.blocks[0];
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
		editing.undo({ expectedRevision: editing.getRevision() });
		check();
		editing.redo({ expectedRevision: editing.getRevision() });
		const saved = check();
		events.dispatch('loadProject', { project: saved });
		check();
	});

	it('uses state reads and one undo step for a coordinated edit batch', () => {
		const { editing, state, events, compilationChanged } = setup();
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
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
		expect(
			state.codeBlockRendering.currentProject.blocks.find(block => getEditorBlockId(block) === targetId)
		).toMatchObject({
			code: ['module original', '; @pos 30 40', 'int value 2', 'moduleEnd'],
			gridX: 30,
			gridY: 40,
		});
		expect(
			state.codeBlockRendering.currentProject.blocks.some(
				block => getEditorBlockId(block) === result.createdBlockIds[0]
			)
		).toBe(true);
		expect(state.historyStack).toHaveLength(1);
		expect(state.viewport).toMatchObject({ x: 124, y: 256 });
		expect(compilationChanged).toHaveBeenCalled();
		expect(load).not.toHaveBeenCalled();
		const undo = editing.undo({ expectedRevision: result.revision });
		expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!.code).toContain(
			'int value 1'
		);
		expect(state.codeBlockRendering.currentProject.blocks.filter(block => block.blockType === 'note')).toHaveLength(0);
		editing.redo({ expectedRevision: undo.revision });
		expect(serializeToProject(state)).toEqual(changedProject);
	});

	it.each(['disabled', 'customDisabled'])(
		'keeps @%s flags consistent through public edits and skips unchanged batches',
		directive => {
			const { editing, state, store, events, compilationChanged } = setup();
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
				const block = state.codeBlockRendering.currentProject.blocks.find(
					block => getEditorBlockId(block) === blockId
				)!;
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
			const historyLength = state.historyStack.length;
			onCustomDirective.mockClear();
			const unchanged = editing.applyEdits({
				expectedRevision: inserted.revision,
				edits: [{ type: 'update', blockId, code: [...disabledCode] }],
			});
			expect(unchanged.revision).toBe(inserted.revision);
			expect(state.projectChange.revision).toBe(projectRevision);
			expect(state.compilerInputRevision).toBe(compilerRevision);
			expect(state.historyStack).toHaveLength(historyLength);
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
			editing.undo({ expectedRevision: editing.getRevision() });
			expectCompilerInput(enabledCode, false);
			editing.redo({ expectedRevision: editing.getRevision() });
			expectCompilerInput(disabledCode, true);
		}
	);

	it('updates valid positions and retains the last position when @pos is removed, including undo and redo', () => {
		const { editing, state } = setup();
		const code = ['module placed', '; @pos -12 34', 'moduleEnd'];
		const inserted = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'insert', code }],
		});
		const findPlaced = () =>
			state.codeBlockRendering.currentProject.blocks.find(
				block => getEditorBlockId(block) === inserted.createdBlockIds[0]
			)!;
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
		const undone = editing.undo({ expectedRevision: removed.revision });
		expect(findPlaced()).toMatchObject({ code: updatedCode, gridX: 56, gridY: -78 });
		editing.redo({ expectedRevision: undone.revision });
		expect(findPlaced()).toMatchObject({ code: withoutPos, gridX: 56, gridY: -78 });
	});

	it.each([{ directives: [] }, { directives: ['; @pos invalid 3'] }, { directives: ['; @pos 1 2', '; @pos 3 4'] }])(
		'preserves unfinished or missing positioning source on inserts and updates: $directives',
		({ directives }) => {
			const { editing, state, events } = setup({
				...structuredClone(EMPTY_DEFAULT_PROJECT),
				execution: [{ type: 'module', id: 0, entry: 'main', code: ['module original', '; @pos 9 12', 'moduleEnd'] }],
			});
			const code = ['module unplaced', ...directives, 'moduleEnd'];
			const originalId = getEditorBlockId(
				state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!
			);
			const result = editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [
					{ type: 'insert', code },
					{ type: 'update', blockId: originalId, code },
				],
			});
			const affected = state.codeBlockRendering.currentProject.blocks.filter(
				block => getEditorBlockId(block) === originalId || getEditorBlockId(block) === result.createdBlockIds[0]
			);
			expect(affected).toHaveLength(2);
			for (const block of affected) {
				const existing = getEditorBlockId(block) === originalId;
				expect(block).toMatchObject({ code, gridX: existing ? 9 : 0, gridY: existing ? 12 : 0 });
			}
			events.dispatch('loadProject', {
				project: {
					...structuredClone(EMPTY_DEFAULT_PROJECT),
					execution: [{ type: 'module', id: 0, entry: 'main', code }],
				},
			});
			expect(state.codeBlockRendering.currentProject.blocks.find(block => block.creationIndex === 0)).toMatchObject({
				code,
				gridX: 0,
				gridY: 0,
			});
		}
	);

	it('rejects an invalid batch without applying earlier operations or changing history', () => {
		const { editing, state, compilationChanged, events } = setup();
		const before = serializeToProject(state);
		const revision = editing.getRevision();
		const nextId = state.codeBlockRendering.nextCodeBlockCreationIndex;
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		const beforeEdit = vi.fn();
		events.on('beforeProjectEdit', beforeEdit);
		expect(() =>
			editing.applyEdits({
				expectedRevision: revision,
				edits: [
					{ type: 'insert', code: ['note new', 'noteEnd'] },
					{ type: 'delete', blockId: getEditorBlockId(target) },
					{ type: 'delete', blockId: 'missing' },
				],
			})
		).toThrow('current blockId');
		expect(serializeToProject(state)).toEqual(before);
		expect(editing.getRevision()).toBe(revision);
		expect(state.historyStack).toHaveLength(0);
		expect(compilationChanged).not.toHaveBeenCalled();
		expect(beforeEdit).not.toHaveBeenCalled();
		expect(state.codeBlockRendering.nextCodeBlockCreationIndex).toBe(nextId);
		expect(state.codeBlockRendering.currentProject.blocks).toContain(target);
	});

	it('applies a mixed edit plan as one checkpoint without replacing existing block handles', () => {
		const { editing, state, compilationChanged, events } = setup({
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			execution: [
				{ type: 'module', id: 0, entry: 'main', code: ['module original', 'moduleEnd'] },
				{ type: 'module', id: 1, entry: 'main', code: ['module removed', 'moduleEnd'] },
			],
		});
		const project = state.codeBlockRendering.currentProject;
		const target = project.blocks.find(block => block.name === 'original')!;
		const removed = project.blocks.find(block => block.name === 'removed')!;
		const prior = serializeToProject(state);
		const changes: ProjectObjectModel[] = [];
		events.on('compilationInputChanged', () => changes.push(serializeToProject(state)));
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
		expect(state.codeBlockRendering.currentProject).toBe(project);
		expect(project.blocks.find(block => block.name === 'updated')).toBe(target);
		expect(project.blocks).not.toContain(removed);
		expect(project.blocks.find(block => block.name === 'new')).toBeDefined();
		expect(result.createdBlockIds).toEqual([getEditorBlockId(project.blocks.find(block => block.name === 'new')!)]);
		expect(state.projectChange).toEqual({ revision: revision + 1, kind: 'edit', history: 'checkpoint' });
		expect(state.compilerInputRevision).toBe(compilerRevision + 1);
		expect(compilationChanged).toHaveBeenCalledOnce();
		expect(changes).toEqual([serializeToProject(state)]);
		expect(state.historyStack).toHaveLength(1);
		editing.undo({ expectedRevision: editing.getRevision() });
		expect(serializeToProject(state)).toEqual(prior);
	});

	it('folds repeated updates and ignores writes to read-only blocks before deciding whether to publish', () => {
		const { editing, state, events, compilationChanged } = setup();
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		const env = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'env')!;
		const originalCode = [...target.code];
		const originalEnvCode = [...env.code];
		const originalLastUpdated = target.lastUpdated;
		const before = serializeToProject(state);
		const beforeEdit = vi.fn();
		events.on('beforeProjectEdit', beforeEdit);
		const revision = editing.getRevision();
		const compilerRevision = state.compilerInputRevision;
		const result = editing.applyEdits({
			expectedRevision: revision,
			edits: [
				{ type: 'update', blockId: getEditorBlockId(target), code: ['module intermediate', 'moduleEnd'] },
				{ type: 'update', blockId: getEditorBlockId(target), code: originalCode },
				{
					type: 'update',
					blockId: getEditorBlockId(env),
					code: [...originalEnvCode.slice(0, -1), 'const USER 4', originalEnvCode.at(-1)!],
				},
				{ type: 'delete', blockId: getEditorBlockId(env) },
			],
		});
		expect(result.revision).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
		expect(target.lastUpdated).toBe(originalLastUpdated);
		expect(env.code).toEqual(originalEnvCode);
		expect(serializeToProject(state)).toEqual(before);
		expect(state.historyStack).toHaveLength(0);
		expect(compilationChanged).not.toHaveBeenCalled();
		expect(beforeEdit).not.toHaveBeenCalled();
	});

	it('does not reject incomplete or malformed program source as an invalid editing command', () => {
		const { editing, state } = setup();
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		const malformed = ['module original', 'group invalidNestedInstruction'];
		const result = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId: getEditorBlockId(target), code: malformed }],
		});
		expect(target.code).toEqual(malformed);
		expect(state.codeBlockRendering.currentProject.blocks).toContain(target);
		expect(result.revision).toBe(editing.getRevision());
	});

	it.each([
		{ code: ['note converted', 'noteEnd'], requestedEntry: undefined, expectedEntry: 'main' },
		{ code: ['function converted', 'functionEnd'], requestedEntry: 'requested', expectedEntry: 'requested' },
		{ code: ['constants converted', 'constantsEnd'], requestedEntry: undefined, expectedEntry: 'main' },
		{ code: ['includes', 'includesEnd'], requestedEntry: undefined, expectedEntry: 'main' },
		{ code: ['pass env'], requestedEntry: undefined, expectedEntry: 'main' },
	])(
		'settles entry assignment when converting a module to $code and back',
		({ code, requestedEntry, expectedEntry }) => {
			const { editing, state, store } = setup({
				...structuredClone(EMPTY_DEFAULT_PROJECT),
				entries: ['alternate', 'empty'],
				execution: [{ type: 'module', id: 0, entry: 'alternate', code: ['module original', 'moduleEnd'] }],
			});
			const project = state.codeBlockRendering.currentProject;
			const target = project.blocks.find(block => block.name === 'original')!;
			const blockId = getEditorBlockId(target);
			store.set('codeBlockRendering.selectedCodeBlock', target);

			editing.applyEdits({ expectedRevision: editing.getRevision(), edits: [{ type: 'update', blockId, code }] });

			expect(target.entry).toBeUndefined();
			expect(project.entries).toEqual(['alternate', 'empty']);
			expect(serializeToProject(state).execution).toEqual([]);

			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [{ type: 'update', blockId, code: ['module converted', 'moduleEnd'], entry: requestedEntry }],
			});

			expect(target.entry).toBe(expectedEntry);
			expect(project.entries).toEqual(['alternate', 'empty', expectedEntry]);
			expect(serializeToProject(state).entries).toEqual(project.entries);
			expect(serializeToProject(state).execution).toMatchObject([{ type: 'module', id: 0, entry: expectedEntry }]);
			expect(project.blocks.find(block => getEditorBlockId(block) === blockId)).toBe(target);
			expect(state.codeBlockRendering.selectedCodeBlock).toBe(target);
		}
	);

	it('preserves a module entry while its source is temporarily incomplete', () => {
		const { editing, state } = setup({
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			entries: ['alternate'],
			execution: [{ type: 'module', id: 0, entry: 'alternate', code: ['module original', 'moduleEnd'] }],
		});
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		const blockId = getEditorBlockId(target);
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId, code: ['module original'] }],
		});
		expect(target.blockType).toBe('unknown');
		expect(target.entry).toBe('alternate');
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId, code: ['module original', 'moduleEnd'] }],
		});
		expect(target.entry).toBe('alternate');
		expect(serializeToProject(state).execution).toMatchObject([{ type: 'module', id: 0, entry: 'alternate' }]);
		expect(state.codeBlockRendering.rootProject.entries).toEqual(['alternate']);
	});

	it('accepts malformed source but rejects explicit entry membership for non-execution blocks', () => {
		const { editing, state, compilationChanged } = setup();
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		const revision = editing.getRevision();
		const before = serializeToProject(state);
		for (const edit of [
			{ type: 'insert' as const, code: ['note details', 'noteEnd'], entry: 'main' },
			{ type: 'update' as const, blockId: getEditorBlockId(target), code: ['module original'], entry: 'main' },
		]) {
			expect(() => editing.applyEdits({ expectedRevision: revision, edits: [edit] })).toThrow('accept an entry');
		}
		expect(editing.getRevision()).toBe(revision);
		expect(serializeToProject(state)).toEqual(before);
		expect(state.historyStack).toHaveLength(0);
		expect(compilationChanged).not.toHaveBeenCalled();
	});

	it('rejects a batch which both updates and deletes an existing block before committing either operation', () => {
		const { editing, state, compilationChanged } = setup();
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		const revision = editing.getRevision();
		const before = serializeToProject(state);
		expect(() =>
			editing.applyEdits({
				expectedRevision: revision,
				edits: [
					{ type: 'update', blockId: getEditorBlockId(target), code: ['module changed', 'moduleEnd'] },
					{ type: 'delete', blockId: getEditorBlockId(target) },
				],
			})
		).toThrow('Cannot update a block being deleted');
		expect(editing.getRevision()).toBe(revision);
		expect(serializeToProject(state)).toEqual(before);
		expect(state.historyStack).toHaveLength(0);
		expect(compilationChanged).not.toHaveBeenCalled();
	});

	it('rejects stale revisions after human source edits, layout edits, project replacement, and from another editor', () => {
		const { editing, store, state, events } = setup();
		const revision = editing.getRevision();
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		store.set('codeBlockRendering.selectedCodeBlock', block);
		block.cursor.row = 1;
		block.cursor.col = block.code[1].length;
		applyCodeBlockSourceEdits(store, [
			{ codeBlock: block, code: block.code.map((line, row) => (row === 1 ? `${line}9` : line)) },
		]);
		expect(() =>
			editing.applyEdits({
				expectedRevision: revision,
				edits: [{ type: 'delete', blockId: getEditorBlockId(block) }],
			})
		).toThrow('getRevision again');
		const sourceRevision = editing.getRevision();
		events.dispatch('pointerdown', { x: block.x + 8, y: block.y + 8 });
		events.dispatch('pointermove', { movementX: 16, movementY: 32 });
		events.dispatch('pointerup');
		expect(editing.getRevision()).not.toBe(sourceRevision);
		const currentRevision = editing.getRevision();
		events.dispatch('loadProject', { project: serializeToProject(state) });
		expect(editing.getRevision()).not.toBe(currentRevision);
		expect(() => editing.undo({ expectedRevision: setup().editing.getRevision() })).toThrow('getRevision again');
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
		const { editing, navigation, events, state, store } = setup(project);
		Object.assign(state.viewport, { x: 64, y: 96 });
		const group = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'voice')!;
		store.set('codeBlockRendering.selectedCodeBlock', group);
		events.dispatch('openProjectGroup', { codeBlock: group });
		Object.assign(state.viewport, { x: -320, y: 160 });
		const inner = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'inner')!;
		store.set('codeBlockRendering.selectedCodeBlock', inner);
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(inner),
					code: ['module updatedInner', '; @home left', 'moduleEnd'],
				},
				{ type: 'insert', projectPath: inner.projectPath, entry: 'local', code: ['module added', 'moduleEnd'] },
			],
		});
		expect(state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'outer')!.code[0]).toBe(
			'module outer'
		);
		expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'updatedInner')).toBe(true);
		expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'added')).toBe(true);
		expect(state.codeBlockRendering.currentProject.path).toBe('voice');
		expect(state.codeBlockRendering.selectedCodeBlock?.name).toBe('updatedInner');
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(inner);
		expect(state.viewport).toMatchObject({ x: -320, y: 160 });
		editing.undo({ expectedRevision: editing.getRevision() });
		expect(state.codeBlockRendering.currentProject.path).toBe('voice');
		expect(state.codeBlockRendering.selectedCodeBlock?.name).toBe('inner');
		expect(state.viewport).toMatchObject({ x: -320, y: 160 });
		editing.redo({ expectedRevision: editing.getRevision() });
		expect(state.codeBlockRendering.selectedCodeBlock?.name).toBe('updatedInner');
		expect(state.viewport).toMatchObject({ x: -320, y: 160 });
		navigation.goToRoot();
		expect(state.viewport).toMatchObject({ x: 64, y: 96 });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(
			state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'voice')
		);
		expect(state.codeBlockRendering.selectedCodeBlock).not.toBe(group);
		const snapshot = serializeToProject(state);
		expect(snapshot.execution.find(block => block.type === 'group')).toMatchObject({
			entries: ['local', 'localEmpty'],
		});
		expect(JSON.stringify(snapshot)).not.toContain('viewport');
		expect(JSON.stringify(snapshot)).not.toContain('selectedBlock');
		events.dispatch('loadProject', { project: snapshot });
		expect(state.viewport).toMatchObject({ x: 0, y: 0 });
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		const replacementGroup = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'voice')!;
		expect(replacementGroup.childProject!.viewport).toBeUndefined();
		navigation.openGroup(getEditorBlockId(replacementGroup));
		expect(state.viewport).not.toMatchObject({ x: -320, y: 160 });
	});

	it('navigates the shared editor view without changing source revisions', () => {
		const project = structuredClone(EMPTY_DEFAULT_PROJECT);
		const child = {
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			type: 'group' as const,
			entry: 'main',
			id: 2,
			exposures: [],
			name: 'child',

			code: ['group child', 'groupEnd'],

			entries: [],
		};
		project.execution = [
			{
				entry: 'main',

				...structuredClone(EMPTY_DEFAULT_PROJECT),
				type: 'group',
				id: 1,
				name: 'parent',
				exposures: [],

				code: ['group parent', 'groupEnd'],
				execution: [child],

				entries: ['main'],
			},
		];
		const { navigation, editing, state, dispose } = setup(project);
		const revision = editing.getRevision();
		const root = state.codeBlockRendering.rootProject.blocks;
		const parent = root.find(block => block.name === 'parent')!;
		const nested = parent.childProject!.blocks.find(block => block.name === 'child')!;
		expect(state.codeBlockRendering.currentProject.blocks).toBe(root);
		expect(() => navigation.openGroup('missing')).toThrow('current group blockId');
		navigation.openGroup(getEditorBlockId(nested));
		expect(state.codeBlockRendering.currentProject.blocks).toBe(nested.childProject?.blocks);
		navigation.goToRoot();
		navigation.openGroup(getEditorBlockId(parent));
		expect(state.codeBlockRendering.currentProject.blocks).toBe(parent.childProject?.blocks);
		expect(state.codeBlockRendering.currentProject.blocks[0].name).toBe('child');
		navigation.openGroup(getEditorBlockId(nested));
		expect(state.codeBlockRendering.currentProject.blocks).toBe(nested.childProject?.blocks);
		navigation.goToParentGroup();
		expect(state.codeBlockRendering.currentProject.blocks).toBe(parent.childProject?.blocks);
		navigation.openGroup(getEditorBlockId(nested));
		navigation.goToRoot();
		navigation.goToParentGroup();
		expect(state.codeBlockRendering.currentProject.blocks).toBe(root);
		expect(editing.getRevision()).toBe(revision);
		dispose();
		expect(() => navigation.goToRoot()).toThrow('disposed');
		const ordinary = setup();
		const module = ordinary.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		expect(() => ordinary.navigation.openGroup(getEditorBlockId(module))).toThrow('not a project group');
	});

	it('keeps pending source edits and an API batch as separate undo steps without delayed duplicates', async () => {
		vi.useFakeTimers();
		try {
			const { editing, state, store } = setup();
			const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
			store.set('codeBlockRendering.selectedCodeBlock', block);
			block.cursor.row = 1;
			block.cursor.col = block.code[1].length;
			applyCodeBlockSourceEdits(store, [
				{ codeBlock: block, code: block.code.map((line, row) => (row === 1 ? `${line}2` : line)) },
			]);
			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [{ type: 'update', blockId: getEditorBlockId(block), code: [...block.code] }],
			});
			expect(state.historyStack).toHaveLength(0);
			editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [
					{ type: 'update', blockId: getEditorBlockId(block), code: ['module original', 'int value 3', 'moduleEnd'] },
				],
			});
			await vi.advanceTimersByTimeAsync(2000);
			expect(state.historyStack).toHaveLength(2);
			editing.undo({ expectedRevision: editing.getRevision() });
			expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!.code).toContain(
				'int value 12'
			);
			editing.undo({ expectedRevision: editing.getRevision() });
			expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!.code).toContain(
				'int value 1'
			);
			editing.redo({ expectedRevision: editing.getRevision() });
			editing.redo({ expectedRevision: editing.getRevision() });
			expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!.code).toContain(
				'int value 3'
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps pending typing separate from ignored env edits and preserves current generated source on restore', async () => {
		vi.useFakeTimers();
		try {
			const { editing, state, store, events } = setup();
			const authored = () => state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'original')!;
			const environment = () => state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'env')!;
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
			expect(state.historyStack).toHaveLength(0);
			// The original typing timer was not canceled or postponed by generated updates or ignored edits.
			await vi.advanceTimersByTimeAsync(500);
			expect(state.historyStack).toHaveLength(1);
			editing.undo({ expectedRevision: editing.getRevision() });
			expect(authored().code).toContain('int value 1');
			expect(environment().code).toContain('; @pos 0 0');
			expect(environment().code).toContain('const GENERATED 1');
			store.set('envConstantContributions.test', ['const GENERATED 2']);
			expect(state.redoStack).toHaveLength(1);
			editing.redo({ expectedRevision: editing.getRevision() });
			expect(authored().code).toContain('int value 12');
			expect(environment().code).toContain('; @pos 0 0');
			expect(environment().code).toContain('const GENERATED 2');
		} finally {
			vi.useRealTimers();
		}
	});

	it('applies API edits without recording history when tracking is disabled', () => {
		const { editing, state, store } = setup();
		store.set('featureFlags.historyTracking', false);
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'delete', blockId: getEditorBlockId(block) }],
		});
		expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'original')).toBe(false);
		expect(state.historyStack).toHaveLength(0);
	});

	it('reports read-only and disposed handles, and does not retain history from a replaced project', () => {
		const { editing, store, state, events, dispose } = setup();
		const revision = editing.getRevision();
		store.set('editorMode', 'view');
		expect(() => editing.undo({ expectedRevision: revision })).toThrow('view mode');
		store.set('editorMode', 'edit');
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
		editing.applyEdits({
			expectedRevision: revision,
			edits: [{ type: 'delete', blockId: getEditorBlockId(target) }],
		});
		events.dispatch('loadProject', { project: structuredClone(EMPTY_DEFAULT_PROJECT) });
		expect(state.historyStack).toHaveLength(0);
		dispose();
		expect(() => editing.getRevision()).toThrow('disposed');
	});
});
