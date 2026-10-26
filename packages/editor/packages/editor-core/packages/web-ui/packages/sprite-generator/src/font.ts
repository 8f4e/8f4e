import type { FontPaletteToken, PaletteColors } from '@8f4e/editor-palette';
import type { SpriteCoordinates } from 'glugglugglug';

import { createAtlasLayout, TEXT_COLOR_NAMES } from './atlasLayout.ts';
import { Command, type DrawingCommand } from './types.ts';

const ASCII_START = 0;
const ASCII_END = 127;

/**
 * Builds a deduped font layout from the runtime text color map.
 *
 * Deduplication is based on exact string equality of color values. Roles that
 * share the same color string are assigned the same row index, so only one
 * atlas row is rendered per unique color. Row ordering is deterministic:
 * unique colors are assigned row indices in the order their first corresponding
 * role appears in TEXT_COLOR_NAMES.
 */
export function buildFontLayout(colors: PaletteColors): {
	rowsByRole: Record<FontPaletteToken, number>;
	uniqueRows: Array<{ color: string; roles: Array<FontPaletteToken> }>;
} {
	const colorToRow = new Map<string, number>();
	const uniqueRows: Array<{ color: string; roles: Array<FontPaletteToken> }> = [];

	for (const role of TEXT_COLOR_NAMES) {
		const color = colors[role];
		if (!colorToRow.has(color)) {
			colorToRow.set(color, uniqueRows.length);
			uniqueRows.push({ color, roles: [] });
		}
		uniqueRows[colorToRow.get(color)!].roles.push(role);
	}

	const rowsByRole = Object.fromEntries(TEXT_COLOR_NAMES.map(role => [role, colorToRow.get(colors[role])!])) as Record<
		FontPaletteToken,
		number
	>;

	return { rowsByRole, uniqueRows };
}

function forEachBit(
	byte: number,
	characterWidth: number,
	callback: (isByteSet: boolean, nthBit: number) => void
): void {
	for (let i = 0; i < characterWidth; i++) {
		const mask = 1 << (characterWidth - 1 - i);
		callback((byte & mask) !== 0, i);
	}
}

export function drawCharacter(
	font: number[],
	charCode: number | string,
	characterWidth: number,
	characterHeight: number
): DrawingCommand[] {
	const commands: DrawingCommand[] = [];
	const char = typeof charCode === 'string' ? charCode.charCodeAt(0) : charCode;
	for (let i = 0; i < characterHeight; i++) {
		forEachBit(font[char * characterHeight + i], characterWidth, (bit, nthBit) => {
			if (bit) {
				commands.push([Command.PIXEL, nthBit, i]);
			}
		});
	}
	return commands;
}

export function drawCharacterMatrix(
	font: number[],
	characterWidth: number,
	characterHeight: number,
	characterMatrix: number[][]
): DrawingCommand[] {
	const commands: DrawingCommand[] = [[Command.SAVE]];
	characterMatrix.forEach(characterArray => {
		characterArray.forEach(char => {
			commands.push(...drawCharacter(font, char, characterWidth, characterHeight), [
				Command.TRANSLATE,
				characterWidth,
				0,
			]);
		});
		commands.push([Command.TRANSLATE, characterArray.length * -characterWidth, characterHeight]);
	});
	commands.push([Command.RESTORE]);
	return commands;
}

function generateFont(x = 0, y = 0, font: number[], characterWidth: number, characterHeight: number): DrawingCommand[] {
	const commands: DrawingCommand[] = [[Command.TRANSLATE, x, y]];

	for (let code = ASCII_START; code <= ASCII_END; code++) {
		commands.push(...drawCharacter(font, code, characterWidth, characterHeight), [
			Command.TRANSLATE,
			characterWidth,
			0,
		]);
	}

	commands.push([Command.RESET_TRANSFORM]);
	return commands;
}

export default function generateFonts(
	font: number[],
	characterWidth: number,
	characterHeight: number,
	colors: PaletteColors
): DrawingCommand[] {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);
	const { uniqueRows } = buildFontLayout(colors);

	return [
		[Command.RESET_TRANSFORM],
		...uniqueRows.flatMap<DrawingCommand>(({ color }, i) => {
			return [
				[Command.FILL_COLOR, color],
				...generateFont(layout.font.x, layout.font.y + characterHeight * i, font, characterWidth, characterHeight),
			];
		}),
	];
}

function capitalize(word: string) {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

export type FontLookups = {
	[key in FontPaletteToken as `font${Capitalize<string & key>}`]: Partial<Record<number | string, SpriteCoordinates>>;
};

export const generateLookups = (characterWidth: number, characterHeight: number, colors: PaletteColors) => {
	const layout = createAtlasLayout(characterWidth, characterHeight, colors);
	const { rowsByRole } = buildFontLayout(colors);

	return Object.fromEntries(
		TEXT_COLOR_NAMES.map(colorName => {
			const lookups: Record<number | string, SpriteCoordinates> = {};
			const y = layout.font.y + characterHeight * rowsByRole[colorName];

			for (let code = ASCII_START; code <= ASCII_END; code++) {
				const coordinates = {
					x: code * characterWidth + layout.font.x,
					y,
					spriteHeight: characterHeight,
					spriteWidth: characterWidth,
				};
				lookups[code] = coordinates;
				lookups[String.fromCharCode(code)] = coordinates;
			}

			return [`font` + capitalize(colorName), lookups];
		})
	) as FontLookups;
};
