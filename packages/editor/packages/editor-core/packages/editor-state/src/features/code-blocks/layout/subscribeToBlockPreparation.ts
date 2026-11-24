import type { CodeBlockLayoutContext, EditorLayoutRegistry, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Prepare block data when layout or an explicitly selected state value changes.
 * Data changes refresh the current view without invalidating its geometry.
 */
export function subscribeToBlockPreparation(
	store: Pick<StateManager<State>, 'getState' | 'subscribe' | 'unsubscribe'>,
	layout: EditorLayoutRegistry,
	selector: string,
	prepare: (context: CodeBlockLayoutContext) => void
): () => void {
	const refresh = () => {
		const state = store.getState();
		if (state.viewport.vGrid <= 0 || state.viewport.hGrid <= 0) return;
		for (const codeBlock of state.codeBlockRendering.currentProject.blocks) prepare({ codeBlock, state });
	};
	const unsubscribeLayout = layout.subscribe(prepare);
	store.subscribe(selector, refresh);
	return () => {
		store.unsubscribe(selector, refresh);
		unsubscribeLayout();
	};
}
