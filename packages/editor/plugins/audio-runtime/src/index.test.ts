import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioRuntimePlugin } from './index';

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
	let cleanups: Set<() => void>;

	beforeEach(() => {
		contexts = [];
		worklets = [];
		workletContexts = [];
		cleanups = new Set();
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

	function mount(sharedAudioContext?: MockContext, settings: string[] = [], modules = ['module demo', 'moduleEnd']) {
		const emitter = new EventEmitter();
		const events = {
			on: vi.fn(emitter.on.bind(emitter)),
			off: vi.fn(emitter.off.bind(emitter)),
			dispatch: vi.fn(emitter.emit.bind(emitter)),
		};
		const store = initState(events, { callbacks: {} });
		const memory = new WebAssembly.Memory({ initial: 1 });
		const dispose = createAudioRuntimePlugin({
			getCodeBuffer: () => new Uint8Array(),
			getMemory: () => memory,
			sharedAudioContext: sharedAudioContext as unknown as AudioContext,
		}).setup({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
			drawers: createEditorDrawerRegistry(),
		});
		const cleanup = () => {
			cleanups.delete(cleanup);
			dispose();
			store.dispose();
		};
		cleanups.add(cleanup);
		const code = (config: string[]) => [
			'note settings',
			'; @config audioRuntime.enabled true',
			...config.map(setting => `; @config audioRuntime.${setting}`),
			'noteEnd',
		];
		const project = parseProjectSource(
			['8f4e/v1', ...code(settings), 'entry buffer', ...modules, 'entryEnd'].join('\n')
		);
		events.dispatch('loadProject', { project });
		const state = store.getState();
		const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'settings')!;
		return {
			cleanup,
			store,
			state,
			events,
			project,
			configure: (config: string[]) =>
				applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: code(config) }], { affectsCompilation: true }),
			allow: () => emitter.listeners('grantAudioPermission')[0]() as Promise<void>,
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
		const editor = mount(shared, ['sampleRate 44100']);
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
		editor.configure(['sampleRate 44100']);
		expect(worklets[0].disconnect).toHaveBeenCalledOnce();
		expect(shared.close).not.toHaveBeenCalled();
		await editor.allow();
		editor.events.dispatch.mockClear();
		editor.configure(['sampleRate 48000']);
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
		const editor = mount(shared, ['audioInBufferLAddress 0']);

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
		const editor = mount(shared, ['audioInBufferLAddress 0']);
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

		expect(editor.events.dispatch).toHaveBeenCalledWith('memoryValuesChanged');
		expect(editor.store.getState().info.audioRuntime).toEqual({ audioBufferSize: 128, sampleRate: 48000 });
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
		const editor = mount(shared, configuredEntry ? [`entry ${configuredEntry}`] : []);

		await editor.allow();

		expect(worklets[0].port.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'init',
				bufferExportName: expectedEntry,
			})
		);
	});

	it('owns its schema and only requests audio while enabled', async () => {
		const editor = mount(new MockContext(), ['enabled false']);
		expect(editor.state.editorConfigSchemaContributions.audioRuntime).toBeDefined();
		expect(editor.state.envConstantContributions.audioRuntime).toBeUndefined();
		expect(editor.events.dispatch).not.toHaveBeenCalledWith('addDialog', expect.anything());
		expect(worklets).toHaveLength(0);
		editor.configure([]);
		expect(editor.events.dispatch).toHaveBeenCalledWith('addDialog', expect.anything());
		await editor.allow();
		expect(worklets).toHaveLength(1);
		editor.configure(['enabled false']);
		expect(worklets[0].disconnect).toHaveBeenCalledOnce();
		expect(editor.state.info.audioRuntime).toBeUndefined();
		expect(editor.state.envConstantContributions.audioRuntime).toEqual([]);
		editor.cleanup();
		expect(editor.state.editorConfigSchemaContributions.audioRuntime).toBeUndefined();
		expect(editor.state.envConstantContributions.audioRuntime).toBeUndefined();
	});

	it('defaults and replaces its contributed constant names', () => {
		const editor = mount(new MockContext());
		expect(editor.state.envConstantContributions.audioRuntime).toEqual([
			'const SAMPLE_RATE 48000',
			'const AUDIO_BUFFER_SIZE 128',
		]);
		editor.configure(['sampleRate 44100', 'sampleRateConstantName AUDIO_RATE', 'bufferSizeConstantName BUFFER_LENGTH']);
		expect(editor.state.envConstantContributions.audioRuntime).toEqual([
			'const AUDIO_RATE 44100',
			'const BUFFER_LENGTH 128',
		]);
		expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
	});

	it('sends stereo output and mono input routes resolved from project configuration', async () => {
		vi.stubGlobal('navigator', {
			mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
		});
		const editor = mount(
			new MockContext(),
			[
				'audioOutBufferLAddress audiooutL:buffer',
				'audioOutBufferRAddress audiooutR:buffer',
				'audioInBufferLAddress 16',
			],
			['module audiooutL', 'float[] buffer 128', 'moduleEnd', 'module audiooutR', 'float[] buffer 128', 'moduleEnd']
		);
		const compiled = await compileProject(editor.project);
		editor.store.set('compiler', {
			...editor.state.compiler,
			compiledModules: compiled.compiledModules,
			memoryPlan: compiled.memoryPlan,
			memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
			projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
		});
		await editor.allow();
		expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
		expect(worklets[0].port.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'init',
				audioOutputBuffers: [
					{
						audioBufferWordAddress: compiled.memoryPlan.modules.audiooutL.memory.buffer.allocationUnitAddress,
						output: 0,
						channel: 0,
					},
					{
						audioBufferWordAddress: compiled.memoryPlan.modules.audiooutR.memory.buffer.allocationUnitAddress,
						output: 0,
						channel: 1,
					},
				],
				audioInputBuffers: [{ audioBufferWordAddress: 16, input: 0, channel: 0 }],
			})
		);
	});

	it('requests audio permission through an Allow dialog button', () => {
		const editor = mount(new MockContext());
		expect(editor.events.dispatch).toHaveBeenCalledWith('addDialog', {
			id: 'audio-worklet-permission',
			title: 'Audio Permission',
			text: "This project uses AudioWorklet for audio playback and requires your permission to start. Select Allow to start the program, or choose to do nothing; then the program won't start.",
			buttons: [{ title: 'Allow', action: 'grantAudioPermission' }],
		});
		expect(editor.events.on).toHaveBeenCalledWith('grantAudioPermission', expect.any(Function));
		editor.cleanup();
		expect(editor.events.off).toHaveBeenCalledWith('grantAudioPermission', expect.any(Function));
	});
});
