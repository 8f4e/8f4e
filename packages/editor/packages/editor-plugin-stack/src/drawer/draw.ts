import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '@8f4e/web-ui';
import type { StackLabel } from '../types';

const BRACKET_ANIMATION_DURATION_MS = 2200;
const MAX_BRACKET_OFFSET_IN_CELLS = 0.375;
const MAX_BRACKET_SCALE = 1.08;
function getAnimationProgress(now: number, reducedMotion: boolean): number {
	if (reducedMotion) {
		return 0;
	}

	const cycleProgress = (now % BRACKET_ANIMATION_DURATION_MS) / BRACKET_ANIMATION_DURATION_MS;
	return cycleProgress <= 0.5 ? cycleProgress * 2 : (1 - cycleProgress) * 2;
}

function drawBracketedValue(
	engine: DrawContext,
	state: State,
	x: number,
	y: number,
	value: string,
	now: number,
	reducedMotion: boolean
): void {
	const { vGrid, hGrid } = state.viewport;
	const animationProgress = getAnimationProgress(now, reducedMotion);
	const bracketOffset = vGrid * MAX_BRACKET_OFFSET_IN_CELLS * animationProgress;
	const bracketScale = 1 + (MAX_BRACKET_SCALE - 1) * animationProgress;
	const bracketWidth = vGrid * bracketScale;
	const bracketHeight = hGrid * bracketScale;
	const bracketY = y + (hGrid - bracketHeight) / 2;
	const leftBracketX = x - bracketOffset + (vGrid - bracketWidth) / 2;
	const rightBracketBaseX = x + vGrid * (value.length + 1);
	const rightBracketX = rightBracketBaseX + bracketOffset + (vGrid - bracketWidth) / 2;
	const color = PALETTE_INDICES.inkBase;

	engine.drawCharacter(leftBracketX, bracketY, 91, color, bracketWidth, bracketHeight);
	engine.drawText(x + state.viewport.vGrid, y, value, PALETTE_INDICES.secondaryBase);
	engine.drawCharacter(rightBracketX, bracketY, 93, color, bracketWidth, bracketHeight);
}

export default function drawStack(
	engine: DrawContext,
	state: State,
	values: StackLabel[],
	now: number,
	reducedMotion: boolean
): void {
	for (const { x, y, text } of values) {
		drawBracketedValue(engine, state, x, y, text, now, reducedMotion);
	}
}
