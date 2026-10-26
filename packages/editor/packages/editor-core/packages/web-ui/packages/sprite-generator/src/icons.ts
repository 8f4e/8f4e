import type { PaletteColors } from '@8f4e/editor-palette';
import type { SpriteCoordinates } from 'glugglugglug';

import { createAtlasLayout } from './atlasLayout.ts';
import { drawCharacter } from './font.ts';
import { Command, type DrawingCommand } from './types.ts';

const INPUT_CHARACTERS = ['[', ' ', ']'] as const;

export const Icon = {
	INPUT: 0,
} as const;

export type IconValue = (typeof Icon)[keyof typeof Icon];

export default function generate(
	asciiFont: number[],
	characterWidth: number,
	characterHeight: number,
	colors: PaletteColors
): DrawingCommand[] {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);
	return [
		[Command.RESET_TRANSFORM],
		[Command.TRANSLATE, layout.icons.x, layout.icons.y],
		[Command.FILL_COLOR, colors.surfaceRaised2],
		[Command.RECTANGLE, 0, 0, characterWidth * INPUT_CHARACTERS.length, characterHeight],
		[Command.FILL_COLOR, colors.primaryBase],
		...INPUT_CHARACTERS.flatMap<DrawingCommand>(char => [
			...drawCharacter(asciiFont, char, characterWidth, characterHeight),
			[Command.TRANSLATE, characterWidth, 0],
		]),
	];
}

export function generateLookup(
	characterWidth: number,
	characterHeight: number,
	colors: PaletteColors
): Record<IconValue, SpriteCoordinates> {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);
	return {
		[Icon.INPUT]: {
			x: layout.icons.x,
			y: layout.icons.y,
			spriteWidth: INPUT_CHARACTERS.length * characterWidth,
			spriteHeight: characterHeight,
		},
	};
}
