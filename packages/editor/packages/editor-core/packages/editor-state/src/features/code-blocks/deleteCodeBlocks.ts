import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../project-changes';
import replaceCodeBlocksInPlace from './replaceCodeBlocksInPlace';

/** Remove blocks from the rendered project slice and clear their selections before announcing one edit. */
export function deleteCodeBlocks(
	store: Pick<StateManager<State>, 'getState' | 'set'>,
	blocks: readonly CodeBlockGraphicData[]
): boolean {
	const rendering = store.getState().codeBlockRendering;
	const removed = new Set(blocks);
	const remaining = rendering.codeBlocks.filter(block => !removed.has(block));
	if (remaining.length === rendering.codeBlocks.length) return false;
	if (rendering.selectedCodeBlock && removed.has(rendering.selectedCodeBlock)) {
		store.set('codeBlockRendering.selectedCodeBlock', undefined);
	}
	if (rendering.draggedCodeBlock && removed.has(rendering.draggedCodeBlock)) rendering.draggedCodeBlock = undefined;
	if (rendering.selectedCodeBlockForProgrammaticEdit && removed.has(rendering.selectedCodeBlockForProgrammaticEdit)) {
		rendering.selectedCodeBlockForProgrammaticEdit = undefined;
	}
	replaceCodeBlocksInPlace(rendering.codeBlocks, remaining);
	store.set('codeBlockRendering.codeBlocks', rendering.codeBlocks);
	incrementCompilerInputRevision(store);
	publishProjectChange(store);
	return true;
}
