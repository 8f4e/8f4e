import { EventEmitter } from 'node:events';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { loadingIndicatorsPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
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

it('draws live indicators in list order at the bottom of the viewport', () => {
	const test = setup();
	test.render();
	expect(test.draw.drawText).not.toHaveBeenCalled();
	test.store.set('loadingIndicators', [{ name: 'plot' }, { name: 'sound' }]);
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(0, 112);
	expect(test.draw.drawText.mock.calls.map(call => call.slice(0, 3))).toEqual([
		[8, 0, 'Loading plot...'],
		[8, 16, 'Loading sound...'],
	]);
	expect(test.store.getState().dialogStack).toEqual([]);
	test.dispose();
	test.draw.drawText.mockClear();
	test.render();
	expect(test.draw.drawText).not.toHaveBeenCalled();
	expect(test.store.getState().loadingIndicators).toHaveLength(2);
});

it('limits long names and lists to the available viewport', () => {
	const test = setup(128, 48);
	test.store.set('loadingIndicators', [{ name: 'a very long asset name' }, { name: 'b' }, { name: 'c' }]);
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(0, 0);
	expect(test.draw.drawText).toHaveBeenCalledTimes(2);
	for (const [, , line] of test.draw.drawText.mock.calls) expect(line.length).toBeLessThanOrEqual(14);
});
