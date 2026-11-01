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
		execution: [{ type: 'module', id: 0, entry: 'main', code: ['module original', 'int value 1', 'moduleEnd'] }],
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
	it('assigns generated environment blocks an identity distinct from root groups', () => {
		const { state } = setup({
			...structuredClone(EMPTY_DEFAULT_PROJECT),
			execution: [
				{
					...structuredClone(EMPTY_DEFAULT_PROJECT),
					type: 'group',
					id: 0,
					name: 'synth',
					entry: 'main',
					exposures: [],
					code: ['group synth', 'groupEnd'],
				},
			],
		});
		const ids = state.codeBlockRendering.rootProject.blocks.map(block => block.creationIndex);
		expect(ids).toHaveLength(2);
		expect(new Set(ids).size).toBe(ids.length);
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
					...structuredClone(EMPTY_DEFAULT_PROJECT),
					type: 'group',
					id: 2,
					name: 'synth',
					entry: 'main',
					exposures: [],
					code: ['group synth', 'groupEnd'],
					execution: [
						module(3, 'voiceA'),
						{
							...structuredClone(EMPTY_DEFAULT_PROJECT),
							type: 'group',
							id: 4,
							name: 'oscillator',
							entry: 'main',
							exposures: [],
							code: ['group oscillator', 'groupEnd'],
							execution: [module(5, 'tick')],
						},
						module(6, 'voiceB'),
					],
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
		const { editing, state, compilationChanged } = setup();
		const before = serializeToProject(state);
		const revision = editing.getRevision();
		const target = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
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
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
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
		project.execution = [
			{ type: 'module', id: 0, entry: 'main', code: ['module outer', 'moduleEnd'] },
			{
				...structuredClone(EMPTY_DEFAULT_PROJECT),
				type: 'group',
				id: 1,
				name: 'voice',
				exposures: [],
				entry: 'main',
				code: ['group voice', 'groupEnd'],
				execution: [{ type: 'module', id: 0, entry: 'main', code: ['module inner', 'moduleEnd'] }],
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
				{ type: 'insert', projectPath: inner.projectPath, code: ['module added', 'moduleEnd'] },
			],
		});
		expect(state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'outer')!.code[0]).toBe(
			'module outer'
		);
		expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'updatedInner')).toBe(true);
		expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'added')).toBe(true);
		expect(state.codeBlockRendering.currentProject.path).toBe('voice');
		expect(state.codeBlockRendering.selectedCodeBlock?.name).toBe('updatedInner');
		expect(state.codeBlockRendering.selectedCodeBlock).not.toBe(inner);
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
			id: 2,
			exposures: [],
			name: 'child',
			entry: 'main',
			code: ['group child', 'groupEnd'],
		};
		project.execution = [
			{
				...structuredClone(EMPTY_DEFAULT_PROJECT),
				type: 'group',
				id: 1,
				name: 'parent',
				exposures: [],
				entry: 'main',
				code: ['group parent', 'groupEnd'],
				execution: [child],
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

	it('keeps pending typing and an API batch as separate undo steps without delayed duplicates', async () => {
		vi.useFakeTimers();
		try {
			const { editing, state, store, events } = setup();
			const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'original')!;
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
