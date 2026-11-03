import type { CodeBlockGraphicData, Direction } from '@8f4e/editor-state-types';

/**
 * Weight factor for alignment preference in distance calculation.
 * Higher values make alignment more important than pure distance.
 * A value of 2.0 strongly favors aligned blocks over closer misaligned ones.
 */
const ALIGNMENT_WEIGHT = 2.0;

/**
 * Calculate the absolute position boundaries of a code block.
 */
function getBlockBounds(block: CodeBlockGraphicData) {
	const left = block.x;
	const top = block.y;
	const right = left + block.width;
	const bottom = top + block.height;
	return { left, top, right, bottom };
}

/**
 * Calculate edge-to-edge distance along the primary axis of movement.
 * For 'down': distance from selected bottom edge to candidate top edge
 * For 'up': distance from candidate bottom edge to selected top edge
 * For 'right': distance from selected right edge to candidate left edge
 * For 'left': distance from candidate right edge to selected left edge
 *
 * Returns a non-negative distance. Negative values (which would indicate overlapping blocks)
 * are clamped to 0 as a defensive measure, though the filtering logic should already exclude such cases.
 */
function calculatePrimaryDistance(
	selectedBounds: ReturnType<typeof getBlockBounds>,
	candidateBounds: ReturnType<typeof getBlockBounds>,
	direction: Direction
): number {
	let distance: number;
	switch (direction) {
		case 'down':
			distance = candidateBounds.top - selectedBounds.bottom;
			break;
		case 'up':
			distance = selectedBounds.top - candidateBounds.bottom;
			break;
		case 'right':
			distance = candidateBounds.left - selectedBounds.right;
			break;
		case 'left':
			distance = selectedBounds.left - candidateBounds.right;
			break;
		default: {
			// Exhaustiveness check: if we get here, TypeScript will error if a direction is missing
			const exhaustiveCheck: never = direction;
			throw new Error(`Unhandled direction: ${exhaustiveCheck}`);
		}
	}
	return Math.max(0, distance);
}

/**
 * Calculate the perpendicular offset between blocks (for alignment scoring).
 * For vertical movement: measures horizontal offset between block centers.
 */
function calculateSecondaryDistance(
	selectedBounds: ReturnType<typeof getBlockBounds>,
	candidateBounds: ReturnType<typeof getBlockBounds>,
	direction: 'up' | 'down'
): number {
	switch (direction) {
		case 'up':
		case 'down': {
			const selectedCenterX = (selectedBounds.left + selectedBounds.right) / 2;
			const candidateCenterX = (candidateBounds.left + candidateBounds.right) / 2;
			return Math.abs(candidateCenterX - selectedCenterX);
		}
	}
}

function findClosestCodeBlockHorizontally(
	candidates: CodeBlockGraphicData[],
	selectedBlock: CodeBlockGraphicData,
	selectedBounds: ReturnType<typeof getBlockBounds>,
	direction: 'left' | 'right'
): CodeBlockGraphicData {
	const absoluteCursorY = selectedBounds.top + selectedBlock.cursor.y;
	let closestBlock = selectedBlock;
	let minDistance = Infinity;

	for (const candidate of candidates) {
		const candidateBounds = getBlockBounds(candidate);
		if (absoluteCursorY < candidateBounds.top || absoluteCursorY > candidateBounds.bottom) {
			continue;
		}

		const distance = calculatePrimaryDistance(selectedBounds, candidateBounds, direction);
		if (distance < minDistance) {
			minDistance = distance;
			closestBlock = candidate;
		}
	}

	return closestBlock;
}

/**
 * Finds the closest code block in a specified direction from the currently selected code block.
 *
 * This function uses an edge-based spatial navigation algorithm that:
 * - Filters code blocks based on edge-to-edge directional criteria
 * - Calculates edge-to-edge distance along the primary axis of movement
 * - Uses the highlighted line for horizontal navigation and alignment weighting for vertical navigation
 * - Returns the selected block if no other blocks exist in that direction
 *
 * Edge-based distance means:
 * - For 'down': measures from bottom edge of selected to top edge of candidates
 * - For 'up': measures from top edge of selected to bottom edge of candidates
 * - For 'right': measures from right edge of selected to left edge of candidates
 * - For 'left': measures from left edge of selected to right edge of candidates
 *
 * This approach provides more intuitive navigation, especially in staggered or
 * diagonal layouts, by preferring blocks that are truly in the requested direction
 * rather than just diagonally closer by center-to-center distance.
 *
 * @param codeBlocks - The list of all code blocks to search through
 * @param selectedBlock - The currently selected code block to navigate from
 * @param direction - The direction to navigate: 'left', 'right', 'up', or 'down'
 * @returns The closest code block in the specified direction, or the selected block if none found
 *
 * @example
 * ```typescript
 * const closestBlock = findClosestCodeBlockInDirection(
 *   codeBlockRendering.currentProject.blocks,
 *   codeBlockRendering.selectedCodeBlock,
 *   'right'
 * );
 * ```
 */
export default function findClosestCodeBlockInDirection(
	codeBlocks: CodeBlockGraphicData[],
	selectedBlock: CodeBlockGraphicData,
	direction: Direction
): CodeBlockGraphicData {
	const selectedBounds = getBlockBounds(selectedBlock);

	const candidates = codeBlocks.filter(block => {
		if (block === selectedBlock) return false;
		if (block.viewportAnchor) return false;

		const candidateBounds = getBlockBounds(block);

		switch (direction) {
			case 'left':
				return candidateBounds.right <= selectedBounds.left;
			case 'right':
				return candidateBounds.left >= selectedBounds.right;
			case 'up':
				return candidateBounds.bottom <= selectedBounds.top;
			case 'down':
				return candidateBounds.top >= selectedBounds.bottom;
		}
	});

	if (candidates.length === 0) {
		return selectedBlock;
	}

	if (direction === 'left' || direction === 'right') {
		return findClosestCodeBlockHorizontally(candidates, selectedBlock, selectedBounds, direction);
	}

	let closestBlock = selectedBlock;
	let minDistance = Infinity;

	for (const candidate of candidates) {
		const candidateBounds = getBlockBounds(candidate);
		const primaryDistance = calculatePrimaryDistance(selectedBounds, candidateBounds, direction);
		const secondaryDistance = calculateSecondaryDistance(selectedBounds, candidateBounds, direction);
		const distance = primaryDistance + secondaryDistance * ALIGNMENT_WEIGHT;

		if (distance < minDistance) {
			minDistance = distance;
			closestBlock = candidate;
		}
	}

	return closestBlock;
}
