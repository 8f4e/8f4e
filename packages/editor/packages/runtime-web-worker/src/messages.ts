// Message protocol shared by the editor runtime plugin and the worker (index.ts).

/** Messages posted by the host to the worker. */
export type WebWorkerHostMessage = {
	type: 'init';
	payload: {
		memoryRef: WebAssembly.Memory;
		entry: string;
		sampleRate: number;
		codeBuffer: Uint8Array;
	};
};

export interface WebWorkerStats {
	timerPrecisionPercentage: number;
	timeToExecuteLoopMs: number;
	timerDriftMs: number;
	timerExpectedIntervalTimeMs: number;
}

/** Messages posted by the worker to the host. */
export type WebWorkerRuntimeMessage =
	| { type: 'initialized'; payload: Record<string, never> }
	| { type: 'stats'; payload: WebWorkerStats }
	| { type: 'compilationError'; payload: unknown };
