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
	const store = initState(events, { callbacks: {} });
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
	it('uses state reads and one undo step for a coordinated edit batch', () => {
		const { editing, state, events, compilationChanged } = setup();
		const target = state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
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
		expect(state.codeBlockRendering.codeBlocks.find(block => getEditorBlockId(block) === targetId)).toMatchObject({
			code: ['module original', '; @pos 30 40', 'int value 2', 'moduleEnd'],
			gridX: 30,
			gridY: 40,
		});
		expect(
			state.codeBlockRendering.codeBlocks.some(block => getEditorBlockId(block) === result.createdBlockIds[0])
		).toBe(true);
		expect(state.historyStack).toHaveLength(1);
		expect(state.viewport).toMatchObject({ x: 124, y: 256 });
		expect(compilationChanged).toHaveBeenCalled();
		expect(load).not.toHaveBeenCalled();
		const undo = editing.undo({ expectedRevision: result.revision });
		expect(state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!.code).toContain('int value 1');
		expect(state.codeBlockRendering.codeBlocks.filter(block => block.blockType === 'note')).toHaveLength(0);
		editing.redo({ expectedRevision: undo.revision });
		expect(serializeToProject(state)).toEqual(changedProject);
	});

	it('derives inserted and updated positions from source, including removing @pos and undoing it', () => {
		const { editing, state } = setup();
		const code = ['module placed', '; @pos -12 34', 'moduleEnd'];
		const inserted = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'insert', code }],
		});
		const findPlaced = () =>
			state.codeBlockRendering.codeBlocks.find(block => getEditorBlockId(block) === inserted.createdBlockIds[0])!;
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
			const { editing, state } = setup();
			const code = ['module unplaced', ...directives, 'moduleEnd'];
			const originalId = getEditorBlockId(
				state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!
			);
			const result = editing.applyEdits({
				expectedRevision: editing.getRevision(),
				edits: [
					{ type: 'insert', code },
					{ type: 'update', blockId: originalId, code },
				],
			});
			const affected = state.codeBlockRendering.codeBlocks.filter(
				block => getEditorBlockId(block) === originalId || getEditorBlockId(block) === result.createdBlockIds[0]
			);
			expect(affected).toHaveLength(2);
			for (const block of affected) {
				expect(block).toMatchObject({ code, gridX: 0, gridY: 0 });
			}
		}
	);

	it('rejects an invalid batch without applying earlier operations or changing history', () => {
		const { editing, state, compilationChanged } = setup();
		const before = serializeToProject(state);
		const revision = editing.getRevision();
		const target = state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
		expect(() =>
			editing.applyEdits({
				expectedRevision: revision,
				edits: [
					{ type: 'delete', blockId: getEditorBlockId(target) },
					{ type: 'delete', blockId: 'missing' },
				],
			})
		).toThrow('current blockId');
		expect(serializeToProject(state)).toEqual(before);
		expect(editing.getRevision()).toBe(revision);
		expect(state.historyStack).toHaveLength(0);
		expect(compilationChanged).not.toHaveBeenCalled();
	});

	it('rejects stale revisions after human source edits, layout edits, project replacement, and from another editor', () => {
		const { editing, store, state, events } = setup();
		const revision = editing.getRevision();
		const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
		store.set('codeBlockRendering.selectedCodeBlock', block);
		block.cursor.row = 1;
		block.cursor.col = block.code[1].length;
		events.dispatch('insertText', { text: '9' });
		expect(() =>
			editing.applyEdits({
				expectedRevision: revision,
				edits: [{ type: 'delete', blockId: getEditorBlockId(block) }],
			})
		).toThrow('getRevision again');
		const sourceRevision = editing.getRevision();
		events.dispatch('mousedown', { x: block.x + 8, y: block.y + 8 });
		events.dispatch('mousemove', { movementX: 16, movementY: 32 });
		events.dispatch('mouseup');
		expect(editing.getRevision()).not.toBe(sourceRevision);
		const currentRevision = editing.getRevision();
		events.dispatch('loadProject', { project: serializeToProject(state) });
		expect(editing.getRevision()).not.toBe(currentRevision);
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
		const { editing, events, state } = setup(project);
		const group = state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'voice')!;
		events.dispatch('openProjectGroup', { codeBlock: group });
		const inner = state.codeBlockRendering.codeBlocks.find(block => block.name === 'inner')!;
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{ type: 'update', blockId: getEditorBlockId(inner), code: ['module updatedInner', 'moduleEnd'] },
				{ type: 'insert', projectPath: inner.projectPath, code: ['module added', 'moduleEnd'] },
			],
		});
		expect(state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'outer')!.code[0]).toBe('module outer');
		expect(state.codeBlockRendering.codeBlocks.some(block => block.name === 'updatedInner')).toBe(true);
		expect(state.codeBlockRendering.codeBlocks.some(block => block.name === 'added')).toBe(true);
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
		const { navigation, editing, state, dispose } = setup(project);
		const revision = editing.getRevision();
		const root = state.codeBlockRendering.rootCodeBlocks;
		const parent = root.find(block => block.name === 'parent')!;
		const nested = parent.nestedProjectCodeBlocks!.find(block => block.name === 'child')!;
		expect(state.codeBlockRendering.codeBlocks).toBe(root);
		expect(() => navigation.openGroup('missing')).toThrow('current group blockId');
		navigation.openGroup(getEditorBlockId(nested));
		expect(state.codeBlockRendering.codeBlocks).toBe(nested.nestedProjectCodeBlocks);
		navigation.goToRoot();
		navigation.openGroup(getEditorBlockId(parent));
		expect(state.codeBlockRendering.codeBlocks).toBe(parent.nestedProjectCodeBlocks);
		expect(state.codeBlockRendering.codeBlocks[0].name).toBe('child');
		navigation.openGroup(getEditorBlockId(nested));
		expect(state.codeBlockRendering.codeBlocks).toBe(nested.nestedProjectCodeBlocks);
		navigation.goToParentGroup();
		expect(state.codeBlockRendering.codeBlocks).toBe(parent.nestedProjectCodeBlocks);
		navigation.openGroup(getEditorBlockId(nested));
		navigation.goToRoot();
		navigation.goToParentGroup();
		expect(state.codeBlockRendering.codeBlocks).toBe(root);
		expect(editing.getRevision()).toBe(revision);
		dispose();
		expect(() => navigation.goToRoot()).toThrow('disposed');
		const ordinary = setup();
		const module = ordinary.state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
		expect(() => ordinary.navigation.openGroup(getEditorBlockId(module))).toThrow('not a project group');
	});

	it('keeps pending typing and an API batch as separate undo steps without delayed duplicates', async () => {
		vi.useFakeTimers();
		try {
			const { editing, state, store, events } = setup();
			const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
			store.set('codeBlockRendering.selectedCodeBlock', block);
			block.cursor.row = 1;
			block.cursor.col = block.code[1].length;
			events.dispatch('insertText', { text: '2' });
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
			expect(state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!.code).toContain(
				'int value 12'
			);
			editing.undo({ expectedRevision: editing.getRevision() });
			expect(state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!.code).toContain(
				'int value 1'
			);
			editing.redo({ expectedRevision: editing.getRevision() });
			editing.redo({ expectedRevision: editing.getRevision() });
			expect(state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!.code).toContain(
				'int value 3'
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('applies API edits without recording history when tracking is disabled', () => {
		const { editing, state, store } = setup();
		store.set('featureFlags.historyTracking', false);
		const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [{ type: 'delete', blockId: getEditorBlockId(block) }],
		});
		expect(state.codeBlockRendering.codeBlocks.some(block => block.name === 'original')).toBe(false);
		expect(state.historyStack).toHaveLength(0);
	});

	it('reports read-only and disposed handles, and does not retain history from a replaced project', () => {
		const { editing, store, state, events, dispose } = setup();
		const revision = editing.getRevision();
		store.set('editorMode', 'view');
		expect(() => editing.undo({ expectedRevision: revision })).toThrow('view mode');
		store.set('editorMode', 'edit');
		const target = state.codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
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
