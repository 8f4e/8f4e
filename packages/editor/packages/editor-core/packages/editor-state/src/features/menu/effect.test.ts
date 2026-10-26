import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, type MockInstance } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';

import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import contextMenu from './effect';

describe('contextMenu effect', () => {
	it('keeps the menu inside the right and bottom viewport edges', async () => {
		const state = createMockState({
			viewport: {
				x: 24,
				y: 48,
				width: 640,
				height: 480,
				vGrid: 8,
				hGrid: 16,
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		contextMenu(store, events);

		const onCalls = (events.on as unknown as MockInstance).mock.calls;
		const onContextMenu = onCalls.find(call => call[0] === 'contextmenu')![1];

		await onContextMenu({ x: 639, y: 479 });

		const menuHeight = state.contextMenu.items.length * state.viewport.hGrid;
		expect(state.contextMenu.x - state.viewport.x).toBe(state.viewport.width - state.contextMenu.itemWidth);
		expect(state.contextMenu.y - state.viewport.y).toBe(state.viewport.height - menuHeight);
	});

	it('anchors the menu in world coordinates and hit-tests it after viewport movement', async () => {
		const state = createMockState({
			viewport: {
				x: 24,
				y: 48,
				vGrid: 8,
				hGrid: 16,
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		contextMenu(store, events);

		const onCalls = (events.on as unknown as MockInstance).mock.calls;
		const onContextMenu = onCalls.find(call => call[0] === 'contextmenu')![1];

		await onContextMenu({ x: 100, y: 112 });

		expect(state.contextMenu.x).toBe(128);
		expect(state.contextMenu.y).toBe(160);

		state.viewport.x = 32;
		state.viewport.y = 64;

		const onMouseMove = (events.on as unknown as MockInstance).mock.calls.find(call => call[0] === 'mousemove')![1];
		onMouseMove({ x: 96, y: 112 });

		expect(state.contextMenu.highlightedItem).toBe(1);
	});

	it('closes the menu before dispatching closeable actions', async () => {
		const state = createMockState({
			callbacks: { exportCanvasScreenshot: async () => {} },
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		let menuWasOpenWhenScreenshotDispatched: boolean | undefined;

		(events.dispatch as unknown as MockInstance).mockImplementation(action => {
			if (action === 'exportCanvasScreenshot') {
				menuWasOpenWhenScreenshotDispatched = state.contextMenu.open;
			}
		});

		contextMenu(store, events);

		const onCalls = (events.on as unknown as MockInstance).mock.calls;
		const onContextMenu = onCalls.find(call => call[0] === 'contextmenu')![1];

		await onContextMenu({ x: 100, y: 112 });

		state.contextMenu.highlightedItem = state.contextMenu.items.findIndex(
			item => item.action === 'exportCanvasScreenshot'
		);

		const onMouseDown = (events.on as unknown as MockInstance).mock.calls.find(call => call[0] === 'mousedown')![1];
		onMouseDown({ x: 100, y: 112 });

		expect(menuWasOpenWhenScreenshotDispatched).toBe(false);
	});
});
