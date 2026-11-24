import type { CodeBlockGraphicData, ProjectEdits, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Remove blocks from the rendered project slice and clear their selections before announcing one edit. */
export function deleteCodeBlocks(
	store: Pick<StateManager<State>, 'getState'> & { projectEdits: ProjectEdits },
	blocks: readonly CodeBlockGraphicData[]
): boolean {
	const currentBlocks = store.getState().codeBlockRendering.currentProject.blocks;
	return store.projectEdits.apply({ deletes: blocks.filter(block => currentBlocks.includes(block)) }).changed;
}
