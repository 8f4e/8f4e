import { EventEmitter } from 'node:events';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry, DrawContext } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { codeRenderingPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(code = ['module audio', 'int value 0', 'moduleEnd']) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('loadProject', {
		project: { ...EMPTY_DEFAULT_PROJECT, execution: [{ type: 'module', id: 0, entry: 'main', code }] },
	});
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
	const drawers = createEditorDrawerRegistry();
	const disposePlugin = codeRenderingPlugin.setup({
		store,
		events,
		drawers,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
	});
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	const draw = new DrawContext({ drawSprite: vi.fn() }, 8);
	const drawRows = vi.spyOn(draw, 'drawResolvedText');
	const memoryViews = {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(0),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
	const render = (codeBlock: CodeBlockGraphicData = block) => {
		drawRows.mockClear();
		drawers.drawCodeBlockContent({ draw, state, codeBlock, memoryViews });
		return drawRows.mock.calls.map(([, , cells]) => cells);
	};
	return { store, events, emitter, state, block, render, drawRows };
}

it('draws existing blocks when installed after loading and reuses prepared cells between frames', () => {
	const test = setup();
	const first = test.render();
	expect(first).toHaveLength(3);
	expect(test.drawRows.mock.calls.map(([x, y]) => [x, y])).toEqual([
		[8, 0],
		[8, 16],
		[8, 32],
	]);
	expect(test.render()[0]).toBe(first[0]);
});

it('colors named note headers after loading a project', () => {
	const test = setup();
	test.events.dispatch('loadProject', {
		project: { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code: ['note named', 'Plain text', 'noteEnd'] }] },
	});
	const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.blockType === 'note')!;
	const rows = test.render(block);
	const prefix = block.lineNumberColumnWidth + 1;
	expect(rows[0][prefix]! >>> 16).toBe(PALETTE_INDICES.primaryBase);
	expect(rows[0][prefix + 5]! >>> 16).toBe(PALETTE_INDICES.inkBase);
	expect(rows[1][prefix]! >>> 16).toBe(PALETTE_INDICES.tertiaryBase);
});

it('refreshes text and reserved rows after source edits and late layout contributions', () => {
	const test = setup();
	const contribution = test.store.layout.createContribution();
	cleanups.push(contribution.dispose);
	contribution.update(test.block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
	const before = test.render();
	expect(before).toHaveLength(5);
	expect(before.slice(2, 4)).toEqual([[], []]);
	applyCodeBlockSourceEdits(
		test.store,
		[{ codeBlock: test.block, code: ['module audio', 'int value 1', 'moduleEnd'] }],
		{ affectsCompilation: true }
	);
	const after = test.render();
	expect(after).toHaveLength(5);
	expect(after[1].at(-1)! & 0xffff).toBe('1'.charCodeAt(0));
	expect(after).not.toEqual(before);
});

it('draws the completed diagnostic layout before notifying other layout listeners', () => {
	const test = setup();
	const completed: ReturnType<typeof test.render>[] = [];
	test.events.on('codeBlockLayoutsChanged', () => completed.push(test.render()));
	test.store.set('codeErrors.compilationErrors', [
		{ codeBlockId: test.block.creationIndex, lineNumber: 1, message: 'Example' },
	]);
	expect(completed).toHaveLength(1);
	expect(completed[0]).toHaveLength(5);
	expect(test.render()[0]).toBe(completed[0][0]);
});

it.each(['memoryValuesChanged', 'spriteSheetRerendered'])('uses completed layouts after %s', event => {
	const test = setup();
	const completed: ReturnType<typeof test.render>[] = [];
	test.events.on('codeBlockLayoutsChanged', () => completed.push(test.render()));
	test.events.dispatch(event);
	expect(completed).toHaveLength(1);
	expect(test.render()[0]).toBe(completed[0][0]);
});

it('retains prepared cells during info and dragging updates', () => {
	const test = setup();
	const before = test.render();
	test.store.set('info.graphics', { fps: 60 });
	test.store.set('codeBlockRendering.draggedCodeBlock', test.block);
	expect(test.render()[0]).toBe(before[0]);
});

it('refreshes disabled colors and folded placeholder rows from completed layouts', () => {
	const test = setup();
	applyCodeBlockSourceEdits(
		test.store,
		[{ codeBlock: test.block, code: ['module audio', '; @disabled', '; @hide', 'int value 1', 'moduleEnd'] }],
		{ affectsCompilation: true }
	);
	const rows = test.render();
	expect(test.block.displayModel.isCollapsed).toBe(true);
	expect(rows).toHaveLength(test.block.displayModel.lines.length);
	for (const cell of rows.flat()) if (cell !== null) expect(cell >>> 16).toBe(PALETTE_INDICES.inkFaint);
});

it('refreshes visible text when entering and leaving project groups', () => {
	const test = setup();
	test.events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			execution: [
				{
					...EMPTY_DEFAULT_PROJECT,
					type: 'group',
					id: 0,
					name: 'audio',
					code: ['group audio', 'groupEnd'],
					entry: 'main',
					exposures: [],
					execution: [{ type: 'module', id: 1, entry: 'main', code: ['module child', 'int value 2', 'moduleEnd'] }],
				},
			],
		},
	});
	const group = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
	const before = test.render(group);
	test.events.dispatch('openProjectGroup', { codeBlock: group });
	const child = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'child')!;
	expect(test.render(child)[1].at(-1)! & 0xffff).toBe('2'.charCodeAt(0));
	test.events.dispatch('goToParentProjectGroup');
	expect(test.render(group)).toEqual(before);
});

it('keeps prepared cells isolated between editor instances and removes its listener and drawer on disposal', () => {
	const first = setup();
	const second = setup(['module audio', 'int value 9', 'moduleEnd']);
	expect(first.render()[1]).not.toEqual(second.render()[1]);
	const listeners = second.emitter.listenerCount('codeBlockLayoutsChanged');
	cleanups.pop()!();
	expect(second.emitter.listenerCount('codeBlockLayoutsChanged')).toBeLessThan(listeners);
	expect(second.render()).toEqual([]);
	expect(first.render()).toHaveLength(3);
});
