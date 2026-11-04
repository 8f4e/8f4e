import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { updateViewport } from '@8f4e/editor-state';
import type { ContextMenuItem } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { contextMenuPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});
const items: ContextMenuItem[] = [
	{ title: 'Actions', isSectionTitle: true },
	{ title: 'Pick', action: 'pick', payload: { value: 42 }, close: true },
	{ title: 'More', action: 'more', close: false },
];
async function setup(content = items, late = false, x = 24, y = 32) {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	events.dispatch('resize', { canvasWidth: 640, canvasHeight: 480 });
	const state = store.getState();
	const drawers = createEditorDrawerRegistry();
	const unregister = store.menus.registerMenu('mainMenu', () => content);
	const install = () =>
		contextMenuPlugin.setup({
			store,
			events,
			drawers,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
		});
	let dispose = late ? undefined : install();
	events.dispatch('contextmenu', { x, y });
	await vi.waitFor(() => expect(state.contextMenu.items).toEqual(content));
	if (late) dispose = install();
	const cleanup = dispose!;
	cleanups.push(() => {
		cleanup();
		unregister();
		store.dispose();
	});
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawText: vi.fn() };
	const render = () => {
		for (const fn of Object.values(draw)) fn.mockClear();
		drawers.drawCanvas({ draw: draw as unknown as DrawContext, state, memoryViews: {} as MemoryViews });
	};
	return { events, store, state, draw, render, dispose: cleanup };
}
it('prepares labels privately and renders a menu opened before installation', async () => {
	const test = await setup(items, true);
	test.state.featureFlags.canvasOverlays = false;
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(24, 32);
	expect(test.draw.drawText.mock.calls.map(call => call[2])).toEqual([
		'Actions ...........',
		'.............. Pick',
		'............ More >',
	]);
	expect(test.state.contextMenu.items).toEqual(items);
	expect(test.state.contextMenu.items[1]).toBe(items[1]);
});
it('hit-tests a completed press without requiring a preceding pointer move', async () => {
	const test = await setup();
	const pick = vi.fn();
	test.events.on('pick', pick);
	test.events.dispatch('pointerdown', { x: 32, y: 56, stopPropagation: false });
	expect(pick).toHaveBeenCalledWith({ value: 42, x: 32, y: 56 });
	expect(test.state.contextMenu.open).toBe(false);
});
it('keeps disabled items and dividers inactive and draws their own styles', async () => {
	const test = await setup([
		{ title: 'Unavailable', action: 'pick', disabled: true },
		{ divider: true },
		{ title: 'Pick', action: 'pick' },
	]);
	const pick = vi.fn();
	test.events.on('pick', pick);
	for (const y of [40, 56]) {
		test.events.dispatch('pointermove', { x: 32, y, stopPropagation: false });
		test.events.dispatch('pointerdown', { x: 32, y, stopPropagation: false });
	}
	test.render();
	expect(pick).not.toHaveBeenCalled();
	expect(test.state.contextMenu.open).toBe(true);
	expect(test.draw.drawText).toHaveBeenCalledWith(
		0,
		0,
		expect.stringContaining('Unavailable'),
		PALETTE_INDICES.floatingMuted
	);
	expect(test.draw.drawText).toHaveBeenCalledTimes(2);
	expect(test.draw.drawFill.mock.calls.every(call => call[2] === PALETTE_INDICES.floatingSurface)).toBe(true);
});
it('tracks hover privately and keeps non-closing menu actions open', async () => {
	const test = await setup();
	const more = vi.fn();
	test.events.on('more', more);
	test.events.dispatch('pointermove', { x: 32, y: 72, stopPropagation: false });
	test.render();
	expect(test.draw.drawText).toHaveBeenCalledWith(0, 0, '............ More >', PALETTE_INDICES.selectionInk);
	test.events.dispatch('pointerdown', { x: 32, y: 72, stopPropagation: false });
	expect(more).toHaveBeenCalledOnce();
	expect(test.state.contextMenu.open).toBe(true);
});
it('closes on outside presses and keeps presses and movement away from blocks', async () => {
	const test = await setup();
	const pick = vi.fn();
	test.events.on('pick', pick);
	const move = { x: 0, y: 0, stopPropagation: false };
	test.events.dispatch('pointermove', move);
	expect(move.stopPropagation).toBe(true);
	const press = { x: 0, y: 0, stopPropagation: false };
	test.events.dispatch('pointerdown', press);
	expect(press.stopPropagation).toBe(true);
	expect(test.state.contextMenu.open).toBe(false);
	expect(pick).not.toHaveBeenCalled();
});
it('reflows on resize, grid changes, and viewport movement without changing the anchor', async () => {
	const test = await setup(items, false, 639, 479);
	const anchor = { x: test.state.contextMenu.x, y: test.state.contextMenu.y };
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(488, 432);
	test.events.dispatch('resize', { canvasWidth: 320, canvasHeight: 240 });
	test.state.viewport.vGrid = 6;
	test.state.viewport.hGrid = 10;
	test.events.dispatch('gridSizeChanged');
	updateViewport(test.state, 600, 450, test.events);
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(42, 30);
	expect(test.state.contextMenu).toMatchObject(anchor);
	const pick = vi.fn();
	test.events.on('pick', pick);
	test.events.dispatch('pointerdown', { x: 48, y: 45, stopPropagation: false });
	expect(pick).toHaveBeenCalledOnce();
});
it('does not activate during capture probes or through modal dialogs', async () => {
	const test = await setup();
	const pick = vi.fn();
	test.events.on('pick', pick);
	test.events.dispatch('pointerdown', { x: 32, y: 56, stopPropagation: false }, { phase: 'capture' });
	test.events.dispatch('addDialog', { id: 'modal', title: 'Wait', text: '', buttons: [] });
	test.events.dispatch('pointerdown', { x: 32, y: 56, stopPropagation: false });
	expect(pick).not.toHaveBeenCalled();
	expect(test.state.contextMenu.open).toBe(true);
});
it('isolates editors and unregisters its presentation without clearing core menu content', async () => {
	const first = await setup();
	const second = await setup(items, false, 80, 96);
	first.dispose();
	first.render();
	second.render();
	expect(first.draw.drawFill).not.toHaveBeenCalled();
	expect(second.draw.startGroup).toHaveBeenCalledWith(80, 96);
	const pick = vi.fn();
	first.events.on('pick', pick);
	first.events.dispatch('pointerdown', { x: 32, y: 56, stopPropagation: false });
	expect(pick).not.toHaveBeenCalled();
	expect(first.state.contextMenu.items).toEqual(items);
});
