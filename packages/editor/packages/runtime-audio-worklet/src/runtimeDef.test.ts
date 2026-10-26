import type { EventDispatcher, State } from '@8f4e/editor-core';
import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	audioWorkletRuntimeFactory,
	createAudioWorkletRuntimeDef,
	getAudioInputBuffers,
	getAudioOutputBuffers,
} from './runtimeDef';
import { storeAudioWorkletRuntimeValues } from './runtimeValues';

describe('storeAudioWorkletRuntimeValues', () => {
	it('merges AudioWorklet runtime values into editor state', () => {
		const state = createMockState({
			runtime: {
				values: {},
			},
		});
		const store = createStateManager(state);

		storeAudioWorkletRuntimeValues(store, state, { audioBufferSize: 128 });
		storeAudioWorkletRuntimeValues(store, state, { sampleRate: 48000 });

		expect(state.runtime.values.AudioWorkletRuntime).toEqual({
			audioBufferSize: 128,
			sampleRate: 48000,
		});
	});
});

describe('AudioWorklet context lifetime', () => {
	class MockContext {
		state = 'suspended';
		sampleRate: number;
		destination = {};
		listeners = new Set<() => void>();
		audioWorklet = { addModule: vi.fn(async () => {}) };
		resume = vi.fn(async () => {
			this.state = 'running';
			for (const listener of this.listeners) listener();
		});
		close = vi.fn(async () => {
			this.state = 'closed';
		});
		createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
		constructor({ sampleRate = 48000 } = {}) {
			this.sampleRate = sampleRate;
		}
		addEventListener(_type: string, listener: () => void) {
			this.listeners.add(listener);
		}
		removeEventListener(_type: string, listener: () => void) {
			this.listeners.delete(listener);
		}
	}

	class MockWorklet {
		port = { postMessage: vi.fn(), close: vi.fn(), onmessage: null };
		connect = vi.fn();
		disconnect = vi.fn();
	}

	let contexts: MockContext[];
	let worklets: MockWorklet[];
	let workletContexts: MockContext[];
	let cleanups: (() => void)[];

	beforeEach(() => {
		contexts = [];
		worklets = [];
		workletContexts = [];
		cleanups = [];
		vi.stubGlobal(
			'AudioContext',
			class extends MockContext {
				constructor(options: { sampleRate: number }) {
					super(options);
					contexts.push(this);
				}
			}
		);
		vi.stubGlobal(
			'AudioWorkletNode',
			class extends MockWorklet {
				constructor(context: MockContext) {
					super();
					worklets.push(this);
					workletContexts.push(context);
				}
			}
		);
	});

	afterEach(() => {
		for (const cleanup of cleanups) cleanup();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	function mount(sharedAudioContext?: MockContext, sampleRate = 48000, input = false, entry?: string) {
		const state = createMockState({
			editorConfig: {
				audioRuntime: { sampleRate, ...(input ? { audioInBufferLAddress: 0 } : {}), ...(entry ? { entry } : {}) },
			},
			compiler: { isCompiling: false },
		});
		const store = createStateManager(state);
		const handlers = new Map<string, () => Promise<void>>();
		const events = {
			on: vi.fn((name: string, handler: () => Promise<void>) => handlers.set(name, handler)),
			off: vi.fn((name: string) => handlers.delete(name)),
			dispatch: vi.fn(),
		} as unknown as EventDispatcher;
		const cleanup = audioWorkletRuntimeFactory(
			store,
			events,
			() => new Uint8Array(),
			() => new WebAssembly.Memory({ initial: 1 }),
			'worklet.js',
			sharedAudioContext
		);
		cleanups.push(cleanup);
		return {
			cleanup,
			store,
			events,
			allow: () => handlers.get('grantAudioPermission')!(),
		};
	}

	it('activates the supplied context in the Allow handler and reuses it after disposal', async () => {
		const shared = new MockContext();
		const first = mount(shared);
		expect(first.events.dispatch).toHaveBeenCalledWith('addDialog', expect.anything());
		const activation = first.allow();
		expect(shared.resume).toHaveBeenCalledOnce();
		await activation;
		const firstNode = worklets[0];
		first.cleanup();
		expect(firstNode.port.postMessage).toHaveBeenCalledWith({ type: 'dispose' });
		expect(firstNode.disconnect).toHaveBeenCalledOnce();
		expect(shared.close).not.toHaveBeenCalled();
		expect(shared.listeners.size).toBe(0);

		const second = mount(shared);
		await vi.waitFor(() => expect(worklets).toHaveLength(2));
		expect(second.events.dispatch).not.toHaveBeenCalledWith('addDialog', expect.anything());
		expect(contexts).toHaveLength(0);
		expect(workletContexts).toEqual([shared, shared]);
		expect(worklets[1]).not.toBe(firstNode);
		expect(shared.audioWorklet.addModule).toHaveBeenCalledOnce();
		expect(shared.resume).toHaveBeenCalledOnce();
	});

	it('shares an in-flight module load and starts waiting editors when the context runs', async () => {
		const shared = new MockContext();
		const loading = Promise.withResolvers<void>();
		shared.audioWorklet.addModule.mockReturnValue(loading.promise);
		const first = mount(shared);
		const second = mount(shared);
		const activation = first.allow();
		expect(shared.audioWorklet.addModule).toHaveBeenCalledOnce();
		expect(worklets).toHaveLength(0);
		loading.resolve();
		await activation;
		await vi.waitFor(() => expect(worklets).toHaveLength(2));
		expect(second.events.dispatch).toHaveBeenCalledWith('removeDialog', { id: 'audio-worklet-permission' });
	});

	it('creates and closes a private context when the project needs another rate', async () => {
		const shared = new MockContext();
		shared.state = 'running';
		const editor = mount(shared, 44100);
		expect(editor.events.dispatch).toHaveBeenCalledWith('addDialog', expect.anything());
		await editor.allow();
		expect(contexts[0].sampleRate).toBe(44100);
		expect(workletContexts).toEqual([contexts[0]]);
		expect(shared.audioWorklet.addModule).not.toHaveBeenCalled();
		editor.cleanup();
		expect(contexts[0].close).toHaveBeenCalledOnce();
		expect(shared.close).not.toHaveBeenCalled();
	});

	it.each(['omitted', 'closed'])('uses a private context when the supplied context is %s', async kind => {
		const shared = new MockContext();
		shared.state = 'closed';
		const editor = mount(kind === 'closed' ? shared : undefined);
		await editor.allow();
		expect(contexts).toHaveLength(1);
		editor.cleanup();
		expect(contexts[0].close).toHaveBeenCalledOnce();
	});

	it('returns to the running shared context after a sample rate change', async () => {
		const shared = new MockContext();
		const editor = mount(shared);
		await editor.allow();
		editor.store.set('editorConfig.audioRuntime', { sampleRate: 44100 });
		expect(worklets[0].disconnect).toHaveBeenCalledOnce();
		expect(shared.close).not.toHaveBeenCalled();
		await editor.allow();
		editor.events.dispatch = vi.fn();
		editor.store.set('editorConfig.audioRuntime', { sampleRate: 48000 });
		await vi.waitFor(() => expect(worklets).toHaveLength(3));
		expect(contexts[0].close).toHaveBeenCalledOnce();
		expect(workletContexts).toEqual([shared, contexts[0], shared]);
		expect(editor.events.dispatch).not.toHaveBeenCalledWith('addDialog', expect.anything());
	});

	it('does not attach a disposed editor when module loading finishes late', async () => {
		const shared = new MockContext();
		const loading = Promise.withResolvers<void>();
		shared.audioWorklet.addModule.mockReturnValue(loading.promise);
		const editor = mount(shared);
		const activation = editor.allow();
		editor.cleanup();
		loading.resolve();
		await activation;
		expect(worklets).toHaveLength(0);
		expect(shared.close).not.toHaveBeenCalled();
		mount(shared);
		await vi.waitFor(() => expect(worklets).toHaveLength(1));
		expect(shared.audioWorklet.addModule).toHaveBeenCalledOnce();
	});

	it('requests microphone input without voice processing', async () => {
		const shared = new MockContext();
		const stop = vi.fn();
		const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
		vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
		const editor = mount(shared, 48000, true);

		await editor.allow();

		expect(getUserMedia).toHaveBeenCalledWith({
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
			},
		});
	});

	it('stops a microphone obtained after disposal without reconnecting its worklet', async () => {
		const shared = new MockContext();
		const stop = vi.fn();
		const microphone = Promise.withResolvers<{ getTracks: () => { stop: typeof stop }[] }>();
		const getUserMedia = vi.fn(() => microphone.promise);
		vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
		const editor = mount(shared, 48000, true);
		const activation = editor.allow();
		await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
		editor.cleanup();
		microphone.resolve({ getTracks: () => [{ stop }] });
		await activation;
		expect(stop).toHaveBeenCalledOnce();
		expect(shared.createMediaStreamSource).not.toHaveBeenCalled();
		expect(worklets[0].connect).not.toHaveBeenCalled();
	});

	it('routes worklet messages to runtime initialization and runtime values', async () => {
		const editor = mount(new MockContext());
		await editor.allow();
		const port = worklets[0].port as unknown as { onmessage: (event: { data: unknown }) => void };

		port.onmessage({ data: { type: 'initialized', payload: { sampleRate: 48000 } } });
		port.onmessage({ data: { type: 'runtimeValues', payload: { audioBufferSize: 128 } } });

		expect(editor.events.dispatch).toHaveBeenCalledWith('runtimeInitialized', { sampleRate: 48000 });
		expect(editor.store.getState().runtime.values.AudioWorkletRuntime).toEqual({ audioBufferSize: 128 });
	});

	it('allows a failed worklet load to be retried without closing the shared context', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const shared = new MockContext();
		shared.audioWorklet.addModule.mockRejectedValueOnce(new Error('Network error'));
		const editor = mount(shared);
		await editor.allow();
		expect(editor.events.dispatch).toHaveBeenCalledWith(
			'addDialog',
			expect.objectContaining({
				text: 'Audio could not start. Select Allow to try again.',
			})
		);
		await editor.allow();
		expect(worklets).toHaveLength(1);
		expect(shared.audioWorklet.addModule).toHaveBeenCalledTimes(2);
		expect(shared.close).not.toHaveBeenCalled();
	});

	it.each([
		[undefined, 'buffer'],
		['alternate', 'alternate'],
	])('initializes the worklet with configured entry %s', async (configuredEntry, expectedEntry) => {
		const shared = new MockContext();
		const editor = mount(shared, 48000, false, configuredEntry);

		await editor.allow();

		expect(worklets[0].port.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'init',
				bufferExportName: expectedEntry,
			})
		);
	});
});

describe('AudioWorklet runtime config', () => {
	function createMemoryPlan(
		memories: Record<string, Record<string, { allocationUnitAddress: number }>>
	): State['compiler']['memoryPlan'] {
		const modules = Object.fromEntries(
			Object.entries(memories).map(([moduleId, moduleMemory], moduleIndex) => {
				const memory = Object.fromEntries(
					Object.entries(moduleMemory).map(([memoryId, memoryData]) => [
						memoryId,
						{
							id: memoryId,
							numberOfElements: 1,
							elementWordSize: 4,
							type: 'int',
							byteAddress: memoryData.allocationUnitAddress * 4,
							elementByteLength: 4,
							allocationUnitCount: 1,
							allocatedByteLength: 4,
							allocationUnitAddress: memoryData.allocationUnitAddress,
							endByteAddress: memoryData.allocationUnitAddress * 4,
							endAddressSafeByteLength: 4,
							lineNumber: 1,
							isInteger: true,
							pointerDepth: 0,
							isUnsigned: false,
						},
					])
				);
				return [
					moduleId,
					{
						id: moduleId,
						lineNumber: 1,
						byteAddress: moduleIndex * 4,
						allocationUnitCount: Object.keys(memory).length,
						allocatedByteLength: Object.keys(memory).length * 4,
						endByteAddress: moduleIndex * 4,
						endAddressSafeByteLength: 4,
						memory,
						declarations: Object.values(memory),
						declarationSources: [],
					},
				];
			})
		);

		return {
			modules,
			moduleList: Object.values(modules),
		};
	}

	function createState(): State {
		return createMockState({
			editorConfig: {
				audioRuntime: {
					audioOutBufferLAddress: 'audiooutL:buffer',
					audioOutBufferRAddress: 'audiooutR:buffer',
					audioInBufferLAddress: '16',
				},
			},
			compiler: {
				projectMemoryExposuresByGroupPath: {},
				memoryPlan: createMemoryPlan({
					audiooutL: { buffer: { allocationUnitAddress: 8 } },
					audiooutR: { buffer: { allocationUnitAddress: 24 } },
				}),
			},
		});
	}

	it('contributes the default entry and audio buffer address config fields', () => {
		const runtimeDef = createAudioWorkletRuntimeDef(
			() => new Uint8Array(),
			() => null,
			'worklet.js'
		);

		expect(runtimeDef.editorConfigSchema?.defaults).toMatchObject({ entry: 'buffer' });
		expect(runtimeDef.editorConfigSchema?.schema.properties).toMatchObject({
			entry: { type: 'string' },
			sampleRate: { type: 'number', minimum: 1 },
			audioOutBufferLAddress: {
				format: 'memory-address',
				anyOf: [
					{ type: 'integer', minimum: 0 },
					{ type: 'string', pattern: '^[^:\\s]+:[^:\\s]+$' },
				],
			},
			audioOutBufferRAddress: {
				format: 'memory-address',
				anyOf: [
					{ type: 'integer', minimum: 0 },
					{ type: 'string', pattern: '^[^:\\s]+:[^:\\s]+$' },
				],
			},
			audioInBufferLAddress: {
				format: 'memory-address',
				anyOf: [
					{ type: 'integer', minimum: 0 },
					{ type: 'string', pattern: '^[^:\\s]+:[^:\\s]+$' },
				],
			},
		});
	});

	it('builds stereo output and mono input routes from audio runtime config', () => {
		const state = createState();

		expect(getAudioOutputBuffers(state)).toEqual([
			{ audioBufferWordAddress: 8, output: 0, channel: 0 },
			{ audioBufferWordAddress: 24, output: 0, channel: 1 },
		]);
		expect(getAudioInputBuffers(state)).toEqual([{ audioBufferWordAddress: 16, input: 0, channel: 0 }]);
	});

	it('requests audio permission through an Allow dialog button', () => {
		const state = createState();
		const store = createStateManager(state);
		const events: EventDispatcher = {
			on: vi.fn(),
			off: vi.fn(),
			dispatch: vi.fn(),
		};

		const cleanup = audioWorkletRuntimeFactory(
			store,
			events,
			() => new Uint8Array(),
			() => null,
			'worklet.js'
		);

		expect(events.dispatch).toHaveBeenCalledWith('addDialog', {
			id: 'audio-worklet-permission',
			title: 'Audio Permission',
			text: "This project uses AudioWorklet for audio playback and requires your permission to start. Select Allow to start the program, or choose to do nothing; then the program won't start.",
			buttons: [{ title: 'Allow', action: 'grantAudioPermission' }],
		});
		expect(events.on).toHaveBeenCalledWith('grantAudioPermission', expect.any(Function));
		expect(events.on).not.toHaveBeenCalledWith('mousedown', expect.any(Function));

		cleanup();

		expect(events.off).toHaveBeenCalledWith('grantAudioPermission', expect.any(Function));
	});
});
