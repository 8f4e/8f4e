import type { EditorCodeBlock, ProjectTransactions, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Remove blocks from the rendered project slice and clear their selections before announcing one edit. */
export function deleteCodeBlocks(
	store: Pick<StateManager<State>, 'getState'> & { projectTransactions: ProjectTransactions },
	blocks: readonly EditorCodeBlock[]
): boolean {
	const currentBlocks = store.getState().project.activeLevel.blocks;
	return store.projectTransactions.apply({ deletes: blocks.filter(block => currentBlocks.includes(block)) }).changed;
}
