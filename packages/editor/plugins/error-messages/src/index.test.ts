import { EventEmitter } from 'node:events';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeError } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews, textToGlyphIds } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMessagesPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(errors: Record<string, CodeError[]> = {}) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 100 100', 'constantsEnd'] }],
			execution: [
				{ type: 'module', entry: 'main', id: 7, code: ['module target', '; @pos 4 3', 'push 1', 'drop', 'moduleEnd'] },
			],
		},
	});
	for (const [id, list] of Object.entries(errors)) store.set(`codeErrors.${id}`, list);
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
	const drawers = createEditorDrawerRegistry();
	const dispose = errorMessagesPlugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	cleanups.push(store.dispose, dispose);
	const drawFill = vi.fn();
	const drawGlyphs = vi.fn();
	const draw = { drawFill, drawGlyphs, startGroup: vi.fn(), endGroup: vi.fn() } as unknown as DrawContext;
	const render = (codeBlock: CodeBlockGraphicData = block) =>
		drawers.drawCodeBlock({ draw, state, codeBlock, memoryViews: {} as MemoryViews });
	const renderOverlay = () => drawers.drawCanvasOverlays({ draw, state, memoryViews: {} as MemoryViews });
	return { state, store, events, block, render, renderOverlay, drawFill, drawGlyphs, dispose };
}

describe('error messages plugin', () => {
	it('reserves and draws only visible source rows while retaining the raw errors', () => {
		const errors = [{ codeBlockId: 7, lineNumber: 2, message: 'Hidden error' }];
		const test = setup({ custom: errors });
		const original = [...test.block.code];
		applyCodeBlockSourceEdits(test, [
			{ codeBlock: test.block, code: ['module target', '; @hide', 'push 1', 'drop', 'moduleEnd'] },
		]);
		test.render();
		expect(test.block.gaps.size).toBe(0);
		expect(test.drawGlyphs).not.toHaveBeenCalled();
		expect(test.state.codeErrors.custom).toBe(errors);
		applyCodeBlockSourceEdits(test, [{ codeBlock: test.block, code: original }]);
		test.render();
		expect(test.block.gaps.get(2)?.size).toBe(2);
		expect(test.drawGlyphs).toHaveBeenLastCalledWith(0, 64, textToGlyphIds(' Hidden error'), expect.any(Number));
	});

	it('renders existing errors from independent contributors and stacks messages after other reserved rows', () => {
		const compiler = [{ codeBlockId: 7, lineNumber: 2, message: 'Compiler error' }];
		const custom = [{ codeBlockId: 7, lineNumber: 2, message: 'Custom error' }];
		const test = setup({ compiler, custom });
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		const other = test.store.layout.createContribution();
		other.update(test.block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 3 }] });
		test.render();
		expect(test.block.gaps.get(2)?.size).toBe(7);
		expect(test.drawFill.mock.calls.map(([, y, , , height]) => [y, height])).toEqual([
			[96, 32],
			[128, 32],
		]);
		expect(test.drawGlyphs.mock.calls.map(([, , text]) => text)).toEqual([
			textToGlyphIds(' Error:'),
			textToGlyphIds(' Compiler error'),
			textToGlyphIds(' Error:'),
			textToGlyphIds(' Custom error'),
		]);
		expect(test.state.codeErrors.compiler).toBe(compiler);
		expect(test.state.codeErrors.custom).toBe(custom);
		expect(test.state.projectChange.revision).toBe(revision);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
	});

	it('rewraps messages when layout width changes and recalculates positions for the font grid', () => {
		const test = setup({ custom: [{ codeBlockId: 7, lineNumber: 2, message: 'a long error message '.repeat(12) }] });
		const rows = test.block.gaps.get(2)!.size;
		const width = test.store.layout.createContribution();
		width.update(test.block, { minGridWidth: 300, verticalSpaceAfterSourceLine: [] });
		expect(test.block.gaps.get(2)!.size).toBeLessThan(rows);
		test.state.viewport.vGrid = 10;
		test.state.viewport.hGrid = 20;
		test.events.dispatch('gridSizeChanged');
		test.render();
		expect(test.drawFill.mock.calls[0].slice(3)).toEqual([test.block.width, 40]);
		expect(test.drawFill.mock.calls[0][1]).toBe(60);
	});

	it('refreshes same-height text changes, clears errors, and releases layout and drawing on disposal', () => {
		const test = setup({ custom: [{ codeBlockId: 7, lineNumber: 2, message: 'First error' }] });
		test.store.set('codeErrors.custom', [{ codeBlockId: 7, lineNumber: 2, message: 'Changed error' }]);
		test.render();
		expect(test.drawGlyphs).toHaveBeenLastCalledWith(0, 64, textToGlyphIds(' Changed error'), expect.any(Number));
		test.store.set('codeErrors.custom', []);
		expect(test.block.gaps.size).toBe(0);
		test.drawGlyphs.mockClear();
		test.render();
		expect(test.drawGlyphs).not.toHaveBeenCalled();
		test.store.set('codeErrors.custom', [{ codeBlockId: 7, lineNumber: 2, message: 'Retained error' }]);
		test.dispose();
		expect(test.state.codeErrors.custom).toHaveLength(1);
		expect(test.block.gaps.size).toBe(0);
		test.store.set('codeErrors.custom', [{ codeBlockId: 7, lineNumber: 2, message: 'After disposal' }]);
		test.render();
		expect(test.drawGlyphs).not.toHaveBeenCalled();
		expect(test.block.gaps.size).toBe(0);
	});

	it('matches project-scope errors by group path and document errors by block identity', () => {
		const test = setup();
		test.events.dispatch('loadProject', {
			project: parseProjectSource(`8f4e/v1
pass missing
entry main
group audio
pass nested
entry main
module child
push 1
moduleEnd
entryEnd
groupEnd
entryEnd`),
		});
		const root = test.state.codeBlockRendering.currentProject.blocks;
		const scope = root.find(block => block.isProjectScope)!;
		const group = root.find(block => block.name === 'audio')!;
		const child = group.childProject!.blocks.find(block => block.name === 'child')!;
		test.store.set('codeErrors.custom', [
			{ codeBlockId: -1, projectGroupPath: '', lineNumber: 0, message: 'Root error' },
			{ codeBlockId: -1, projectGroupPath: 'audio', lineNumber: 1, message: 'Group error' },
			{ codeBlockId: child.creationIndex, lineNumber: 1, message: 'Child error' },
		]);
		test.render(scope);
		expect(test.drawGlyphs).toHaveBeenLastCalledWith(
			0,
			expect.any(Number),
			textToGlyphIds(' Root error'),
			expect.any(Number)
		);
		test.drawGlyphs.mockClear();
		test.render(group);
		expect(test.drawGlyphs).toHaveBeenLastCalledWith(
			0,
			expect.any(Number),
			textToGlyphIds(' Group error'),
			expect.any(Number)
		);
		test.events.dispatch('openProjectGroup', { codeBlock: group });
		test.drawGlyphs.mockClear();
		test.render(child);
		expect(test.drawGlyphs).toHaveBeenLastCalledWith(
			0,
			expect.any(Number),
			textToGlyphIds(' Child error'),
			expect.any(Number)
		);
	});
	it('keeps unlocated and unmappable errors visible and clears them with their contributor', () => {
		const test = setup({
			custom: [{ message: 'Worker failed' }, { codeBlockId: 999, lineNumber: 2, message: 'Unmapped source' }],
		});
		test.store.set('viewport.width', 640);
		test.renderOverlay();
		expect(test.drawGlyphs.mock.calls.map(([, , glyphs]) => glyphs)).toEqual([
			textToGlyphIds('Error: Worker failed'),
			textToGlyphIds('Error: Unmapped source'),
		]);
		test.store.set('codeErrors.custom', []);
		test.drawGlyphs.mockClear();
		test.renderOverlay();
		expect(test.drawGlyphs).not.toHaveBeenCalled();
	});
});
