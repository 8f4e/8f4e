import type { PaletteColors } from '@8f4e/editor-palette';
import type { SpriteCoordinates } from 'glugglugglug';

import { createAtlasLayout } from './atlasLayout.ts';
import { drawCharacter } from './font.ts';
import Glyph from './fonts/types.ts';
import { Command, type DrawingCommand } from './types.ts';

export default function generate(
	glyphs: number[],
	characterWidth: number,
	characterHeight: number,
	colors: PaletteColors
): DrawingCommand[] {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);
	const commands: DrawingCommand[] = [
		[Command.RESET_TRANSFORM],
		[Command.TRANSLATE, layout.background.x, layout.background.y],
		[Command.FILL_COLOR, colors.canvasBase],
		[Command.RECTANGLE, 0, 0, layout.background.width, layout.background.height],
	];

	for (let i = 0; i < 32; i++) {
		for (let j = 0; j < 64; j++) {
			commands.push(
				j % 2 === 0 && i % 1 === 0
					? [Command.FILL_COLOR, colors.canvasDetail2]
					: [Command.FILL_COLOR, colors.canvasDetail1],
				...drawCharacter(glyphs, Glyph.DOT, characterWidth, characterHeight),
				[Command.TRANSLATE, characterWidth, 0]
			);
		}
		commands.push([Command.TRANSLATE, -characterWidth * 64, characterHeight]);
	}

	return commands;
}

export const generateLookup = (
	characterWidth: number,
	characterHeight: number,
	colors: PaletteColors
): Record<0, SpriteCoordinates> => {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);

	return {
		0: {
			x: layout.background.x,
			y: layout.background.y,
			spriteWidth: 64 * characterWidth,
			spriteHeight: 32 * characterHeight,
		},
	};
};
