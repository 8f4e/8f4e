import { describe, expect, it } from 'vitest';
import { createAtlasLayout } from '../src/atlasLayout';
import generateIcons, { generateLookup, Icon } from '../src/icons';
import { Command } from '../src/types';
import { characterDimensions6x10, characterDimensions8x16, testPalette } from './utils/testFixtures';
import {
	createMockBitmap,
	findAllCommands,
	findCommand,
	validateDrawingCommand,
	validateSpriteCoordinates,
} from './utils/testHelpers';

describe('icons module', () => {
	const layout8x16 = createAtlasLayout(
		characterDimensions8x16.width,
		characterDimensions8x16.height,
		testPalette.colors
	);

	describe('Icon enum', () => {
		it('contains only the precomposed input connector', () => {
			expect(Icon.INPUT).toBe(0);
			expect(Object.keys(Icon)).toEqual(['INPUT']);
		});
	});

	describe('generateIcons function', () => {
		const mockFont = createMockBitmap(256);

		it('generates drawing commands for different character sizes', () => {
			const commands8x16 = generateIcons(mockFont, 8, 16, testPalette.colors);
			const commands6x10 = generateIcons(mockFont, 6, 10, testPalette.colors);

			expect(commands8x16[0]).toEqual([Command.RESET_TRANSFORM]);
			expect(commands6x10[0]).toEqual([Command.RESET_TRANSFORM]);
			expect(findAllCommands(commands8x16, Command.RECTANGLE)).toContainEqual([Command.RECTANGLE, 0, 0, 24, 16]);
			expect(findAllCommands(commands6x10, Command.RECTANGLE)).toContainEqual([Command.RECTANGLE, 0, 0, 18, 10]);
		});

		it('positions the icon section at its atlas offset', () => {
			const commands = generateIcons(
				mockFont,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);
			const translateCommand = findCommand(commands, Command.TRANSLATE);

			expect(translateCommand).toBeDefined();
			validateDrawingCommand(translateCommand!, Command.TRANSLATE, [layout8x16.icons.x, layout8x16.icons.y]);
		});

		it('uses the input connector colors', () => {
			const commands = generateIcons(
				mockFont,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);
			const colorValues = findAllCommands(commands, Command.FILL_COLOR).map(command => command[1]);

			expect(colorValues).toContain(testPalette.colors.surfaceRaised2);
			expect(colorValues).toContain(testPalette.colors.primaryReadable);
		});

		it('draws the input brackets from the ascii font', () => {
			const asciiFont = Array.from({ length: 128 * characterDimensions8x16.height }, () => 0);
			asciiFont['['.charCodeAt(0) * characterDimensions8x16.height + 1] = 0b10000000;
			asciiFont[']'.charCodeAt(0) * characterDimensions8x16.height + 2] = 0b01000000;

			const commands = generateIcons(
				asciiFont,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);
			const pixels = findAllCommands(commands, Command.PIXEL);

			expect(pixels).toContainEqual([Command.PIXEL, 0, 1]);
			expect(pixels).toContainEqual([Command.PIXEL, 1, 2]);
		});

		it('handles a missing optional input background color', () => {
			const colorsWithUndefined = {
				...testPalette.colors,
				inputConnectorBackground: undefined as string | undefined,
			};

			expect(() =>
				generateIcons(mockFont, characterDimensions8x16.width, characterDimensions8x16.height, colorsWithUndefined)
			).not.toThrow();
		});
	});

	describe('generateLookup function', () => {
		it('generates only the input connector lookup', () => {
			const lookup = generateLookup(characterDimensions8x16.width, characterDimensions8x16.height, testPalette.colors);

			expect(Object.keys(lookup)).toEqual([String(Icon.INPUT)]);
			validateSpriteCoordinates(
				lookup[Icon.INPUT],
				layout8x16.icons.x,
				layout8x16.icons.y,
				characterDimensions8x16.width * 3,
				characterDimensions8x16.height
			);
		});

		it('uses the current font dimensions', () => {
			const lookup = generateLookup(characterDimensions6x10.width, characterDimensions6x10.height, testPalette.colors);

			expect(lookup[Icon.INPUT].spriteWidth).toBe(characterDimensions6x10.width * 3);
			expect(lookup[Icon.INPUT].spriteHeight).toBe(characterDimensions6x10.height);
		});
	});
});
