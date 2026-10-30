import type { EditorPlugin } from '@8f4e/editor-core';
import { resolveMemoryTarget } from '@8f4e/editor-state/memory';
import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/test-runner';
import { readTextureConfig, type TextureConfig, WASM_TEXTURE_CONFIG } from './config';
import { getTextureDrawRect } from './placement';
import { RgbaTextureDrawer } from './rgba-texture-drawer';

/** Runs a project entry and draws its RGBA framebuffer above earlier render layers. */
export function createWasmTexturePlugin({
	getCodeBuffer,
	getMemory,
}: {
	getCodeBuffer: () => Uint8Array;
	getMemory: () => WebAssembly.Memory | null;
}): EditorPlugin {
	return {
		id: 'wasm-texture',
		setup: ({ store, events, drawers }) => {
			const state = store.getState();
			let config: TextureConfig | undefined;
			let program: { memory: WebAssembly.Memory; exports: WebAssembly.Exports } | undefined;
			let entry: CallableFunction | undefined;
			let byteAddress: number | undefined;
			let byteLength = 0;
			let generation = 0;
			let pending = false;
			let unregisterLayer: (() => void) | undefined;

			function clearProgram() {
				generation++;
				program = undefined;
				pending = false;
				entry = undefined;
				byteAddress = undefined;
			}

			function prepareFrame() {
				entry = undefined;
				byteAddress = undefined;
				if (!config || !program) return;
				const target = resolveMemoryTarget(state, { kind: 'project', groupPath: '' }, config.target);
				const nextEntry = program.exports[config.entry];
				if (typeof nextEntry !== 'function' || !target) return;
				entry = nextEntry;
				byteAddress = target.memory.byteAddress;
			}

			async function syncProgram() {
				clearProgram();
				const version = generation;
				if (!config) return;
				const nextMemory = getMemory();
				const code = getCodeBuffer();
				if (!nextMemory || code.byteLength === 0) return;
				pending = true;
				try {
					const { instance } = await WebAssembly.instantiate(new Uint8Array(code), {
						host: { memory: nextMemory, ...IGNORED_ASSERTION_IMPORTS },
					});
					if (version !== generation) return;
					program = { memory: nextMemory, exports: instance.exports };
					pending = false;
					prepareFrame();
				} catch (error) {
					if (version === generation) {
						pending = false;
						console.error('Failed to instantiate WASM texture:', error);
					}
				}
			}

			function syncConfig() {
				config = readTextureConfig(state.editorConfig);
				byteLength = config ? config.width * config.height * 4 : 0;
				if (!config) {
					unregisterLayer?.();
					unregisterLayer = undefined;
					clearProgram();
				} else if (!unregisterLayer) {
					unregisterLayer = drawers.registerRenderLayer(({ gl }) => {
						const texture = new RgbaTextureDrawer(gl);
						return {
							draw: () => {
								if (!config || !entry || !program || byteAddress === undefined) return;
								entry();
								const { memory } = program;
								if (byteAddress + byteLength > memory.buffer.byteLength) return;
								texture.uploadRgba8Texture(
									new Uint8Array(memory.buffer, byteAddress, byteLength),
									config.width,
									config.height
								);
								const rect = getTextureDrawRect(
									config.width,
									config.height,
									gl.drawingBufferWidth,
									gl.drawingBufferHeight,
									config.magnification,
									config.position
								);
								texture.drawTexture(rect.x, rect.y, rect.width, rect.height);
							},
							releaseMemory: () => texture.releaseMemory(),
							destroy: () => texture.destroy(),
						};
					});
				}
				prepareFrame();
				if (config && !program && !pending) void syncProgram();
			}

			store.set('editorConfigSchemaContributions.wasmTexture', WASM_TEXTURE_CONFIG);
			store.subscribe('editorConfig.wasmTexture', syncConfig);
			events.on('compilationSucceeded', syncProgram);
			syncConfig();
			return () => {
				store.unsubscribe('editorConfig.wasmTexture', syncConfig);
				events.off('compilationSucceeded', syncProgram);
				clearProgram();
				unregisterLayer?.();
				const schemas = { ...state.editorConfigSchemaContributions };
				delete schemas.wasmTexture;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
