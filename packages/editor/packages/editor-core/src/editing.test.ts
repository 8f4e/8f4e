import initState, {
	createEditorEditingHandle,
	EMPTY_DEFAULT_PROJECT,
	getEditorBlockId,
	serializeToProject,
} from '@8f4e/editor-state';
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
		modules: [{ id: 0, entry: 'main', code: ['module original', 'int value 1', 'moduleEnd'] }],
	}
) {
	const events = initEvents();
	const compilationChanged = vi.fn();
	events.on('compilationInputChanged', compilationChanged);
	const store = initState(events, { runtimeRegistry: {}, initialEditorMode: 'edit', callbacks: {} });
	const editing = createEditorEditingHandle(store, events);
	events.dispatch('loadProject', { project });
	compilationChanged.mockClear();
	cleanups.push(() => {
		editing.dispose();
		store.dispose();
		events.dispose();
	});
	const state = store.getState();
	const blocks = () => {
		const flatten = (list: typeof state.codeBlockRendering.codeBlocks): typeof list =>
			list.flatMap(block => [block, ...flatten(block.nestedProjectCodeBlocks ?? [])]);
		return flatten(state.codeBlockRendering.rootCodeBlocks).map(block => ({ blockId: getEditorBlockId(block), block }));
	};
	const read = () => ({
		revision: editing.handle.getRevision(),
		project: structuredClone(serializeToProject(state)),
		blocks: structuredClone(blocks()),
		canUndo: state.historyStack.length > 0,
	});
	return {
		state,
		blocks,
		read,
		store,
		events,
		editing: editing.handle,
		navigation: editing.navigation,
		dispose: editing.dispose,
		compilationChanged,
	};
}

describe('public editor editing handle', () => {
	it('uses state reads and one undo step for a coordinated edit batch', () => {
		const { editing, store, events, compilationChanged, read } = setup();
		const original = read();
		const target = original.blocks.find(({ block }) => block.name === 'original')!;
		const load = vi.fn();
		events.on('loadProject', load);
		store.getState().viewport.x = 124;
		store.getState().viewport.y = 256;
		const result = editing.applyEdits({
			expectedRevision: original.revision,
			edits: [
				{
					type: 'update',
					blockId: target.blockId,
					code: ['module original', '; @pos 30 40', 'int value 2', 'moduleEnd'],
				},
				{ type: 'insert', code: ['note', '; @pos 60 40', 'Created through the public API', 'noteEnd'] },
			],
		});
		const changed = read();
		expect(changed.project.modules[0].code).toContain('int value 2');
		expect(changed.blocks.find(block => block.blockId === target.blockId)).toMatchObject({
			block: { gridX: 30, gridY: 40 },
		});
		expect(changed.blocks.some(block => block.blockId === result.createdBlockIds[0])).toBe(true);
		expect(store.getState().historyStack).toHaveLength(1);
		expect(store.getState().viewport).toMatchObject({ x: 124, y: 256 });
		expect(compilationChanged).toHaveBeenCalled();
		expect(load).not.toHaveBeenCalled();
		const undo = editing.undo({ expectedRevision: changed.revision });
		expect(read().project.modules[0].code).toContain('int value 1');
		expect(read().project.notes).toHaveLength(0);
		editing.redo({ expectedRevision: undo.revision });
		expect(read().project).toEqual(changed.project);
	});

	it('derives inserted and updated positions from source, including removing @pos and undoing it', () => {
		const { editing, read } = setup();
		const code = ['module placed', '; @pos -12 34', 'moduleEnd'];
		const inserted = editing.applyEdits({
			expectedRevision: read().revision,
			edits: [{ type: 'insert', code }],
		});
		const findPlaced = () => read().blocks.find(block => block.blockId === inserted.createdBlockIds[0])!.block;
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
		expect(findPlaced()).toMatchObject({ code: withoutPos, gridX: 0, gridY: 0 });
		const undone = editing.undo({ expectedRevision: removed.revision });
		expect(findPlaced()).toMatchObject({ code: updatedCode, gridX: 56, gridY: -78 });
		editing.redo({ expectedRevision: undone.revision });
		expect(findPlaced()).toMatchObject({ code: withoutPos, gridX: 0, gridY: 0 });
	});

	it.each([{ directives: [] }, { directives: ['; @pos invalid 3'] }, { directives: ['; @pos 1 2', '; @pos 3 4'] }])(
		'preserves unfinished or missing positioning source on inserts and updates: $directives',
		({ directives }) => {
			const { editing, read } = setup();
			const code = ['module unplaced', ...directives, 'moduleEnd'];
			const original = read();
			const result = editing.applyEdits({
				expectedRevision: original.revision,
				edits: [
					{ type: 'insert', code },
					{ type: 'update', blockId: original.blocks[0].blockId, code },
				],
			});
			for (const { block } of read().blocks.filter(
				block => block.blockId === original.blocks[0].blockId || block.blockId === result.createdBlockIds[0]
			)) {
				expect(block).toMatchObject({ code, gridX: 0, gridY: 0 });
			}
		}
	);

	it('rejects an invalid batch without applying earlier operations or changing history', () => {
		const { editing, store, compilationChanged, read } = setup();
		const before = read();
		expect(() =>
			editing.applyEdits({
				expectedRevision: before.revision,
				edits: [
					{ type: 'delete', blockId: before.blocks[0].blockId },
					{ type: 'delete', blockId: 'missing' },
				],
			})
		).toThrow('current blockId');
		expect(read()).toEqual(before);
		expect(store.getState().historyStack).toHaveLength(0);
		expect(compilationChanged).not.toHaveBeenCalled();
	});

	it('rejects stale revisions after human source edits, layout edits, project replacement, and from another editor', () => {
		const { editing, store, events, read } = setup();
		const before = read();
		const block = store.getState().codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
		store.set('codeBlockRendering.selectedCodeBlock', block);
		store.set('codeBlockRendering.selectedCodeBlock.code', ['module original', 'int value 9', 'moduleEnd']);
		expect(() =>
			editing.applyEdits({
				expectedRevision: before.revision,
				edits: [{ type: 'delete', blockId: before.blocks[0].blockId }],
			})
		).toThrow('getRevision again');
		const sourceRevision = read().revision;
		block.code.splice(1, 0, '; @pos 7 8');
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		expect(read().revision).not.toBe(sourceRevision);
		const current = read();
		events.dispatch('loadProject', { project: current.project });
		expect(read().revision).not.toBe(current.revision);
		expect(() => editing.undo({ expectedRevision: setup().editing.getRevision() })).toThrow('getRevision again');
	});

	it('targets duplicate block IDs in nested projects and preserves the currently viewed group', () => {
		const project = structuredClone(EMPTY_DEFAULT_PROJECT);
		project.modules = [{ id: 0, entry: 'main', code: ['module outer', 'moduleEnd'] }];
		project.groups = [
			{
				...structuredClone(EMPTY_DEFAULT_PROJECT),
				name: 'voice',
				entry: 'main',
				code: ['group voice', 'groupEnd'],
				modules: [{ id: 0, entry: 'main', code: ['module inner', 'moduleEnd'] }],
			},
		];
		const { editing, events, store, read } = setup(project);
		const group = store.getState().codeBlockRendering.rootCodeBlocks.find(block => block.name === 'voice')!;
		events.dispatch('openProjectGroup', { codeBlock: group });
		const snapshot = read();
		const inner = snapshot.blocks.find(({ block }) => block.name === 'inner')!;
		editing.applyEdits({
			expectedRevision: snapshot.revision,
			edits: [
				{ type: 'update', blockId: inner.blockId, code: ['module updatedInner', 'moduleEnd'] },
				{ type: 'insert', projectPath: inner.block.projectPath, code: ['module added', 'moduleEnd'] },
			],
		});
		const after = read();
		expect(after.project.modules[0].code[0]).toBe('module outer');
		expect(after.project.groups[0].modules.map(block => block.code[0])).toContain('module updatedInner');
		expect(store.getState().codeBlockRendering.codeBlocks.some(block => block.name === 'added')).toBe(true);
	});

	it('navigates the shared editor view without changing source revisions', () => {
		const project = structuredClone(EMPTY_DEFAULT_PROJECT);
		const child = {
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			name: 'child',
			entry: 'main',
			code: ['group child', 'groupEnd'],
		};
		project.groups = [
			{
				...structuredClone(EMPTY_DEFAULT_PROJECT),
				name: 'parent',
				entry: 'main',
				code: ['group parent', 'groupEnd'],
				groups: [child],
			},
		];
		const { navigation, store, dispose, read } = setup(project);
		const root = read();
		const parent = root.blocks.find(({ block }) => block.name === 'parent')!;
		const nested = root.blocks.find(({ block }) => block.name === 'child')!;
		expect(store.getState().codeBlockRendering.codeBlocks).toBe(store.getState().codeBlockRendering.rootCodeBlocks);
		expect(() => navigation.openGroup('missing')).toThrow('current group blockId');
		navigation.openGroup(nested.blockId);
		expect(store.getState().codeBlockRendering.codeBlocks).toBe(
			store
				.getState()
				.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'parent')!
				.nestedProjectCodeBlocks!.find(block => block.name === 'child')!.nestedProjectCodeBlocks
		);
		navigation.goToRoot();
		navigation.openGroup(parent.blockId);
		expect(store.getState().codeBlockRendering.codeBlocks).toBe(
			store.getState().codeBlockRendering.rootCodeBlocks.find(block => block.name === 'parent')!.nestedProjectCodeBlocks
		);
		expect(store.getState().codeBlockRendering.codeBlocks[0].name).toBe('child');
		navigation.openGroup(nested.blockId);
		expect(store.getState().codeBlockRendering.codeBlocks).toBe(
			store
				.getState()
				.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'parent')!
				.nestedProjectCodeBlocks!.find(block => block.name === 'child')!.nestedProjectCodeBlocks
		);
		navigation.goToParentGroup();
		expect(store.getState().codeBlockRendering.codeBlocks).toBe(
			store.getState().codeBlockRendering.rootCodeBlocks.find(block => block.name === 'parent')!.nestedProjectCodeBlocks
		);
		navigation.openGroup(nested.blockId);
		navigation.goToRoot();
		navigation.goToParentGroup();
		expect(store.getState().codeBlockRendering.codeBlocks).toBe(store.getState().codeBlockRendering.rootCodeBlocks);
		expect(read().revision).toBe(root.revision);
		dispose();
		expect(() => navigation.goToRoot()).toThrow('disposed');
		const ordinary = setup();
		expect(() => ordinary.navigation.openGroup(ordinary.read().blocks[0].blockId)).toThrow('not a project group');
	});

	it('reports read-only and disposed handles, and does not retain history from a replaced project', () => {
		const { editing, store, events, dispose, read } = setup();
		const snapshot = read();
		store.set('featureFlags.editing', false);
		expect(() => editing.undo({ expectedRevision: snapshot.revision })).toThrow('view mode');
		store.set('featureFlags.editing', true);
		editing.applyEdits({
			expectedRevision: snapshot.revision,
			edits: [{ type: 'delete', blockId: snapshot.blocks[0].blockId }],
		});
		events.dispatch('loadProject', { project: structuredClone(EMPTY_DEFAULT_PROJECT) });
		expect(read().canUndo).toBe(false);
		dispose();
		expect(() => read()).toThrow('disposed');
	});
});
