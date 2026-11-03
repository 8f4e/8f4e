import type { CodeBlockDrawerContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

const OUTLINE_STEP_DURATION_MS = 80;

export default function drawSelectionAnimation({ draw, state, codeBlock }: CodeBlockDrawerContext): void {
	if (state.codeBlockRendering.selectedCodeBlock !== codeBlock) return;
	const { width: codeBlockWidth, height: codeBlockHeight } = codeBlock;
	const now = performance.now();
	const { vGrid, hGrid } = state.viewport;
	const leftX = -vGrid * 2;
	const rightX = codeBlockWidth + vGrid;
	const innerRightX = codeBlockWidth;
	const topY = -hGrid;
	const bottomY = codeBlockHeight;
	const segmentLength = 4;
	const topSteps = Math.floor((rightX - leftX) / (vGrid * 2)) + 1;
	const rightSteps = Math.floor(codeBlockHeight / hGrid) + 1;
	const bottomSteps = Math.floor((innerRightX - leftX) / (vGrid * 2)) + 2;
	const leftSteps = Math.floor(codeBlockHeight / hGrid) + 1;
	const perimeterLength = topSteps + rightSteps + bottomSteps + leftSteps;
	const startOffset = perimeterLength - segmentLength;
	const animationOffset = (Math.floor(now / OUTLINE_STEP_DURATION_MS) + startOffset) % perimeterLength;

	const color = PALETTE_INDICES.secondaryBase;

	for (let i = 0; i < segmentLength; i++) {
		const step = (animationOffset + i) % perimeterLength;
		let x = leftX;
		let y = topY;

		if (step < topSteps) {
			x = leftX + step * vGrid * 2;
			y = topY;
		} else if (step < topSteps + rightSteps) {
			x = rightX;
			y = (step - topSteps) * hGrid;
		} else if (step < topSteps + rightSteps + bottomSteps) {
			const bottomStep = step - topSteps - rightSteps;
			y = bottomY;

			if (bottomStep === 0) {
				x = rightX;
			} else {
				x = innerRightX - (bottomStep - 1) * vGrid * 2;
			}
		} else {
			x = leftX;
			y = codeBlockHeight - (step - topSteps - rightSteps - bottomSteps) * hGrid;
		}

		let character = '|';
		if (y === topY) {
			character = x === leftX || x === rightX ? '.' : '-';
		} else if (y === bottomY) {
			character = '-';
			if (x === leftX) character = '`';
			else if (x === rightX) character = "'";
		}

		draw.drawText(x, y, character, color);
	}
}
