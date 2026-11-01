import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

/**
 * Represents a code block in the clipboard payload.
 * This is a simplified representation with only the essential data needed for copy/paste.
 * Disabled state is stored within the code array via the ; @disabled directive.
 */
export interface ClipboardCodeBlock {
	code: string[];
	gridCoordinates: { x: number; y: number };
	entry?: string;
	childProject?: { blocks: ClipboardCodeBlock[] };
}

function createClipboardCodeBlock(block: CodeBlockGraphicData, origin: { x: number; y: number }): ClipboardCodeBlock {
	return {
		code: block.code,
		gridCoordinates: {
			x: block.gridX - origin.x,
			y: block.gridY - origin.y,
		},
		...(block.entry === undefined ? {} : { entry: block.entry }),
		...(block.childProject === undefined
			? {}
			: {
					childProject: {
						blocks: block.childProject?.blocks.map(child => createClipboardCodeBlock(child, { x: 0, y: 0 })),
					},
				}),
	};
}

/**
 * Serializes code blocks and recursively owned project-group slices into a clipboard payload.
 * The payload is a JSON array where gridCoordinates are relative to the anchor block.
 *
 * @param codeBlocks - Array of code blocks to copy from the same rendered project slice
 * @param anchorBlock - The block to use as the reference point (0,0)
 * @returns JSON string representation of the code blocks
 */
export function serializeCodeBlocksToClipboard(
	codeBlocks: CodeBlockGraphicData[],
	anchorBlock: CodeBlockGraphicData
): string {
	const clipboardBlocks = codeBlocks.map(block =>
		createClipboardCodeBlock(block, { x: anchorBlock.gridX, y: anchorBlock.gridY })
	);

	return JSON.stringify(clipboardBlocks);
}

/**
 * Validates if an object matches the expected code block shape.
 */
function isValidClipboardCodeBlock(obj: unknown): obj is ClipboardCodeBlock {
	if (typeof obj !== 'object' || obj === null) {
		return false;
	}

	const block = obj as Record<string, unknown>;

	// Check required fields
	if (!Array.isArray(block.code)) {
		return false;
	}

	if (!block.code.every(line => typeof line === 'string')) {
		return false;
	}

	if (typeof block.gridCoordinates !== 'object' || block.gridCoordinates === null) {
		return false;
	}

	const coords = block.gridCoordinates as Record<string, unknown>;
	if (typeof coords.x !== 'number' || typeof coords.y !== 'number') {
		return false;
	}
	if (block.entry !== undefined && typeof block.entry !== 'string') {
		return false;
	}
	if (block.childProject !== undefined) {
		if (typeof block.childProject !== 'object' || block.childProject === null) return false;
		const project = block.childProject as Record<string, unknown>;
		if (!Array.isArray(project.blocks) || !project.blocks.every(isValidClipboardCodeBlock)) return false;
	}

	return true;
}

/**
 * Parses clipboard text and determines if it's a valid multi-block payload or single-block text.
 *
 * @param clipboardText - The raw clipboard text
 * @returns Object with either multiBlock array or singleBlock text
 */
export function parseClipboardData(
	clipboardText: string
): { type: 'multi'; blocks: ClipboardCodeBlock[] } | { type: 'single'; text: string } {
	// Try to parse as JSON
	let parsed: unknown;
	try {
		parsed = JSON.parse(clipboardText);
	} catch {
		// Not valid JSON, treat as single-block text
		return { type: 'single', text: clipboardText };
	}

	if (!Array.isArray(parsed) || parsed.length === 0) {
		return { type: 'single', text: clipboardText };
	}

	// Check if every element matches the expected code block shape
	if (!parsed.every(isValidClipboardCodeBlock)) {
		return { type: 'single', text: clipboardText };
	}
	if (parsed.length === 1 && parsed[0].childProject === undefined) {
		return { type: 'single', text: clipboardText };
	}

	return { type: 'multi', blocks: parsed };
}
