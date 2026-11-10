import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import type { DialogContent } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews, textToGlyphIds } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { dialogsPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});
const content: DialogContent = {
	id: 'permission',
	title: 'Permission',
	text: 'Allow audio?',
	buttons: [{ title: 'Allow', action: 'allowAudio', payload: 42 }],
};

function setup(initialDialog?: DialogContent) {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	events.dispatch('resize', { canvasWidth: 640, canvasHeight: 768 });
	if (initialDialog) events.dispatch('addDialog', initialDialog);
	const state = store.getState();
	const drawers = createEditorDrawerRegistry();
	const dispose = dialogsPlugin.setup({
		store,
		events,
		drawers,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
	});
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawGlyphs: vi.fn() };
	const render = () => {
		for (const fn of Object.values(draw)) fn.mockClear();
		drawers.drawModalOverlays({ draw: draw as unknown as DrawContext, state, memoryViews: {} as MemoryViews });
	};
	return { events, store, state, render, draw, dispose };
}

describe('dialogs plugin', () => {
	it('renders a dialog opened before installation with the existing colors and button padding', () => {
		const test = setup(content);
		test.state.featureFlags.canvasOverlays = false;
		test.render();
		expect(test.draw.startGroup).toHaveBeenCalledWith(64, 320);
		expect(test.draw.drawFill).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.scrim, 640, 768);
		expect(test.draw.drawFill).toHaveBeenCalledWith(400, 80, PALETTE_INDICES.selectionSurface, 104, 48);
		expect(test.draw.drawGlyphs).toHaveBeenCalledWith(432, 96, textToGlyphIds('Allow'), PALETTE_INDICES.selectionInk);
		expect(test.state.dialog).toEqual(content);
	});

	it('reflows on resize and font grid changes, keeping hit testing in sync', () => {
		const test = setup(content);
		const allow = vi.fn();
		test.events.on('allowAudio', allow);
		test.events.dispatch('resize', { canvasWidth: 320, canvasHeight: 768 });
		test.render();
		expect(test.draw.startGroup).toHaveBeenCalledWith(8, 320);
		test.state.viewport.vGrid = 6;
		test.state.viewport.hGrid = 10;
		test.events.dispatch('gridSizeChanged');
		test.render();
		expect(test.draw.startGroup).toHaveBeenCalledWith(6, 340);
		// Coordinates are inside the rendered button after both layout changes.
		test.events.dispatch('pointerdown', { x: 250, y: 400, stopPropagation: false });
		expect(allow).toHaveBeenCalledWith(42);
		expect(test.state.dialogStack).toEqual([]);
	});

	it('leaves gaps between wrapped rows inactive while preserving button actions', () => {
		const test = setup();
		const allow = vi.fn();
		test.events.on('allowAudio', allow);
		test.events.dispatch('resize', { canvasWidth: 320, canvasHeight: 768 });
		test.events.dispatch('addDialog', {
			...content,
			buttons: [{ title: 'Cancel' }, { title: 'More information' }, { title: 'Allow audio', action: 'allowAudio' }],
		});
		test.render();
		const [originX, originY] = test.draw.startGroup.mock.calls.at(-1)!;
		const buttons = test.draw.drawFill.mock.calls.filter(([, , color]) => color === PALETTE_INDICES.selectionSurface);
		const [first, second, third] = buttons;
		expect(second[1] - first[1] - first[4]).toBe(16);
		const gapPress = { x: originX + first[0] + 1, y: originY + first[1] + first[4] + 8, stopPropagation: false };
		test.events.dispatch('pointerdown', gapPress);
		expect(gapPress.stopPropagation).toBe(true);
		expect(test.state.dialogStack).toHaveLength(1);
		expect(allow).not.toHaveBeenCalled();
		test.events.dispatch('pointerdown', {
			x: originX + third[0] + 1,
			y: originY + third[1] + 1,
			stopPropagation: false,
		});
		expect(allow).toHaveBeenCalledOnce();
		expect(test.state.dialogStack).toEqual([]);
	});

	it('uses only the visible dialog and ignores capture probes and clicks outside buttons', () => {
		const test = setup(content);
		const allow = vi.fn();
		test.events.on('allowAudio', allow);
		test.events.dispatch('addDialog', { ...content, id: 'second', title: 'Second', buttons: [] });
		test.render();
		expect(test.draw.drawGlyphs).toHaveBeenCalledWith(8, 16, textToGlyphIds('Second'), PALETTE_INDICES.floatingAccent);
		test.events.dispatch('pointerdown', { x: 500, y: 420, stopPropagation: false });
		expect(allow).not.toHaveBeenCalled();
		test.events.dispatch('removeDialog', 'second');
		test.events.dispatch('pointerdown', { x: 500, y: 420, stopPropagation: false }, { phase: 'capture' });
		expect(allow).not.toHaveBeenCalled();
		test.events.dispatch('pointerdown', { x: 0, y: 0, stopPropagation: false });
		expect(allow).not.toHaveBeenCalled();
		test.events.dispatch('pointerdown', { x: 500, y: 420, stopPropagation: false });
		expect(allow).toHaveBeenCalledOnce();
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('unregisters drawing and input on disposal while preserving editor-owned dialogs', () => {
		const test = setup(content);
		const allow = vi.fn();
		test.events.on('allowAudio', allow);
		test.dispose();
		test.events.dispatch('resize', { canvasWidth: 1280, canvasHeight: 768 });
		test.events.dispatch('gridSizeChanged');
		test.events.dispatch('pointerdown', { x: 500, y: 420, stopPropagation: false });
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(allow).not.toHaveBeenCalled();
		expect(test.state.dialogStack).toEqual([content]);
	});

	it('keeps layout and listeners independent between editors', () => {
		const first = setup(content);
		const second = setup();
		second.render();
		expect(second.draw.drawFill).not.toHaveBeenCalled();
		first.dispose();
		second.events.dispatch('addDialog', content);
		second.render();
		expect(second.draw.drawGlyphs).toHaveBeenCalledWith(432, 96, textToGlyphIds('Allow'), PALETTE_INDICES.selectionInk);
	});
});
