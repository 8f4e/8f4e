import type { ResolvedPalette } from '@8f4e/editor-palette';
import { logError, markGridSizePending, setGridSize } from '@8f4e/editor-state';
import type { EditorLoadingRegistry, EventDispatcher, LoadingIndicatorHandle, State } from '@8f4e/editor-state-types';
import loadFontAtlas, { type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { getAppearanceFont, getConfiguredPalette } from './config';
import type { FontChangedEvent } from './types';

export function updateGridSize(state: State, events: EventDispatcher, atlas: FontAtlas): void {
	const { cellHeight, cellWidth } = atlas.grid;
	setGridSize(state, events, { hGrid: cellHeight, vGrid: cellWidth });
}

export function subscribeToAppearance(
	store: StateManager<State>,
	events: EventDispatcher,
	loading: EditorLoadingRegistry,
	applyFont: (atlas: FontAtlas, font: Font) => void,
	applyPalette: (palette: ResolvedPalette) => void,
	defaultFont?: Font
): () => void {
	const state = store.getState();
	let disposed = false;
	let generation = 0;
	let fontLoading: { font: Font; indicator: LoadingIndicatorHandle } | undefined;
	let appliedFont = getAppearanceFont(state, defaultFont);
	const restoreAppliedGrid = () => {
		const { hGrid, vGrid } = state.viewport;
		setGridSize(state, events, { hGrid, vGrid });
	};
	const updateFont = async () => {
		const font = getAppearanceFont(state, defaultFont);
		if (fontLoading?.font === font) return;
		const currentGeneration = ++generation;
		fontLoading?.indicator.cancel();
		fontLoading = undefined;
		if (font === appliedFont) {
			if (!state.gridSizeReady) {
				// Configuration can resolve during a source refresh. Let that refresh settle layout first.
				await Promise.resolve();
				if (!disposed && currentGeneration === generation) restoreAppliedGrid();
			}
			return;
		}
		markGridSizePending(state);
		const indicator = loading.add({ id: 'font', message: `Loading font ${font}...` });
		fontLoading = { font, indicator };
		try {
			const atlas = await loadFontAtlas(font);
			if (disposed || currentGeneration !== generation) return;
			applyFont(atlas, font);
			appliedFont = font;
			updateGridSize(state, events, atlas);
			events.dispatch('fontChanged', { font } satisfies FontChangedEvent);
			indicator.done();
		} catch (error) {
			if (disposed || currentGeneration !== generation) return;
			logError(state, `Failed to load font ${font}: ${String(error)}`);
			indicator.fail();
			if (!disposed && currentGeneration === generation) restoreAppliedGrid();
		} finally {
			indicator.cancel();
			if (fontLoading?.indicator === indicator) fontLoading = undefined;
		}
	};
	const updatePalette = () => applyPalette(getConfiguredPalette(state.editorConfig));
	store.subscribe('editorConfig.font', updateFont);
	store.subscribe('appearance.fontOverride', updateFont);
	store.subscribe('editorConfig.color', updatePalette);

	return () => {
		disposed = true;
		fontLoading?.indicator.cancel();
		fontLoading = undefined;
		store.unsubscribe('editorConfig.font', updateFont);
		store.unsubscribe('appearance.fontOverride', updateFont);
		store.unsubscribe('editorConfig.color', updatePalette);
	};
}
