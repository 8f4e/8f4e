import { type ResolvedPalette, resolvePalette } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import generateSprite from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import type { SpriteData } from '@8f4e/web-ui';
import type { EventDispatcher } from './events';

type SpriteSheetView = {
	loadSpriteAtlas: (spriteData: SpriteData) => void;
	loadPalette: (palette: ResolvedPalette) => void;
};

/**
 * Keeps generated sprite-sheet data in sync with editor state changes.
 */
export function createSpriteSheetManager(
	store: StateManager<State>,
	view: SpriteSheetView,
	events: EventDispatcher
): () => void {
	const state = store.getState();
	let disposed = false;
	let generation = 0;
	const rerenderSpriteSheet = async () => {
		const currentGeneration = ++generation;
		const spriteData = await generateSprite({
			font: state.editorConfig.font,
			palette: state.editorConfig.color,
		});
		if (disposed || currentGeneration !== generation) {
			return;
		}

		spriteData.palette = resolvePalette(state.editorConfig.color);
		view.loadSpriteAtlas(spriteData);

		events.dispatch('spriteSheetRerendered');
	};

	store.subscribe('editorConfig.font', rerenderSpriteSheet);
	const updatePalette = () => {
		if (!disposed) view.loadPalette(resolvePalette(state.editorConfig.color));
	};
	store.subscribe('editorConfig.color', updatePalette);

	return () => {
		if (disposed) {
			return;
		}

		disposed = true;
		generation++;
		store.unsubscribe('editorConfig.font', rerenderSpriteSheet);
		store.unsubscribe('editorConfig.color', updatePalette);
	};
}
