import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';

import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import contextMenu from './effect';
import createMenuItemRegistry from './itemRegistry';

describe('contextMenu effect', () => {
	it.each([false, true])('separates main-menu contributions without trailing dividers: %s', async contributed => {
		const state = createMockState({ featureFlags: { projectCreation: false, projectOpening: false } });
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const items = createMenuItemRegistry();
		if (contributed) items.registerItem('mainMenu', () => ({ title: 'Inspect', action: 'inspect' }));
		const dispose = contextMenu(store, events, items);
		await vi
			.mocked(events.on)
			.mock.calls.find(([name]) => name === 'contextmenu')![1]({ x: 100, y: 112 });
		expect(state.contextMenu.items.at(-1)?.divider).not.toBe(true);
		if (contributed) {
			expect(state.contextMenu.items.at(-1)?.action).toBe('inspect');
			expect(state.contextMenu.items.at(-2)?.divider).toBe(true);
		}
		dispose();
		store.dispose();
	});
	it('navigates module categories with explicit paths and restores the parent request', async () => {
		const state = createMockState({
			callbacks: { getListOfModules: async () => [{ slug: 'gain', title: 'Gain', category: 'Audio' }] },
		});
		const events = createMockEventDispatcherWithVitest();
		const cleanup = contextMenu(createStateManager(state), events, createMenuItemRegistry());
		const onCalls = (events.on as unknown as MockInstance).mock.calls;
		const onOpenSubMenu = onCalls.find(call => call[0] === 'openSubMenu')![1];
		const onMenuBack = onCalls.find(call => call[0] === 'menuBack')![1];
		await onOpenSubMenu({ menu: 'moduleCategoriesMenu', path: [] });
		const category = state.contextMenu.items.find(item => item.action === 'openSubMenu')!;
		expect(category.payload).toEqual({ menu: 'moduleCategoriesMenu', path: ['Audio'] });
		await onOpenSubMenu(category.payload);
		expect(state.contextMenu.items.find(item => item.action === 'addCodeBlockBySlug')?.payload).toEqual({
			codeBlockSlug: 'gain',
		});
		await onMenuBack();
		expect(state.contextMenu.items.find(item => item.action === 'openSubMenu')?.payload).toEqual(category.payload);
		cleanup();
	});

	it('rebuilds contributed items when opening and revisiting the block submenu', async () => {
		const codeBlock = createMockCodeBlock({ name: 'first' });
		const state = createMockState();
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const items = createMenuItemRegistry();
		items.registerItem('moduleMenu', ({ codeBlock }) => ({
			title: `Inspect ${codeBlock.name}`,
			action: 'inspect',
			payload: { codeBlock },
		}));
		const cleanup = contextMenu(store, events, items);
		const onCalls = (events.on as unknown as MockInstance).mock.calls;
		const onOpenSubMenu = onCalls.find(call => call[0] === 'openSubMenu')![1];
		const onMenuBack = onCalls.find(call => call[0] === 'menuBack')![1];
		await onOpenSubMenu({ menu: 'moduleMenu', codeBlock });
		expect(state.contextMenu.items.find(item => item.action === 'inspect')?.payload?.codeBlock).toBe(codeBlock);
		await onOpenSubMenu({ menu: 'mainMenu' });
		codeBlock.name = 'updated';
		await onMenuBack();
		expect(state.contextMenu.items.find(item => item.action === 'inspect')?.title).toContain('Inspect updated');
		cleanup();
	});

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

		contextMenu(store, events, createMenuItemRegistry());

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

		contextMenu(store, events, createMenuItemRegistry());

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
		const state = createMockState();
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		let menuWasOpenWhenActionDispatched: boolean | undefined;

		(events.dispatch as unknown as MockInstance).mockImplementation(action => {
			if (action === 'contributedAction') {
				menuWasOpenWhenActionDispatched = state.contextMenu.open;
			}
		});

		const items = createMenuItemRegistry();
		items.registerItem('mainMenu', () => ({ title: 'Contributed action', action: 'contributedAction', close: true }));
		contextMenu(store, events, items);

		const onCalls = (events.on as unknown as MockInstance).mock.calls;
		const onContextMenu = onCalls.find(call => call[0] === 'contextmenu')![1];

		await onContextMenu({ x: 100, y: 112 });

		state.contextMenu.highlightedItem = state.contextMenu.items.findIndex(item => item.action === 'contributedAction');

		const onMouseDown = (events.on as unknown as MockInstance).mock.calls.find(call => call[0] === 'mousedown')![1];
		onMouseDown({ x: 100, y: 112 });

		expect(menuWasOpenWhenActionDispatched).toBe(false);
	});
});
