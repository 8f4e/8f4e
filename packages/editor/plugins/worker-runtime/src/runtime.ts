import type {
	EditorConfig,
	EditorConfigSchemaContribution,
	EditorPluginContext,
	EventDispatcher,
} from '@8f4e/editor-core';
import { resolveSchemaConfigRoot } from '@8f4e/editor-core';
import type { WebWorkerHostMessage, WebWorkerRuntimeMessage } from '@8f4e/runtime-web-worker/messages';

export const WEB_WORKER_EDITOR_CONFIG: EditorConfigSchemaContribution = {
	root: 'workerRuntime',
	defaults: {
		enabled: false,
		entry: 'main',
		sampleRate: 50,
		sampleRateConstantName: 'SAMPLE_RATE',
	},
	schema: {
		type: 'object',
		properties: {
			enabled: { type: 'boolean' },
			entry: { type: 'string' },
			sampleRateConstantName: { type: 'string' },
			sampleRate: { type: 'number', minimum: 1 },
		},
		additionalProperties: false,
	},
};

interface WebWorkerRuntimeConfig {
	enabled: boolean;
	sampleRateConstantName: string;
	entry: string;
	sampleRate: number;
}

export function getWebWorkerRuntimeConfig(editorConfig: EditorConfig): WebWorkerRuntimeConfig {
	const config = resolveSchemaConfigRoot(WEB_WORKER_EDITOR_CONFIG, editorConfig);

	return config as unknown as WebWorkerRuntimeConfig;
}

// WebWorker Runtime Factory
export function startWorkerRuntime(
	store: EditorPluginContext['store'],
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
				events.dispatch('memoryValuesChanged');
				break;
			case 'stats':
				store.set('info.workerRuntime', { ...data.payload });
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
