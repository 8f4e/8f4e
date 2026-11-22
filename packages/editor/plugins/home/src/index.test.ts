import { EventEmitter } from 'node:events';
import initState, { applyCodeBlockSourceEdits, centerViewportOnCodeBlock } from '@8f4e/editor-state';
import type { ViewportBlockAlignment } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { homePlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(installed = true) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const disposePlugin = installed
		? homePlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
				drawers: createEditorDrawerRegistry(),
			})
		: () => {};
	cleanups.push(store.dispose, disposePlugin);
	events.dispatch('resize', { canvasWidth: 640, canvasHeight: 384 });
	const state = store.getState();
	const load = (source: string) =>
		events.dispatch('loadProject', { project: parseProjectSource(`8f4e/v1\n${source}`) });
	const block = (name: string) => state.codeBlockRendering.currentProject.blocks.find(block => block.name === name)!;
	const position = () => ({ x: state.viewport.x, y: state.viewport.y });
	const expectedPosition = (name: string, alignment: ViewportBlockAlignment) =>
		centerViewportOnCodeBlock(state.viewport, block(name), { alignment });
	return { state, store, events, load, block, position, expectedPosition, disposePlugin };
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
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
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
		expect(test.position()).toEqual(test.expectedPosition('first', 'left'));
		Object.assign(test.state.viewport, { x: 128, y: 256 });
		const changed = vi.fn();
		test.events.on('viewportChanged', changed);
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		test.events.dispatch('goHome');
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(test.block('first'));
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
		applyCodeBlockSourceEdits({ store: test.store, events: test.events }, [
			{ codeBlock: first, code: ['note first', '; @pos 100 200', 'noteEnd'] },
			{ codeBlock: second, code: ['note second', '; @pos 200 300', '; @home top', 'noteEnd'] },
		]);
		test.events.dispatch('goHome');
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(second);
		expect(test.position()).toEqual(test.expectedPosition('second', 'top'));
	});

	it('falls back to the origin without discarding selection if no valid home exists', () => {
		const test = setup();
		test.load('note target\n; @pos 100 200\n; @home diagonal\nnoteEnd');
		expect(test.position()).toEqual({ x: 0, y: 0 });
		test.store.set('codeBlockRendering.selectedCodeBlock', test.block('target'));
		Object.assign(test.state.viewport, { x: 128, y: 256 });
		test.events.dispatch('goHome');
		expect(test.position()).toEqual({ x: 0, y: 0 });
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(test.block('target'));
	});

	it('positions new group visits, but preserves remembered positions on later visits', () => {
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
		const rootPosition = { x: 128, y: 256 };
		Object.assign(test.state.viewport, rootPosition);
		test.events.dispatch('openProjectGroup', { codeBlock: group });
		expect(test.position()).toEqual(test.expectedPosition('child', 'right'));
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		Object.assign(test.state.viewport, { x: 0, y: 0 });
		test.events.dispatch('goToParentProjectGroup');
		expect(test.position()).toEqual(rootPosition);
		test.events.dispatch('openProjectGroup', { codeBlock: group });
		expect(test.position()).toEqual({ x: 0, y: 0 });
		test.events.dispatch('goHome');
		expect(test.position()).toEqual(test.expectedPosition('child', 'right'));
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(test.block('child'));
	});

	it('contributes the main menu action only in edit mode, even without home blocks', async () => {
		const test = setup();
		test.load('note target\n; @pos 100 200\nnoteEnd');
		test.events.dispatch('enterEditMode');
		test.events.dispatch('contextmenu', { x: 600, y: 350 });
		await Promise.resolve();
		const items = test.state.contextMenu.items;
		const index = items.findIndex(item => item.action === 'goHome');
		expect(items[index]).toEqual({ title: 'Go @home', action: 'goHome', close: true });
		Object.assign(test.state.viewport, { x: -128, y: -256 });
		test.events.dispatch('activateContextMenuItem', { index, x: 0, y: 0 });
		expect(test.state.contextMenu.open).toBe(false);
		expect(test.position()).toEqual({ x: 0, y: 0 });
		test.store.set('editorMode', 'view');
		test.events.dispatch('contextmenu', { x: 600, y: 350 });
		await Promise.resolve();
		expect(test.state.contextMenu.items.some(item => item.action === 'goHome')).toBe(false);
	});

	it.each(['not installed', 'disposed'])('has no behavior or menu when %s', async status => {
		const test = setup(status !== 'not installed');
		if (status === 'disposed') test.disposePlugin();
		test.load('note target\n; @pos 100 200\n; @home\nnoteEnd');
		expect(test.position()).toEqual({ x: 0, y: 0 });
		Object.assign(test.state.viewport, { x: 128, y: 256 });
		test.events.dispatch('goHome');
		expect(test.position()).toEqual({ x: 128, y: 256 });
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		test.events.dispatch('enterEditMode');
		test.events.dispatch('contextmenu', { x: 600, y: 350 });
		await Promise.resolve();
		expect(test.state.contextMenu.items.some(item => item.action === 'goHome')).toBe(false);
	});
});
