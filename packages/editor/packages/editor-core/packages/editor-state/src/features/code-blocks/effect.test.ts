import { EventEmitter } from 'node:events';
import type { EditorLifecycleEvents, EventDispatcher } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-loading/emptyDefaultProject';
import initState, { setGridSize, subscribeToBlockPreparation } from '~/index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(initializeGrid = true) {
	const emitter = new EventEmitter();
	const events: EventDispatcher = {
		on: emitter.on.bind(emitter),
		off: emitter.off.bind(emitter),
		dispatch: emitter.emit.bind(emitter),
	};
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	cleanups.push(store.dispose);
	events.dispatch('resize', { canvasWidth: 200, canvasHeight: 200 });
	if (initializeGrid) setGridSize(state, events, { vGrid: 8, hGrid: 16 });
	const load = (project: ProjectObjectModel) => events.dispatch('loadProject', { project });
	const loadSource = (source: string) => load(parseProjectSource(`8f4e/v1\n${source}`));
	const block = (name: string) => state.codeBlockRendering.currentProject.blocks.find(block => block.name === name)!;
	return { store, state, events, load, loadSource, block };
}

describe('code block rendering cursor selection', () => {
	it.each(['view', 'edit'] as const)('updates shared source selection through the store in %s mode', editorMode => {
		const { store, state, events, load } = setup();
		load(EMPTY_DEFAULT_PROJECT);
		const {
			insertedBlocks: [selectedBlock],
		} = store.projectEdits.apply({
			inserts: [{ project: state.codeBlockRendering.rootProject, source: { code: ['; @tab 4', '\tvalue', 'two'] } }],
		});
		if (editorMode === 'edit') events.dispatch('enterEditMode');
		store.set('codeBlockRendering.selectedCodeBlock', selectedBlock);
		const onSelectedRowChanged = vi.fn();
		store.subscribe('codeBlockRendering.selectedCodeBlock.cursor.row', onSelectedRowChanged);

		events.dispatch('codeBlockPointerDown', {
			relativeX: 8 * 8,
			relativeY: state.viewport.hGrid,
			codeBlock: selectedBlock,
		});

		expect(state.editorMode).toBe(editorMode);
		expect(selectedBlock.cursor).toEqual({ row: 1, col: 2, y: 16 });
		expect(onSelectedRowChanged).toHaveBeenCalledWith(1);
	});

	it('keeps folded source selection and gap geometry available without an editing plugin', () => {
		const { store, state, events, loadSource, block } = setup();
		loadSource('note test\n; @hide\n; @tab 4\n\tvalue\nnoteEnd');
		const note = block('test');
		expect(note.isCollapsed).toBe(true);
		const contribution = store.layout.createContribution();
		cleanups.push(contribution.dispose);
		contribution.update(note, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }] });
		store.set('codeBlockRendering.selectedCodeBlock', note);
		expect(note.isCollapsed).toBe(false);
		setGridSize(state, events, { vGrid: 12, hGrid: 24 });
		events.dispatch('codeBlockPointerDown', { codeBlock: note, relativeX: 96, relativeY: 132 });
		expect(note.cursor).toEqual({ row: 3, col: 2, y: 120 });
		expect(state.editorMode).toBe('view');
	});
});

describe('code block rendering project loading', () => {
	it('renders root project-scope source as an editable code block', () => {
		const { state, load } = setup();
		load({ ...EMPTY_DEFAULT_PROJECT, code: ['pass env'] });
		expect(state.codeBlockRendering.currentProject.blocks.find(block => block.isProjectScope)).toMatchObject({
			code: ['pass env'],
			isProjectScope: true,
			projectPath: '',
		});
	});

	it('renders project-level includes blocks from imported project state', () => {
		const { state, load } = setup();
		const includesBlock = ['includes', 'include std/events/risingEdge', 'includesEnd'];
		load({
			...EMPTY_DEFAULT_PROJECT,
			includes: [{ id: 0, code: includesBlock }],
			execution: [{ type: 'module', id: 1, code: ['module main', 'moduleEnd'], entry: 'main' }],
		});
		expect(state.codeBlockRendering.currentProject.blocks).toHaveLength(3);
		expect(state.codeBlockRendering.currentProject.blocks.find(block => block.blockType === 'includes')?.code).toEqual(
			includesBlock
		);
	});

	it('renders root blocks and project-group blocks while retaining nested slices', () => {
		const { state, loadSource, block } = setup();
		loadSource(`entry main
module root
moduleEnd
group Audio
; keep this comment
expose level &voice:level
entry main
module voice
moduleEnd
entryEnd
groupEnd
entryEnd`);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(state.codeBlockRendering.rootProject.blocks);
		expect(state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['env', 'root', 'Audio']);
		const group = block('Audio');
		expect(group.projectPath).toBe('');
		expect(group.code).toEqual(['group Audio', '; keep this comment', 'expose level &voice:level', 'groupEnd']);
		expect(group.childProject?.blocks).toHaveLength(1);
		expect(group.childProject?.blocks[0]).toMatchObject({
			name: 'voice',
			entry: 'main',
			projectPath: 'Audio',
			code: ['module voice', 'moduleEnd'],
		});
		expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'voice')).toBe(false);
	});

	it('retains imported entry membership in root and nested project views', () => {
		const { state, events, loadSource, block } = setup();
		loadSource(`entry main
group audio
; @pos 10 20
entry main
group voices
; @pos 30 40
entry main
module voice
; @pos 50 60
float out
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd
entry test
group checks
; @pos -20 -10
entry main
entryEnd
groupEnd
entryEnd`);
		const root = state.codeBlockRendering.rootProject.blocks;
		const audio = block('audio');
		expect(audio.entry).toBe('main');
		expect(state.codeBlockRendering.currentProject.entries).toEqual(['main', 'test']);
		expect(block('checks').entry).toBe('test');

		events.dispatch('openProjectGroup', { codeBlock: audio });
		const voices = block('voices');
		expect(state.codeBlockRendering.currentProject.entries).toEqual(['main']);
		expect(voices.entry).toBe('main');

		events.dispatch('openProjectGroup', { codeBlock: voices });
		expect(state.codeBlockRendering.currentProject.blocks[0].name).toBe('voice');
		expect(state.codeBlockRendering.currentProject.entries).toEqual(['main']);
		expect(block('voice').entry).toBe('main');

		events.dispatch('goToParentProjectGroup');
		events.dispatch('goToParentProjectGroup');
		expect(state.codeBlockRendering.currentProject.blocks).toBe(root);
		expect(state.codeBlockRendering.currentProject.entries).toEqual(['main', 'test']);
	});

	it('resets the rendered slice pointer to the new root when a project reloads', () => {
		const { state, events, loadSource, block } = setup();
		loadSource('entry main\ngroup Audio\nentry main\nmodule voice\nmoduleEnd\nentryEnd\ngroupEnd\nentryEnd');
		expect(state.compilerInputRevision).toBe(1);
		const firstRoot = state.codeBlockRendering.rootProject.blocks;
		events.dispatch('openProjectGroup', { codeBlock: block('Audio') });
		expect(state.codeBlockRendering.currentProject.path).toBe('Audio');

		loadSource('entry main\nmodule replacement\nmoduleEnd\nentryEnd');

		expect(state.codeBlockRendering.rootProject.blocks).not.toBe(firstRoot);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(state.codeBlockRendering.rootProject.blocks);
		expect(state.compilerInputRevision).toBe(2);
		expect(state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['env', 'replacement']);
	});

	it('resolves initial placement with settled project layout without selecting a block', () => {
		const { state, events, loadSource, block } = setup();
		const resolvePosition = vi.fn((request: EditorLifecycleEvents['resolveInitialProjectViewport']) => {
			expect(request.project).toBe(state.codeBlockRendering.currentProject);
			const main = block('main');
			expect(main).toMatchObject({ x: 80, y: 320, height: 48 });
			expect(main.width).toBeGreaterThan(0);
			request.position = { x: 80, y: 320 };
		});
		events.on('resolveInitialProjectViewport', resolvePosition);
		loadSource('entry main\nmodule main\n; @pos 10 20\nmoduleEnd\nentryEnd');
		expect(state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['env', 'main']);
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(state.viewport).toMatchObject({ x: 80, y: 320 });
		expect(resolvePosition).toHaveBeenCalledOnce();
	});
});

describe('code block rendering @alwaysOnTop live edits', () => {
	it('re-partitions codeBlocks when @alwaysOnTop is added via live code edit', () => {
		const { store, state, loadSource, block } = setup();
		loadSource(
			'entry main\nmodule normalA\nmoduleEnd\nmodule normalB\nmoduleEnd\nmodule topA\n; @alwaysOnTop\nmoduleEnd\nentryEnd'
		);
		const normalA = block('normalA');
		const codeBlocks = state.codeBlockRendering.currentProject.blocks;
		store.set('codeBlockRendering.selectedCodeBlock', normalA);
		store.projectEdits.apply({
			updates: [{ codeBlock: normalA, code: ['module normalA', '; @alwaysOnTop', 'moduleEnd'] }],
		});
		expect(normalA.alwaysOnTop).toBe(true);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(codeBlocks);
		expect(codeBlocks.map(block => block.name)).toEqual(['env', 'normalB', 'normalA', 'topA']);
	});

	it('re-partitions codeBlocks when @alwaysOnTop is removed from the last of multiple top blocks via live code edit', () => {
		const { store, state, loadSource, block } = setup();
		loadSource(
			'entry main\nmodule normalA\nmoduleEnd\nmodule normalB\nmoduleEnd\nmodule topA\n; @alwaysOnTop\nmoduleEnd\nmodule topB\n; @alwaysOnTop\nmoduleEnd\nentryEnd'
		);
		const topB = block('topB');
		const codeBlocks = state.codeBlockRendering.currentProject.blocks;
		store.set('codeBlockRendering.selectedCodeBlock', topB);
		store.projectEdits.apply({ updates: [{ codeBlock: topB, code: ['module topB', 'moduleEnd'] }] });
		expect(topB.alwaysOnTop).toBe(false);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(codeBlocks);
		expect(codeBlocks.map(block => block.name)).toEqual(['env', 'normalA', 'normalB', 'topB', 'topA']);
	});
});

describe('code block layout invalidation', () => {
	it('does not invalidate layouts for compilation progress or results', () => {
		const { store, state, events, loadSource } = setup();
		loadSource('entry main\nmodule main\nmoduleEnd\nentryEnd');
		const onLayoutsChanged = vi.fn();
		events.on('codeBlockLayoutsChanged', onLayoutsChanged);

		store.set('compiler.isCompiling', true);
		store.set('compiler.isCompiling', false);
		expect(onLayoutsChanged).not.toHaveBeenCalled();

		store.set('compiler.isCompiling', true);
		store.set('compiler.result', { ...state.compiler.result, inputRevision: state.compilerInputRevision });
		store.set('compiler.isCompiling', false);
		expect(onLayoutsChanged).not.toHaveBeenCalled();
	});

	it('supports explicit data-dependent block preparation without recalculating layout', () => {
		const { store, state, events, loadSource, block } = setup(false);
		loadSource('entry main\ngroup child\nentry main\nmodule voice\nmoduleEnd\nentryEnd\ngroupEnd\nentryEnd');
		const prepare = vi.fn();
		const unsubscribe = subscribeToBlockPreparation(store, store.layout, 'compiler.result', prepare);
		cleanups.push(unsubscribe);
		const onLayoutsChanged = vi.fn();
		events.on('codeBlockLayoutsChanged', onLayoutsChanged);

		store.set('compiler.result', { ...state.compiler.result, inputRevision: state.compilerInputRevision });
		expect(prepare).not.toHaveBeenCalled();
		expect(onLayoutsChanged).not.toHaveBeenCalled();

		setGridSize(state, events, { vGrid: 8, hGrid: 16 });
		expect(prepare).toHaveBeenCalledWith({ codeBlock: block('child'), state });
		prepare.mockClear();
		onLayoutsChanged.mockClear();

		store.set('compiler.result', { ...state.compiler.result });
		expect(prepare.mock.calls.map(([context]) => context.codeBlock)).toEqual(
			state.codeBlockRendering.currentProject.blocks
		);
		expect(onLayoutsChanged).not.toHaveBeenCalled();

		events.dispatch('openProjectGroup', { codeBlock: block('child') });
		expect(prepare).toHaveBeenCalledWith({ codeBlock: block('voice'), state });
		prepare.mockClear();
		onLayoutsChanged.mockClear();
		store.set('compiler.result', { ...state.compiler.result });
		expect(prepare).toHaveBeenCalledExactlyOnceWith({ codeBlock: block('voice'), state });
		expect(onLayoutsChanged).not.toHaveBeenCalled();

		unsubscribe();
		prepare.mockClear();
		store.set('compiler.result', { ...state.compiler.result });
		events.dispatch('gridSizeChanged');
		expect(prepare).not.toHaveBeenCalled();
	});
});
