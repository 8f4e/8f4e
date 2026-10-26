import createModule from './createModule';
import type {
	AudioInputBufferRoute,
	AudioOutputBufferRoute,
	AudioWorkletHostMessage,
	AudioWorkletRuntimeMessage,
} from './messages';

class Main extends AudioWorkletProcessor {
	constructor(...args: ConstructorParameters<typeof AudioWorkletProcessor>) {
		super(...args);

		this.port.onmessage = async ({ data }: MessageEvent<AudioWorkletHostMessage>) => {
			if (data.type === 'dispose') {
				this.disposed = true;
				this.buffer = () => {};
				this.memoryBuffer = new Float32Array(0);
				this.port.close();
				return;
			}
			if (data.type === 'init') {
				this.init(
					data.memoryRef,
					data.codeBuffer,
					data.bufferExportName,
					data.audioOutputBuffers,
					data.audioInputBuffers
				);
			}
		};
	}

	async init(
		memoryRef: WebAssembly.Memory,
		codeBuffer: Uint8Array,
		bufferExportName: string,
		audioOutputBuffers: AudioOutputBufferRoute[],
		audioInputBuffers: AudioInputBufferRoute[]
	) {
		const { memoryBuffer, buffer } = await createModule(memoryRef, codeBuffer, bufferExportName);
		if (this.disposed) {
			return;
		}

		this.audioOutputBuffers = audioOutputBuffers;
		this.audioInputBuffers = audioInputBuffers;

		this.buffer = buffer;
		this.memoryBuffer = memoryBuffer;

		this.postToHost({
			type: 'initialized',
			payload: {
				sampleRate,
			},
		});
	}

	buffer: CallableFunction = () => {
		return;
	};
	private disposed = false;

	memoryBuffer: Float32Array = new Float32Array(128).fill(0);
	audioOutputBuffers: AudioOutputBufferRoute[] = [];
	audioInputBuffers: AudioInputBufferRoute[] = [];
	audioBufferSize: number | undefined;

	static get parameterDescriptors() {
		return [{ name: 'amplitude', defaultValue: 0.25, minValue: 0, maxValue: 1 }];
	}

	private postToHost(message: AudioWorkletRuntimeMessage) {
		this.port.postMessage(message);
	}

	private reportAudioBufferSize(inputs: Float32Array[][], outputs: Float32Array[][]) {
		const audioBufferSize = outputs[0]?.[0]?.length ?? inputs[0]?.[0]?.length;

		if (!audioBufferSize || audioBufferSize === this.audioBufferSize) {
			return;
		}

		this.audioBufferSize = audioBufferSize;
		this.postToHost({
			type: 'runtimeValues',
			payload: {
				audioBufferSize,
			},
		});
	}

	process(inputs: Float32Array[][], outputs: Float32Array[][]) {
		if (this.disposed) {
			return false;
		}
		this.reportAudioBufferSize(inputs, outputs);

		for (let i = 0; i < this.audioInputBuffers.length; i++) {
			const input = inputs[this.audioInputBuffers[i].input];
			if (!input) {
				continue;
			}

			const channel = input[this.audioInputBuffers[i].channel];
			if (!channel) {
				continue;
			}

			for (let j = 0; j < channel.length; j++) {
				this.memoryBuffer[j + this.audioInputBuffers[i].audioBufferWordAddress] = channel[j];
			}
		}

		this.buffer();

		for (let i = 0; i < this.audioOutputBuffers.length; i++) {
			const output = outputs[this.audioOutputBuffers[i].output];

			if (!output) {
				continue;
			}

			const channel = output[this.audioOutputBuffers[i].channel];

			if (!channel) {
				continue;
			}

			for (let j = 0; j < channel.length; j++) {
				channel[j] = this.memoryBuffer[j + this.audioOutputBuffers[i].audioBufferWordAddress];
			}
		}

		return true;
	}
}

registerProcessor('worklet', Main);
