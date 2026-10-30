import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it } from 'vitest';
import initState, { applyCodeBlockSourceEdits, serializeProjectTo8f4e, serializeToProject } from '../../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(source: string) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	cleanups.push(store.dispose);
	const load = (text: string) => events.dispatch('loadProject', { project: parseProjectSource(text) });
	load(source);
	events.dispatch('enterEditMode');
	return { store, state: store.getState(), events, load };
}

const twoNotes = `8f4e/v1
note left
; @pos 0 0
; @config export.fileName left
noteEnd
note right
; @pos 80 0
; @config export.fileName right
noteEnd`;

describe('spatial configuration precedence', () => {
	it.each([
		{ name: 'horizontal position before vertical position', first: '20 -10', second: '0 10', winner: 'first' },
		{ name: 'vertical position at the same horizontal position', first: '0 10', second: '0 -10', winner: 'first' },
		{ name: 'creation order at the same grid position', first: '0 0', second: '0 0', winner: 'second' },
	])('uses $name independently of drawing order', ({ first, second, winner }) => {
		const { state, store, load } = setup(`8f4e/v1
note first
; @pos ${first}
; @config export.fileName first
noteEnd
note second
; @pos ${second}
; @config export.fileName second
noteEnd`);
		expect(state.editorConfig.export?.fileName).toBe(winner);
		const blocks = state.codeBlockRendering.rootCodeBlocks;
		const reversed = [...blocks].reverse();
		blocks.splice(0, blocks.length, ...reversed);
		store.set('codeBlockRendering.codeBlocks', blocks);
		expect(state.editorConfig.export?.fileName).toBe(winner);
		expect(blocks).toEqual(reversed);
		load(serializeProjectTo8f4e(serializeToProject(state)));
		expect(state.editorConfig.export?.fileName).toBe(winner);
	});

	it('uses spatial order across block types before and after saving', () => {
		const { state, load } = setup(`8f4e/v1
note right
; @pos 20 0
; @config export.fileName right
noteEnd
entry main
module left
; @pos -20 0
; @config export.fileName left
moduleEnd
entryEnd`);
		expect(state.editorConfig.export?.fileName).toBe('right');
		load(serializeProjectTo8f4e(serializeToProject(state)));
		expect(state.editorConfig.export?.fileName).toBe('right');
	});

	it('combines different paths and applies directives in source order, skipping invalid values', () => {
		const { state } = setup(`8f4e/v1
note right
; @pos 20 0
; @config export.fileName first
; @config export.fileName second @config export.fileName last
; @config color.ink invalid
noteEnd
note left
; @pos 0 0
; @config export.fileName left
; @config color.ink #112233
noteEnd`);
		expect(state.editorConfig.export?.fileName).toBe('last');
		expect(state.editorConfig.color?.ink).toBe('#112233');
		expect(state.codeErrors.editorDirectiveErrors).toEqual([
			expect.objectContaining({ lineNumber: 4, message: expect.stringContaining("invalid color value 'invalid'") }),
		]);
	});

	it.each(['typing', 'programmatic edit'] as const)('refreshes precedence after a position-only %s', editKind => {
		const { state, store, events } = setup(twoNotes);
		const left = state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'left')!;
		expect(state.editorConfig.export?.fileName).toBe('right');
		if (editKind === 'typing') {
			store.set('codeBlockRendering.selectedCodeBlock', left);
			left.cursor = { row: 1, col: '; @pos '.length, x: 0, y: 0 };
			events.dispatch('insertText', { text: '10' });
		} else {
			applyCodeBlockSourceEdits(
				store,
				[{ codeBlock: left, code: left.code.map(line => line.replace('@pos 0 0', '@pos 100 0')) }],
				{
					affectsCompilation: false,
				}
			);
		}
		expect({ x: left.gridX, y: left.gridY }).toEqual({ x: 100, y: 0 });
		expect({ x: left.x, y: left.y }).toEqual({ x: 100 * state.viewport.vGrid, y: 0 });
		expect(state.editorConfig.export?.fileName).toBe('left');
		if (editKind === 'typing') {
			left.cursor = { row: 1, col: left.code[1].length, x: 0, y: 0 };
			events.dispatch('deleteBackward');
		} else {
			applyCodeBlockSourceEdits(
				store,
				[{ codeBlock: left, code: left.code.map(line => line.replace('@pos 100 0', '@pos 100 -')) }],
				{ affectsCompilation: false }
			);
		}
		expect({ x: left.gridX, y: left.gridY }).toEqual({ x: 100, y: 0 });
		expect({ x: left.x, y: left.y }).toEqual({ x: 100 * state.viewport.vGrid, y: 0 });
		expect(state.editorConfig.export?.fileName).toBe('left');
		if (editKind === 'typing') {
			events.dispatch('insertText', { text: '0' });
		} else {
			applyCodeBlockSourceEdits(
				store,
				[{ codeBlock: left, code: left.code.map(line => line.replace('@pos 100 -', '@pos 100 0')) }],
				{ affectsCompilation: false }
			);
		}
		events.dispatch('undo');
		expect(state.editorConfig.export?.fileName).toBe('right');
		events.dispatch('redo');
		expect(state.editorConfig.export?.fileName).toBe('left');
	});

	it('keeps precedence on selection and updates it when a drag completes', () => {
		const { state, events, load } = setup(twoNotes);
		const left = state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'left')!;
		const pointer = {
			x: left.x - state.viewport.x + 1,
			y: left.y - state.viewport.y + 1,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
			altKey: false,
		};
		events.dispatch('mousedown', pointer);
		expect(state.codeBlockRendering.rootCodeBlocks.at(-1)).toBe(left);
		expect(state.editorConfig.export?.fileName).toBe('right');
		events.dispatch('mouseup');
		events.dispatch('mousedown', pointer);
		events.dispatch('mousemove', { ...pointer, movementX: 100 * state.viewport.vGrid });
		expect(state.editorConfig.export?.fileName).toBe('right');
		events.dispatch('mouseup');
		expect(left.gridX).toBe(100);
		expect(state.editorConfig.export?.fileName).toBe('left');
		load(serializeProjectTo8f4e(serializeToProject(state)));
		expect(state.editorConfig.export?.fileName).toBe('left');
	});

	it('orders nested groups locally and keeps each subtree in its parent position', () => {
		const { state, store, events, load } = setup(`8f4e/v1
note rootRight
; @pos 20 0
; @config export.fileName rootRight
noteEnd
entry main
group outer
; @pos 10 0
; @config export.fileName outer
note childRight
; @pos 1000 0
; @config export.fileName childRight
noteEnd
group inner
; @pos 0 0
; @config export.fileName inner
note leaf
; @pos 2000 0
; @config export.fileName leaf
noteEnd
groupEnd
groupEnd
entryEnd`);
		expect(state.editorConfig.export?.fileName).toBe('rootRight');
		const outer = state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'outer')!;
		applyCodeBlockSourceEdits(
			store,
			[{ codeBlock: outer, code: outer.code.map(line => line.replace('@pos 10 0', '@pos 30 0')) }],
			{
				affectsCompilation: false,
			}
		);
		expect(state.editorConfig.export?.fileName).toBe('childRight');
		events.dispatch('openProjectGroup', { codeBlock: outer });
		expect(state.editorConfig.export?.fileName).toBe('childRight');
		const childRight = state.codeBlockRendering.codeBlocks.find(block => block.name === 'childRight')!;
		applyCodeBlockSourceEdits(
			store,
			[{ codeBlock: childRight, code: childRight.code.map(line => line.replace('@pos 1000 0', '@pos -10 0')) }],
			{
				affectsCompilation: false,
			}
		);
		expect(state.editorConfig.export?.fileName).toBe('leaf');
		events.dispatch('goToParentProjectGroup');
		expect(state.editorConfig.export?.fileName).toBe('leaf');
		load(serializeProjectTo8f4e(serializeToProject(state)));
		expect(state.editorConfig.export?.fileName).toBe('leaf');
	});
});
