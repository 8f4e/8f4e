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
	return { store, events, draw, render, dispose };
}

it('draws cached results, hides them by outcome, and retains every contribution', () => {
	vi.useFakeTimers();
	vi.setSystemTime(1000);
	const test = setup();
	expect(vi.getTimerCount()).toBe(0);
	test.render();
	expect(test.draw.drawText).not.toHaveBeenCalled();
	const compilation = test.store.loading.add({ id: 'compiler', message: 'Compiling...' });
	const asset = test.store.loading.add({ id: 'asset', message: 'Fetching sound...' });
	const old = test.store.loading.add({ id: 'old', message: 'Old task...' });
	const pending = test.store.loading.add({ id: 'pending', message: 'Still working...' });
	expect(vi.getTimerCount()).toBe(1);
	vi.advanceTimersByTime(250);
	asset.fail();
	vi.advanceTimersByTime(10);
	old.cancel();
	vi.advanceTimersByTime(10);
	compilation.done();
	vi.advanceTimersByTime(930);
	const clock = vi.spyOn(Date, 'now');
	clock.mockClear();
	test.render();
	test.render();
	expect(clock).not.toHaveBeenCalled();
	expect(test.draw.startGroup).toHaveBeenCalledWith(0, 80);
	expect(test.draw.drawText).toHaveBeenCalledWith(8, 0, 'Compiling...', PALETTE_INDICES.floatingInk);
	expect(test.draw.drawText).toHaveBeenCalledWith(104, 0, ' done', PALETTE_INDICES.positiveBase);
	expect(test.draw.drawText).toHaveBeenCalledWith(144, 0, ' 270 ms', PALETTE_INDICES.floatingMuted);
	expect(test.draw.drawText).toHaveBeenCalledWith(144, 16, ' failed', PALETTE_INDICES.negativeBase);
	expect(test.draw.drawText).toHaveBeenCalledWith(96, 32, ' cancelled', PALETTE_INDICES.floatingMuted);
	expect(test.draw.drawText).toHaveBeenCalledWith(136, 48, ' 1.2 s', PALETTE_INDICES.floatingMuted);
	expect(test.store.getState().dialogStack).toEqual([]);
	const changed = vi.fn();
	test.store.subscribe('loadingIndicators', changed);
	const readState = vi.spyOn(test.store, 'getState');
	vi.advanceTimersByTime(70);
	expect(readState).not.toHaveBeenCalled();
	const visibleMessages = () => {
		test.draw.drawText.mockClear();
		test.render();
		return test.draw.drawText.mock.calls.filter(([x]) => x === 8).map(([, , text]) => text);
	};
	expect(visibleMessages()).toHaveLength(4);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Fetching sound...', 'Old task...', 'Still working...']);
	readState.mockClear();
	vi.advanceTimersByTime(3979);
	expect(readState).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Old task...', 'Still working...']);
	vi.advanceTimersByTime(49);
	expect(visibleMessages()).toHaveLength(2);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Still working...']);
	expect(changed).not.toHaveBeenCalled();
	expect(test.store.getState().loadingIndicators).toHaveLength(4);
	test.store.set('viewport.width', 400);
	expect(visibleMessages()).toEqual(['Still working...']);
	expect(vi.getTimerCount()).toBe(1);
	test.store.set('featureFlags.canvasOverlays', false);
	expect(vi.getTimerCount()).toBe(0);
	test.store.set('featureFlags.canvasOverlays', true);
	pending.cancel();
	const retry = test.store.loading.add({ id: 'compiler', message: 'Compiling again...' });
	expect(visibleMessages()).toEqual(['Compiling again...', 'Still working...']);
	retry.done();
	expect(vi.getTimerCount()).toBe(1);
	test.dispose();
	expect(vi.getTimerCount()).toBe(0);
	vi.advanceTimersByTime(6000);
	expect(test.store.getState().loadingIndicators).toHaveLength(4);
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
	test.store.set('viewport.width', 64);
	test.draw.drawText.mockClear();
	test.render();
	for (const [x, , text] of test.draw.drawText.mock.calls) expect(x / 8 - 1 + text.length).toBeLessThanOrEqual(6);
	test.events.dispatch('resize', { canvasWidth: 256, canvasHeight: 64 });
	test.draw.drawFill.mockClear();
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledTimes(3);
	Object.assign(test.store.getState().viewport, { vGrid: 4, hGrid: 8 });
	test.events.dispatch('gridSizeChanged');
	test.render();
	expect(test.draw.startGroup).toHaveBeenLastCalledWith(0, 32);
});
