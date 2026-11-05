import createModule from './createModule';
import type { WebWorkerHostMessage, WebWorkerRuntimeMessage } from './messages';

let interval: ReturnType<typeof setInterval>;
let statsInterval: ReturnType<typeof setInterval>;
let timeToExecuteLoopMs: number;
let lastIntervalTime: number;
let timerDriftMs: number;
let initializationId = 0;

async function init(
	memoryRef: WebAssembly.Memory,
	sampleRate: number,
	codeBuffer: Uint8Array,
	entryName: string,
	requestId: number
) {
	initializationId = requestId;
	try {
		const wasmApp = await createModule(memoryRef, codeBuffer, entryName);
		if (requestId !== initializationId) return;

		const intervalTime = Math.floor(1000 / sampleRate);

		lastIntervalTime = performance.now();

		clearInterval(interval);

		interval = setInterval(() => {
			const startTime = performance.now();
			timerDriftMs = startTime - lastIntervalTime - intervalTime;
			lastIntervalTime = startTime;
			wasmApp.entry();
			const endTime = performance.now();
			timeToExecuteLoopMs = endTime - startTime;
		}, intervalTime);

		clearInterval(statsInterval);

		statsInterval = setInterval(() => {
			postToHost({
				type: 'stats',
				payload: {
					timerPrecisionPercentage: 100 - Math.abs(timerDriftMs / intervalTime) * 100,
					timeToExecuteLoopMs,
					timerDriftMs,
					timerExpectedIntervalTimeMs: intervalTime,
				},
			});
		}, 10000);

		postToHost({
			type: 'initialized',
			requestId,
			payload: {},
		});
	} catch (error) {
		if (requestId !== initializationId) return;
		console.log('compilationError', error);
		postToHost({
			type: 'compilationError',
			requestId,
			payload: error,
		});
	}
}

function postToHost(message: WebWorkerRuntimeMessage) {
	self.postMessage(message);
}

self.onmessage = ({ data }: MessageEvent<WebWorkerHostMessage>) => {
	switch (data.type) {
		case 'init':
			init(
				data.payload.memoryRef,
				data.payload.sampleRate,
				data.payload.codeBuffer,
				data.payload.entry,
				data.requestId
			);
			break;
	}
};
