import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import replaceCodeBlocksInPlace from './replaceCodeBlocksInPlace';

type AlwaysOnTopPartitionableBlock = Pick<CodeBlockGraphicData, 'alwaysOnTop'>;

/**
 * Stable-partitions code blocks into normal blocks first followed by always-on-top blocks.
 */
export function partitionCodeBlocksByAlwaysOnTop<TBlock extends AlwaysOnTopPartitionableBlock>(
	codeBlocks: readonly TBlock[]
): TBlock[] {
	return [...codeBlocks.filter(block => !block.alwaysOnTop), ...codeBlocks.filter(block => block.alwaysOnTop)];
}

/**
 * Inserts a code block at the end of its z-order partition (normal blocks before always-on-top blocks).
 */
export function insertCodeBlockRespectingAlwaysOnTop<TBlock extends AlwaysOnTopPartitionableBlock>(
	codeBlocks: readonly TBlock[],
	newBlock: TBlock
): TBlock[] {
	return partitionCodeBlocksByAlwaysOnTop([...codeBlocks, newBlock]);
}

/**
 * Raises a block within its own z-order partition without replacing the live block list.
 */
export function raiseCodeBlockInPlace(codeBlocks: CodeBlockGraphicData[], targetBlock: CodeBlockGraphicData): void {
	const remainingBlocks = codeBlocks.filter(block => block !== targetBlock);
	replaceCodeBlocksInPlace(codeBlocks, insertCodeBlockRespectingAlwaysOnTop(remainingBlocks, targetBlock));
}
