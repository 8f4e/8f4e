import type { EventDispatcher } from '@8f4e/editor-core';
import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';

import { createWebWorkerRuntimeDef, webWorkerRuntimeFactory } from './runtimeDef';

describe('WebWorker runtime config', () => {
	it('defaults to the main entry and requires a positive sample rate', () => {
		const runtimeDef = createWebWorkerRuntimeDef(
			() => new Uint8Array(),
			() => null,
			class {} as unknown as new () => Worker
		);

		expect(runtimeDef.editorConfigSchema?.defaults).toMatchObject({ entry: 'main' });
		expect(runtimeDef.editorConfigSchema?.schema.properties).toMatchObject({
			entry: { type: 'string' },
			sampleRate: { type: 'number', minimum: 1 },
		});
	});

	it.each([
		[undefined, 'main'],
		['alternate', 'alternate'],
	])('initializes the worker with configured entry %s', (configuredEntry, expectedEntry) => {
		const workers: MockWorker[] = [];
		class MockWorker {
			postMessage = vi.fn();
			addEventListener = vi.fn();
			removeEventListener = vi.fn();
			terminate = vi.fn();

			constructor() {
				workers.push(this);
			}
		}

		const state = createMockState({
			editorConfig: {
				workerRuntime: {
					sampleRate: 25,
					...(configuredEntry ? { entry: configuredEntry } : {}),
				},
			},
			compiler: { isCompiling: false },
			info: {},
		});
		const cleanup = webWorkerRuntimeFactory(
			createStateManager(state),
			{ dispatch: vi.fn() } as unknown as EventDispatcher,
			() => new Uint8Array([1, 2, 3]),
			() => new WebAssembly.Memory({ initial: 1 }),
			MockWorker as unknown as new () => Worker
		);
		const [worker] = workers;

		expect(worker.postMessage).toHaveBeenCalledWith({
			type: 'init',
			payload: {
				memoryRef: expect.any(WebAssembly.Memory),
				entry: expectedEntry,
				sampleRate: 25,
				codeBuffer: new Uint8Array([1, 2, 3]),
			},
		});

		cleanup();
	});

	it('handles initialized and stats messages and ignores compilation errors', () => {
		let onMessage: ((event: { data: unknown }) => void) | undefined;
		class MockWorker {
			postMessage = vi.fn();
			addEventListener = vi.fn((_type: string, listener: typeof onMessage) => {
				onMessage = listener;
			});
			removeEventListener = vi.fn();
			terminate = vi.fn();
		}
		const state = createMockState({ compiler: { isCompiling: false }, info: {} });
		const events = { dispatch: vi.fn() } as unknown as EventDispatcher;
		const cleanup = webWorkerRuntimeFactory(
			createStateManager(state),
			events,
			() => new Uint8Array(),
			() => new WebAssembly.Memory({ initial: 1 }),
			MockWorker as unknown as new () => Worker
		);
		const stats = {
			timerPrecisionPercentage: 99,
			timeToExecuteLoopMs: 1,
			timerDriftMs: 0.5,
			timerExpectedIntervalTimeMs: 20,
		};

		onMessage?.({ data: { type: 'initialized', payload: {} } });
		onMessage?.({ data: { type: 'stats', payload: stats } });
		onMessage?.({ data: { type: 'compilationError', payload: new Error('failed') } });

		expect(events.dispatch).toHaveBeenCalledExactlyOnceWith('runtimeInitialized');
		expect(state.info.runtime).toEqual(stats);

		cleanup();
	});
});
