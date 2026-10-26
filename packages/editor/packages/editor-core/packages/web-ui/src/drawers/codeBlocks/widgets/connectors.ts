import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { SpriteFont, SpriteId } from '@8f4e/sprite-generator';
import type { DrawContext } from '../../../drawContext';
import type { MemoryViews } from '../../../types';

const OUTPUT_FONTS = [
	'fontPrimaryDark3',
	'fontPrimaryDark2',
	'fontPrimaryDark1',
	'fontPrimaryBase',
	'fontWarningBase',
	'fontNegativeBase',
] as const;

/** Composes a connector from the shared fill and font sprites in background-to-foreground order. */
function drawConnector(
	engine: DrawContext,
	x: number,
	y: number,
	width: number,
	height: number,
	background: SpriteId,
	brackets: SpriteFont,
	marker?: SpriteFont
): void {
	engine.drawSprite(x, y, background, width * 3, height);
	engine.drawSprite(x, y, brackets[91] ?? brackets[63], width, height);
	if (marker) {
		engine.drawSprite(x + width, y, marker[42] ?? marker[63], width, height);
	}
	engine.drawSprite(x + width * 2, y, brackets[93] ?? brackets[63], width, height);
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
	const background = sprites.fillColors.surfaceRaised2;

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
			sprites.fontSecondaryBase,
			sprites[OUTPUT_FONTS[scaleIndex] ?? OUTPUT_FONTS[0]]
		);
	}

	for (const { x, y } of codeBlock.widgets.inputs) {
		drawConnector(engine, x, y, width, height, background, sprites.fontPrimaryBase);
	}
}
