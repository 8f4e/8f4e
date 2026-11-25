import type { EditorCodeBlock } from '@8f4e/editor-state-types';

/** Replaces a project slice without changing the array identity referenced by its owner. */
export default function replaceBlocksInPlace(
	codeBlocks: EditorCodeBlock[],
	replacement: readonly EditorCodeBlock[]
): void {
	codeBlocks.splice(0, codeBlocks.length, ...replacement);
}
