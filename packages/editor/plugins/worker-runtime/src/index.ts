import type { EditorPlugin } from '@8f4e/editor-core';
import { getWebWorkerRuntimeConfig, startWorkerRuntime, WEB_WORKER_EDITOR_CONFIG } from './runtime';

export function createWorkerRuntimePlugin({
	getCodeBuffer,
	getMemory,
}: {
	getCodeBuffer: () => Uint8Array;
	getMemory: () => WebAssembly.Memory | null;
}): EditorPlugin {
	return {
		id: 'worker-runtime',
		setup: ({ store, events }) => {
			const state = store.getState();
			let stop: (() => void) | undefined;
			function sync() {
				const config = getWebWorkerRuntimeConfig(state.editorConfig);
				const lines = config.enabled ? [`const ${config.sampleRateConstantName} ${config.sampleRate}`] : [];
				const previous = state.envConstantContributions.workerRuntime ?? [];
				if (lines.length !== previous.length || lines.some((line, index) => line !== previous[index]))
					store.set('envConstantContributions.workerRuntime', lines);
				if (!config.enabled) {
					stop?.();
					stop = undefined;
					store.set('info.workerRuntime', undefined);
					return;
				}
				if (!stop && !state.compiler.isCompiling && getMemory())
					stop = startWorkerRuntime(store, events, getCodeBuffer, getMemory);
			}
			store.subscribe('editorConfig.workerRuntime', sync);
			store.subscribe('compiler.isCompiling', sync);
			store.set('editorConfigSchemaContributions.workerRuntime', WEB_WORKER_EDITOR_CONFIG);
			sync();
			return () => {
				store.unsubscribe('editorConfig.workerRuntime', sync);
				store.unsubscribe('compiler.isCompiling', sync);
				stop?.();
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
