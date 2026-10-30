import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/test-runner';
import { readTextureRuntimeConfig, TEXTURE_RUNTIME_CONFIG } from './config';
import { type BlockTexture, registerTextureLayout } from './layout';
import { TextureDrawer } from './texture-drawer';

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
		setup: ({ store, events, drawers, layout }) => {
			const state = store.getState();
			let config = readTextureRuntimeConfig(state.editorConfig);
			let program: WebAssembly.Exports | undefined;
			let entry: CallableFunction | undefined;
			let generation = 0;
			let pending = false;
			const texturesByBlock = new WeakMap<CodeBlockGraphicData, BlockTexture[]>();

			function clearProgram() {
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
				try {
					const { instance } = await WebAssembly.instantiate(new Uint8Array(code), {
						host: { memory: nextMemory, ...IGNORED_ASSERTION_IMPORTS },
					});
					if (version !== generation) return;
					program = instance.exports;
					pending = false;
					prepareEntry();
				} catch (error) {
					if (version === generation) {
						pending = false;
						console.error('Failed to instantiate texture runtime:', error);
					}
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
			const unregisterLayout = registerTextureLayout(layout, texturesByBlock);
			const unregisterLayer = drawers.registerRenderLayer(({ gl }) => {
				let drawer: TextureDrawer | undefined;
				const visibleKeys = new Set<string>();
				return {
					draw: ({ memoryViews }) => {
						entry?.();
						visibleKeys.clear();
						for (const block of state.codeBlockRendering.codeBlocks) {
							for (const texture of texturesByBlock.get(block) ?? []) {
								const x = block.x - state.viewport.x + texture.x;
								const y = block.y - state.viewport.y + texture.y;
								const width = texture.width * texture.magnification;
								const height = texture.height * texture.magnification;
								if (x + width <= 0 || y + height <= 0 || x >= state.viewport.width || y >= state.viewport.height)
									continue;
								const { byteAddress, byteLength } = texture;
								if (byteAddress === undefined || byteAddress + byteLength > memoryViews.uint8.length) continue;
								drawer ??= new TextureDrawer(gl);
								visibleKeys.add(texture.key);
								drawer.upload(
									texture.key,
									memoryViews.uint8.subarray(byteAddress, byteAddress + byteLength),
									texture.width,
									texture.height,
									texture.format
								);
								drawer.drawTexture(texture.key, x, y, width, height);
							}
						}
						drawer?.retainTextures(visibleKeys);
					},
					releaseMemory: () => drawer?.releaseMemory(),
					destroy: () => drawer?.destroy(),
				};
			});
			store.subscribe('editorConfig.textureRuntime', syncConfig);
			events.on('compilationSucceeded', syncProgram);
			syncConfig();
			return () => {
				store.unsubscribe('editorConfig.textureRuntime', syncConfig);
				events.off('compilationSucceeded', syncProgram);
				clearProgram();
				unregisterLayout();
				unregisterLayer();
				const schemas = { ...state.editorConfigSchemaContributions };
				delete schemas.textureRuntime;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
