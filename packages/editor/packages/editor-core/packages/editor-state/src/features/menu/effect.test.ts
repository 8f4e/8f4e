import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';

import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import contextMenu from './effect';
import createMenuRegistry from './registry';

describe('contextMenu effect', () => {
	it.each([false, true])('separates main-menu contributions without trailing dividers: %s', async contributed => {
		const state = createMockState({ featureFlags: { projectCreation: false } });
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const items = createMenuRegistry();
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
	it('navigates registered menus with caller-owned payloads and rebuilds parents on Back', async () => {
		const state = createMockState();
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const registry = createMenuRegistry();
		const generate = vi.fn(async (_state, { page }: { page: number }) => [{ title: `Page ${page}` }]);
		const unregister = registry.registerMenu('inspector', generate);
		const cleanup = contextMenu(store, events, registry);
		const onOpenSubMenu = vi.mocked(events.on).mock.calls.find(([name]) => name === 'openSubMenu')![1];
		const onMenuBack = vi.mocked(events.on).mock.calls.find(([name]) => name === 'menuBack')![1];
		await vi
			.mocked(events.on)
			.mock.calls.find(([name]) => name === 'contextmenu')![1]({ x: 100, y: 112 });
		await onOpenSubMenu({ menu: 'inspector', payload: { page: 1 } });
		await onOpenSubMenu({ menu: 'inspector', payload: { page: 2 } });
		expect(state.contextMenu.items[1].title).toContain('Page 2');
		await onMenuBack();
		expect(generate.mock.calls.map(([, payload]) => payload)).toEqual([{ page: 1 }, { page: 2 }, { page: 1 }]);
		expect(state.contextMenu.items[1].title).toContain('Page 1');
		await onMenuBack();
		expect(state.contextMenu.items.some(item => item.action === 'menuBack')).toBe(false);
		expect(state.contextMenu.items.some(item => item.action === 'goHome')).toBe(true);
		unregister();
		cleanup();
		store.dispose();
	});

	it('starts a fresh navigation stack when reopening the context menu', async () => {
		const state = createMockState();
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const registry = createMenuRegistry();
		registry.registerMenu('inspector', () => [{ title: 'Inspect' }]);
		const cleanup = contextMenu(store, events, registry);
		await vi
			.mocked(events.on)
			.mock.calls.find(([name]) => name === 'openSubMenu')![1]({ menu: 'inspector' });
		await vi
			.mocked(events.on)
			.mock.calls.find(([name]) => name === 'contextmenu')![1]({ x: 100, y: 112 });
		expect(state.contextMenu.menuStack).toEqual([{ menu: 'mainMenu' }]);
		cleanup();
		store.dispose();
	});

	it('rebuilds contributed items when opening and revisiting the block submenu', async () => {
		const codeBlock = createMockCodeBlock({ name: 'first' });
		const state = createMockState({
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: [codeBlock] } },
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const items = createMenuRegistry();
		items.registerItem('moduleMenu', ({ codeBlock }) => ({
			title: `Inspect ${codeBlock.name}`,
			action: 'inspect',
			payload: { codeBlock },
		}));
		const cleanup = contextMenu(store, events, items);
		const onCalls = (events.on as unknown as MockInstance).mock.calls;
		const onOpenSubMenu = onCalls.find(call => call[0] === 'openSubMenu')![1];
		const onMenuBack = onCalls.find(call => call[0] === 'menuBack')![1];
		await onCalls.find(call => call[0] === 'contextmenu')![1]({ x: codeBlock.x + 8, y: codeBlock.y + 8 });
		expect(state.contextMenu.items.find(item => item.action === 'inspect')?.payload?.codeBlock).toBe(codeBlock);
		await onOpenSubMenu({ menu: 'mainMenu' });
		codeBlock.name = 'updated';
		await onMenuBack();
		expect(state.contextMenu.items.find(item => item.action === 'inspect')?.title).toContain('Inspect updated');
		expect(state.contextMenu.items.some(item => item.action === 'menuBack')).toBe(false);
		cleanup();
		store.dispose();
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

		const items = createMenuRegistry();
		items.registerItem('mainMenu', () => ({ title: 'Contributed action', action: 'contributedAction', close: true }));
		contextMenu(store, events, items);

		const onCalls = (events.on as unknown as MockInstance).mock.calls;
		const onContextMenu = onCalls.find(call => call[0] === 'contextmenu')![1];

		await onContextMenu({ x: 100, y: 112 });

		const index = state.contextMenu.items.findIndex(item => item.action === 'contributedAction');

		const activate = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'activateContextMenuItem'
		)![1];
		activate({ index, x: 100, y: 112 });

		expect(menuWasOpenWhenActionDispatched).toBe(false);
	});
	it('retains raw contributed labels and the requested world anchor', async () => {
		const state = createMockState({ viewport: { x: 24, y: 48 } });
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const registry = createMenuRegistry();
		const item = { title: 'Inspect', action: 'inspect', close: false };
		registry.registerItem('mainMenu', () => item);
		const dispose = contextMenu(store, events, registry);
		await vi
			.mocked(events.on)
			.mock.calls.find(([name]) => name === 'contextmenu')![1]({ x: 100, y: 112 });
		expect(state.contextMenu).toMatchObject({ open: true, x: 124, y: 160 });
		expect(state.contextMenu.items.at(-1)).toBe(item);
		dispose();
		store.dispose();
	});
	it('keeps disabled items and dividers inactive, and applies selector items in core', () => {
		const state = createMockState();
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const dispose = contextMenu(store, events, createMenuRegistry());
		state.contextMenu.open = true;
		state.contextMenu.items = [
			{ title: 'Unavailable', action: 'blocked', disabled: true },
			{ divider: true },
			{ title: 'Edit', selector: 'editorMode', value: 'edit', close: true },
		];
		const activate = vi.mocked(events.on).mock.calls.find(([name]) => name === 'activateContextMenuItem')![1];
		activate({ index: 0, x: 12, y: 16 });
		activate({ index: 1, x: 12, y: 32 });
		expect(events.dispatch).not.toHaveBeenCalled();
		expect(state.contextMenu.open).toBe(true);
		activate({ index: 2, x: 12, y: 48 });
		expect(state.editorMode).toBe('edit');
		expect(state.contextMenu.open).toBe(false);
		dispose();
		store.dispose();
	});
});
