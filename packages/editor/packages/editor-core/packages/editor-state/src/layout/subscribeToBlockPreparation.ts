import type { CodeBlockLayoutContext, EditorLayoutRegistry, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Prepare block data when layout or an explicitly selected state value changes.
 * Data changes refresh the current view without automatically invalidating its geometry.
 * The reason lets plugins submit source-owned layout requests only during layout preparation.
 */
export function subscribeToBlockPreparation(
	store: Pick<StateManager<State>, 'getState' | 'subscribe' | 'unsubscribe'>,
	layout: EditorLayoutRegistry,
	selector: string,
	prepare: (context: CodeBlockLayoutContext, reason: 'layout' | 'data') => void
): () => void {
	const refresh = () => {
		const state = store.getState();
		if (state.viewport.vGrid <= 0 || state.viewport.hGrid <= 0) return;
		for (const codeBlock of state.project.activeLevel.blocks) prepare({ codeBlock, state }, 'data');
	};
	const unsubscribeLayout = layout.subscribe(context => prepare(context, 'layout'));
	store.subscribe(selector, refresh);
	return () => {
		store.unsubscribe(selector, refresh);
		unsubscribeLayout();
	};
}
