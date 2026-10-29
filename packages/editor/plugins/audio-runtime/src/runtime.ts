import type {
	EditorConfig,
	EditorConfigSchemaContribution,
	EditorPluginContext,
	EventDispatcher,
	State,
} from '@8f4e/editor-core';
import { resolveSchemaConfigRoot } from '@8f4e/editor-core';
import type {
	AudioInputBufferRoute,
	AudioOutputBufferRoute,
	AudioWorkletRuntimeMessage,
} from '@8f4e/runtime-audio-worklet/messages';
import audioWorkletUrl from '@8f4e/runtime-audio-worklet/worklet?url';

const AUDIO_PERMISSION_DIALOG_ID = 'audio-worklet-permission';
const GRANT_AUDIO_PERMISSION_ACTION = 'grantAudioPermission';
export const AUDIO_BUFFER_SIZE = 128;
const AUDIO_PERMISSION_TEXT =
	"This project uses AudioWorklet for audio playback and requires your permission to start. Select Allow to start the program, or choose to do nothing; then the program won't start.";

/** Reuse an AudioContext’s loaded worklet modules across editor instances. */

const workletModules = new WeakMap<AudioContext, Map<string, Promise<void>>>();

function loadWorklet(context: AudioContext, url: string): Promise<void> {
	let modules = workletModules.get(context);
	if (!modules) {
		modules = new Map();
		workletModules.set(context, modules);
	}
	let loading = modules.get(url);
	if (!loading) {
		loading = context.audioWorklet.addModule(url).catch(error => {
			modules.delete(url);
			throw error;
		});
		modules.set(url, loading);
	}
	return loading;
}
const AUDIO_BUFFER_ADDRESS_SCHEMA = {
	format: 'memory-address',
	anyOf: [
		{ type: 'integer' as const, minimum: 0 },
		{ type: 'string' as const, pattern: '^[^:\\s]+:[^:\\s]+$' },
	],
};

export const AUDIO_WORKLET_EDITOR_CONFIG: EditorConfigSchemaContribution = {
	root: 'audioRuntime',
	defaults: {
		enabled: false,
		entry: 'buffer',
		sampleRate: 48000,
		sampleRateConstantName: 'SAMPLE_RATE',
		bufferSizeConstantName: 'AUDIO_BUFFER_SIZE',
	},
	schema: {
		type: 'object',
		properties: {
			enabled: { type: 'boolean' },
			entry: { type: 'string' },
			sampleRateConstantName: { type: 'string' },
			bufferSizeConstantName: { type: 'string' },
			sampleRate: { type: 'number', minimum: 1 },
			audioOutBufferLAddress: AUDIO_BUFFER_ADDRESS_SCHEMA,
			audioOutBufferRAddress: AUDIO_BUFFER_ADDRESS_SCHEMA,
			audioInBufferLAddress: AUDIO_BUFFER_ADDRESS_SCHEMA,
		},
		additionalProperties: false,
	},
};

interface AudioWorkletRuntimeConfig {
	enabled: boolean;
	sampleRateConstantName: string;
	bufferSizeConstantName: string;
	entry: string;
	sampleRate: number;
	audioOutBufferLAddress?: number;
	audioOutBufferRAddress?: number;
	audioInBufferLAddress?: number;
}

export function getAudioWorkletRuntimeConfig(state: State): AudioWorkletRuntimeConfig {
	return resolveSchemaConfigRoot(
		AUDIO_WORKLET_EDITOR_CONFIG,
		state.editorConfig,
		state
	) as unknown as AudioWorkletRuntimeConfig;
}

function getSampleRate(editorConfig: EditorConfig): number {
	return resolveSchemaConfigRoot(AUDIO_WORKLET_EDITOR_CONFIG, editorConfig).sampleRate as number;
}

function getAudioOutputBuffers(state: State): AudioOutputBufferRoute[] {
	const config = getAudioWorkletRuntimeConfig(state);
	const leftAddress = config.audioOutBufferLAddress;
	const rightAddress = config.audioOutBufferRAddress;
	const buffers: AudioOutputBufferRoute[] = [];

	if (leftAddress !== undefined) {
		buffers.push({ audioBufferWordAddress: leftAddress, output: 0, channel: 0 });
	}

	if (rightAddress !== undefined) {
		buffers.push({ audioBufferWordAddress: rightAddress, output: 0, channel: 1 });
	}

	return buffers;
}

function getAudioInputBuffers(state: State): AudioInputBufferRoute[] {
	const config = getAudioWorkletRuntimeConfig(state);
	const leftAddress = config.audioInBufferLAddress;

	return leftAddress === undefined ? [] : [{ audioBufferWordAddress: leftAddress, input: 0, channel: 0 }];
}

function hasAudioInputBufferConfig(editorConfig: EditorConfig): boolean {
	return resolveSchemaConfigRoot(AUDIO_WORKLET_EDITOR_CONFIG, editorConfig).audioInBufferLAddress !== undefined;
}

// AudioWorklet Runtime Factory
export function startAudioRuntime(
	store: EditorPluginContext['store'],
	events: EventDispatcher,
	getCodeBuffer: () => Uint8Array,
	getMemory: () => WebAssembly.Memory | null,
	sharedAudioContext?: AudioContext
) {
	const state = store.getState();
	let audioContext: AudioContext | null = null;
	let audioWorklet: AudioWorkletNode | null = null;
	let mediaStream: MediaStream | null = null;
	let mediaStreamSource: MediaStreamAudioSourceNode | null = null;
	let disposed = false;
	/**
	 * Identifies the current audio initialization attempt. Incremented when initialization
	 * starts and when the audio setup is torn down. After each await, initialization checks
	 * its captured value so an old attempt cannot attach nodes or tear down a newer setup.
	 * This also handles sample-rate changes while the editor itself remains alive.
	 */
	let generation = 0;
	/**
	 * Identifies the latest microphone synchronization request. Incremented on every input
	 * sync and audio teardown. If getUserMedia resolves with an older revision, its tracks
	 * are stopped instead of connected. This is separate from generation because input
	 * settings can change without restarting the audio context. The pending browser request
	 * is not cancelled; only its outdated result is discarded.
	 */
	let inputRevision = 0;

	function getSharedAudioContext() {
		return sharedAudioContext?.state !== 'closed' &&
			sharedAudioContext?.sampleRate === getSampleRate(state.editorConfig)
			? sharedAudioContext
			: undefined;
	}

	function showAudioPermissionDialog(text: string) {
		events.dispatch('addDialog', {
			id: AUDIO_PERMISSION_DIALOG_ID,
			text,
			title: 'Audio Permission',
			buttons: [{ title: 'Allow', action: GRANT_AUDIO_PERMISSION_ACTION }],
		});
	}

	function hideAudioPermissionDialog() {
		events.dispatch('removeDialog', { id: AUDIO_PERMISSION_DIALOG_ID });
	}

	function syncCodeAndSettingsWithRuntime() {
		if (!audioWorklet || !audioContext) {
			return;
		}

		const memory = getMemory();
		if (!memory) {
			console.warn('[Runtime] Memory not yet created, skipping runtime init');
			return;
		}

		const config = getAudioWorkletRuntimeConfig(state);
		audioWorklet.port.postMessage({
			type: 'init',
			memoryRef: memory,
			codeBuffer: getCodeBuffer(),
			bufferExportName: config.entry,
			audioOutputBuffers: getAudioOutputBuffers(state),
			audioInputBuffers: getAudioInputBuffers(state),
		});
	}

	async function syncAudioInputSource() {
		const revision = ++inputRevision;
		if (!audioContext || !audioWorklet) {
			return;
		}

		if (!hasAudioInputBufferConfig(state.editorConfig)) {
			if (mediaStreamSource) {
				mediaStreamSource.disconnect();
				mediaStreamSource = null;
			}

			if (mediaStream) {
				mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
				mediaStream = null;
			}
			return;
		}

		if (mediaStreamSource) {
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
				},
			});
			if (disposed || revision !== inputRevision) {
				stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
				return;
			}
			mediaStream = stream;
			mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);
			mediaStreamSource.connect(audioWorklet);
		} catch (error) {
			console.error('Error accessing the microphone:', error);
		}
	}

	async function initAudioContext() {
		if (disposed || audioContext) {
			return;
		}
		hideAudioPermissionDialog();
		const currentGeneration = ++generation;

		try {
			audioContext = getSharedAudioContext() ?? null;
			if (!audioContext) {
				audioContext = new AudioContext({
					sampleRate: getSampleRate(state.editorConfig),
					latencyHint: 'interactive',
				});
			}

			// Resume synchronously in the Allow handler, before loading the worklet can consume the user gesture.
			await Promise.all([
				audioContext.state === 'running' ? Promise.resolve() : audioContext.resume(),
				loadWorklet(audioContext, audioWorkletUrl),
			]);
			if (disposed || currentGeneration !== generation) {
				return;
			}
			audioWorklet = new AudioWorkletNode(audioContext, 'worklet', {
				outputChannelCount: [2],
				numberOfOutputs: 1,
				numberOfInputs: 1, // Specify the number of inputs
				channelCount: 1,
				channelCountMode: 'explicit',
			});

			audioWorklet.port.onmessage = ({ data }: { data: AudioWorkletRuntimeMessage }) => {
				switch (data.type) {
					case 'initialized':
						store.set('info.audioRuntime', { ...state.info.audioRuntime, ...data.payload });
						events.dispatch('memoryValuesChanged');
						break;
					case 'runtimeValues':
						store.set('info.audioRuntime', { ...state.info.audioRuntime, ...data.payload });
						break;
				}
			};

			await syncAudioInputSource();
			if (disposed || currentGeneration !== generation) {
				return;
			}

			audioWorklet.connect(audioContext.destination);

			syncCodeAndSettingsWithRuntime();
		} catch (error) {
			if (disposed || currentGeneration !== generation) {
				return;
			}
			tearDownAudioContext();
			console.error('Error starting audio:', error);
			showAudioPermissionDialog('Audio could not start. Select Allow to try again.');
		}
	}

	store.subscribeToValue('compiler.isCompiling', false, syncCodeAndSettingsWithRuntime);
	store.subscribe('editorConfig.audioRuntime', onEditorConfigChanged);
	events.on(GRANT_AUDIO_PERMISSION_ACTION, initAudioContext);
	sharedAudioContext?.addEventListener('statechange', onSharedContextStateChanged);

	function tearDownAudioContext() {
		++generation;
		++inputRevision;
		if (mediaStreamSource) {
			mediaStreamSource.disconnect();
			mediaStreamSource = null;
		}

		if (mediaStream) {
			mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
			mediaStream = null;
		}

		if (audioWorklet) {
			audioWorklet.port.postMessage({ type: 'dispose' });
			audioWorklet.port.onmessage = null;
			audioWorklet.port.close();
			audioWorklet.disconnect();
			audioWorklet = null;
		}

		if (audioContext) {
			if (audioContext !== sharedAudioContext) {
				void audioContext.close();
			}
			audioContext = null;
		}
	}

	function onEditorConfigChanged() {
		if (!audioContext) {
			startOrRequestAudio();
			return;
		}
		const desiredSampleRate = getSampleRate(state.editorConfig);
		if (audioContext.sampleRate !== desiredSampleRate) {
			tearDownAudioContext();
			startOrRequestAudio('Sample rate changed. Select Allow to restart audio playback at the new sample rate.');
			return;
		}

		void syncAudioInputSource();
		syncCodeAndSettingsWithRuntime();
	}

	function onSharedContextStateChanged() {
		if (!disposed && !audioContext && getSharedAudioContext()?.state === 'running') {
			void initAudioContext();
		}
	}

	function startOrRequestAudio(text = AUDIO_PERMISSION_TEXT) {
		if (getSharedAudioContext()?.state === 'running') {
			void initAudioContext();
		} else {
			showAudioPermissionDialog(text);
		}
	}

	startOrRequestAudio();

	return () => {
		disposed = true;
		store.unsubscribe('compiler.isCompiling', syncCodeAndSettingsWithRuntime);
		store.unsubscribe('editorConfig.audioRuntime', onEditorConfigChanged);
		events.off(GRANT_AUDIO_PERMISSION_ACTION, initAudioContext);
		sharedAudioContext?.removeEventListener('statechange', onSharedContextStateChanged);

		tearDownAudioContext();
		hideAudioPermissionDialog();
	};
}
