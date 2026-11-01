import initState from '@8f4e/editor-state';
import { createMockCodeBlock, createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { type EditorPlugin, installEditorPlugins } from './plugins';

function createContext() {
	const events = createMockEventDispatcher();
	const store = initState(events, { callbacks: {} });
	return {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createEditorDrawerRegistry(),
	};
}

describe('editor plugins', () => {
	it('installs in declaration order and disposes in reverse order once', () => {
		const context = createContext();
		const calls: string[] = [];
		const plugins = ['first', 'second'].map(id => ({
			id,
			setup: () => {
				calls.push(`install ${id}`);
				return () => calls.push(`dispose ${id}`);
			},
		}));
		const dispose = installEditorPlugins(plugins, context);
		dispose();
		dispose();
		expect(calls).toEqual(['install first', 'install second', 'dispose second', 'dispose first']);
		context.store.dispose();
	});

	it('passes original services and lets the plugin release its own subscriptions and menu items', () => {
		const context = createContext();
		const onChange = vi.fn();
		const onEvent = vi.fn();
		const off = vi.spyOn(context.events, 'off');
		const dispose = installEditorPlugins(
			[
				{
					id: 'resources',
					setup: received => {
						expect(received).toBe(context);
						received.store.subscribe('compilerInputRevision', onChange);
						received.events.on('plugin-action', onEvent);
						const unregisterMenu = received.menus.registerItem('moduleMenu', () => ({ title: 'Plugin action' }));
						return () => {
							unregisterMenu();
							received.events.off('plugin-action', onEvent);
							received.store.unsubscribe('compilerInputRevision', onChange);
						};
					},
				},
			],
			context
		);
		context.store.set('compilerInputRevision', 1);
		expect(onChange).toHaveBeenCalledOnce();
		dispose();
		context.store.set('compilerInputRevision', 2);
		expect(onChange).toHaveBeenCalledOnce();
		expect(off).toHaveBeenCalledWith('plugin-action', onEvent);
		context.store.dispose();
	});

	it('unwinds completed setups when a later plugin throws', () => {
		const context = createContext();
		const calls: string[] = [];
		const later = vi.fn(() => () => {});
		const error = new Error('Setup failed');
		expect(() =>
			installEditorPlugins(
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
					{ id: 'later', setup: later },
				],
				context
			)
		).toThrow(error);
		expect(calls).toEqual(['second', 'first']);
		expect(later).not.toHaveBeenCalled();
		context.store.dispose();
	});

	it('propagates teardown failures', () => {
		const context = createContext();
		const dispose = installEditorPlugins(
			[
				{
					id: 'failing',
					setup: () => () => {
						throw new Error('Cleanup failed');
					},
				},
			],
			context
		);
		expect(dispose).toThrow('Cleanup failed');
		dispose();
		context.store.dispose();
	});

	it('releases earlier plugins when a dependent plugin cleanup throws', () => {
		const context = createContext();
		const releaseCompiler = vi.fn();
		const dispose = installEditorPlugins(
			[
				{ id: 'compiler', setup: () => releaseCompiler },
				{
					id: 'dependent',
					setup: () => () => {
						throw new Error('Cleanup failed');
					},
				},
			],
			context
		);
		expect(dispose).toThrow('Cleanup failed');
		expect(releaseCompiler).toHaveBeenCalledOnce();
		dispose();
		context.store.dispose();
	});

	it('keeps contributions private to each editor instance', () => {
		const first = createContext();
		const second = createContext();
		const firstDrawer = vi.fn();
		const secondDrawer = vi.fn();
		const plugin: EditorPlugin = {
			id: 'test',
			setup: ({ drawers, store }) =>
				drawers.registerCodeBlockDrawer(store === first.store ? firstDrawer : secondDrawer),
		};
		const disposeFirst = installEditorPlugins([plugin], first);
		const disposeSecond = installEditorPlugins([plugin], second);
		const drawContext = {
			draw: {} as Parameters<typeof first.drawers.drawCodeBlock>[0]['draw'],
			state: first.store.getState(),
			codeBlock: createMockCodeBlock(),
			memoryViews: {} as Parameters<typeof first.drawers.drawCodeBlock>[0]['memoryViews'],
		};
		first.drawers.drawCodeBlock(drawContext);
		expect(firstDrawer).toHaveBeenCalledOnce();
		expect(secondDrawer).not.toHaveBeenCalled();
		disposeFirst();
		first.drawers.drawCodeBlock(drawContext);
		second.drawers.drawCodeBlock(drawContext);
		expect(firstDrawer).toHaveBeenCalledOnce();
		expect(secondDrawer).toHaveBeenCalledOnce();
		disposeSecond();
		first.store.dispose();
		second.store.dispose();
	});
});
