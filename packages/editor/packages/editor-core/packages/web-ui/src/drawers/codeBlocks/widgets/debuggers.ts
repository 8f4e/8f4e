import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';
import type { MemoryViews } from '../../../types';
import formatDebuggerValue from './formatDebuggerValue';

const BRACKET_ANIMATION_DURATION_MS = 2200;
const MAX_BRACKET_OFFSET_IN_CELLS = 0.375;
const MAX_BRACKET_SCALE = 1.08;
const reducedMotionMediaQuery =
	typeof window === 'undefined' ? undefined : window.matchMedia('(prefers-reduced-motion: reduce)');

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

export default function drawDebuggers(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData,
	memoryViews: MemoryViews,
	now = performance.now(),
	reducedMotion = reducedMotionMediaQuery?.matches ?? false
): void {
	if (!state.spriteLookups) {
		return;
	}

	if (memoryViews.int32.length === 0) {
		return;
	}

	for (const { x, y, memory, showAddress, showEndAddress, displayFormat, bufferPointer, text } of codeBlock.widgets
		.debuggers) {
		if (text !== undefined) {
			drawBracketedValue(engine, state, x, y, text, now, reducedMotion);
			continue;
		}

		if (!memory) {
			continue;
		}

		if (showAddress) {
			// Elements are `elementWordSize` bytes wide, so narrow and float64 arrays do not step by 4.
			const byteAddress = memory.byteAddress + bufferPointer * memory.elementWordSize;
			drawBracketedValue(engine, state, x, y, String(byteAddress), now, reducedMotion);
		} else if (showEndAddress) {
			// The planner's end address excludes leading alignment padding, which `allocationUnitCount` includes.
			drawBracketedValue(engine, state, x, y, String(memory.endByteAddress), now, reducedMotion);
		} else {
			const value = formatDebuggerValue(memoryViews, memory, bufferPointer, displayFormat);
			drawBracketedValue(engine, state, x, y, value, now, reducedMotion);
		}
	}
}
