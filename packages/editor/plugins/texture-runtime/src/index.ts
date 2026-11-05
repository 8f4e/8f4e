import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/language-spec';
import { createTextureBindings } from './bindings';
import { readTextureRuntimeConfig, TEXTURE_RUNTIME_CONFIG } from './config';
import { createTextureLayout } from './layout';
import { createTextureRenderLayer } from './render-layer';

/** Executes one project entry per editor frame and displays block-bound framebuffer views. */
export function createTextureRuntimePlugin({
	getCodeBuffer,
	getMemory,
}: {
	getCodeBuffer: () => Uint8Array;
	getMemory: () => WebAssembly.Memory | null;
}): EditorPlugin {
	return {
		id: 'texture-runtime',
		setup: ({ store, events, drawers, layout, loading }) => {
			const state = store.getState();
			let config = readTextureRuntimeConfig(state.editorConfig);
			let program: WebAssembly.Exports | undefined;
			let entry: CallableFunction | undefined;
			let generation = 0;
			let pending = false;
			let programLoading: LoadingIndicatorHandle | undefined;

			function clearProgram() {
				programLoading?.cancel();
				programLoading = undefined;
				generation++;
				program = undefined;
				pending = false;
				entry = undefined;
			}

			function prepareEntry() {
				const nextEntry = program?.[config.entry];
				entry = typeof nextEntry === 'function' ? nextEntry : undefined;
			}

			async function syncProgram() {
				clearProgram();
				const version = generation;
				if (!config.enabled) return;
				const nextMemory = getMemory();
				const code = getCodeBuffer();
				if (!nextMemory || code.byteLength === 0) return;
				pending = true;
				const indicator = loading.add({ id: 'texture-runtime', message: 'Starting texture runtime...' });
				programLoading = indicator;
				try {
					const { instance } = await WebAssembly.instantiate(new Uint8Array(code), {
						host: { memory: nextMemory, ...IGNORED_ASSERTION_IMPORTS },
					});
					if (version !== generation) return;
					program = instance.exports;
					pending = false;
					prepareEntry();
					indicator.done();
				} catch (error) {
					indicator.fail();
					if (version === generation) {
						pending = false;
						console.error('Failed to instantiate texture runtime:', error);
					}
				} finally {
					indicator.cancel();
					if (programLoading === indicator) programLoading = undefined;
				}
			}

			function syncConfig() {
				config = readTextureRuntimeConfig(state.editorConfig);
				if (!config.enabled) clearProgram();
				else {
					prepareEntry();
					if (!program && !pending) void syncProgram();
				}
			}

			store.set('editorConfigSchemaContributions.textureRuntime', TEXTURE_RUNTIME_CONFIG);
			const bindings = createTextureBindings(store);
			const textures = createTextureLayout(layout);
			const unregisterLayer = drawers.registerRenderLayer(({ gl }) => {
				const renderLayer = createTextureRenderLayer({ gl, state, bindings, textures });
				return {
					...renderLayer,
					draw: frame => {
						entry?.();
						renderLayer.draw(frame);
					},
				};
			});
			store.subscribe('editorConfig.textureRuntime', syncConfig);
			events.on('compilationSucceeded', syncProgram);
			syncConfig();
			return () => {
				store.unsubscribe('editorConfig.textureRuntime', syncConfig);
				events.off('compilationSucceeded', syncProgram);
				clearProgram();
				bindings.dispose();
				textures.dispose();
				unregisterLayer();
				const schemas = { ...state.editorConfigSchemaContributions };
				delete schemas.textureRuntime;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
