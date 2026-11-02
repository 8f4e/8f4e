import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

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
 * Moves a target code block to the front (end) of its own z-order partition without crossing partitions.
 */
export function bringCodeBlockToFrontWithinPartition<TBlock extends AlwaysOnTopPartitionableBlock>(
	codeBlocks: readonly TBlock[],
	targetBlock: TBlock
): TBlock[] {
	const remainingBlocks = codeBlocks.filter(block => block !== targetBlock);
	return insertCodeBlockRespectingAlwaysOnTop(remainingBlocks, targetBlock);
}
