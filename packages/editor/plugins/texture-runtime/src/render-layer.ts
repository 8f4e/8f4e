import type { ResolvedPalette } from '@8f4e/editor-palette';
import { logError } from '@8f4e/editor-state';
import type { State } from '@8f4e/editor-state-types';
import type { EditorRenderLayer } from '@8f4e/web-ui';
import type { createTextureBindings } from './bindings';
import type { createTextureLayout } from './layout';
import { TextureDrawer } from './texture-drawer';

interface TextureRenderLayerOptions {
	gl: WebGL2RenderingContext;
	palette: ResolvedPalette;
	state: State;
	bindings: ReturnType<typeof createTextureBindings>;
	textures: ReturnType<typeof createTextureLayout>;
}

/** Own GPU resources, visible uploads, and conflict reporting for the texture pass. */
export function createTextureRenderLayer({
	gl,
	palette,
	state,
	bindings,
	textures,
}: TextureRenderLayerOptions): EditorRenderLayer {
	let drawer: TextureDrawer | undefined;
	const visibleAddresses = new Set<number>();
	let previousConflicts = new Set<number>();
	return {
		draw: ({ memoryViews }) => {
			const { sources, conflicts } = bindings.resolveUploads(memoryViews.int32);
			for (const address of conflicts)
				if (!previousConflicts.has(address))
					logError(state, `Conflicting @textureUpload definitions at byte address ${address}`);
			previousConflicts = conflicts;
			visibleAddresses.clear();
			for (const block of state.codeBlockRendering.currentProject.blocks) {
				for (const texture of textures.viewsByBlock.get(block) ?? []) {
					const x = block.x - state.viewport.x + texture.x;
					const y = block.y - state.viewport.y + texture.y;
					const width = texture.crop.width * texture.magnification.x;
					const height = texture.crop.height * texture.magnification.y;
					if (x + width <= 0 || y + height <= 0 || x >= state.viewport.width || y >= state.viewport.height) continue;
					const address = bindings.resolveViewAddress(block, texture.address, memoryViews.int32);
					const source = address === undefined ? undefined : sources.get(address);
					if (!source || address === undefined || address + source.byteLength > memoryViews.uint8.length) continue;
					const crop = texture.crop;
					if (crop.x + crop.width > source.width || crop.y + crop.height > source.height) continue;
					drawer ??= new TextureDrawer(gl);
					if (!visibleAddresses.has(address))
						drawer.upload(
							address,
							memoryViews.uint8.subarray(address, address + source.byteLength),
							source.width,
							source.height,
							source.format
						);
					visibleAddresses.add(address);
					drawer.drawTexture(address, x, y, width, height, crop, palette);
				}
			}
			drawer?.retainTextures(visibleAddresses);
		},
		loadPalette: nextPalette => {
			palette = nextPalette;
		},
		releaseMemory: () => drawer?.releaseMemory(),
		destroy: () => drawer?.destroy(),
	};
}
