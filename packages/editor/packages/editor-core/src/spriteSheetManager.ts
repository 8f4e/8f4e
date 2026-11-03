import { type ResolvedPalette, resolvePalette } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import loadFontAtlas, { DEFAULT_FONT, type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import type { EventDispatcher } from './events';

type SpriteSheetView = {
	loadFontAtlas: (fontAtlas: FontAtlas, font: Font) => void;
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
		const font = state.editorConfig.font ?? DEFAULT_FONT;
		const fontAtlas = await loadFontAtlas(font);
		if (disposed || currentGeneration !== generation) {
			return;
		}

		state.viewport.hGrid = fontAtlas.grid.cellHeight;
		state.viewport.vGrid = fontAtlas.grid.cellWidth;
		view.loadFontAtlas(fontAtlas, font);

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
