import type { EditorPlugin } from '@8f4e/editor-core';
import { toPaletteBytes } from '@8f4e/editor-palette';
import BackgroundRenderer from './backgroundRenderer';

/** Draws a world-anchored dotted backdrop behind all sprites. */
export const dottedBackgroundPlugin: EditorPlugin = {
	id: 'dotted-background',
	setup: ({ drawers }) =>
		drawers.registerRenderLayer('beforeSprites', ({ gl, palette }) => {
			const background = new BackgroundRenderer(gl);
			background.setPalette(toPaletteBytes(palette));
			return {
				draw: ({ viewport }) => background.draw(viewport),
				loadPalette: nextPalette => background.setPalette(toPaletteBytes(nextPalette)),
				destroy: () => background.destroy(),
			};
		}),
};
