import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import deriveEntryBounds from './deriveEntryBounds';

export default function entryBounds(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	const updateBounds = () => {
		store.set(
			'codeBlockRendering.entryBounds',
			deriveEntryBounds(
				state.codeBlockRendering.currentProject.blocks,
				state.viewport.vGrid * 8,
				state.viewport.hGrid * 4
			)
		);
	};
	const selectors = ['codeBlockRendering.currentProject.blocks', 'projectChange'] as const;
	const geometryEvents = ['codeBlockLayoutsChanged', 'gridSizeChanged', 'viewportChanged', 'viewportResized'];
	for (const selector of selectors) store.subscribe(selector, updateBounds);
	for (const event of geometryEvents) events.on(event, updateBounds);
	updateBounds();
	return () => {
		for (const selector of selectors) store.unsubscribe(selector, updateBounds);
		for (const event of geometryEvents) events.off(event, updateBounds);
	};
}
