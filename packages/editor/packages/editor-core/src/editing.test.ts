import initState, { createEditorEditingHandle, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
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
	return {
		store,
		events,
		editing: editing.handle,
		navigation: editing.navigation,
		dispose: editing.dispose,
		compilationChanged,
	};
}

describe('public editor editing handle', () => {
	it('returns the full existing block model as a detached graph, including Maps and wire references', () => {
		const { editing, store } = setup();
		const live = store.getState().codeBlockRendering.rootCodeBlocks.find(block => block.name === 'original')!;
		live.gaps.set(0, { size: 2 });
		live.widgets.inputs.push({
			codeBlock: live,
			width: 1,
			height: 1,
			x: 0,
			y: 0,
			wireX: 0,
			wireY: 0,
			id: 'self',
			allocationUnitAddress: 0,
		});
		const { block } = editing.getSnapshot().blocks.find(({ block }) => block.name === 'original')!;
		expect(block).not.toBe(live);
		expect(block).toEqual(live);
		expect(block.widgets.inputs[0].codeBlock).toBe(block);
		block.gaps.get(0)!.size = 99;
		block.widgets.inputs[0].codeBlock.code[0] = 'changed snapshot';
		expect(live.gaps.get(0)!.size).toBe(2);
		expect(live.code[0]).toBe('module original');
	});
	it('returns detached source snapshots and uses one undo step for a coordinated edit batch', () => {
		const { editing, store, events, compilationChanged } = setup();
		const original = editing.getSnapshot();
		const target = original.blocks.find(({ block }) => block.name === 'original')!;
		original.project.modules[0].code[1] = 'corrupt';
		target.block.code[1] = 'corrupt';
		expect(editing.getSnapshot().project.modules[0].code[1]).toBe('int value 1');
		const load = vi.fn();
		events.on('loadProject', load);
		store.getState().viewport.x = 124;
		store.getState().viewport.y = 256;
		const result = editing.applyEdits({
			expectedRevision: original.revision,
			edits: [
				{ type: 'update', blockId: target.blockId, code: ['module original', 'int value 2', 'moduleEnd'] },
				{ type: 'move', blockId: target.blockId, x: 30, y: 40 },
				{ type: 'insert', code: ['note', 'Created through the public API', 'noteEnd'], x: 60, y: 40 },
			],
		});
		const changed = editing.getSnapshot();
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
		expect(editing.getSnapshot().project.modules[0].code).toContain('int value 1');
		expect(editing.getSnapshot().project.notes).toHaveLength(0);
		editing.redo({ expectedRevision: undo.revision });
		expect(editing.getSnapshot().project).toEqual(changed.project);
	});

	it('rejects an invalid batch without applying earlier operations or changing history', () => {
		const { editing, store, compilationChanged } = setup();
		const before = editing.getSnapshot();
		expect(() =>
			editing.applyEdits({
				expectedRevision: before.revision,
				edits: [
					{ type: 'delete', blockId: before.blocks[0].blockId },
					{ type: 'move', blockId: 'missing', x: 0, y: 0 },
				],
			})
		).toThrow('current blockId');
		expect(editing.getSnapshot()).toEqual(before);
		expect(store.getState().historyStack).toHaveLength(0);
		expect(compilationChanged).not.toHaveBeenCalled();
	});

	it('rejects snapshots after human source edits, layout edits, project replacement, and from another editor', () => {
		const { editing, store, events } = setup();
		const before = editing.getSnapshot();
		const block = store.getState().codeBlockRendering.codeBlocks.find(block => block.name === 'original')!;
		store.set('codeBlockRendering.selectedCodeBlock', block);
		store.set('codeBlockRendering.selectedCodeBlock.code', ['module original', 'int value 9', 'moduleEnd']);
		expect(() =>
			editing.applyEdits({
				expectedRevision: before.revision,
				edits: [{ type: 'delete', blockId: before.blocks[0].blockId }],
			})
		).toThrow('getSnapshot again');
		const sourceRevision = editing.getSnapshot().revision;
		block.code.splice(1, 0, '; @pos 7 8');
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		expect(editing.getSnapshot().revision).not.toBe(sourceRevision);
		const current = editing.getSnapshot();
		events.dispatch('loadProject', { project: current.project });
		expect(editing.getSnapshot().revision).not.toBe(current.revision);
		expect(() => editing.undo({ expectedRevision: setup().editing.getSnapshot().revision })).toThrow(
			'getSnapshot again'
		);
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
		const { editing, events, store } = setup(project);
		const group = store.getState().codeBlockRendering.rootCodeBlocks.find(block => block.name === 'voice')!;
		events.dispatch('openProjectGroup', { codeBlock: group });
		const snapshot = editing.getSnapshot();
		const inner = snapshot.blocks.find(({ block }) => block.name === 'inner')!;
		editing.applyEdits({
			expectedRevision: snapshot.revision,
			edits: [
				{ type: 'update', blockId: inner.blockId, code: ['module updatedInner', 'moduleEnd'] },
				{ type: 'insert', projectPath: inner.block.projectPath, code: ['module added', 'moduleEnd'] },
			],
		});
		const after = editing.getSnapshot();
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
		const { editing, navigation, store, dispose } = setup(project);
		const root = editing.getSnapshot();
		const parent = root.blocks.find(({ block }) => block.name === 'parent')!;
		const nested = root.blocks.find(({ block }) => block.name === 'child')!;
		expect(root.projectPath).toBe('');
		expect(() => navigation.openGroup('missing')).toThrow('current group blockId');
		navigation.openGroup(nested.blockId);
		expect(editing.getSnapshot().projectPath).toBe('parent/child');
		navigation.goToRoot();
		navigation.openGroup(parent.blockId);
		expect(editing.getSnapshot().projectPath).toBe('parent');
		expect(store.getState().codeBlockRendering.codeBlocks[0].name).toBe('child');
		navigation.openGroup(nested.blockId);
		expect(editing.getSnapshot().projectPath).toBe('parent/child');
		navigation.goToParentGroup();
		expect(editing.getSnapshot().projectPath).toBe('parent');
		navigation.openGroup(nested.blockId);
		navigation.goToRoot();
		navigation.goToParentGroup();
		expect(editing.getSnapshot().projectPath).toBe('');
		expect(editing.getSnapshot().revision).toBe(root.revision);
		dispose();
		expect(() => navigation.goToRoot()).toThrow('disposed');
		const ordinary = setup();
		expect(() => ordinary.navigation.openGroup(ordinary.editing.getSnapshot().blocks[0].blockId)).toThrow(
			'not a project group'
		);
	});

	it('reports read-only and disposed handles, and does not retain history from a replaced project', () => {
		const { editing, store, events, dispose } = setup();
		const snapshot = editing.getSnapshot();
		store.set('featureFlags.editing', false);
		expect(() => editing.undo({ expectedRevision: snapshot.revision })).toThrow('view mode');
		store.set('featureFlags.editing', true);
		editing.applyEdits({
			expectedRevision: snapshot.revision,
			edits: [{ type: 'delete', blockId: snapshot.blocks[0].blockId }],
		});
		events.dispatch('loadProject', { project: structuredClone(EMPTY_DEFAULT_PROJECT) });
		expect(editing.getSnapshot().canUndo).toBe(false);
		dispose();
		expect(() => editing.getSnapshot()).toThrow('disposed');
	});
});
