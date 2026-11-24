import { logError, markGridSizePending, setGridSize } from '@8f4e/editor-state';
import type {
	EditorLoadingRegistry,
	EventDispatcher,
	GridSize,
	LoadingIndicatorHandle,
	State,
} from '@8f4e/editor-state-types';
import loadFontAtlas, { type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { DrawContext } from '../sprites/drawContext';
import type { SpriteEngine } from '../webgl/spriteEngine';
import { getAppearanceFont } from './config';

/** Payload of `fontChanged`, emitted after a different font atlas and its grid are installed. */
export interface FontChangedEvent {
	font: Font;
}

/** Load the selected font, retaining its identity even if configuration changes meanwhile. */
export async function loadInitialFontAtlas(state: State, defaultFont?: Font) {
	const font = getAppearanceFont(state, defaultFont);
	return { font, atlas: await loadFontAtlas(font) };
}

/** Install the initial atlas, then manage replacements and the grid of the atlas currently in use. */
export function createFontAtlasController(
	store: StateManager<State>,
	events: EventDispatcher,
	loading: EditorLoadingRegistry,
	engine: Pick<SpriteEngine, 'setSpriteAtlas' | 'drawSprite'>,
	initial: Awaited<ReturnType<typeof loadInitialFontAtlas>>,
	defaultFont?: Font
) {
	const state = store.getState();
	const draw = new DrawContext(engine, initial.atlas.grid.cellWidth);
	let disposed = false;
	let generation = 0;
	let fontLoading: { font: Font; indicator: LoadingIndicatorHandle } | undefined;
	let installedFont: Font;
	let installedGrid: GridSize;
	const install = (font: Font, atlas: FontAtlas): void => {
		engine.setSpriteAtlas(atlas.image, atlas.grid);
		draw.setCharacterWidth(atlas.grid.cellWidth);
		installedFont = font;
		installedGrid = { hGrid: atlas.grid.cellHeight, vGrid: atlas.grid.cellWidth };
		setGridSize(state, events, installedGrid);
	};
	install(initial.font, initial.atlas);

	const updateFont = async () => {
		const font = getAppearanceFont(state, defaultFont);
		if (fontLoading?.font === font) return;
		const currentGeneration = ++generation;
		fontLoading?.indicator.cancel();
		fontLoading = undefined;
		if (font === installedFont) {
			if (!state.gridSizeReady) {
				// Configuration can resolve during a source refresh. Let that refresh settle layout first.
				await Promise.resolve();
				if (!disposed && currentGeneration === generation) setGridSize(state, events, installedGrid);
			}
			return;
		}
		markGridSizePending(state);
		const indicator = loading.add({ id: 'font', message: `Loading font ${font}...` });
		fontLoading = { font, indicator };
		try {
			const atlas = await loadFontAtlas(font);
			if (disposed || currentGeneration !== generation) return;
			install(font, atlas);
			events.dispatch('fontChanged', { font } satisfies FontChangedEvent);
			indicator.done();
		} catch (error) {
			if (disposed || currentGeneration !== generation) return;
			logError(state, `Failed to load font ${font}: ${String(error)}`);
			indicator.fail();
			if (!disposed && currentGeneration === generation) setGridSize(state, events, installedGrid);
		} finally {
			indicator.cancel();
			if (fontLoading?.indicator === indicator) fontLoading = undefined;
		}
	};
	return {
		draw,
		subscribe() {
			store.subscribe('editorConfig.font', updateFont);
			store.subscribe('appearance.fontOverride', updateFont);
			return () => {
				disposed = true;
				fontLoading?.indicator.cancel();
				fontLoading = undefined;
				store.unsubscribe('editorConfig.font', updateFont);
				store.unsubscribe('appearance.fontOverride', updateFont);
			};
		},
	};
}
