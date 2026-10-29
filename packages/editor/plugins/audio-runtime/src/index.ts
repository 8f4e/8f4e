import type { EditorPlugin } from '@8f4e/editor-core';
import {
	AUDIO_BUFFER_SIZE,
	AUDIO_WORKLET_EDITOR_CONFIG,
	getAudioWorkletRuntimeConfig,
	startAudioRuntime,
} from './runtime';

export function createAudioRuntimePlugin({
	getCodeBuffer,
	getMemory,
	audioWorkletUrl,
	sharedAudioContext,
	AudioContext: AudioContextConstructor,
	AudioWorkletNode: AudioWorkletNodeConstructor,
	navigator,
}: {
	getCodeBuffer: () => Uint8Array;
	getMemory: () => WebAssembly.Memory | null;
	audioWorkletUrl: string;
	sharedAudioContext?: AudioContext;
	AudioContext: typeof globalThis.AudioContext;
	AudioWorkletNode: typeof globalThis.AudioWorkletNode;
	navigator: Navigator;
}): EditorPlugin {
	return {
		id: 'audio-runtime',
		setup: ({ store, events }) => {
			const state = store.getState();
			let stop: (() => void) | undefined;
			function sync() {
				const config = getAudioWorkletRuntimeConfig(state);
				const lines = config.enabled
					? [
							`const ${config.sampleRateConstantName} ${config.sampleRate}`,
							`const ${config.bufferSizeConstantName} ${AUDIO_BUFFER_SIZE}`,
						]
					: [];
				const previous = state.envConstantContributions.audioRuntime ?? [];
				if (lines.length !== previous.length || lines.some((line, index) => line !== previous[index]))
					store.set('envConstantContributions.audioRuntime', lines);
				if (!config.enabled) {
					stop?.();
					stop = undefined;
					store.set('info.audioRuntime', undefined);
					return;
				}
				if (!stop && !state.compiler.isCompiling && getMemory())
					stop = startAudioRuntime(
						store,
						events,
						getCodeBuffer,
						getMemory,
						audioWorkletUrl,
						sharedAudioContext,
						AudioContextConstructor,
						AudioWorkletNodeConstructor,
						navigator
					);
			}
			store.subscribe('editorConfig.audioRuntime', sync);
			store.subscribe('compiler.isCompiling', sync);
			store.set('editorConfigSchemaContributions.audioRuntime', AUDIO_WORKLET_EDITOR_CONFIG);
			sync();
			return () => {
				store.unsubscribe('editorConfig.audioRuntime', sync);
				store.unsubscribe('compiler.isCompiling', sync);
				stop?.();
				store.set('info.audioRuntime', undefined);
				const constants = { ...state.envConstantContributions };
				delete constants.audioRuntime;
				store.set('envConstantContributions', constants);
				const schemas = { ...state.editorConfigSchemaContributions };
				delete schemas.audioRuntime;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
