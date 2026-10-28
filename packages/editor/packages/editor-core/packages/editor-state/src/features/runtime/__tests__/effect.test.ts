import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import runtimeEffect from '../effect';

describe('Runtime System', () => {
	describe('Runtime lifecycle integration', () => {
		it('should destroy previous runtime when runtime type changes without changeRuntime event', async () => {
			const audioDestroyer = vi.fn();
			const webWorkerDestroyer = vi.fn();
			const audioRuntimeFactory = vi.fn(() => audioDestroyer);
			const webWorkerRuntimeFactory = vi.fn(() => webWorkerDestroyer);

			const registry = {
				AudioWorkletRuntime: {
					id: 'AudioWorkletRuntime',
					factory: audioRuntimeFactory,
				},
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: webWorkerRuntimeFactory,
				},
			};
			const state = createMockState({
				editorConfig: { runtime: 'AudioWorkletRuntime' },
			});

			const store = createStateManager(state);
			const events = createMockEventDispatcherWithVitest();

			await runtimeEffect(store, events, registry);

			store.set('compiler.isCompiling', true);
			store.set('compiler.isCompiling', false);

			// Give the subscription callback time to execute
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(audioRuntimeFactory).toHaveBeenCalledTimes(1);
			expect(audioDestroyer).not.toHaveBeenCalled();

			store.set('editorConfig.runtime', 'WebWorkerRuntime');

			// Give the subscription callback time to execute
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(audioDestroyer).toHaveBeenCalledTimes(1);
			expect(webWorkerRuntimeFactory).toHaveBeenCalledTimes(1);

			const destroyOrder = audioDestroyer.mock.invocationCallOrder[0];
			const webWorkerFactoryOrder = webWorkerRuntimeFactory.mock.invocationCallOrder[0];

			expect(destroyOrder).toBeLessThan(webWorkerFactoryOrder);
		});

		it('should switch runtime immediately when runtime selection changes while compiler is idle', async () => {
			const audioDestroyer = vi.fn();
			const webWorkerDestroyer = vi.fn();
			const audioRuntimeFactory = vi.fn(() => audioDestroyer);
			const webWorkerRuntimeFactory = vi.fn(() => webWorkerDestroyer);

			const registry = {
				AudioWorkletRuntime: {
					id: 'AudioWorkletRuntime',
					factory: audioRuntimeFactory,
				},
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: webWorkerRuntimeFactory,
				},
			};
			const state = createMockState({
				editorConfig: { runtime: 'AudioWorkletRuntime' },
			});

			const store = createStateManager(state);
			const events = createMockEventDispatcherWithVitest();

			await runtimeEffect(store, events, registry);

			store.set('compiler.isCompiling', true);
			store.set('compiler.isCompiling', false);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(audioRuntimeFactory).toHaveBeenCalledTimes(1);
			expect(audioDestroyer).not.toHaveBeenCalled();

			store.set('editorConfig.runtime', 'WebWorkerRuntime');

			await new Promise(resolve => setTimeout(resolve, 10));

			expect(audioDestroyer).toHaveBeenCalledTimes(1);
			expect(webWorkerRuntimeFactory).toHaveBeenCalledTimes(1);
		});

		it('should mirror runtime schema contributions into the generic editor config contribution registry', async () => {
			const registry = {
				AudioWorkletRuntime: {
					id: 'AudioWorkletRuntime',
					editorConfigSchema: {
						root: 'audioRuntime',
						schema: { type: 'object', properties: { sampleRate: { type: 'number' } } },
					},
					factory: () => () => {},
				},
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					editorConfigSchema: {
						root: 'workerRuntime',
						schema: { type: 'object', properties: { sampleRate: { type: 'number' } } },
					},
					factory: () => () => {},
				},
			};
			const state = createMockState({
				editorConfigSchemaContributions: {
					host: {
						root: 'hostSettings',
						schema: { type: 'object', properties: { enabled: { type: 'boolean' } } },
					},
				},
				editorConfig: { runtime: 'WebWorkerRuntime' },
			});

			const store = createStateManager(state);
			const events = createMockEventDispatcherWithVitest();

			await runtimeEffect(store, events, registry);

			expect(Object.keys(store.getState().editorConfigSchemaContributions)).toEqual([
				'host',
				'runtime:WebWorkerRuntime',
				'runtime:AudioWorkletRuntime',
			]);
		});

		it('should not initialize a runtime when no runtime is selected', async () => {
			const webWorkerRuntimeFactory = vi.fn(() => () => {});
			const registry = {
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: webWorkerRuntimeFactory,
				},
			};
			const state = createMockState({});

			const store = createStateManager(state);
			const events = createMockEventDispatcherWithVitest();

			await runtimeEffect(store, events, registry);

			store.set('compiler.isCompiling', true);
			store.set('compiler.isCompiling', false);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(webWorkerRuntimeFactory).not.toHaveBeenCalled();
		});

		it('destroys the active runtime and stops reacting after disposal', async () => {
			const audioDestroyer = vi.fn();
			const webWorkerRuntimeFactory = vi.fn(() => () => {});
			const registry = {
				AudioWorkletRuntime: {
					id: 'AudioWorkletRuntime',
					factory: vi.fn(() => audioDestroyer),
				},
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: webWorkerRuntimeFactory,
				},
			};
			const state = createMockState({
				editorConfig: { runtime: 'AudioWorkletRuntime' },
			});
			const store = createStateManager(state);
			const events = createMockEventDispatcherWithVitest();
			const dispose = runtimeEffect(store, events, registry);

			store.set('compiler.isCompiling', true);
			store.set('compiler.isCompiling', false);
			await new Promise(resolve => setTimeout(resolve, 10));
			dispose();
			store.set('editorConfig.runtime', 'WebWorkerRuntime');
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(audioDestroyer).toHaveBeenCalledOnce();
			expect(webWorkerRuntimeFactory).not.toHaveBeenCalled();
		});
	});
});
