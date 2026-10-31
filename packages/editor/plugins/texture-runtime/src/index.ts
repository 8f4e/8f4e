import type { EditorPlugin } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';
import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/test-runner';
import { readTextureRuntimeConfig, TEXTURE_RUNTIME_CONFIG } from './config';
import { createTextureLayout, resolveTextureAddress } from './layout';
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
			const textures = createTextureLayout({ store, layout, getMemory });
			const unregisterLayer = drawers.registerRenderLayer(({ gl }) => {
				let drawer: TextureDrawer | undefined;
				const visibleKeys = new Set<string>();
				let previousConflicts = new Set<number>();
				return {
					draw: ({ memoryViews }) => {
						entry?.();
						const { sources, conflicts } = textures.resolveUploads(memoryViews.int32);
						for (const address of conflicts)
							if (!previousConflicts.has(address))
								logError(state, `Conflicting @textureUpload definitions at byte address ${address}`);
						previousConflicts = conflicts;
						textures.updateSizes(sources, memoryViews.int32);
						visibleKeys.clear();
						for (const block of state.codeBlockRendering.codeBlocks) {
							for (const texture of textures.viewsByBlock.get(block) ?? []) {
								if (!texture.visible || !texture.width || !texture.height) continue;
								const x = block.x - state.viewport.x + texture.x;
								const y = block.y - state.viewport.y + texture.y;
								const width = texture.width * texture.magnification;
								const height = texture.height * texture.magnification;
								if (x + width <= 0 || y + height <= 0 || x >= state.viewport.width || y >= state.viewport.height)
									continue;
								const address = resolveTextureAddress(texture.binding, memoryViews.int32);
								const source = address === undefined ? undefined : sources.get(address);
								if (!source || address === undefined || address + source.byteLength > memoryViews.uint8.length)
									continue;
								const crop = texture.crop;
								if (crop && (crop.x + crop.width > source.width || crop.y + crop.height > source.height)) continue;
								const key = String(address);
								drawer ??= new TextureDrawer(gl);
								if (!visibleKeys.has(key))
									drawer.upload(
										key,
										memoryViews.uint8.subarray(address, address + source.byteLength),
										source.width,
										source.height,
										source.format
									);
								visibleKeys.add(key);
								drawer.drawTexture(key, x, y, width, height, crop);
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
				textures.dispose();
				unregisterLayer();
				const schemas = { ...state.editorConfigSchemaContributions };
				delete schemas.textureRuntime;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
