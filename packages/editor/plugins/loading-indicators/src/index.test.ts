import { EventEmitter } from 'node:events';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { loadingIndicatorsPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function setup(width = 320, height = 160) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	Object.assign(store.getState().viewport, { width, height });
	const drawers = createEditorDrawerRegistry();
	const dispose = loadingIndicatorsPlugin.setup({
		store,
		events,
		drawers,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
	});
	cleanups.push(store.dispose, dispose);
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawText: vi.fn() };
	const render = () =>
		drawers.drawCanvasOverlays({
			draw: draw as unknown as DrawContext,
			state: store.getState(),
			memoryViews: {} as MemoryViews,
		});
	return { store, draw, render, dispose };
}

it('draws custom messages and frozen terminal times, then expires results without rendering', () => {
	vi.useFakeTimers();
	vi.setSystemTime(1000);
	const test = setup();
	test.render();
	expect(test.draw.drawText).not.toHaveBeenCalled();
	const compilation = test.store.loading.add({ id: 'compiler', message: 'Compiling...' });
	const asset = test.store.loading.add({ id: 'asset', message: 'Fetching sound...' });
	const old = test.store.loading.add({ id: 'old', message: 'Old task...' });
	test.store.loading.add({ id: 'pending', message: 'Still working...' });
	vi.advanceTimersByTime(250);
	asset.fail();
	vi.advanceTimersByTime(100);
	old.cancel();
	vi.advanceTimersByTime(100);
	compilation.done();
	vi.advanceTimersByTime(800);
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(0, 80);
	expect(test.draw.drawText).toHaveBeenCalledWith(8, 0, 'Compiling...', PALETTE_INDICES.floatingInk);
	expect(test.draw.drawText).toHaveBeenCalledWith(104, 0, ' done', PALETTE_INDICES.positiveBase);
	expect(test.draw.drawText).toHaveBeenCalledWith(144, 0, ' 450 ms', PALETTE_INDICES.floatingMuted);
	expect(test.draw.drawText).toHaveBeenCalledWith(144, 16, ' failed', PALETTE_INDICES.negativeBase);
	expect(test.draw.drawText).toHaveBeenCalledWith(96, 32, ' cancelled', PALETTE_INDICES.floatingMuted);
	expect(test.draw.drawText).toHaveBeenCalledWith(136, 48, ' 1.3 s', PALETTE_INDICES.floatingMuted);
	expect(test.store.getState().dialogStack).toEqual([]);
	vi.advanceTimersByTime(4000);
	expect(test.store.getState().loadingIndicators).toHaveLength(4);
	vi.advanceTimersByTime(250);
	expect(test.store.getState().loadingIndicators.map(indicator => indicator.id)).toEqual([
		'compiler',
		'old',
		'pending',
	]);
	vi.advanceTimersByTime(249);
	expect(test.store.getState().loadingIndicators).toHaveLength(3);
	vi.advanceTimersByTime(1);
	expect(test.store.getState().loadingIndicators.map(indicator => indicator.id)).toEqual(['compiler', 'pending']);
	vi.advanceTimersByTime(250);
	expect(test.store.getState().loadingIndicators).toMatchObject([{ id: 'pending', status: 'loading' }]);
	test.dispose();
	expect(vi.getTimerCount()).toBe(0);
	test.draw.drawText.mockClear();
	test.render();
	expect(test.draw.drawText).not.toHaveBeenCalled();
});

it('limits messages and lists to the viewport while reserving room for elapsed time', () => {
	vi.spyOn(Date, 'now').mockReturnValue(1000);
	const test = setup(128, 48);
	for (const [id, message] of [
		['a', 'a very long message'],
		['b', 'b'],
		['c', 'c'],
	])
		test.store.loading.add({ id, message });
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(0, 0);
	expect(test.draw.drawFill).toHaveBeenCalledTimes(2);
	for (const [x, , text] of test.draw.drawText.mock.calls) expect(x / 8 - 1 + text.length).toBeLessThanOrEqual(14);
});
