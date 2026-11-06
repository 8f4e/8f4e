import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockState, createMockViewport } from '@8f4e/editor-state-testing';
import type { ContextMenuItem } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
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
function setup({
	content = items,
	openBeforeInstall = false,
	x = 24,
	y = 32,
}: {
	content?: ContextMenuItem[];
	openBeforeInstall?: boolean;
	x?: number;
	y?: number;
} = {}) {
	const events = createEvents();
	const state = createMockState({ viewport: createMockViewport(0, 0, 640, 480) });
	const store = createStateManager(state);
	const drawers = createEditorDrawerRegistry();
	const activate = vi.fn();
	const close = vi.fn();
	events.on('activateContextMenuItem', activate);
	events.on('closeContextMenu', close);
	const open = () => store.set('contextMenu', { open: true, x, y, items: content, menuStack: [] });
	if (openBeforeInstall) open();
	const dispose = contextMenuPlugin.setup({
		store,
		events,
		drawers,
	} as unknown as EditorPluginContext);
	if (!openBeforeInstall) open();
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawText: vi.fn() };
	const render = () => {
		for (const fn of Object.values(draw)) fn.mockClear();
		drawers.drawContextMenuOverlays({ draw: draw as unknown as DrawContext, state, memoryViews: {} as MemoryViews });
	};
	return { events, state, draw, render, dispose, activate, close };
}
it('prepares labels privately and renders a menu opened before installation', () => {
	const test = setup({ openBeforeInstall: true });
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
it('requests activation for a forwarded press without requiring a preceding pointer move', () => {
	const test = setup();
	test.events.dispatch('contextMenuPointerDown', { x: 32, y: 56 });
	expect(test.activate).toHaveBeenCalledExactlyOnceWith({ index: 1, x: 32, y: 56 });
});
it('draws disabled items and dividers without hover highlighting', () => {
	const test = setup({
		content: [
			{ title: 'Unavailable', action: 'pick', disabled: true },
			{ divider: true },
			{ title: 'Pick', action: 'pick' },
		],
	});
	for (const y of [40, 56]) {
		test.events.dispatch('contextMenuPointerMove', { x: 32, y });
		test.render();
		expect(test.draw.drawFill.mock.calls.every(call => call[2] === PALETTE_INDICES.floatingSurface)).toBe(true);
	}
	expect(test.draw.drawText).toHaveBeenCalledWith(
		0,
		0,
		expect.stringContaining('Unavailable'),
		PALETTE_INDICES.floatingMuted
	);
	expect(test.draw.drawText).toHaveBeenCalledTimes(2);
});
it('tracks hover privately and requests activation of the hit row', () => {
	const test = setup();
	test.events.dispatch('contextMenuPointerMove', { x: 32, y: 72 });
	test.render();
	expect(test.draw.drawText).toHaveBeenCalledWith(0, 0, '............ More >', PALETTE_INDICES.selectionInk);
	test.events.dispatch('contextMenuPointerDown', { x: 32, y: 72 });
	expect(test.activate).toHaveBeenCalledExactlyOnceWith({ index: 2, x: 32, y: 72 });
});
it('clears hover outside the menu and requests closure on an outside press', () => {
	const test = setup();
	test.events.dispatch('contextMenuPointerMove', { x: 0, y: 0 });
	test.render();
	expect(test.draw.drawFill.mock.calls.every(call => call[2] === PALETTE_INDICES.floatingSurface)).toBe(true);
	test.events.dispatch('contextMenuPointerDown', { x: 0, y: 0 });
	expect(test.close).toHaveBeenCalledOnce();
	expect(test.activate).not.toHaveBeenCalled();
});
it('reflows on resize, grid changes, and viewport movement without changing the anchor', () => {
	const test = setup({ x: 639, y: 479 });
	const anchor = { x: test.state.contextMenu.x, y: test.state.contextMenu.y };
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(488, 432);
	test.state.viewport.width = 320;
	test.state.viewport.height = 240;
	test.events.dispatch('resize', { canvasWidth: 320, canvasHeight: 240 });
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(168, 192);
	test.state.viewport.vGrid = 6;
	test.state.viewport.hGrid = 10;
	test.events.dispatch('gridSizeChanged');
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(206, 210);
	test.state.viewport.x = 600;
	test.state.viewport.y = 450;
	test.events.dispatch('viewportChanged', { previousX: 0, previousY: 0, x: 600, y: 450 });
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledWith(42, 30);
	expect(test.state.contextMenu).toMatchObject(anchor);
	test.events.dispatch('contextMenuPointerDown', { x: 48, y: 45 });
	expect(test.activate).toHaveBeenCalledExactlyOnceWith({ index: 1, x: 48, y: 45 });
});
it('isolates editors and unregisters its presentation without clearing core menu content', () => {
	const first = setup();
	const second = setup({ x: 80, y: 96 });
	first.dispose();
	first.render();
	second.render();
	expect(first.draw.drawFill).not.toHaveBeenCalled();
	expect(second.draw.startGroup).toHaveBeenCalledWith(80, 96);
	first.events.dispatch('contextMenuPointerDown', { x: 32, y: 56 });
	expect(first.activate).not.toHaveBeenCalled();
	expect(first.state.contextMenu.items).toEqual(items);
});
