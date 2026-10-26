import type { PaletteColors } from '@8f4e/editor-palette';
import type { SpriteCoordinates } from 'glugglugglug';

import { createAtlasLayout } from './atlasLayout.ts';
import { drawCharacter } from './font.ts';
import { Command, type DrawingCommand } from './types.ts';

const icons = (
	characterWidth: number,
	characterHeight: number,
	colors?: PaletteColors
): {
	commandsBeforeRenderingGlyphs: DrawingCommand[];
	chars: string[];
}[] => [
	{
		commandsBeforeRenderingGlyphs: [
			[Command.FILL_COLOR, colors?.surfaceRaised2 || ''],
			[Command.RECTANGLE, 0, 0, characterWidth * 3, characterHeight],
			[Command.FILL_COLOR, colors?.primaryBase || ''],
		],
		chars: ['[', ' ', ']'],
	},
];

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
		...icons(characterWidth, characterHeight, colors).flatMap<DrawingCommand>(icon => {
			return [
				...icon.commandsBeforeRenderingGlyphs,
				...icon.chars.flatMap<DrawingCommand>(char => {
					return [
						...drawCharacter(asciiFont, char, characterWidth, characterHeight),
						[Command.TRANSLATE, characterWidth, 0],
					];
				}),
			];
		}),
	];
}

function generateIconPositions(characterWidth: number, characterHeight: number, colors?: PaletteColors) {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);

	return icons(characterWidth, characterHeight).reduce((acc, current) => {
		const length = acc.reduce((acc, icon) => acc + icon[2], 0);
		acc.push([layout.icons.x + length, layout.icons.y, current.chars.length * characterWidth]);
		return acc;
	}, [] as number[][]);
}

export const generateLookup = (characterWidth: number, characterHeight: number, colors?: PaletteColors) => {
	const iconPositions = generateIconPositions(characterWidth, characterHeight, colors);

	return Object.fromEntries(
		icons(characterWidth, characterHeight).map((icon, index) => {
			return [
				index,
				{
					x: iconPositions[index][0],
					y: iconPositions[index][1],
					spriteWidth: iconPositions[index][2],
					spriteHeight: characterHeight,
				},
			];
		})
	) as Record<IconValue, SpriteCoordinates>;
};
