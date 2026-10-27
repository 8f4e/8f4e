// Import the types from the editor
// Note: Worker import is done at runtime by the host, not here

import type {
	EditorConfig,
	EditorConfigSchemaContribution,
	EventDispatcher,
	RuntimeRegistryEntry,
	State,
} from '@8f4e/editor-core';
import { resolveSchemaConfigRoot } from '@8f4e/editor-core';
import type { StateManager } from '@8f4e/state-manager';
import type { WebWorkerHostMessage, WebWorkerRuntimeMessage } from './messages';

const WEB_WORKER_EDITOR_CONFIG: EditorConfigSchemaContribution = {
	root: 'workerRuntime',
	defaults: {
		entry: 'main',
		sampleRate: 50,
	},
	schema: {
		type: 'object',
		properties: {
			entry: { type: 'string' },
			sampleRate: { type: 'number', minimum: 1 },
		},
		additionalProperties: false,
	},
};

interface WebWorkerRuntimeConfig {
	entry: string;
	sampleRate: number;
}

function getWebWorkerRuntimeConfig(editorConfig: EditorConfig): WebWorkerRuntimeConfig {
	const config = resolveSchemaConfigRoot(WEB_WORKER_EDITOR_CONFIG, editorConfig);

	return {
		entry: typeof config.entry === 'string' && config.entry ? config.entry : 'main',
		sampleRate: typeof config.sampleRate === 'number' ? config.sampleRate : 50,
	};
}

// WebWorker Runtime Factory
export function webWorkerRuntimeFactory(
	store: StateManager<State>,
	events: EventDispatcher,
	getCodeBuffer: () => Uint8Array,
	getMemory: () => WebAssembly.Memory | null,
	WorkerConstructor: new () => Worker
) {
	const state = store.getState();
	let worker: Worker | undefined;

	async function onWorkerMessage({ data }: MessageEvent<WebWorkerRuntimeMessage>) {
		switch (data.type) {
			case 'initialized':
				events.dispatch('runtimeInitialized');
				break;
			case 'stats':
				{
					const runtimeInfo = state.info.runtime ?? (state.info.runtime = {});
					runtimeInfo.timerPrecisionPercentage = data.payload.timerPrecisionPercentage;
					runtimeInfo.timeToExecuteLoopMs = data.payload.timeToExecuteLoopMs;
					runtimeInfo.timerDriftMs = data.payload.timerDriftMs;
					runtimeInfo.timerExpectedIntervalTimeMs = data.payload.timerExpectedIntervalTimeMs;
				}
				break;
		}
	}

	function syncCodeAndSettingsWithRuntime() {
		if (!worker) {
			return;
		}
		const memory = getMemory();
		if (!memory) {
			console.warn('[Runtime] Memory not yet created, skipping runtime init');
			return;
		}
		const config = getWebWorkerRuntimeConfig(state.editorConfig);
		const message: WebWorkerHostMessage = {
			type: 'init',
			payload: {
				memoryRef: memory,
				entry: config.entry,
				sampleRate: config.sampleRate,
				codeBuffer: getCodeBuffer(),
			},
		};
		worker.postMessage(message);
	}

	worker = new WorkerConstructor();

	worker.addEventListener('message', onWorkerMessage);
	syncCodeAndSettingsWithRuntime();

	store.subscribeToValue('compiler.isCompiling', false, syncCodeAndSettingsWithRuntime);
	store.subscribe('editorConfig.workerRuntime', syncCodeAndSettingsWithRuntime);

	return () => {
		store.unsubscribe('compiler.isCompiling', syncCodeAndSettingsWithRuntime);
		store.unsubscribe('editorConfig.workerRuntime', syncCodeAndSettingsWithRuntime);
		if (worker) {
			worker.removeEventListener('message', onWorkerMessage);
			worker.terminate();
			worker = undefined;
		}
	};
}

/**
 * Create a runtime definition with injected callbacks.
 * This allows the host to provide getCodeBuffer and getMemory implementations.
 */
export function createWebWorkerRuntimeDef(
	getCodeBuffer: () => Uint8Array,
	getMemory: () => WebAssembly.Memory | null,
	WorkerConstructor: new () => Worker
): RuntimeRegistryEntry {
	return {
		id: 'WebWorkerRuntime',
		editorConfigSchema: WEB_WORKER_EDITOR_CONFIG,
		getEnvConstants: editorConfig => [`const SAMPLE_RATE ${getWebWorkerRuntimeConfig(editorConfig).sampleRate}`],
		factory: (store: StateManager<State>, events: EventDispatcher) => {
			return webWorkerRuntimeFactory(store, events, getCodeBuffer, getMemory, WorkerConstructor);
		},
	};
}
