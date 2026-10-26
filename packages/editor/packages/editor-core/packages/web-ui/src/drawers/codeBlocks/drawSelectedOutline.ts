import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../drawContext';

const OUTLINE_STEP_DURATION_MS = 80;

export default function drawSelectedOutline(
	engine: DrawContext,
	state: State,
	codeBlockWidth: number,
	codeBlockHeight: number,
	now = performance.now()
): void {
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
	const startOffset = Math.max(0, perimeterLength - segmentLength);
	const animationOffset = (Math.floor(now / OUTLINE_STEP_DURATION_MS) + startOffset) % perimeterLength;

	const font = state.spriteLookups!.fontSecondaryBase;

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

		const character =
			y === topY
				? x === leftX || x === rightX
					? '.'
					: '-'
				: y === bottomY
					? x === leftX
						? '`'
						: x === rightX
							? "'"
							: '-'
					: '|';

		engine.drawText(x, y, character, font);
	}
}
