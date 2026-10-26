import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';
import type { MemoryViews } from '../../../types';

const OUTPUT_COLORS = [
	'primaryDark3',
	'primaryDark2',
	'primaryDark1',
	'primaryBase',
	'warningBase',
	'negativeBase',
] as const;

/** Composes a connector from the shared fill and font sprites in background-to-foreground order. */
function drawConnector(
	engine: DrawContext,
	x: number,
	y: number,
	width: number,
	height: number,
	background: PaletteIndex,
	bracketColor: PaletteIndex,
	markerColor?: PaletteIndex
): void {
	engine.drawFill(x, y, background, width * 3, height);
	engine.drawCharacter(x, y, 91, bracketColor, width, height);
	if (markerColor !== undefined) {
		engine.drawCharacter(x + width, y, 42, markerColor, width, height);
	}
	engine.drawCharacter(x + width * 2, y, 93, bracketColor, width, height);
}

export default function drawConnectors(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData,
	memoryViews: MemoryViews
): void {
	const sprites = state.spriteLookups;
	if (!sprites) {
		return;
	}
	const { vGrid: width, hGrid: height } = state.viewport;
	const background = PALETTE_INDICES.surfaceOverlay;

	for (const output of codeBlock.widgets.outputs) {
		const { x, y, memory } = output;

		const rawValue = memory.isInteger
			? memoryViews.int32[memory.allocationUnitAddress]
			: memory.isFloat64
				? memoryViews.float64[memory.byteAddress / 8]
				: memoryViews.float32[memory.allocationUnitAddress];
		const value = Number.isFinite(rawValue) ? rawValue : 0;

		output.calibratedMax = Math.max(1, output.calibratedMax, value);
		output.calibratedMin = Math.min(-1, output.calibratedMin, value);
		const scaleIndex = Math.max(
			0,
			Math.min(
				5,
				Math.round(((value - output.calibratedMin) / (output.calibratedMax + Math.abs(output.calibratedMin))) * 5)
			)
		);

		drawConnector(
			engine,
			x,
			y,
			width,
			height,
			background,
			PALETTE_INDICES.secondaryBase,
			PALETTE_INDICES[OUTPUT_COLORS[scaleIndex] ?? OUTPUT_COLORS[0]]
		);
	}

	for (const { x, y } of codeBlock.widgets.inputs) {
		drawConnector(engine, x, y, width, height, background, PALETTE_INDICES.primaryBase);
	}
}
