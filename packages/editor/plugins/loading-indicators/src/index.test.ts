import { EventEmitter } from 'node:events';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews, textToGlyphIds } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createLoadingIndicatorsPlugin, loadingIndicatorsPlugin } from './index';

const cleanups: Array<() => void> = [];
const TEXT_X_WITH_ORBIT = 88;
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
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
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawGlyphs: vi.fn() };
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
	const test = setup(352);
	const visibleMessages = () => {
		test.draw.drawGlyphs.mockClear();
		test.render();
		return test.draw.drawGlyphs.mock.calls.filter(([x]) => x === TEXT_X_WITH_ORBIT).map(([, , text]) => text);
	};
	expect(vi.getTimerCount()).toBe(0);
	test.render();
	expect(test.draw.drawGlyphs).not.toHaveBeenCalled();
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
	expect(visibleMessages()).toContainEqual(textToGlyphIds('Quick task...'));
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).not.toContainEqual(textToGlyphIds('Quick task...'));
	vi.advanceTimersByTime(99);
	const clock = vi.spyOn(Date, 'now');
	clock.mockClear();
	test.render();
	test.render();
	expect(clock).not.toHaveBeenCalled();
	expect(test.draw.startGroup).toHaveBeenLastCalledWith(0, 80);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
		TEXT_X_WITH_ORBIT,
		0,
		textToGlyphIds('Compiling...'),
		PALETTE_INDICES.floatingInk
	);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(184, 0, textToGlyphIds(' done'), PALETTE_INDICES.positiveBase);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(224, 0, textToGlyphIds(' 270 ms'), PALETTE_INDICES.floatingMuted);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(224, 16, textToGlyphIds(' failed'), PALETTE_INDICES.negativeBase);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
		176,
		32,
		textToGlyphIds(' cancelled'),
		PALETTE_INDICES.floatingMuted
	);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(216, 48, textToGlyphIds(' 1.2 s'), PALETTE_INDICES.floatingMuted);
	expect(test.store.getState().dialogStack).toEqual([]);
	const changed = vi.fn();
	test.store.subscribe('loadingIndicators', changed);
	const readState = vi.spyOn(test.store, 'getState');
	vi.advanceTimersByTime(1070);
	expect(readState).not.toHaveBeenCalled();
	expect(visibleMessages()).toHaveLength(5);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([
		textToGlyphIds('Fetching sound...'),
		textToGlyphIds('Old task...'),
		textToGlyphIds('Still working...'),
		textToGlyphIds('Slow task...'),
	]);
	readState.mockClear();
	vi.advanceTimersByTime(1230);
	expect(readState).not.toHaveBeenCalled();
	expect(visibleMessages()).toContainEqual(textToGlyphIds('Slow task...'));
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([
		textToGlyphIds('Fetching sound...'),
		textToGlyphIds('Old task...'),
		textToGlyphIds('Still working...'),
	]);
	readState.mockClear();
	vi.advanceTimersByTime(1748);
	expect(readState).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([textToGlyphIds('Old task...'), textToGlyphIds('Still working...')]);
	vi.advanceTimersByTime(24);
	expect(visibleMessages()).toHaveLength(2);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([textToGlyphIds('Still working...')]);
	expect(changed).not.toHaveBeenCalled();
	expect(test.store.getState().loadingIndicators).toHaveLength(6);
	test.store.set('viewport.width', 400);
	expect(visibleMessages()).toEqual([textToGlyphIds('Still working...')]);
	expect(vi.getTimerCount()).toBe(1);
	test.store.set('featureFlags.canvasOverlays', false);
	expect(vi.getTimerCount()).toBe(0);
	test.store.set('featureFlags.canvasOverlays', true);
	pending.cancel();
	const retry = test.store.loading.add({ id: 'compiler', message: 'Compiling again...' });
	expect(visibleMessages()).toEqual([textToGlyphIds('Compiling again...'), textToGlyphIds('Still working...')]);
	retry.done();
	expect(vi.getTimerCount()).toBe(1);
	test.dispose();
	expect(vi.getTimerCount()).toBe(0);
	vi.advanceTimersByTime(6000);
	expect(test.store.getState().loadingIndicators).toHaveLength(6);
	test.draw.drawGlyphs.mockClear();
	test.render();
	expect(test.draw.drawGlyphs).not.toHaveBeenCalled();
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
	expect(test.draw.drawFill).toHaveBeenCalledTimes(3);
	for (const [x, , text] of test.draw.drawGlyphs.mock.calls) expect(x / 8 - 1 + text.length).toBeLessThanOrEqual(14);
	test.store.set('viewport.width', 64);
	test.draw.drawGlyphs.mockClear();
	test.render();
	for (const [x, , text] of test.draw.drawGlyphs.mock.calls) expect(x / 8 - 1 + text.length).toBeLessThanOrEqual(6);
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

it('draws the square orbit while loading and leaves settled messages in place without it', () => {
	vi.useFakeTimers();
	const test = setup();
	const pending = test.store.loading.add({ id: 'compiler', message: 'Compiling...' });
	const orbit = () => {
		test.draw.drawGlyphs.mockClear();
		test.render();
		return test.draw.drawGlyphs.mock.calls.filter(([x]) => x === 8).map(([, , glyphs]) => glyphs);
	};
	const first = ['······∙•', '·      ○', '·      ·', '········'].map(textToGlyphIds);
	const second = ['·······∙', '·      •', '·      ○', '········'].map(textToGlyphIds);
	expect(orbit()).toEqual(first);
	expect(test.draw.startGroup).toHaveBeenLastCalledWith(0, 96);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
		TEXT_X_WITH_ORBIT,
		48,
		textToGlyphIds('Compiling...'),
		PALETTE_INDICES.floatingInk
	);
	vi.advanceTimersByTime(77);
	expect(orbit()).toEqual(first);
	vi.advanceTimersByTime(1);
	expect(orbit()).toEqual(second);
	vi.advanceTimersByTime(78);
	expect(orbit()[3]).toEqual(textToGlyphIds('·······○'));
	vi.advanceTimersByTime(18 * 78);
	expect(orbit()).toEqual(first);
	pending.done();
	expect(orbit()).toEqual([]);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
		TEXT_X_WITH_ORBIT,
		48,
		textToGlyphIds('Compiling...'),
		PALETTE_INDICES.floatingInk
	);
	vi.advanceTimersByTime(78);
	expect(orbit()).toEqual([]);
	vi.advanceTimersByTime(3000 - 78);
	expect(orbit()).toEqual([]);
	expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
		TEXT_X_WITH_ORBIT,
		48,
		textToGlyphIds('Compiling...'),
		PALETTE_INDICES.floatingInk
	);
	vi.advanceTimersByTime(1);
	expect(orbit()).toEqual([]);
	expect(test.draw.drawGlyphs).not.toHaveBeenCalled();
});

it('keeps the orbit until the last pending operation settles, even if its row is clipped', () => {
	vi.useFakeTimers();
	const test = setup(320, 160, createLoadingIndicatorsPlugin({ maxVisibleRows: 1 }));
	const first = test.store.loading.add({ id: 'compiler', message: 'Compiling...' });
	const second = test.store.loading.add({ id: 'asset', message: 'Fetching sound...' });
	const orbit = () => {
		test.draw.drawGlyphs.mockClear();
		test.render();
		return test.draw.drawGlyphs.mock.calls.filter(([x]) => x === 8);
	};
	expect(orbit()).toHaveLength(4);
	first.done();
	expect(orbit()).toHaveLength(4);
	expect(test.draw.drawGlyphs).not.toHaveBeenCalledWith(
		TEXT_X_WITH_ORBIT,
		48,
		textToGlyphIds('Fetching sound...'),
		PALETTE_INDICES.floatingInk
	);
	second.cancel();
	expect(orbit()).toHaveLength(0);
	test.store.loading.add({ id: 'next', message: 'Starting another task...' });
	expect(orbit()).toHaveLength(4);
});

it('keeps the orbit and message stack bottom-aligned as messages are added and expire', () => {
	vi.useFakeTimers();
	const test = setup();
	test.store.loading.add({ id: 'compiler', message: 'Compiling...' });
	const checkLayout = (visibleRows: number) => {
		test.draw.drawFill.mockClear();
		test.draw.drawGlyphs.mockClear();
		test.render();
		const [left, top] = test.draw.startGroup.mock.lastCall!;
		const orbitCells = test.draw.drawGlyphs.mock.calls.filter(([x]) => x === 8).map(([x, y]) => [left + x, top + y]);
		expect(orbitCells).toEqual([
			[8, 96],
			[8, 112],
			[8, 128],
			[8, 144],
		]);
		expect(test.draw.drawFill.mock.calls.map(([x, y]) => [left + x, top + y])).toEqual(
			Array.from({ length: visibleRows }, (_, index) => [80, 160 - (visibleRows - index) * 16])
		);
	};
	checkLayout(1);
	for (let index = 0; index < 5; index++) {
		test.store.loading.add({ id: `task-${index}`, message: 'Loading asset...' }).done();
	}
	checkLayout(6);
	vi.advanceTimersByTime(1076);
	checkLayout(2);
	vi.advanceTimersByTime(25);
	checkLayout(1);
});

it('keeps the orbit phase when a new editor is mounted', () => {
	vi.useFakeTimers();
	const first = setup();
	first.store.loading.add({ id: 'initial', message: 'Loading first project...' });
	vi.advanceTimersByTime(156);
	first.render();
	const orbit = first.draw.drawGlyphs.mock.calls.filter(([x]) => x === 8);
	expect(orbit.map(([, , glyphs]) => glyphs)[3]).toEqual(textToGlyphIds('·······○'));
	first.dispose();

	const second = setup();
	second.store.loading.add({ id: 'replacement', message: 'Loading second project...' });
	second.render();
	expect(second.draw.drawGlyphs.mock.calls.filter(([x]) => x === 8)).toEqual(orbit);
});

it('aligns glyphs and text fills to whole cells on a viewport with partial rows and columns', () => {
	vi.useFakeTimers();
	const test = setup(327, 173);
	test.store.loading.add({ id: 'compiler', message: 'Compiling...' });
	const checkGrid = (cellWidth: number, cellHeight: number) => {
		test.draw.drawFill.mockClear();
		test.draw.drawGlyphs.mockClear();
		test.render();
		const [left, top] = test.draw.startGroup.mock.lastCall!;
		const orbit = test.draw.drawGlyphs.mock.calls.filter(([x]) => x === cellWidth);
		expect(orbit.map(([, y]) => top + y)).toEqual(
			[4, 3, 2, 1].map(offset => (Math.floor(173 / cellHeight) - offset) * cellHeight)
		);
		for (const [x, y] of [...test.draw.drawGlyphs.mock.calls, ...test.draw.drawFill.mock.calls]) {
			expect((left + x) % cellWidth).toBe(0);
			expect((top + y) % cellHeight).toBe(0);
		}
	};
	checkGrid(8, 16);
	test.store.loading.add({ id: 'assets', message: 'Loading assets...' });
	test.store.loading.add({ id: 'plugins', message: 'Loading plugins...' });
	checkGrid(8, 16);
	Object.assign(test.store.getState().viewport, { vGrid: 5, hGrid: 11 });
	test.events.dispatch('gridSizeChanged');
	checkGrid(5, 11);
});

it('freezes the orbit for reduced motion and falls back to text on a narrow or short viewport', () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: true }))
	);
	const test = setup();
	test.store.loading.add({ id: 'compiler', message: 'Compiling...' });
	const render = () => {
		test.draw.drawGlyphs.mockClear();
		test.draw.drawFill.mockClear();
		test.render();
		return test.draw.drawGlyphs.mock.calls.filter(([x]) => x === 8).map(([, , glyphs]) => glyphs);
	};
	const initial = render();
	expect(initial).toHaveLength(4);
	vi.advanceTimersByTime(260);
	expect(render()).toEqual(initial);
	for (const [width, height] of [
		[223, 160],
		[320, 63],
	]) {
		test.events.dispatch('resize', { canvasWidth: width, canvasHeight: height });
		expect(render()).toEqual([textToGlyphIds('Compiling...')]);
		expect(test.draw.drawFill).toHaveBeenCalledTimes(1);
	}
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
		test.draw.drawGlyphs.mockClear();
		test.render();
		return test.draw.drawGlyphs.mock.calls.filter(([x]) => x === TEXT_X_WITH_ORBIT).map(([, , text]) => text);
	};
	const fast = test.store.loading.add({ id: 'fast', message: 'Fast' });
	const alsoFast = test.store.loading.add({ id: 'also-fast', message: 'Also fast' });
	const medium = test.store.loading.add({ id: 'medium', message: 'Medium' });
	const slow = test.store.loading.add({ id: 'slow', message: 'Slow' });
	const failed = test.store.loading.add({ id: 'failed', message: 'Failed' });
	const cancelled = test.store.loading.add({ id: 'cancelled', message: 'Cancelled' });
	vi.advanceTimersByTime(39);
	expect(visibleMessages()).toEqual([textToGlyphIds('Fast'), textToGlyphIds('Also fast')]);
	expect(test.draw.drawGlyphs.mock.calls.map(([, , text]) => text)).toContainEqual(textToGlyphIds(' 0 ms'));
	vi.advanceTimersByTime(1);
	visibleMessages();
	expect(test.draw.drawGlyphs.mock.calls.map(([, , text]) => text)).toContainEqual(textToGlyphIds(' 40 ms'));
	fast.done();
	alsoFast.done();
	vi.advanceTimersByTime(40);
	medium.done();
	vi.advanceTimersByTime(1);
	slow.done();
	failed.fail();
	cancelled.cancel();
	vi.advanceTimersByTime(59);
	expect(visibleMessages()).toEqual([textToGlyphIds('Fast'), textToGlyphIds('Also fast')]);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([textToGlyphIds('Also fast'), textToGlyphIds('Medium')]);
	vi.advanceTimersByTime(14);
	expect(visibleMessages()).toEqual([textToGlyphIds('Also fast'), textToGlyphIds('Medium')]);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([textToGlyphIds('Medium'), textToGlyphIds('Slow')]);
	vi.advanceTimersByTime(44);
	expect(visibleMessages()).toEqual([textToGlyphIds('Medium'), textToGlyphIds('Slow')]);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([textToGlyphIds('Slow'), textToGlyphIds('Failed')]);
	vi.advanceTimersByTime(20);
	expect(visibleMessages()).toEqual([textToGlyphIds('Slow'), textToGlyphIds('Failed')]);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([textToGlyphIds('Failed'), textToGlyphIds('Cancelled')]);
	vi.advanceTimersByTime(19);
	expect(visibleMessages()).toEqual([textToGlyphIds('Failed'), textToGlyphIds('Cancelled')]);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([textToGlyphIds('Cancelled')]);
	vi.advanceTimersByTime(19);
	expect(visibleMessages()).toEqual([textToGlyphIds('Cancelled')]);
	vi.advanceTimersByTime(1);
	expect(visibleMessages()).toEqual([]);
	expect(test.store.getState().loadingIndicators).toHaveLength(6);
	expect(vi.getTimerCount()).toBe(0);
});
