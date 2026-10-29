import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPluginContext } from '@8f4e/editor-core';
import { createAudioRuntimePlugin } from '@8f4e/editor-plugin-audio-runtime';
import { createWorkerRuntimePlugin } from '@8f4e/editor-plugin-worker-runtime';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { afterEach, expect, it, vi } from 'vitest';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	let memory: WebAssembly.Memory | null = null;
	const workers: FakeWorker[] = [];
	class FakeWorker {
		postMessage = vi.fn();
		terminate = vi.fn();
		removeEventListener = vi.fn();
		onmessage!: (event: { data: unknown }) => void;
		addEventListener = vi.fn((_name: string, listener: typeof this.onmessage) => {
			this.onmessage = listener;
		});
		constructor() {
			workers.push(this);
		}
	}
	const worklets: FakeWorklet[] = [];
	class FakeWorklet {
		port = { postMessage: vi.fn(), close: vi.fn(), onmessage: null as ((event: { data: unknown }) => void) | null };
		connect = vi.fn();
		disconnect = vi.fn();
		constructor() {
			worklets.push(this);
		}
	}
	const audioContext = {
		state: 'running',
		sampleRate: 48000,
		destination: {},
		audioWorklet: { addModule: vi.fn(async () => {}) },
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		close: vi.fn(),
	};
	const context = { store, events } as EditorPluginContext;
	const disposeAudio = createAudioRuntimePlugin({
		getMemory: () => memory,
		getCodeBuffer: () => new Uint8Array([1]),
		audioWorkletUrl: 'worklet.js',
		sharedAudioContext: audioContext as unknown as AudioContext,
		AudioContext: class {} as unknown as typeof AudioContext,
		AudioWorkletNode: FakeWorklet as unknown as typeof AudioWorkletNode,
		navigator: {} as Navigator,
	}).setup(context);
	const disposeWorker = createWorkerRuntimePlugin({
		getMemory: () => memory,
		getCodeBuffer: () => new Uint8Array([1]),
		Worker: FakeWorker as unknown as new () => Worker,
	}).setup(context);
	cleanups.push(() => {
		disposeWorker();
		disposeAudio();
		store.dispose();
	});
	const source = [
		'note config',
		'; @config audioRuntime.enabled true',
		'; @config audioRuntime.sampleRateConstantName AUDIO_RATE',
		'; @config workerRuntime.enabled true',
		'; @config workerRuntime.sampleRateConstantName CONTROL_RATE',
		'; @config workerRuntime.sampleRate 25',
		'noteEnd',
	];
	events.dispatch('loadProject', {
		project: parseProjectSource(
			['8f4e/v1', ...source, 'entry main', 'module demo', 'moduleEnd', 'entryEnd'].join('\n')
		),
	});
	const block = state.codeBlockRendering.codeBlocks.find(block => block.blockType === 'note')!;
	const edit = (from: string, to: string) =>
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: block.code.map(line => line.replace(from, to)) }], {
			affectsCompilation: true,
		});
	const compile = () => {
		store.set('compiler.isCompiling', true);
		memory = new WebAssembly.Memory({ initial: 1 });
		store.set('compiler.isCompiling', false);
	};
	return { store, state, workers, worklets, audioContext, compile, edit, disposeAudio, disposeWorker };
}

it('starts both runtimes after compilation and keeps their constants and info separate', async () => {
	const test = setup();
	expect(test.workers).toHaveLength(0);
	expect(test.worklets).toHaveLength(0);
	expect(test.state.envConstantContributions.audioRuntime).toEqual([
		'const AUDIO_RATE 48000',
		'const AUDIO_BUFFER_SIZE 128',
	]);
	expect(test.state.envConstantContributions.workerRuntime).toEqual(['const CONTROL_RATE 25']);
	expect(test.state.codeErrors.editorDirectiveErrors).toEqual([]);
	test.compile();
	await vi.waitFor(() => expect(test.worklets).toHaveLength(1));
	expect(test.workers).toHaveLength(1);
	expect(test.workers[0].postMessage).toHaveBeenCalledWith(
		expect.objectContaining({ payload: expect.objectContaining({ entry: 'main', sampleRate: 25 }) })
	);
	test.workers[0].onmessage({
		data: {
			type: 'stats',
			payload: {
				timerPrecisionPercentage: 99,
				timeToExecuteLoopMs: 1,
				timerDriftMs: 0,
				timerExpectedIntervalTimeMs: 40,
			},
		},
	});
	test.worklets[0].port.onmessage!({ data: { type: 'runtimeValues', payload: { audioBufferSize: 128 } } });
	expect(test.state.info.workerRuntime?.timerPrecisionPercentage).toBe(99);
	expect(test.state.info.audioRuntime?.audioBufferSize).toBe(128);
});

it('disables and reenables a runtime independently, and replaces its contributed names', async () => {
	const test = setup();
	test.compile();
	await vi.waitFor(() => expect(test.worklets).toHaveLength(1));
	test.edit('workerRuntime.enabled true', 'workerRuntime.enabled false');
	expect(test.workers[0].terminate).toHaveBeenCalledOnce();
	expect(test.worklets[0].disconnect).not.toHaveBeenCalled();
	expect(test.state.envConstantContributions.workerRuntime).toEqual([]);
	test.edit('audioRuntime.sampleRateConstantName AUDIO_RATE', 'audioRuntime.sampleRateConstantName SAMPLE_RATE');
	expect(test.state.envConstantContributions.audioRuntime).toContain('const SAMPLE_RATE 48000');
	expect(test.state.envConstantContributions.audioRuntime).not.toContain('const AUDIO_RATE 48000');
	test.store.set('compiler.isCompiling', true);
	test.edit('workerRuntime.enabled false', 'workerRuntime.enabled true');
	expect(test.workers).toHaveLength(1);
	test.store.set('compiler.isCompiling', false);
	expect(test.workers).toHaveLength(2);
	expect(test.worklets).toHaveLength(1);
	test.edit('audioRuntime.enabled true', 'audioRuntime.enabled false');
	expect(test.worklets[0].disconnect).toHaveBeenCalledOnce();
	expect(test.workers[1].terminate).not.toHaveBeenCalled();
	expect(test.state.envConstantContributions.audioRuntime).toEqual([]);
});

it('removes each plugin’s resources and contributions without disposing the other runtime', async () => {
	const test = setup();
	test.compile();
	await vi.waitFor(() => expect(test.worklets).toHaveLength(1));
	test.disposeWorker();
	expect(test.workers[0].terminate).toHaveBeenCalledOnce();
	expect(test.state.editorConfigSchemaContributions.workerRuntime).toBeUndefined();
	expect(test.state.envConstantContributions.workerRuntime).toBeUndefined();
	expect(test.worklets[0].disconnect).not.toHaveBeenCalled();
	test.disposeAudio();
	expect(test.worklets[0].disconnect).toHaveBeenCalledOnce();
	expect(test.audioContext.close).not.toHaveBeenCalled();
	expect(test.state.editorConfigSchemaContributions.audioRuntime).toBeUndefined();
	expect(test.state.envConstantContributions.audioRuntime).toBeUndefined();
	cleanups.pop();
	test.store.dispose();
});

it('defaults contributed names and allows audio buffer-size names to be configured', () => {
	const test = setup();
	test.edit('; @config audioRuntime.sampleRateConstantName AUDIO_RATE', '');
	expect(test.state.envConstantContributions.audioRuntime).toEqual([
		'const SAMPLE_RATE 48000',
		'const AUDIO_BUFFER_SIZE 128',
	]);
	const block = test.state.codeBlockRendering.codeBlocks.find(block => block.blockType === 'note')!;
	applyCodeBlockSourceEdits(
		test.store,
		[
			{
				codeBlock: block,
				code: [...block.code.slice(0, -1), '; @config audioRuntime.bufferSizeConstantName BUFFER_LENGTH', 'noteEnd'],
			},
		],
		{ affectsCompilation: true }
	);
	expect(test.state.envConstantContributions.audioRuntime).toEqual([
		'const SAMPLE_RATE 48000',
		'const BUFFER_LENGTH 128',
	]);
	test.edit('; @config workerRuntime.sampleRateConstantName CONTROL_RATE', '');
	expect(test.state.envConstantContributions.workerRuntime).toEqual(['const SAMPLE_RATE 25']);
});
