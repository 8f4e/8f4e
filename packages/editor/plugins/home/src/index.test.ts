import { EventEmitter } from 'node:events';
import type { EditorPluginContext } from '@8f4e/editor-core';
import initState, {
	applyCodeBlockSourceEdits,
	centerViewportOnCodeBlock,
	markGridSizePending,
	setGridSize,
	updateViewport,
} from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { ProjectLevel, ViewportBlockAlignment } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { homePlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(withGrid = true) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	if (withGrid) setGridSize(state, events, TEST_GRID_SIZE);
	const unregisterMenuItem = vi.fn();
	const registerItem = vi.spyOn(store.menus, 'registerItem').mockReturnValue(unregisterMenuItem);
	let cleanup: (() => void) | undefined = homePlugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers: {} as EditorPluginContext['drawers'],
	});
	const disposePlugin = () => {
		cleanup?.();
		cleanup = undefined;
	};
	cleanups.push(store.dispose, disposePlugin);
	events.dispatch('resize', { canvasWidth: 640, canvasHeight: 384 });
	const load = (source: string) =>
		events.dispatch('loadProject', { project: parseProjectSource(`8f4e/v1\n${source}`) });
	const block = (name: string) => state.project.activeLevel.blocks.find(block => block.name === name)!;
	const position = () => ({ x: state.viewport.x, y: state.viewport.y });
	const expectedPosition = (name: string, alignment: ViewportBlockAlignment) =>
		centerViewportOnCodeBlock(state.viewport, block(name), { alignment });
	const gridPending = () => markGridSizePending(state);
	const gridReady = (grid = { vGrid: 6, hGrid: 12 }) => setGridSize(state, events, grid);
	const resolveInitial = (project: ProjectLevel = state.project.activeLevel, position = { x: 0, y: 0 }) => {
		events.dispatch('resolveInitialProjectViewport', { project, position });
		return position;
	};
	const menu = () => {
		expect(registerItem).toHaveBeenCalledExactlyOnceWith('mainMenu', expect.any(Function));
		return registerItem.mock.calls[0][1]({ state });
	};
	return {
		state,
		store,
		events,
		load,
		block,
		position,
		expectedPosition,
		gridPending,
		gridReady,
		resolveInitial,
		menu,
		unregisterMenuItem,
		disposePlugin,
	};
}

describe('home viewport navigation', () => {
	it.each([
		['', 'center'],
		[' center', 'center'],
		[' left', 'left'],
		[' right', 'right'],
		[' top', 'top'],
		[' bottom', 'bottom'],
	] as const)('honors @home%s on initial placement without selecting the block', (args, alignment) => {
		const test = setup();
		test.load(`note target\n; @pos 100 200\n; @home${args}\nnoteEnd`);
		expect(test.position()).toEqual(test.expectedPosition('target', alignment));
		expect(test.state.project.selectedCodeBlock).toBeUndefined();
	});

	it('uses the first valid home block even if disabled, and its last valid alignment', () => {
		const test = setup();
		test.load(`note invalid
; @home diagonal
; @home top extra
noteEnd
note first
; @pos 100 200
; @disabled @home right
; @home left
; @home invalid
noteEnd
note later
; @pos 300 400
; @home top
noteEnd`);
		expect(test.block('first').disabled).toBe(true);
		expect(test.resolveInitial()).toEqual(test.expectedPosition('first', 'left'));
		Object.assign(test.state.viewport, { x: 128, y: 256 });
		const changed = vi.fn();
		test.events.on('viewportChanged', changed);
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		test.events.dispatch('goHome');
		expect(test.state.project.selectedCodeBlock).toBe(test.block('first'));
		expect(test.position()).toEqual(test.expectedPosition('first', 'left'));
		expect(changed).toHaveBeenCalledExactlyOnceWith({
			previousX: 128,
			previousY: 256,
			...test.position(),
			source: 'navigation',
		});
		expect(test.state.projectChange.revision).toBe(revision);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
	});

	it('uses newly settled layout when navigating to a selected home block', () => {
		const test = setup();
		test.load(`note target
; @pos 100 200
; @home bottom
; @hide
First line
Second line
Third line
noteEnd`);
		const before = test.position();
		expect(test.block('target').isCollapsed).toBe(true);
		test.events.dispatch('goHome');
		expect(test.block('target').isCollapsed).toBe(false);
		expect(test.position()).toEqual(test.expectedPosition('target', 'bottom'));
		expect(test.position()).not.toEqual(before);
	});

	it('matches cached directives after a source edit', () => {
		const test = setup();
		test.load(`note first
; @pos 100 200
; @home
noteEnd
note second
; @pos 200 300
noteEnd`);
		const first = test.block('first');
		const second = test.block('second');
		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock: first, code: ['note first', '; @pos 100 200', 'noteEnd'] },
			{ codeBlock: second, code: ['note second', '; @pos 200 300', '; @home top', 'noteEnd'] },
		]);
		test.events.dispatch('goHome');
		expect(test.state.project.selectedCodeBlock).toBe(second);
		expect(test.position()).toEqual(test.expectedPosition('second', 'top'));
	});

	it('falls back to the origin without discarding selection if no valid home exists', () => {
		const test = setup();
		test.load('note target\n; @pos 100 200\n; @home diagonal\nnoteEnd');
		expect(test.resolveInitial(undefined, { x: 128, y: 256 })).toEqual({ x: 128, y: 256 });
		test.store.set('project.selectedCodeBlock', test.block('target'));
		Object.assign(test.state.viewport, { x: 128, y: 256 });
		test.events.dispatch('goHome');
		expect(test.position()).toEqual({ x: 0, y: 0 });
		expect(test.state.project.selectedCodeBlock).toBe(test.block('target'));
	});

	it('resolves home within the requested project level', () => {
		const test = setup();
		test.load(`note rootHome
; @pos 100 200
; @home left
noteEnd
entry main
group audio
entry main
module child
; @pos 80 100
; @home right
moduleEnd
entryEnd
groupEnd
entryEnd`);
		const group = test.block('audio');
		const rootLevel = test.state.project.rootLevel;
		const expectedRootPosition = test.expectedPosition('rootHome', 'left');
		test.events.dispatch('openProjectGroup', { codeBlock: group });
		expect(test.position()).toEqual(test.expectedPosition('child', 'right'));
		expect(test.resolveInitial(rootLevel)).toEqual(expectedRootPosition);
		expect(test.state.project.selectedCodeBlock).toBeUndefined();
		test.events.dispatch('goHome');
		expect(test.position()).toEqual(test.expectedPosition('child', 'right'));
		expect(test.state.project.selectedCodeBlock).toBe(test.block('child'));
	});

	it('contributes the main menu action only in edit mode, even without home blocks', () => {
		const test = setup();
		test.load('note target\n; @pos 100 200\nnoteEnd');
		test.events.dispatch('enterEditMode');
		expect(test.menu()).toEqual({ title: 'Go @home', action: 'goHome', close: true });
		test.store.set('editorMode', 'view');
		expect(test.menu()).toBeUndefined();
	});

	it('unregisters navigation and the menu contribution on disposal', () => {
		const test = setup();
		test.disposePlugin();
		test.load('note target\n; @pos 100 200\n; @home\nnoteEnd');
		expect(test.resolveInitial()).toEqual({ x: 0, y: 0 });
		Object.assign(test.state.viewport, { x: 128, y: 256 });
		test.events.dispatch('goHome');
		expect(test.position()).toEqual({ x: 128, y: 256 });
		expect(test.state.project.selectedCodeBlock).toBeUndefined();
		expect(test.unregisterMenuItem).toHaveBeenCalledOnce();
	});
});

describe('home navigation while waiting for grid dimensions', () => {
	it('positions the initial home using the actual grid after layout settles, only once', () => {
		const test = setup(false);
		const resolveInitial = vi.fn();
		test.events.on('resolveInitialProjectViewport', resolveInitial);
		test.load('note target\n; @pos 100 200\n; @home top\nnoteEnd');
		expect(test.position()).toEqual({ x: 0, y: 0 });
		expect(resolveInitial).not.toHaveBeenCalled();

		test.gridReady();
		expect(test.block('target')).toMatchObject({ x: 600, y: 2400 });
		expect(test.position()).toEqual(test.expectedPosition('target', 'top'));
		expect(test.state.project.selectedCodeBlock).toBeUndefined();
		expect(resolveInitial).toHaveBeenCalledOnce();

		const homePosition = test.position();
		test.gridPending();
		test.gridReady(TEST_GRID_SIZE);
		expect(test.position()).toEqual(homePosition);
		expect(test.position()).not.toEqual(test.expectedPosition('target', 'top'));
		expect(resolveInitial).toHaveBeenCalledOnce();
	});

	it('does not navigate to a home from a replaced project when its replacement has no home', () => {
		const test = setup(false);
		test.load('note first\n; @pos 100 200\n; @home left\nnoteEnd');
		test.load('note latest\n; @pos 300 400\nnoteEnd');
		test.gridReady();
		expect(test.position()).toEqual({ x: 0, y: 0 });
	});

	it('uses the latest home declaration if source changes before the grid is ready', () => {
		const test = setup(false);
		test.load(`note first
; @pos 100 200
; @home
noteEnd
note second
; @pos 300 400
noteEnd`);
		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock: test.block('first'), code: ['note first', '; @pos 100 200', 'noteEnd'] },
			{ codeBlock: test.block('second'), code: ['note second', '; @pos 300 400', '; @home bottom', 'noteEnd'] },
		]);
		test.gridReady();
		expect(test.position()).toEqual(test.expectedPosition('second', 'bottom'));
	});

	it('uses the installed grid for an explicit Go @home action while a replacement font loads', () => {
		const test = setup();
		test.load(`note target
; @pos 100 200
; @home bottom
; @hide
First line
Second line
Third line
noteEnd`);
		updateViewport(test.state, 32, 48, test.events, 'pan');
		test.gridPending();
		test.events.dispatch('goHome');
		expect(test.state.project.selectedCodeBlock).toBe(test.block('target'));
		expect(test.block('target').isCollapsed).toBe(false);
		expect(test.position()).toEqual(test.expectedPosition('target', 'bottom'));
		const homePosition = test.position();

		test.gridReady();
		expect(test.position()).toEqual(homePosition);
		expect(test.position()).not.toEqual(test.expectedPosition('target', 'bottom'));
	});

	it('does not contribute initial placement when the plugin is disposed before the grid is installed', () => {
		const test = setup(false);
		test.load('note target\n; @pos 100 200\n; @home\nnoteEnd');
		test.disposePlugin();
		test.gridReady();
		expect(test.position()).toEqual({ x: 0, y: 0 });
	});
});

describe('home diagnostics', () => {
	const duplicateMessage = 'Duplicate @home directive in this project level.';

	it('reports duplicate declarations on the same line, in the same block, and across blocks', () => {
		const test = setup();
		test.load(`note first
; @home @home right
; @home invalid
noteEnd
note second
; @home left
noteEnd`);
		expect(test.state.codeErrors.home).toEqual([
			{ codeBlockId: test.block('first').creationIndex, lineNumber: 1, message: duplicateMessage },
			{ codeBlockId: test.block('first').creationIndex, lineNumber: 2, message: duplicateMessage },
			{ codeBlockId: test.block('second').creationIndex, lineNumber: 1, message: duplicateMessage },
		]);
		expect(test.resolveInitial()).toEqual(test.expectedPosition('first', 'right'));
	});

	it('allows a separate home in each project level and checks unvisited groups', () => {
		const test = setup();
		test.load(`note rootHome
; @home
noteEnd
entry main
group audio
entry main
module child
; @home
moduleEnd
module duplicate
; @home
moduleEnd
entryEnd
groupEnd
group visual
entry main
module screen
; @home
moduleEnd
entryEnd
groupEnd
entryEnd`);
		const duplicate = test.block('audio').childProject!.blocks.find(block => block.name === 'duplicate')!;
		expect(test.state.codeErrors.home).toEqual([
			{ codeBlockId: duplicate.creationIndex, lineNumber: 1, message: duplicateMessage },
		]);
	});

	it('keeps duplicate errors on the same declaration after a block is raised and unrelated source changes', () => {
		const test = setup();
		test.load(`note first
; @pos 10 10
; @home left
noteEnd
note second
; @pos 70 10
; @home right
noteEnd
note other
; @pos 20 30
; Original comment
noteEnd`);
		const first = test.block('first');
		const second = test.block('second');
		const errors = test.state.codeErrors.home;
		expect(errors).toEqual([{ codeBlockId: second.creationIndex, lineNumber: 2, message: duplicateMessage }]);
		expect(test.resolveInitial()).toEqual(test.expectedPosition('first', 'left'));

		const { viewport } = test.state;
		const pointer = {
			x: first.x - viewport.x + 1,
			y: first.y - viewport.y + 1,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: viewport.width,
			canvasHeight: viewport.height,
			altKey: false,
		};
		test.events.dispatch('pointerdown', pointer);
		test.events.dispatch('pointerup', { ...pointer, buttons: 0 });
		const blocks = test.state.project.activeLevel.blocks;
		expect(blocks.indexOf(first)).toBeGreaterThan(blocks.indexOf(second));
		expect(test.resolveInitial()).toEqual(test.expectedPosition('second', 'right'));

		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock: test.block('other'), code: ['note other', '; @pos 20 30', '; Updated comment', 'noteEnd'] },
		]);
		expect(test.state.codeErrors.home).toBe(errors);
		test.events.dispatch('goHome');
		expect(test.state.project.selectedCodeBlock).toBe(second);
	});

	it('refreshes duplicate errors after source edits and project replacement', () => {
		const test = setup();
		test.load(`note first
; @home
noteEnd
note second
noteEnd`);
		const second = test.block('second');
		const editSecond = (code: string[]) => applyCodeBlockSourceEdits(test.store, [{ codeBlock: second, code }]);
		expect(test.state.codeErrors.home ?? []).toEqual([]);
		editSecond(['note second', '; @home', 'noteEnd']);
		expect(test.state.codeErrors.home).toEqual([
			{ codeBlockId: second.creationIndex, lineNumber: 1, message: duplicateMessage },
		]);
		editSecond(['note second', 'noteEnd']);
		expect(test.state.codeErrors.home).toEqual([]);
		editSecond(['note second', '; @home', 'noteEnd']);
		expect(test.state.codeErrors.home).toHaveLength(1);
		test.load('note replacement\n; @home\nnoteEnd');
		expect(test.state.codeErrors.home).toEqual([]);
	});

	it('removes only its own diagnostics and stops publishing on disposal', () => {
		const test = setup();
		const duplicateSource = 'note target\n; @home\n; @home\nnoteEnd';
		test.load(duplicateSource);
		expect(test.state.codeErrors.home).toHaveLength(1);
		const otherErrors = [{ message: 'Other contributor' }];
		test.store.set('codeErrors.other', otherErrors);
		test.disposePlugin();
		expect(test.state.codeErrors.home).toBeUndefined();
		expect(test.state.codeErrors.other).toBe(otherErrors);
		test.load(duplicateSource);
		expect(test.state.codeErrors.home).toBeUndefined();
	});
});
