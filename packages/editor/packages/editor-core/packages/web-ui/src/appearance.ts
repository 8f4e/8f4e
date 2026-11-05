import type { ResolvedPalette } from '@8f4e/editor-palette';
import type { EditorLoadingRegistry, EventDispatcher, State } from '@8f4e/editor-state-types';
import loadFontAtlas, { type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { getConfiguredFont, getConfiguredPalette } from './config';

export function updateGridSize(state: State, events: EventDispatcher, atlas: FontAtlas): void {
	const { cellHeight, cellWidth } = atlas.grid;
	if (state.viewport.hGrid === cellHeight && state.viewport.vGrid === cellWidth) return;
	state.viewport.hGrid = cellHeight;
	state.viewport.vGrid = cellWidth;
	events.dispatch('gridSizeChanged');
}

export function subscribeToAppearance(
	store: StateManager<State>,
	events: EventDispatcher,
	loading: EditorLoadingRegistry,
	applyFont: (atlas: FontAtlas, font: Font) => void,
	applyPalette: (palette: ResolvedPalette) => void
): () => void {
	const state = store.getState();
	let disposed = false;
	let generation = 0;
	let finishFontLoading: (() => void) | undefined;
	const updateFont = async () => {
		const currentGeneration = ++generation;
		finishFontLoading?.();
		const font = getConfiguredFont(state.editorConfig);
		const finishLoading = loading.add({ name: `font ${font}` });
		finishFontLoading = finishLoading;
		try {
			const atlas = await loadFontAtlas(font);
			if (disposed || currentGeneration !== generation) return;
			applyFont(atlas, font);
			updateGridSize(state, events, atlas);
		} finally {
			finishLoading();
			if (finishFontLoading === finishLoading) finishFontLoading = undefined;
		}
	};
	const updatePalette = () => applyPalette(getConfiguredPalette(state.editorConfig));
	store.subscribe('editorConfig.font', updateFont);
	store.subscribe('editorConfig.color', updatePalette);

	return () => {
		disposed = true;
		finishFontLoading?.();
		finishFontLoading = undefined;
		store.unsubscribe('editorConfig.font', updateFont);
		store.unsubscribe('editorConfig.color', updatePalette);
	};
}
