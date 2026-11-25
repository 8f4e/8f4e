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
	const store = initState(events, { callbacks: {} });
	store.subscribe('compilerInputRevision', compilationChanged);
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	events.dispatch('enterEditMode');
	const editing = createEditorCommandApi(store, events);
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

describe('public editor editing handle', () => {
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
		const ids = state.project.rootLevel.blocks.map(block => block.creationIndex);
		expect(ids).toHaveLength(2);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it.each([{ directives: [] }, { directives: ['; @pos invalid 3'] }, { directives: ['; @pos 1 2', '; @pos 3 4'] }])(
		'preserves unfinished or missing positioning source on inserts and updates: $directives',
		({ directives }) => {
			const { editing, state, events } = setup({
				...structuredClone(EMPTY_DEFAULT_PROJECT),
				execution: [{ type: 'module', id: 0, entry: 'main', code: ['module original', '; @pos 9 12', 'moduleEnd'] }],
			});
			const code = ['module unplaced', ...directives, 'moduleEnd'];
			const originalId = getEditorBlockId(state.project.activeLevel.blocks.find(block => block.name === 'original')!);
			const result = editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [
					{ type: 'insert', code },
					{ type: 'update', blockId: originalId, code },
				],
			});
			const affected = state.project.activeLevel.blocks.filter(
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
			expect(state.project.activeLevel.blocks.find(block => block.creationIndex === 0)).toMatchObject({
				code,
				gridX: 0,
				gridY: 0,
			});
		}
	);

	it('rejects an invalid batch without applying earlier operations or publishing a change', () => {
		const { editing, state, compilationChanged, events } = setup();
		const before = serializeToProject(state);
		const revision = editing.getRevision();
		const nextId = state.project.nextCodeBlockCreationIndex;
		const target = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
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
		expect(compilationChanged).not.toHaveBeenCalled();
		expect(beforeEdit).not.toHaveBeenCalled();
		expect(state.project.nextCodeBlockCreationIndex).toBe(nextId);
		expect(state.project.activeLevel.blocks).toContain(target);
	});

	it('folds repeated updates and ignores writes to read-only blocks before deciding whether to publish', () => {
		const { editing, state, events, compilationChanged } = setup();
		const target = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
		const env = state.project.activeLevel.blocks.find(block => block.name === 'env')!;
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
		expect(compilationChanged).not.toHaveBeenCalled();
		expect(beforeEdit).not.toHaveBeenCalled();
	});

	it('does not reject incomplete or malformed program source as an invalid editing command', () => {
		const { editing, state } = setup();
		const target = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
		const malformed = ['module original', 'group invalidNestedInstruction'];
		const result = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'update', blockId: getEditorBlockId(target), code: malformed }],
		});
		expect(target.code).toEqual(malformed);
		expect(state.project.activeLevel.blocks).toContain(target);
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
			const project = state.project.activeLevel;
			const target = project.blocks.find(block => block.name === 'original')!;
			const blockId = getEditorBlockId(target);
			store.set('project.selectedCodeBlock', target);

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
			expect(state.project.selectedCodeBlock).toBe(target);
		}
	);

	it('preserves a module entry while its source is temporarily incomplete', () => {
		const { editing, state } = setup({
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			entries: ['alternate'],
			execution: [{ type: 'module', id: 0, entry: 'alternate', code: ['module original', 'moduleEnd'] }],
		});
		const target = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
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
		expect(state.project.rootLevel.entries).toEqual(['alternate']);
	});

	it('accepts malformed source but rejects explicit entry membership for non-execution blocks', () => {
		const { editing, state, compilationChanged } = setup();
		const target = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
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
		expect(compilationChanged).not.toHaveBeenCalled();
	});

	it('rejects a batch which both updates and deletes an existing block before committing either operation', () => {
		const { editing, state, compilationChanged } = setup();
		const target = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
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
		expect(compilationChanged).not.toHaveBeenCalled();
	});

	it('rejects a batch with a missing or non-group insertion owner before committing any operations', () => {
		const { editing, state, compilationChanged } = setup();
		const target = state.project.rootLevel.blocks.find(block => block.name === 'original')!;
		const revision = editing.getRevision();
		const before = serializeToProject(state);
		for (const { groupBlockId, code } of [
			{ groupBlockId: 'missing', code: 'block_not_found' },
			{ groupBlockId: getEditorBlockId(target), code: 'invalid_edit' },
		]) {
			expect(() =>
				editing.applyEdits({
					expectedRevision: revision,
					edits: [
						{ type: 'insert', code: ['note root', 'noteEnd'] },
						{ type: 'insert', groupBlockId, code: ['note misplaced', 'noteEnd'] },
					],
				})
			).toThrow(expect.objectContaining({ code, revision }));
			expect(editing.getRevision()).toBe(revision);
			expect(serializeToProject(state)).toEqual(before);
			expect(compilationChanged).not.toHaveBeenCalled();
		}
	});

	it('rejects stale revisions after human source edits, layout edits, project replacement, and from another editor', () => {
		const { editing, store, state, events } = setup();
		const revision = editing.getRevision();
		const block = state.project.activeLevel.blocks.find(block => block.name === 'original')!;
		store.set('project.selectedCodeBlock', block);
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
		expect(() =>
			editing.applyEdits({
				expectedRevision: setup().editing.getRevision(),
				edits: [{ type: 'insert', code: ['note foreign', 'noteEnd'] }],
			})
		).toThrow('getRevision again');
	});

	it('inserts into a copied group by owning block handle while omitted ownership targets the root', () => {
		const { editing, navigation, state, store, group: original } = setupGroup('voice');
		const [copy] = insertCodeBlocks(store, { x: 240, y: 80, blocks: serializeCodeBlocks([original], original) });
		expect(original.childLevel!.path).toBe(copy.childLevel!.path);
		navigation.openGroup(getEditorBlockId(copy));
		const result = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{ type: 'insert', groupBlockId: getEditorBlockId(copy), code: ['note nested', 'noteEnd'] },
				{ type: 'insert', code: ['note root', 'noteEnd'] },
			],
		});
		expect(state.project.activeLevel).toBe(copy.childLevel);
		expect(original.childLevel!.blocks.map(block => block.name)).toEqual(['sample']);
		expect(copy.childLevel!.blocks.map(block => block.name)).toEqual(['sample', 'nested']);
		const nestedNote = copy.childLevel!.blocks.find(block => block.name === 'nested')!;
		const rootNote = state.project.rootLevel.blocks.find(block => block.name === 'root')!;
		expect(nestedNote.projectPath).toBe(original.childLevel!.path);
		expect(rootNote.projectPath).toBe('');
		expect(result.createdBlockIds).toEqual([getEditorBlockId(nestedNote), getEditorBlockId(rootNote)]);
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
		const root = state.project.rootLevel.blocks;
		const parent = root.find(block => block.name === 'parent')!;
		const nested = parent.childLevel!.blocks.find(block => block.name === 'child')!;
		expect(state.project.activeLevel.blocks).toBe(root);
		expect(() => navigation.openGroup('missing')).toThrow('current group blockId');
		navigation.openGroup(getEditorBlockId(nested));
		expect(state.project.activeLevel.blocks).toBe(nested.childLevel?.blocks);
		navigation.goToRoot();
		navigation.openGroup(getEditorBlockId(parent));
		expect(state.project.activeLevel.blocks).toBe(parent.childLevel?.blocks);
		expect(state.project.activeLevel.blocks[0].name).toBe('child');
		navigation.openGroup(getEditorBlockId(nested));
		expect(state.project.activeLevel.blocks).toBe(nested.childLevel?.blocks);
		navigation.goToParentGroup();
		expect(state.project.activeLevel.blocks).toBe(parent.childLevel?.blocks);
		navigation.openGroup(getEditorBlockId(nested));
		navigation.goToRoot();
		navigation.goToParentGroup();
		expect(state.project.activeLevel.blocks).toBe(root);
		expect(editing.getRevision()).toBe(revision);
		dispose();
		expect(() => navigation.goToRoot()).toThrow('disposed');
		const ordinary = setup();
		const module = ordinary.state.project.activeLevel.blocks.find(block => block.name === 'original')!;
		expect(() => ordinary.navigation.openGroup(getEditorBlockId(module))).toThrow('not a project group');
	});
});
