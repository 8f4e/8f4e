import type { EditorCodeBlock } from '@8f4e/editor-state-types';

/** Modules and structural project groups can own execution entries. */
export function supportsExecutionEntry(block: Pick<EditorCodeBlock, 'blockType'>): boolean {
	return block.blockType === 'module' || block.blockType === 'group';
}
