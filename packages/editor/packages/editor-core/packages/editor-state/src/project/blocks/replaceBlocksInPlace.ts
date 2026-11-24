import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

/** Replaces a project slice without changing the array identity referenced by its owner. */
export default function replaceCodeBlocksInPlace(
	codeBlocks: CodeBlockGraphicData[],
	replacement: readonly CodeBlockGraphicData[]
): void {
	codeBlocks.splice(0, codeBlocks.length, ...replacement);
}
