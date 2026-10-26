import type { PaletteColors } from '@8f4e/editor-palette';
import type { SpriteCoordinates } from 'glugglugglug';

import { createAtlasLayout, FILL_COLOR_COLUMNS, FILL_COLOR_NAMES } from './atlasLayout.ts';
import { Command, type DrawingCommand } from './types.ts';

export type FillSpriteColorName = (typeof FILL_COLOR_NAMES)[number];

export default function generate(
	characterWidth: number,
	characterHeight: number,
	colors: PaletteColors
): DrawingCommand[] {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);

	return [
		[Command.RESET_TRANSFORM],
		[Command.TRANSLATE, layout.fillColors.x, layout.fillColors.y],
		...FILL_COLOR_NAMES.flatMap<DrawingCommand>((color, index) => {
			return [
				[Command.FILL_COLOR, colors[color]],
				[Command.RECTANGLE, 0, 0, characterWidth, characterHeight],
				index % FILL_COLOR_COLUMNS === FILL_COLOR_COLUMNS - 1
					? [Command.TRANSLATE, -(FILL_COLOR_COLUMNS - 1) * characterWidth, characterHeight]
					: [Command.TRANSLATE, characterWidth, 0],
			];
		}),
	];
}

export const generateLookup = (characterWidth: number, characterHeight: number, colors: PaletteColors) => {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);

	return Object.fromEntries(
		FILL_COLOR_NAMES.map((color, index) => [
			color,
			{
				x: layout.fillColors.x + (index % FILL_COLOR_COLUMNS) * characterWidth,
				y: layout.fillColors.y + Math.floor(index / FILL_COLOR_COLUMNS) * characterHeight,
				spriteWidth: characterWidth,
				spriteHeight: characterHeight,
			},
		])
	) as Record<FillSpriteColorName, SpriteCoordinates>;
};
