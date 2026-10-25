import { createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import type { EditorStatePlugin } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import initState from './index';
import { getEditorStatePluginActions, installEditorStatePlugins } from './plugins';

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

	it('scopes store subscriptions and event listeners to plugin installation', () => {
		const store = createStateManager(createMockState());
		const events = createMockEventDispatcher();
		const on = vi.spyOn(events, 'on');
		const off = vi.spyOn(events, 'off');
		const onChange = vi.fn();
		const onMatchingValue = vi.fn();
		const onEvent = vi.fn();
		const dispose = installEditorStatePlugins(
			[
				{
					id: 'subscriptions',
					setup: context => {
						context.store.subscribe('compilerInputRevision', onChange);
						context.store.subscribeToValue('compilerInputRevision', 1, onMatchingValue);
						context.events.on('plugin-action', onEvent);
					},
				},
			],
			store,
			events
		);
		store.set('compilerInputRevision', 1);
		expect(onChange).toHaveBeenCalledOnce();
		expect(onMatchingValue).toHaveBeenCalledOnce();
		expect(on).toHaveBeenCalledWith('plugin-action', onEvent);
		dispose();
		dispose();
		store.set('compilerInputRevision', 2);
		store.set('compilerInputRevision', 1);
		expect(onChange).toHaveBeenCalledOnce();
		expect(onMatchingValue).toHaveBeenCalledOnce();
		expect(off).toHaveBeenCalledExactlyOnceWith('plugin-action', onEvent);
	});

	it('cleans up earlier plugins and partial subscriptions when setup fails', () => {
		const store = createStateManager(createMockState());
		const events = createMockEventDispatcher();
		const off = vi.spyOn(events, 'off');
		const cleanup = vi.fn();
		const onChange = vi.fn();
		const onEvent = vi.fn();
		expect(() =>
			installEditorStatePlugins(
				[
					{ id: 'first', setup: () => cleanup },
					{
						id: 'failing',
						setup: context => {
							context.store.subscribe('compilerInputRevision', onChange);
							context.events.on('partial-action', onEvent);
							throw new Error('Setup failed');
						},
					},
				],
				store,
				events
			)
		).toThrow('Setup failed');
		store.set('compilerInputRevision', 1);
		expect(onChange).not.toHaveBeenCalled();
		expect(off).toHaveBeenCalledWith('partial-action', onEvent);
		expect(cleanup).toHaveBeenCalledOnce();
	});

	it('continues disposal when a plugin cleanup throws', () => {
		const cleanup = vi.fn();
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
		const dispose = installEditorStatePlugins(
			[
				{ id: 'first', setup: () => cleanup },
				{
					id: 'second',
					setup: () => () => {
						throw new Error('Cleanup failed');
					},
				},
			],
			createStateManager(createMockState()),
			createMockEventDispatcher()
		);
		dispose();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(errorLog).toHaveBeenCalledOnce();
		errorLog.mockRestore();
	});

	it('rejects duplicate plugin IDs before setup', () => {
		const setup = vi.fn();
		expect(() =>
			initState(createMockEventDispatcher(), {
				callbacks: { loadSession: async () => null },
				runtimeRegistry: {},
				plugins: [
					{ id: 'duplicate', setup },
					{ id: 'duplicate', setup },
				],
			})
		).toThrow('duplicate');
		expect(setup).not.toHaveBeenCalled();
	});

	it('rejects conflicting actions and collects action availability per editor', () => {
		const plugin: EditorStatePlugin = { id: 'test', actions: ['test-action'], setup: () => {} };
		expect(() => getEditorStatePluginActions([plugin, { ...plugin, id: 'other' }])).toThrow('test-action');
		const withPlugin = initState(createMockEventDispatcher(), {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
			plugins: [plugin],
		});
		const withoutPlugin = initState(createMockEventDispatcher(), {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
		});
		expect(withPlugin.getState().pluginActions.has('test-action')).toBe(true);
		expect(withoutPlugin.getState().pluginActions.size).toBe(0);
		withPlugin.dispose();
		withoutPlugin.dispose();
	});
});
