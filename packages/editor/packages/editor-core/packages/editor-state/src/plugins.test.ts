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

	it('passes services directly and calls the plugin disposer to release its resources', () => {
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
						expect(context.store).toBe(store);
						expect(context.events).toBe(events);
						expect(context.menus).toBe(menus);
						context.store.subscribe('compilerInputRevision', onChange);
						context.store.subscribeToValue('compilerInputRevision', 1, onMatchingValue);
						context.events.on('plugin-action', onEvent);
						const unregister = context.menus.registerItem('moduleMenu', () => ({
							title: 'Plugin action',
							action: 'plugin-action',
						}));
						return () => {
							unregister();
							context.events.off('plugin-action', onEvent);
							context.store.unsubscribe('compilerInputRevision', onMatchingValue);
							context.store.unsubscribe('compilerInputRevision', onChange);
						};
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

	it('disposes completed plugins in reverse order when a later setup fails', () => {
		const calls: string[] = [];
		const laterSetup = vi.fn(() => () => {});
		const error = new Error('Setup failed');
		expect(() =>
			installEditorStatePlugins(
				[
					{
						id: 'first',
						setup: () => () => {
							calls.push('first');
						},
					},
					{
						id: 'second',
						setup: () => () => {
							calls.push('second');
						},
					},
					{
						id: 'failing',
						setup: () => {
							throw error;
						},
					},
					{ id: 'later', setup: laterSetup },
				],
				createStateManager(createMockState()),
				createMockEventDispatcher(),
				createMenuItemRegistry()
			)
		).toThrow(error);
		expect(calls).toEqual(['second', 'first']);
		expect(laterSetup).not.toHaveBeenCalled();
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
				return menus.registerItem('moduleMenu', () => ({ title: 'Test item' }));
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
