import type { CodeBlockLayoutsChangedEvent, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import deriveEntryBounds from './deriveEntryBounds';

export default function trackEntryBounds(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	const updateBounds = () => {
		if (state.viewport.vGrid <= 0 || state.viewport.hGrid <= 0) return;
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
	const onLayoutsChanged = ({ project }: CodeBlockLayoutsChangedEvent) => {
		if (project === state.codeBlockRendering.currentProject) updateBounds();
	};
	events.on('codeBlockLayoutsChanged', onLayoutsChanged);
	for (const selector of selectors) store.subscribe(selector, updateBounds);
	events.on('gridSizeChanged', updateBounds);
	updateBounds();
	return () => {
		events.off('codeBlockLayoutsChanged', onLayoutsChanged);
		for (const selector of selectors) store.unsubscribe(selector, updateBounds);
		events.off('gridSizeChanged', updateBounds);
	};
}
