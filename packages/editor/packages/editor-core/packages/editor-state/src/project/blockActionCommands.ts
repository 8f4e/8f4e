import type { EventDispatcher, ProjectTransactions, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { insertCodeBlock } from './insertCodeBlock';

export default function registerBlockActionCommands(
	store: StateManager<State> & { projectTransactions: ProjectTransactions },
	events: EventDispatcher
): () => void {
	function onInsertCodeBlock({ x, y, code }: { x: number; y: number; code: string[] }): void {
		insertCodeBlock(store, { x, y, code });
	}

	events.on('insertCodeBlock', onInsertCodeBlock);
	return () => {
		events.off('insertCodeBlock', onInsertCodeBlock);
	};
}
