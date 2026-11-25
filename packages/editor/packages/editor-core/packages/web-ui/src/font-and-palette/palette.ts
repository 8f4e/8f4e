import { toPaletteBytes } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import type { AttachedRenderLayers } from '../webgl/renderLayerRegistry';
import type { SpriteEngine } from '../webgl/spriteEngine';
import { getConfiguredPalette } from './config';

/** Install the palette immediately and keep sprite and layer palettes synchronized with configuration. */
export function createPaletteController(store: StateManager<State>, engine: Pick<SpriteEngine, 'setPalette'>) {
	const state = store.getState();
	const initial = getConfiguredPalette(state.editorConfig);
	engine.setPalette(toPaletteBytes(initial));
	return {
		initial,
		subscribe(renderLayers: AttachedRenderLayers) {
			const updatePalette = () => {
				const palette = getConfiguredPalette(state.editorConfig);
				engine.setPalette(toPaletteBytes(palette));
				renderLayers.loadPalette(palette);
			};
			store.subscribe('editorConfig.color', updatePalette);
			return () => store.unsubscribe('editorConfig.color', updatePalette);
		},
	};
}
