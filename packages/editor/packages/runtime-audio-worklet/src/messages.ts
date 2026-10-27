// Message protocol shared by the host runtime (runtimeDef.ts) and the AudioWorklet processor (index.ts).
// Type-only, so the worklet bundle stays dependency-free.

export interface AudioOutputBufferRoute {
	audioBufferWordAddress: number;
	output: number;
	channel: number;
}

export interface AudioInputBufferRoute {
	audioBufferWordAddress: number;
	input: number;
	channel: number;
}

/** Messages posted by the host to the AudioWorklet processor. */
export type AudioWorkletHostMessage =
	| {
			type: 'init';
			memoryRef: WebAssembly.Memory;
			codeBuffer: Uint8Array;
			bufferExportName: string;
			audioOutputBuffers: AudioOutputBufferRoute[];
			audioInputBuffers: AudioInputBufferRoute[];
	  }
	| { type: 'dispose' };

/** Messages posted by the AudioWorklet processor to the host. */
export type AudioWorkletRuntimeMessage =
	| { type: 'initialized'; payload: { sampleRate: number } }
	| { type: 'runtimeValues'; payload: { audioBufferSize: number } };
