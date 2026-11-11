import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { readByteAddress, readDeclarationEndAddress } from '@8f4e/editor-state/memory';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import { textToGlyphIds } from '@8f4e/web-ui';
import type { WatchValue } from '../types';
import formatWatchValue from './formatWatchValue';

const [LEFT_BRACKET, RIGHT_BRACKET] = textToGlyphIds('[]');

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

	engine.drawSprite(leftBracketX, bracketY, LEFT_BRACKET, color, bracketWidth, bracketHeight);
	engine.drawNumericText(x + vGrid, y, value, PALETTE_INDICES.secondaryBase);
	engine.drawSprite(rightBracketX, bracketY, RIGHT_BRACKET, color, bracketWidth, bracketHeight);
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

	for (const { x, y, display, displayFormat } of values) {
		if (display.kind === 'value') {
			drawBracketedValue(
				engine,
				vGrid,
				hGrid,
				x,
				y,
				formatWatchValue(memoryViews, display.read, displayFormat),
				now,
				reducedMotion
			);
			continue;
		}
		const address = readByteAddress(display.address, memoryViews.int32);
		const value = display.kind === 'endAddress' ? readDeclarationEndAddress(address, display.declarations) : address;
		if (value !== undefined) drawBracketedValue(engine, vGrid, hGrid, x, y, String(value), now, reducedMotion);
	}
}
