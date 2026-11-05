import { EventEmitter } from 'node:events';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createLoadingIndicatorsPlugin, loadingIndicatorsPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function setup(width = 320, height = 160, plugin = loadingIndicatorsPlugin) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	Object.assign(store.getState().viewport, { width, height });
	const drawers = createEditorDrawerRegistry();
	const dispose = plugin.setup({
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
	const visibleMessages = () => {
		test.draw.drawText.mockClear();
		test.render();
		return test.draw.drawText.mock.calls.filter(([x]) => x === 8).map(([, , text]) => text);
	};
	expect(vi.getTimerCount()).toBe(0);
	test.render();
	expect(test.draw.drawText).not.toHaveBeenCalled();
	const compilation = test.store.loading.add({ id: 'compiler', message: 'Compiling...' });
	const asset = test.store.loading.add({ id: 'asset', message: 'Fetching sound...' });
	const old = test.store.loading.add({ id: 'old', message: 'Old task...' });
	const pending = test.store.loading.add({ id: 'pending', message: 'Still working...' });
	const quick = test.store.loading.add({ id: 'quick', message: 'Quick task...' });
	const slow = test.store.loading.add({ id: 'slow', message: 'Slow task...' });
	expect(vi.getTimerCount()).toBe(1);
	vi.advanceTimersByTime(100);
	quick.done();
	vi.advanceTimersByTime(150);
	asset.fail();
	vi.advanceTimersByTime(10);
	old.cancel();
	vi.advanceTimersByTime(10);
	compilation.done();
	vi.advanceTimersByTime(231);
	slow.done();
	vi.advanceTimersByTime(599);
	expect(visibleMessages()).toContain('Quick task...');
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).not.toContain('Quick task...');
	vi.advanceTimersByTime(99);
	const clock = vi.spyOn(Date, 'now');
	clock.mockClear();
	test.render();
	test.render();
	expect(clock).not.toHaveBeenCalled();
	expect(test.draw.startGroup).toHaveBeenLastCalledWith(0, 64);
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
	vi.advanceTimersByTime(1070);
	expect(readState).not.toHaveBeenCalled();
	expect(visibleMessages()).toHaveLength(5);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Fetching sound...', 'Old task...', 'Still working...', 'Slow task...']);
	readState.mockClear();
	vi.advanceTimersByTime(1230);
	expect(readState).not.toHaveBeenCalled();
	expect(visibleMessages()).toContain('Slow task...');
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Fetching sound...', 'Old task...', 'Still working...']);
	readState.mockClear();
	vi.advanceTimersByTime(1748);
	expect(readState).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Old task...', 'Still working...']);
	vi.advanceTimersByTime(24);
	expect(visibleMessages()).toHaveLength(2);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Still working...']);
	expect(changed).not.toHaveBeenCalled();
	expect(test.store.getState().loadingIndicators).toHaveLength(6);
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
	expect(test.store.getState().loadingIndicators).toHaveLength(6);
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
	for (let index = 0; index < 19; index++)
		test.store.loading.add({ id: `extra-${index}`, message: `Extra task ${index}` });
	test.events.dispatch('resize', { canvasWidth: 256, canvasHeight: 512 });
	test.draw.drawFill.mockClear();
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledTimes(20);
	expect(test.store.getState().loadingIndicators).toHaveLength(22);
});

it('applies custom row limits, refresh intervals, and result visibility timings', () => {
	vi.useFakeTimers();
	vi.setSystemTime(1000);
	const test = setup(
		320,
		160,
		createLoadingIndicatorsPlugin({
			maxVisibleRows: 2,
			elapsedUpdateIntervalMs: 40,
			hideIntervalMs: 15,
			fastOperationThresholdMs: 40,
			mediumOperationThresholdMs: 80,
			fastDoneVisibleMs: 100,
			mediumDoneVisibleMs: 120,
			slowDoneVisibleMs: 140,
			failedVisibleMs: 160,
			cancelledVisibleMs: 180,
		})
	);
	const visibleMessages = () => {
		test.draw.drawText.mockClear();
		test.render();
		return test.draw.drawText.mock.calls.filter(([x]) => x === 8).map(([, , text]) => text);
	};
	const fast = test.store.loading.add({ id: 'fast', message: 'Fast' });
	const alsoFast = test.store.loading.add({ id: 'also-fast', message: 'Also fast' });
	const medium = test.store.loading.add({ id: 'medium', message: 'Medium' });
	const slow = test.store.loading.add({ id: 'slow', message: 'Slow' });
	const failed = test.store.loading.add({ id: 'failed', message: 'Failed' });
	const cancelled = test.store.loading.add({ id: 'cancelled', message: 'Cancelled' });
	vi.advanceTimersByTime(39);
	expect(visibleMessages()).toEqual(['Fast', 'Also fast']);
	expect(test.draw.drawText.mock.calls.map(([, , text]) => text)).toContain(' 0 ms');
	vi.advanceTimersByTime(1);
	visibleMessages();
	expect(test.draw.drawText.mock.calls.map(([, , text]) => text)).toContain(' 40 ms');
	fast.done();
	alsoFast.done();
	vi.advanceTimersByTime(40);
	medium.done();
	vi.advanceTimersByTime(1);
	slow.done();
	failed.fail();
	cancelled.cancel();
	vi.advanceTimersByTime(59);
	expect(visibleMessages()).toEqual(['Fast', 'Also fast']);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Also fast', 'Medium']);
	vi.advanceTimersByTime(14);
	expect(visibleMessages()).toEqual(['Also fast', 'Medium']);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Medium', 'Slow']);
	vi.advanceTimersByTime(44);
	expect(visibleMessages()).toEqual(['Medium', 'Slow']);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Slow', 'Failed']);
	vi.advanceTimersByTime(20);
	expect(visibleMessages()).toEqual(['Slow', 'Failed']);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Failed', 'Cancelled']);
	vi.advanceTimersByTime(19);
	expect(visibleMessages()).toEqual(['Failed', 'Cancelled']);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual(['Cancelled']);
	vi.advanceTimersByTime(19);
	expect(visibleMessages()).toEqual(['Cancelled']);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([]);
	expect(test.store.getState().loadingIndicators).toHaveLength(6);
	expect(vi.getTimerCount()).toBe(0);
});
