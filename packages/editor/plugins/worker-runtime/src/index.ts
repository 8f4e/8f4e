import type {
	EditorConfig,
	EditorConfigSchemaContribution,
	EditorPlugin,
	LoadingIndicatorHandle,
} from '@8f4e/editor-core';
import { resolveSchemaConfigRoot } from '@8f4e/editor-core';
import type { WebWorkerHostMessage, WebWorkerRuntimeMessage } from '@8f4e/runtime-web-worker/messages';
import WorkerConstructor from '@8f4e/runtime-web-worker?worker';

const WEB_WORKER_EDITOR_CONFIG: EditorConfigSchemaContribution = {
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

function getWebWorkerRuntimeConfig(editorConfig: EditorConfig): WebWorkerRuntimeConfig {
	const config = resolveSchemaConfigRoot(WEB_WORKER_EDITOR_CONFIG, editorConfig);

	return config as unknown as WebWorkerRuntimeConfig;
}

export function createWorkerRuntimePlugin({
	getCodeBuffer,
	getMemory,
}: {
	getCodeBuffer: () => Uint8Array;
	getMemory: () => WebAssembly.Memory | null;
}): EditorPlugin {
	return {
		id: 'worker-runtime',
		setup: ({ store, events, loading }) => {
			const state = store.getState();
			let worker: Worker | undefined;
			let initializationId = 0;
			let startupLoading: LoadingIndicatorHandle | undefined;
			function finishStartup(status: 'done' | 'failed' | 'cancelled') {
				if (status === 'done') startupLoading?.done();
				else if (status === 'failed') startupLoading?.fail();
				else startupLoading?.cancel();
				startupLoading = undefined;
			}

			function onWorkerMessage({ data }: MessageEvent<WebWorkerRuntimeMessage>) {
				switch (data.type) {
					case 'initialized':
						if (data.requestId !== initializationId) return;
						finishStartup('done');
						events.dispatch('memoryValuesChanged');
						break;
					case 'stats':
						store.set('info.workerRuntime', { ...data.payload });
						break;
					case 'compilationError':
						if (data.requestId !== initializationId) return;
						finishStartup('failed');
						break;
				}
			}

			function stopWorker() {
				++initializationId;
				finishStartup('cancelled');
				if (worker) worker.onerror = null;
				worker?.removeEventListener('message', onWorkerMessage);
				worker?.terminate();
				worker = undefined;
			}

			function sync() {
				const config = getWebWorkerRuntimeConfig(state.editorConfig);
				const lines = config.enabled ? [`const ${config.sampleRateConstantName} ${config.sampleRate}`] : [];
				const previous = state.envConstantContributions.workerRuntime ?? [];
				if (lines.length !== previous.length || lines.some((line, index) => line !== previous[index]))
					store.set('envConstantContributions.workerRuntime', lines);
				if (!config.enabled) {
					stopWorker();
					store.set('info.workerRuntime', undefined);
					return;
				}
				if (state.compiler.isCompiling) return;
				const memory = getMemory();
				if (!memory) return;
				finishStartup('cancelled');
				startupLoading = loading.add({ id: 'worker-runtime', message: 'Starting worker runtime...' });
				try {
					if (!worker) {
						worker = new WorkerConstructor();
						worker.addEventListener('message', onWorkerMessage);
						worker.onerror = () => finishStartup('failed');
					}
					const message: WebWorkerHostMessage = {
						type: 'init',
						requestId: ++initializationId,
						payload: {
							memoryRef: memory,
							entry: config.entry,
							sampleRate: config.sampleRate,
							codeBuffer: getCodeBuffer(),
						},
					};
					worker.postMessage(message);
				} catch (error) {
					finishStartup('failed');
					throw error;
				}
			}
			store.set('editorConfigSchemaContributions.workerRuntime', WEB_WORKER_EDITOR_CONFIG);
			store.subscribe('editorConfig.workerRuntime', sync);
			store.subscribe('compiler.isCompiling', sync);
			sync();
			return () => {
				store.unsubscribe('editorConfig.workerRuntime', sync);
				store.unsubscribe('compiler.isCompiling', sync);
				stopWorker();
				store.set('info.workerRuntime', undefined);
				const constants = { ...state.envConstantContributions };
				delete constants.workerRuntime;
				store.set('envConstantContributions', constants);
				const schemas = { ...state.editorConfigSchemaContributions };
				delete schemas.workerRuntime;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
