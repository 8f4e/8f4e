import { createMockState } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import { createEditorEnvironmentPluginManager } from './manager';
import type { EditorEnvironmentPluginContext, EditorEnvironmentPluginRegistryEntry } from './types';

function createState(codeBlocks: CodeBlockGraphicData[] = []): State {
	return createMockState({
		codeBlockRendering: {
			codeBlocks,
		},
		codeErrors: {
			compilationErrors: [],
			editorDirectiveErrors: [],
		},
	});
}

function createCodeBlockWithEditorDirective(name: string, args: string[] = []): CodeBlockGraphicData {
	return {
		parsedDirectives: [
			{
				prefix: '@',
				name,
				args,
				sourceLineIndex: 0,
				isTrailing: false,
			},
		],
	} as unknown as CodeBlockGraphicData;
}

function createCodeBlockWithConfigPath(path: string): CodeBlockGraphicData {
	return createCodeBlockWithEditorDirective('config', [path, 'value']);
}

async function flushPromises(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe('editor environment plugin manager', () => {
	const events = {
		on: vi.fn(),
		off: vi.fn(),
		dispatch: vi.fn(),
	} as EventDispatcher;
	const windowMock = {} as Window;
	const navigatorMock = {} as Navigator;
	const inputTargetMock = {} as HTMLElement;
	const memoryViewsMock = {} as EditorEnvironmentPluginContext['memoryViews'];
	const services = {
		getWasmExports: vi.fn(),
	};

	it('lazy-loads a plugin when one of its editor directives appears', async () => {
		const dispose = vi.fn();
		const start = vi.fn(() => dispose);
		const load = vi.fn(async () => ({ default: start }));
		const registry: EditorEnvironmentPluginRegistryEntry[] = [
			{
				id: 'test-plugin',
				editorDirectives: ['testDirective'],
				load,
			},
		];
		const store = createStateManager(createState());

		const cleanup = createEditorEnvironmentPluginManager(store, events, {
			window: windowMock,
			navigator: navigatorMock,
			inputTarget: inputTargetMock,
			memoryViews: memoryViewsMock,
			services,
			registry,
		});

		expect(load).not.toHaveBeenCalled();

		store.set('codeBlockRendering.codeBlocks', [createCodeBlockWithEditorDirective('testDirective')]);
		await flushPromises();

		expect(load).toHaveBeenCalledTimes(1);
		expect(start).toHaveBeenCalledTimes(1);
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({
				store,
				events,
				window: windowMock,
				navigator: navigatorMock,
				inputTarget: inputTargetMock,
				memoryViews: memoryViewsMock,
				services,
			})
		);

		cleanup();
	});

	it('lazy-loads a plugin when one of its editor config trigger paths appears', async () => {
		const dispose = vi.fn();
		const start = vi.fn(() => dispose);
		const load = vi.fn(async () => ({ default: start }));
		const registry: EditorEnvironmentPluginRegistryEntry[] = [
			{
				id: 'test-plugin',
				editorDirectives: [],
				editorConfigPaths: ['testPlugin'],
				load,
			},
		];
		const store = createStateManager(createState());

		const cleanup = createEditorEnvironmentPluginManager(store, events, {
			window: windowMock,
			navigator: navigatorMock,
			inputTarget: inputTargetMock,
			memoryViews: memoryViewsMock,
			services,
			registry,
		});

		store.set('codeBlockRendering.codeBlocks', [createCodeBlockWithConfigPath('testPlugin.inputs.0.port')]);
		await flushPromises();

		expect(load).toHaveBeenCalledTimes(1);
		expect(start).toHaveBeenCalledTimes(1);

		cleanup();
	});

	it('disposes an active plugin when its trigger directives disappear', async () => {
		const dispose = vi.fn();
		const start = vi.fn(() => dispose);
		const registry: EditorEnvironmentPluginRegistryEntry[] = [
			{
				id: 'test-plugin',
				editorDirectives: ['testDirective'],
				load: vi.fn(async () => ({ default: start })),
			},
		];
		const store = createStateManager(createState([createCodeBlockWithEditorDirective('testDirective')]));

		createEditorEnvironmentPluginManager(store, events, {
			window: windowMock,
			navigator: navigatorMock,
			inputTarget: inputTargetMock,
			memoryViews: memoryViewsMock,
			services,
			registry,
		});
		await flushPromises();

		store.set('codeBlockRendering.codeBlocks', []);

		expect(dispose).toHaveBeenCalledTimes(1);
	});

	it('lets plugins own and clear their scoped errors', async () => {
		const pluginError = {
			codeBlockId: 0,
			lineNumber: 1,
			message: 'Plugin-specific directive error',
		};
		const start = vi.fn((context: EditorEnvironmentPluginContext) => {
			context.setErrors([pluginError]);
			return () => {};
		});
		const registry: EditorEnvironmentPluginRegistryEntry[] = [
			{
				id: 'test-plugin',
				editorDirectives: ['testDirective'],
				load: vi.fn(async () => ({ default: start })),
			},
		];
		const store = createStateManager(createState([createCodeBlockWithEditorDirective('testDirective')]));

		createEditorEnvironmentPluginManager(store, events, {
			window: windowMock,
			navigator: navigatorMock,
			inputTarget: inputTargetMock,
			memoryViews: memoryViewsMock,
			services,
			registry,
		});
		await flushPromises();

		expect(store.getState().codeErrors.editorDirectiveErrors).toEqual([{ ...pluginError, ownerId: 'test-plugin' }]);

		store.set('codeBlockRendering.codeBlocks', []);

		expect(store.getState().codeErrors.editorDirectiveErrors).toEqual([]);
	});

	it('ignores a stale plugin import if the directive disappears before loading finishes', async () => {
		const start = vi.fn();
		let resolveLoad: (value: { default: typeof start }) => void = () => {};
		const load = vi.fn(
			() =>
				new Promise<{ default: typeof start }>(resolve => {
					resolveLoad = resolve;
				})
		);
		const registry: EditorEnvironmentPluginRegistryEntry[] = [
			{
				id: 'test-plugin',
				editorDirectives: ['testDirective'],
				load,
			},
		];
		const store = createStateManager(createState());

		createEditorEnvironmentPluginManager(store, events, {
			window: windowMock,
			navigator: navigatorMock,
			inputTarget: inputTargetMock,
			memoryViews: memoryViewsMock,
			services,
			registry,
		});

		store.set('codeBlockRendering.codeBlocks', [createCodeBlockWithEditorDirective('testDirective')]);
		store.set('codeBlockRendering.codeBlocks', []);

		resolveLoad({ default: start });
		await flushPromises();

		expect(start).not.toHaveBeenCalled();
	});
});
