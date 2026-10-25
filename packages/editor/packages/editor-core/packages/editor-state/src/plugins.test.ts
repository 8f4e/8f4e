import { createMockCodeBlock, createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import type { EditorStatePlugin } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import createMenuItemRegistry from './features/menu/itemRegistry';
import initState from './index';
import { installEditorStatePlugins } from './plugins';

describe('editor state plugins', () => {
	it('installs in declaration order and disposes in reverse order once', () => {
		const calls: string[] = [];
		const plugins = ['first', 'second'].map(id => ({
			id,
			setup: () => {
				calls.push(`install ${id}`);
				return () => calls.push(`dispose ${id}`);
			},
		}));
		const store = initState(createMockEventDispatcher(), {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
			plugins,
		});
		store.dispose();
		store.dispose();
		expect(calls).toEqual(['install first', 'install second', 'dispose second', 'dispose first']);
	});

	it('scopes store subscriptions, event listeners, and menu items to plugin installation', () => {
		const store = createStateManager(createMockState());
		const events = createMockEventDispatcher();
		const on = vi.spyOn(events, 'on');
		const off = vi.spyOn(events, 'off');
		const onChange = vi.fn();
		const onMatchingValue = vi.fn();
		const onEvent = vi.fn();
		const menus = createMenuItemRegistry();
		const dispose = installEditorStatePlugins(
			[
				{
					id: 'subscriptions',
					setup: context => {
						context.store.subscribe('compilerInputRevision', onChange);
						context.store.subscribeToValue('compilerInputRevision', 1, onMatchingValue);
						context.events.on('plugin-action', onEvent);
						context.menus.registerItem('moduleMenu', () => ({ title: 'Plugin action', action: 'plugin-action' }));
					},
				},
			],
			store,
			events,
			menus
		);
		store.set('compilerInputRevision', 1);
		expect(onChange).toHaveBeenCalledOnce();
		expect(onMatchingValue).toHaveBeenCalledOnce();
		expect(on).toHaveBeenCalledWith('plugin-action', onEvent);
		expect(menus.getItems('moduleMenu', { state: store.getState(), codeBlock: createMockCodeBlock() })).toHaveLength(1);
		dispose();
		dispose();
		store.set('compilerInputRevision', 2);
		store.set('compilerInputRevision', 1);
		expect(onChange).toHaveBeenCalledOnce();
		expect(onMatchingValue).toHaveBeenCalledOnce();
		expect(off).toHaveBeenCalledExactlyOnceWith('plugin-action', onEvent);
		expect(menus.getItems('moduleMenu', { state: store.getState(), codeBlock: createMockCodeBlock() })).toEqual([]);
	});

	it('cleans up earlier plugins and partial subscriptions when setup fails', () => {
		const store = createStateManager(createMockState());
		const events = createMockEventDispatcher();
		const off = vi.spyOn(events, 'off');
		const cleanup = vi.fn();
		const onChange = vi.fn();
		const onEvent = vi.fn();
		const menus = createMenuItemRegistry();
		expect(() =>
			installEditorStatePlugins(
				[
					{ id: 'first', setup: () => cleanup },
					{
						id: 'failing',
						setup: context => {
							context.store.subscribe('compilerInputRevision', onChange);
							context.events.on('partial-action', onEvent);
							context.menus.registerItem('moduleMenu', () => ({ title: 'Partial action' }));
							throw new Error('Setup failed');
						},
					},
				],
				store,
				events,
				menus
			)
		).toThrow('Setup failed');
		store.set('compilerInputRevision', 1);
		expect(onChange).not.toHaveBeenCalled();
		expect(off).toHaveBeenCalledWith('partial-action', onEvent);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(menus.getItems('moduleMenu', { state: store.getState(), codeBlock: createMockCodeBlock() })).toEqual([]);
	});

	it('propagates plugin cleanup errors through the state host', () => {
		const store = initState(createMockEventDispatcher(), {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
			plugins: [
				{
					id: 'failing-cleanup',
					setup: () => () => {
						throw new Error('Cleanup failed');
					},
				},
			],
		});
		expect(() => store.dispose()).toThrow('Cleanup failed');
		store.dispose();
	});

	it('keeps menu registrations independent across editor instances', () => {
		const plugin: EditorStatePlugin = {
			id: 'test',
			setup: ({ menus }) => {
				menus.registerItem('moduleMenu', () => ({ title: 'Test item' }));
			},
		};
		const first = createMenuItemRegistry();
		const second = createMenuItemRegistry();
		const state = createMockState();
		const disposeFirst = installEditorStatePlugins(
			[plugin],
			createStateManager(state),
			createMockEventDispatcher(),
			first
		);
		const disposeSecond = installEditorStatePlugins(
			[plugin],
			createStateManager(createMockState()),
			createMockEventDispatcher(),
			second
		);
		expect(first.getItems('moduleMenu', { state, codeBlock: createMockCodeBlock() })).toHaveLength(1);
		expect(second.getItems('moduleMenu', { state, codeBlock: createMockCodeBlock() })).toHaveLength(1);
		disposeFirst();
		expect(first.getItems('moduleMenu', { state, codeBlock: createMockCodeBlock() })).toEqual([]);
		expect(second.getItems('moduleMenu', { state, codeBlock: createMockCodeBlock() })).toHaveLength(1);
		disposeSecond();
	});
});
