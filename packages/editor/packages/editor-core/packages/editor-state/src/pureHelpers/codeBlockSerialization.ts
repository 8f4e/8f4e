import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

/**
 * Represents a code block in the portable source batch.
 * This is a simplified representation with only the essential data needed for serialization.
 * Disabled state is stored within the code array via the ; @disabled directive.
 */
export interface SerializedCodeBlock {
	code: string[];
	gridCoordinates: { x: number; y: number };
	entry?: string;
	childProject?: { entries: string[]; blocks: SerializedCodeBlock[] };
}

function createSerializedCodeBlock(block: CodeBlockGraphicData, origin: { x: number; y: number }): SerializedCodeBlock {
	return {
		code: [...block.code],
		gridCoordinates: {
			x: block.gridX - origin.x,
			y: block.gridY - origin.y,
		},
		...(block.entry === undefined ? {} : { entry: block.entry }),
		...(block.childProject === undefined
			? {}
			: {
					childProject: {
						entries: [...block.childProject.entries],
						blocks: block.childProject.blocks.map(child => createSerializedCodeBlock(child, { x: 0, y: 0 })),
					},
				}),
	};
}

/**
 * Serializes code blocks and recursively owned project-group slices into a portable source batch.
 * Grid coordinates are relative to the anchor block.
 *
 * @param codeBlocks - Array of code blocks to copy from the same rendered project slice
 * @param anchorBlock - The block to use as the reference point (0,0)
 * @returns Detached block sources with their relative positions
 */
export function serializeCodeBlocks(
	codeBlocks: CodeBlockGraphicData[],
	anchorBlock: CodeBlockGraphicData
): SerializedCodeBlock[] {
	const blocks = codeBlocks.map(block =>
		createSerializedCodeBlock(block, { x: anchorBlock.gridX, y: anchorBlock.gridY })
	);

	return blocks;
}
