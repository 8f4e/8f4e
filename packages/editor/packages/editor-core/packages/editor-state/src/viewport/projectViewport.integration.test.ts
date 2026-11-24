import { EventEmitter } from 'node:events';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { EditorLifecycleEvents } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, expect, it, vi } from 'vitest';
import initState, {
	applyCodeBlockSourceEdits,
	createEditorEditingHandle,
	getEditorBlockId,
	markGridSizePending,
	setGridSize,
	updateViewport,
} from '../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, {
		callbacks: {},
		editorConfigSchemaContributions: { test: { root: 'test', schema: { type: 'string' } } },
	});
	cleanups.push(store.dispose);
	const state = store.getState();
	const load = (source: string) =>
		events.dispatch('loadProject', { project: parseProjectSource(`8f4e/v1\n${source}`) });
	const resolver = vi.fn(({ project, position }: EditorLifecycleEvents['resolveInitialProjectViewport']) => {
		expect(state.gridSizeReady).toBe(true);
		expect(project).toBe(state.codeBlockRendering.currentProject);
		const block = project.blocks.find(block => block.blockType === 'module' || block.blockType === 'note');
		if (block) {
			expect(block.width).toBeGreaterThan(0);
			expect(block.height).toBeGreaterThan(0);
			Object.assign(position, { x: block.x, y: block.y });
		}
	});
	events.on('resolveInitialProjectViewport', resolver);
	return {
		events,
		store,
		state,
		load,
		resolver,
		position: () => ({ x: state.viewport.x, y: state.viewport.y }),
		block: (name: string) => state.codeBlockRendering.currentProject.blocks.find(block => block.name === name)!,
	};
}

const groupProject = `note root
; @pos 10 20
noteEnd
entry main
group audio
entry main
module child
; @pos 30 40
moduleEnd
entryEnd
groupEnd
entryEnd`;

it('resolves first-visit placement after source and layout settle, before the grid handoff completes', () => {
	const test = setup();
	const { state, events, resolver } = test;
	const notifications: string[] = [];
	events.on('codeBlockLayoutsChanged', () => notifications.push('layout'));
	events.on('resolveInitialProjectViewport', () => {
		expect(state.editorConfig.test).toBe('enabled');
		notifications.push('placement');
	});
	test.load('note sample\n; @pos 10 20\n; @config test enabled\nnoteEnd');
	expect(state.editorConfig.test).toBe('enabled');
	expect(state.compilerInputRevision).toBeGreaterThan(0);
	expect(resolver).not.toHaveBeenCalled();
	expect(test.position()).toEqual({ x: 0, y: 0 });
	expect(notifications).toEqual([]);

	setGridSize(state, events, { vGrid: 6, hGrid: 12 });
	expect(notifications).toEqual(['layout', 'placement']);
	expect(state.gridSizeReady).toBe(true);
	expect(test.position()).toEqual({ x: 60, y: 240 });
	expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();

	markGridSizePending(state);
	setGridSize(state, events, TEST_GRID_SIZE);
	expect(resolver).toHaveBeenCalledOnce();
	expect(test.position()).toEqual({ x: 60, y: 240 });
});

it('only resolves the current project, using source edits made while placement was pending', () => {
	const test = setup();
	test.load('note replaced\n; @pos 1 2\nnoteEnd');
	test.load('note current\n; @pos 3 4\nnoteEnd');
	applyCodeBlockSourceEdits(test.store, [
		{ codeBlock: test.block('current'), code: ['note current', '; @pos 10 20', 'noteEnd'] },
	]);
	expect(test.resolver).not.toHaveBeenCalled();
	setGridSize(test.state, test.events, TEST_GRID_SIZE);
	expect(test.resolver).toHaveBeenCalledOnce();
	expect(test.position()).toEqual({ x: 80, y: 320 });
});

it('uses layout contributions from project-change subscribers when replacing a project with an installed grid', () => {
	const test = setup();
	setGridSize(test.state, test.events, TEST_GRID_SIZE);
	const contribution = test.store.layout.createContribution();
	cleanups.push(contribution.dispose);
	test.store.subscribe('projectChange', () => {
		contribution.update(test.block('sample'), {
			verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }],
		});
	});
	test.events.on(
		'resolveInitialProjectViewport',
		({ position }: EditorLifecycleEvents['resolveInitialProjectViewport']) => {
			const block = test.block('sample');
			position.y = block.y + block.height;
		}
	);

	test.load('note sample\n; @pos 10 20\nnoteEnd');
	const block = test.block('sample');
	expect(block.height).toBe(5 * TEST_GRID_SIZE.hGrid);
	expect(test.resolver).toHaveBeenCalledOnce();
	expect(test.position()).toEqual({ x: block.x, y: block.y + block.height });
});

it('returns to the remembered parent only after project-change subscribers finish deleting the open group', () => {
	const test = setup();
	const { state, events, store } = test;
	setGridSize(state, events, TEST_GRID_SIZE);
	test.load(groupProject);
	events.dispatch('enterEditMode');
	const { handle, navigation, dispose } = createEditorEditingHandle(store, events);
	cleanups.push(dispose);
	const groupId = getEditorBlockId(test.block('audio'));
	updateViewport(state, 12, -20, events, 'pan');
	navigation.openGroup(groupId);
	updateViewport(state, 32, -16, events, 'pan');

	const notifications: string[] = [];
	store.subscribe('projectChange', () => {
		expect(state.codeBlockRendering.currentProject.path).toBe('');
		expect(test.position()).toEqual({ x: 32, y: -16 });
		notifications.push('projectChange');
	});
	events.on('viewportChanged', () => notifications.push('viewportChanged'));
	handle.applyEdits({
		expectedRevision: handle.getRevision(),
		edits: [{ type: 'delete', blockId: groupId }],
	});

	expect(notifications).toEqual(['projectChange', 'viewportChanged']);
	expect(test.position()).toEqual({ x: 12, y: -20 });
	// The remembered parent does not need a new first-visit position.
	expect(test.resolver).toHaveBeenCalledTimes(2);
});

it.each([TEST_GRID_SIZE, { vGrid: 6, hGrid: 12 }])(
	'resolves pending placement when a live grid installation completes with $vGrid×$hGrid dimensions',
	grid => {
		const test = setup();
		setGridSize(test.state, test.events, TEST_GRID_SIZE);
		test.load('note old\n; @pos 1 2\nnoteEnd');
		markGridSizePending(test.state);
		test.load('note replacement\n; @pos 10 20\nnoteEnd');
		expect(test.resolver).toHaveBeenCalledOnce();
		expect(test.position()).toEqual({ x: 0, y: 0 });
		// The old atlas and its geometry remain usable while the replacement loads.
		expect(test.block('replacement')).toMatchObject({ x: 80, y: 320 });
		setGridSize(test.state, test.events, grid);
		expect(test.resolver).toHaveBeenCalledTimes(2);
		expect(test.position()).toEqual({ x: 10 * grid.vGrid, y: 20 * grid.hGrid });
	}
);

it.each([
	{ source: 'pan', x: 32, y: -16 },
	{ source: 'navigation', x: 0, y: 0 },
] as const)('preserves an explicit $source target while a first visit is pending', ({ source, x, y }) => {
	const test = setup();
	test.load('note sample\n; @pos 10 20\nnoteEnd');
	updateViewport(test.state, x, y, test.events, source);
	setGridSize(test.state, test.events, TEST_GRID_SIZE);
	expect(test.resolver).not.toHaveBeenCalled();
	expect(test.position()).toEqual({ x, y });
});

it('restores a remembered parent and resolves a group upon reentry if its first visit was interrupted', () => {
	const test = setup();
	const { state, events } = test;
	setGridSize(state, events, TEST_GRID_SIZE);
	test.load(groupProject);
	updateViewport(state, 32, -16, events, 'pan');
	markGridSizePending(state);
	const group = test.block('audio');
	events.dispatch('openProjectGroup', { codeBlock: group });
	expect(test.position()).toEqual({ x: 0, y: 0 });
	events.dispatch('goToParentProjectGroup');
	expect(group.childProject?.viewport).toBeUndefined();
	expect(test.position()).toEqual({ x: 32, y: -16 });
	setGridSize(state, events, { vGrid: 6, hGrid: 12 });
	expect(test.resolver).toHaveBeenCalledOnce();
	expect(test.position()).toEqual({ x: 32, y: -16 });

	events.dispatch('openProjectGroup', { codeBlock: group });
	expect(test.resolver).toHaveBeenCalledTimes(2);
	expect(test.position()).toEqual({ x: 180, y: 480 });
	events.dispatch('goToRootProjectGroup');
	expect(test.position()).toEqual({ x: 32, y: -16 });
	events.dispatch('openProjectGroup', { codeBlock: group });
	expect(test.position()).toEqual({ x: 180, y: 480 });
	expect(test.resolver).toHaveBeenCalledTimes(2);
});

it('does not remember an unplaced parent when entering a group before the first grid arrives', () => {
	const test = setup();
	const { state, events } = test;
	test.load(groupProject);
	events.dispatch('openProjectGroup', { codeBlock: test.block('audio') });
	expect(state.codeBlockRendering.rootProject.viewport).toBeUndefined();
	setGridSize(state, events, TEST_GRID_SIZE);
	expect(test.resolver).toHaveBeenCalledOnce();
	expect(test.position()).toEqual({ x: 240, y: 640 });
	events.dispatch('goToRootProjectGroup');
	expect(test.resolver).toHaveBeenCalledTimes(2);
	expect(test.position()).toEqual({ x: 80, y: 320 });
});

it('preserves unplaced first visits across undo without remembering their temporary origin', () => {
	const test = setup();
	test.load('note sample\n; @pos 10 20\nnoteEnd');
	applyCodeBlockSourceEdits(test.store, [
		{ codeBlock: test.block('sample'), code: ['note sample', '; @pos 30 40', 'noteEnd'] },
	]);
	test.events.dispatch('undo');
	expect(test.state.codeBlockRendering.currentProject.viewport).toBeUndefined();
	expect(test.resolver).not.toHaveBeenCalled();
	setGridSize(test.state, test.events, TEST_GRID_SIZE);
	expect(test.resolver).toHaveBeenCalledOnce();
	expect(test.position()).toEqual({ x: 80, y: 320 });
});

it('keeps initial placement pending even when a checkpoint attempts to delete generated environment source', () => {
	const test = setup();
	test.load('note sample\n; @pos 10 20\nnoteEnd');
	test.events.dispatch('enterEditMode');
	const { handle, dispose } = createEditorEditingHandle(test.store, test.events);
	cleanups.push(dispose);
	const revision = handle.getRevision();
	const env = test.block('env');
	handle.applyEdits({
		expectedRevision: revision,
		edits: [{ type: 'delete', blockId: getEditorBlockId(env) }],
	});

	expect(test.block('env')).toBe(env);
	expect(handle.getRevision()).toBe(revision);
	expect(test.state.codeBlockRendering.currentProject.viewport).toBeUndefined();
	expect(test.resolver).not.toHaveBeenCalled();
	setGridSize(test.state, test.events, TEST_GRID_SIZE);
	expect(test.resolver).toHaveBeenCalledOnce();
	expect(test.position()).toEqual({ x: 80, y: 320 });
});
