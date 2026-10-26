import type { PaletteColors } from '@8f4e/editor-palette';
import type { SpriteCoordinates } from 'glugglugglug';

import { createAtlasLayout } from './atlasLayout.ts';
import { drawCharacter } from './font.ts';
import { Command, type DrawingCommand } from './types.ts';

export function getFeedbackScaleColors(colors: PaletteColors): string[] {
	return [
		colors.primaryDark3,
		colors.primaryDark2,
		colors.primaryDark1,
		colors.primaryBase,
		colors.warningBase,
		colors.negativeBase,
	];
}

export default function generate(
	font: number[],
	characterWidth: number,
	characterHeight: number,
	colors: PaletteColors
): DrawingCommand[] {
	const feedbackScaleColors = getFeedbackScaleColors(colors);
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);

	return [
		[Command.RESET_TRANSFORM],
		[Command.TRANSLATE, layout.feedbackScale.x, layout.feedbackScale.y],

		...feedbackScaleColors.flatMap<DrawingCommand>(color => {
			return [
				[Command.FILL_COLOR, colors.surfaceRaised2],
				[Command.RECTANGLE, 0, 0, characterWidth * 3, characterHeight],
				[Command.FILL_COLOR, colors.secondaryBase],
				...drawCharacter(font, '[', characterWidth, characterHeight),
				[Command.TRANSLATE, characterWidth, 0],
				[Command.FILL_COLOR, color],
				...drawCharacter(font, '*', characterWidth, characterHeight),
				[Command.TRANSLATE, characterWidth, 0],
				[Command.FILL_COLOR, colors.secondaryBase],
				...drawCharacter(font, ']', characterWidth, characterHeight),
				[Command.TRANSLATE, characterWidth, 0],
			];
		}),
	];
}

export const generateLookup = (
	characterWidth: number,
	characterHeight: number,
	colors: PaletteColors
): Partial<Record<number, SpriteCoordinates>> => {
	const feedbackScaleColors = getFeedbackScaleColors(colors);
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);

	return Object.fromEntries(
		feedbackScaleColors.map((_color, index) => {
			return [
				index,
				{
					x: layout.feedbackScale.x + index * (characterWidth * 3),
					y: layout.feedbackScale.y,
					spriteWidth: characterWidth * 3,
					spriteHeight: characterHeight,
				},
			];
		})
	);
};
