import { FONT_PALETTE_TOKENS, PALETTE_TOKENS } from '@8f4e/editor-palette';
import { describe, expect, it } from 'vitest';
import generateFonts, { buildFontLayout, drawCharacter, drawCharacterMatrix, generateLookups } from '../src/font';
import { Command } from '../src/types';
import { testPalette } from './utils/testFixtures';
import { createMockBitmap, findAllCommands } from './utils/testHelpers';

describe('font module', () => {
	describe('drawCharacter function', () => {
		it('should generate pixel commands for character with set bits', () => {
			// Create a font with specific bit pattern
			const testFont = new Array(256 * 16).fill(0);
			// Set some bits for character 'A' (ASCII 65)
			testFont[65 * 16] = 0b11111111; // First row all set
			testFont[65 * 16 + 1] = 0b10000001; // Second row corners set

			const commands = drawCharacter(testFont, 65, 8, 16);
			const pixelCommands = findAllCommands(commands, Command.PIXEL);

			// Should generate pixel commands for set bits
			expect(pixelCommands.length).toBeGreaterThan(0);

			// First row should have 8 pixels
			const firstRowPixels = pixelCommands.filter(cmd => cmd[2] === 0);
			expect(firstRowPixels.length).toBe(8);

			// Second row should have 2 pixels (corners)
			const secondRowPixels = pixelCommands.filter(cmd => cmd[2] === 1);
			expect(secondRowPixels.length).toBe(2);
		});

		it('should handle string character codes', () => {
			const testFont = new Array(256 * 16).fill(0);
			testFont[65 * 16] = 0b11111111; // 'A'

			const commandsNumber = drawCharacter(testFont, 65, 8, 16);
			const commandsString = drawCharacter(testFont, 'A', 8, 16);

			// Should generate same commands for number and string
			expect(commandsNumber).toEqual(commandsString);
		});

		it('should generate correct pixel coordinates', () => {
			const testFont = new Array(256 * 16).fill(0);
			testFont[65 * 16] = 0b10000001; // First and last bit set

			const commands = drawCharacter(testFont, 65, 8, 16);
			const pixelCommands = findAllCommands(commands, Command.PIXEL);

			// Should have pixels at (0,0) and (7,0)
			expect(pixelCommands).toContainEqual([Command.PIXEL, 0, 0]);
			expect(pixelCommands).toContainEqual([Command.PIXEL, 7, 0]);
		});

		it('should handle different character dimensions', () => {
			const testFont = new Array(256 * 10).fill(0);
			testFont[65 * 10] = 0b111111; // First 6 bits set

			const commands = drawCharacter(testFont, 65, 6, 10);
			const pixelCommands = findAllCommands(commands, Command.PIXEL);

			// Should generate pixels for 6-bit width
			expect(pixelCommands.length).toBe(6);
			expect(pixelCommands).toContainEqual([Command.PIXEL, 0, 0]);
			expect(pixelCommands).toContainEqual([Command.PIXEL, 5, 0]);
		});

		it('should return empty array for character with no set bits', () => {
			const testFont = new Array(256 * 16).fill(0);
			// Character 65 has no bits set

			const commands = drawCharacter(testFont, 65, 8, 16);

			expect(commands).toEqual([]);
		});
	});

	describe('drawCharacterMatrix function', () => {
		const mockFont = createMockBitmap(256);

		it('should generate save and restore commands', () => {
			const commands = drawCharacterMatrix(mockFont, 8, 16, [[65], [66]]);

			expect(commands[0]).toEqual([Command.SAVE]);
			expect(commands[commands.length - 1]).toEqual([Command.RESTORE]);
		});

		it('should generate translate commands for positioning', () => {
			const commands = drawCharacterMatrix(mockFont, 8, 16, [
				[65, 66],
				[67, 68],
			]);
			const translateCommands = findAllCommands(commands, Command.TRANSLATE);

			// Should have translate commands for horizontal and vertical positioning
			expect(translateCommands.length).toBeGreaterThan(0);

			// Should have horizontal translates (characterWidth, 0)
			const horizontalTranslates = translateCommands.filter(cmd => cmd[1] === 8 && cmd[2] === 0);
			expect(horizontalTranslates.length).toBeGreaterThan(0);

			// Should have vertical translates with negative x and positive y
			const verticalTranslates = translateCommands.filter(cmd => cmd[1] < 0 && cmd[2] === 16);
			expect(verticalTranslates.length).toBeGreaterThan(0);
		});

		it('should handle 2x2 character matrix correctly', () => {
			const commands = drawCharacterMatrix(mockFont, 8, 16, [
				[65, 66],
				[67, 68],
			]);
			const translateCommands = findAllCommands(commands, Command.TRANSLATE);

			// Should have translates for each character position
			const horizontalTranslates = translateCommands.filter(cmd => cmd[1] === 8 && cmd[2] === 0);
			expect(horizontalTranslates.length).toBe(4); // 2 chars per row * 2 rows

			// Should have row reset translates
			const rowResets = translateCommands.filter(
				cmd => cmd[1] === -16 && cmd[2] === 16 // -2 * characterWidth, characterHeight
			);
			expect(rowResets.length).toBe(2); // 2 rows
		});

		it('should handle empty matrix', () => {
			const commands = drawCharacterMatrix(mockFont, 8, 16, []);

			expect(commands[0]).toEqual([Command.SAVE]);
			expect(commands[commands.length - 1]).toEqual([Command.RESTORE]);
			expect(commands.length).toBe(2); // Only save and restore
		});

		it('should handle single character matrix', () => {
			const commands = drawCharacterMatrix(mockFont, 8, 16, [[65]]);
			const translateCommands = findAllCommands(commands, Command.TRANSLATE);

			// Should have horizontal translate for the character
			const horizontalTranslates = translateCommands.filter(cmd => cmd[1] === 8 && cmd[2] === 0);
			expect(horizontalTranslates.length).toBe(1);
		});
	});

	describe('palette font catalog', () => {
		it('fits the lookup texture even when every configurable font color is distinct', () => {
			expect(FONT_PALETTE_TOKENS.length * 128 + PALETTE_TOKENS.length + 1).toBeLessThanOrEqual(8_192);
		});

		it('renders every concrete color once and shares coordinates between matching tokens', () => {
			const colors = testPalette.colors;
			const commands = generateFonts(createMockBitmap(256), 8, 16, colors);
			expect(findAllCommands(commands, Command.FILL_COLOR).map(command => command[1])).toEqual([
				...new Set(FONT_PALETTE_TOKENS.map(token => colors[token])),
			]);
			const { rowsByRole, uniqueRows } = buildFontLayout(colors);
			expect(uniqueRows.length).toBe(new Set(FONT_PALETTE_TOKENS.map(token => colors[token])).size);
			expect(uniqueRows.length * 128 + PALETTE_TOKENS.length + 1).toBeLessThanOrEqual(8_192);
			expect(rowsByRole.primaryBase).toBe(rowsByRole.secondaryBase);
			const lookups = generateLookups(8, 16, colors);
			expect(lookups.fontPrimaryBase).toEqual(lookups.fontSecondaryBase);
			expect(lookups.fontPrimaryBase).not.toEqual(lookups.fontSurfaceBase);
		});

		it.each([
			[8, 16],
			[6, 10],
			[16, 32],
		])('provides every palette font with character and fallback lookups at %ix%i', (width, height) => {
			const lookups = generateLookups(width, height, testPalette.colors);
			expect(Object.keys(lookups)).toHaveLength(FONT_PALETTE_TOKENS.length);
			for (const font of Object.values(lookups)) {
				expect(font[63]).toBeDefined();
				expect(font.A).toEqual(font[65]);
				expect(font[65]).toMatchObject({ x: 65 * width, spriteWidth: width, spriteHeight: height });
			}
		});
	});
});
