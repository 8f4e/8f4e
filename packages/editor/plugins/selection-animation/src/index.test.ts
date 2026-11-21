import initState from '@8f4e/editor-state';
import { createMockCodeBlock, createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectionAnimationPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

function setup() {
	const events = createMockEventDispatcher();
	const store = initState(events, { callbacks: {} });
	const drawers = createEditorDrawerRegistry();
	const dispose = selectionAnimationPlugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	cleanups.push(store.dispose, dispose);
	const drawGlyphs = vi.fn();
	const draw = { drawGlyphs } as unknown as DrawContext;
	const state = store.getState();
	const block = createMockCodeBlock({ width: 96, height: 64 });
	const render = (codeBlock = block) =>
		drawers.drawCodeBlock({ draw, state, codeBlock, memoryViews: {} as MemoryViews });
	return { state, block, drawGlyphs, render, dispose };
}

describe('selection animation plugin', () => {
	it.each(['view', 'edit'] as const)('follows selection in %s mode and unregisters on disposal', mode => {
		const { state, block, drawGlyphs, render, dispose } = setup();
		state.editorMode = mode;
		const other = createMockCodeBlock({ creationIndex: 1 });
		render();
		expect(drawGlyphs).not.toHaveBeenCalled();

		state.codeBlockRendering.selectedCodeBlock = block;
		render();
		render(other);
		expect(drawGlyphs).toHaveBeenCalledTimes(4);

		drawGlyphs.mockClear();
		state.codeBlockRendering.selectedCodeBlock = other;
		render();
		expect(drawGlyphs).not.toHaveBeenCalled();
		render(other);
		expect(drawGlyphs).toHaveBeenCalledTimes(4);

		drawGlyphs.mockClear();
		state.codeBlockRendering.selectedCodeBlock = undefined;
		render();
		render(other);
		expect(drawGlyphs).not.toHaveBeenCalled();

		state.codeBlockRendering.selectedCodeBlock = block;
		dispose();
		render();
		expect(drawGlyphs).not.toHaveBeenCalled();
	});

	it.each([
		{ width: 96, height: 64, vGrid: 8, hGrid: 16, loopDurationMs: 2160 },
		{ width: 48, height: 24, vGrid: 6, hGrid: 12, loopDurationMs: 1520 },
	])('loops around a $width by $height block with a $vGrid by $hGrid font grid', options => {
		const { state, block, drawGlyphs, render } = setup();
		block.width = options.width;
		block.height = options.height;
		state.viewport.vGrid = options.vGrid;
		state.viewport.hGrid = options.hGrid;
		state.codeBlockRendering.selectedCodeBlock = block;
		const now = vi.spyOn(performance, 'now').mockReturnValue(0);
		render();
		const initial = [...drawGlyphs.mock.calls];
		expect(initial).toHaveLength(4);

		drawGlyphs.mockClear();
		now.mockReturnValue(80);
		render();
		expect(drawGlyphs.mock.calls).not.toEqual(initial);

		drawGlyphs.mockClear();
		now.mockReturnValue(options.loopDurationMs);
		render();
		expect(drawGlyphs.mock.calls).toEqual(initial);
	});
});
