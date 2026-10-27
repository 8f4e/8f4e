// Narrow views of the Web Audio and media APIs used by the host runtime.
// runtimeDef.ts runs on the host page but is type-checked with the AudioWorklet lib, which has no DOM types.

import type { AudioWorkletHostMessage, AudioWorkletRuntimeMessage } from './messages';

export interface AudioNodeLike {
	connect(destination: AudioNodeLike): unknown;
	disconnect(): void;
}

export interface MediaStreamTrackLike {
	stop(): void;
}

export interface MediaStreamLike {
	getTracks(): MediaStreamTrackLike[];
}

export interface AudioContextLike {
	readonly sampleRate: number;
	readonly state: string;
	readonly destination: AudioNodeLike;
	readonly audioWorklet: { addModule(url: string): Promise<void> };
	resume(): Promise<void>;
	close(): Promise<void>;
	createMediaStreamSource(mediaStream: MediaStreamLike): AudioNodeLike;
	addEventListener(type: 'statechange', listener: () => void): void;
	removeEventListener(type: 'statechange', listener: () => void): void;
}

export interface AudioWorkletPortLike {
	onmessage: ((event: { data: AudioWorkletRuntimeMessage }) => void) | null;
	postMessage(message: AudioWorkletHostMessage): void;
	close(): void;
}

export interface AudioWorkletNodeLike extends AudioNodeLike {
	readonly port: AudioWorkletPortLike;
}

interface AudioWorkletNodeOptionsLike {
	outputChannelCount: number[];
	numberOfOutputs: number;
	numberOfInputs: number;
	channelCount: number;
	channelCountMode: 'explicit';
}

interface MicrophoneConstraints {
	audio: { echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean };
}

/** Browser globals read by getBrowserAudioPlatform. */
interface BrowserAudioGlobals {
	AudioContext: new (options: { sampleRate: number; latencyHint: 'interactive' }) => AudioContextLike;
	AudioWorkletNode: new (
		context: AudioContextLike,
		name: string,
		options: AudioWorkletNodeOptionsLike
	) => AudioWorkletNodeLike;
	navigator: { mediaDevices: { getUserMedia(constraints: MicrophoneConstraints): Promise<MediaStreamLike> } };
}

/**
 * Host-page capabilities used to start audio and microphone input.
 * The globals are read on each call, the same as accessing them directly.
 */
export const browserAudioPlatform = {
	createAudioContext: (options: { sampleRate: number; latencyHint: 'interactive' }) =>
		new (getBrowserGlobals().AudioContext)(options),
	createAudioWorkletNode: (context: AudioContextLike, name: string, options: AudioWorkletNodeOptionsLike) =>
		new (getBrowserGlobals().AudioWorkletNode)(context, name, options),
	getUserMedia: (constraints: MicrophoneConstraints) =>
		getBrowserGlobals().navigator.mediaDevices.getUserMedia(constraints),
};

function getBrowserGlobals(): BrowserAudioGlobals {
	// The AudioWorklet lib does not declare these host-page globals, so this is the one place they are asserted.
	return globalThis as unknown as BrowserAudioGlobals;
}
