import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import type { WatchValue } from '../types';
import formatWatchValue from './formatWatchValue';

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
	vGrid: number,
	hGrid: number,
	x: number,
	y: number,
	value: string,
	now: number,
	reducedMotion: boolean
): void {
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
	engine.drawText(x + vGrid, y, value, PALETTE_INDICES.secondaryBase);
	engine.drawCharacter(rightBracketX, bracketY, 93, color, bracketWidth, bracketHeight);
}

export default function drawWatch(
	engine: DrawContext,
	vGrid: number,
	hGrid: number,
	values: WatchValue[],
	memoryViews: MemoryViews,
	now: number,
	reducedMotion: boolean
): void {
	if (memoryViews.int32.length === 0) {
		return;
	}

	for (const { x, y, memory, showAddress, showEndAddress, displayFormat, bufferPointer } of values) {
		if (showAddress) {
			// Elements are `elementWordSize` bytes wide, so narrow and float64 arrays do not step by 4.
			const byteAddress = memory.byteAddress + bufferPointer * memory.elementWordSize;
			drawBracketedValue(engine, vGrid, hGrid, x, y, String(byteAddress), now, reducedMotion);
		} else if (showEndAddress) {
			// The planner's end address excludes leading alignment padding, which `allocationUnitCount` includes.
			drawBracketedValue(engine, vGrid, hGrid, x, y, String(memory.endByteAddress), now, reducedMotion);
		} else {
			const value = formatWatchValue(memoryViews, memory, bufferPointer, displayFormat);
			drawBracketedValue(engine, vGrid, hGrid, x, y, value, now, reducedMotion);
		}
	}
}
