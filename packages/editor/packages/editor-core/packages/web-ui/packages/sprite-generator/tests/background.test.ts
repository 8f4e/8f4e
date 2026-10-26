import { describe, expect, it } from 'vitest';
import { createAtlasLayout } from '../src/atlasLayout';
import generateBackground, { generateLookup } from '../src/background';
import { Command } from '../src/types';
import { characterDimensions6x10, characterDimensions8x16, testPalette } from './utils/testFixtures';
import {
	createMockBitmap,
	findAllCommands,
	findCommand,
	validateDrawingCommand,
	validateSpriteCoordinates,
} from './utils/testHelpers';

describe('background module', () => {
	const layout8x16 = createAtlasLayout(
		characterDimensions8x16.width,
		characterDimensions8x16.height,
		testPalette.colors
	);
	const layout6x10 = createAtlasLayout(
		characterDimensions6x10.width,
		characterDimensions6x10.height,
		testPalette.colors
	);

	describe('generateBackground function', () => {
		const mockGlyphs = createMockBitmap(256);

		it('should generate drawing commands for 8x16 characters', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			// Should start with reset transform
			expect(commands[0]).toEqual([Command.RESET_TRANSFORM]);

			// Should have translate command to position offset
			const translateCommand = findCommand(commands, Command.TRANSLATE);
			expect(translateCommand).toBeDefined();
			validateDrawingCommand(translateCommand!, Command.TRANSLATE, [layout8x16.background.x, layout8x16.background.y]);
		});

		it('should generate drawing commands for 6x10 characters', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions6x10.width,
				characterDimensions6x10.height,
				testPalette.colors
			);

			// Should start with reset transform
			expect(commands[0]).toEqual([Command.RESET_TRANSFORM]);

			// Should have translate command
			const translateCommand = findCommand(commands, Command.TRANSLATE);
			expect(translateCommand).toBeDefined();
		});

		it('should generate background rectangle', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			const fillColorCommands = findAllCommands(commands, Command.FILL_COLOR);
			const rectangleCommands = findAllCommands(commands, Command.RECTANGLE);

			// Should have background color
			const backgroundColorCommand = fillColorCommands.find(cmd => cmd[1] === testPalette.colors.canvasBase);
			expect(backgroundColorCommand).toBeDefined();

			// Should have background rectangle with correct dimensions
			const backgroundRectangle = rectangleCommands.find(
				cmd => cmd[3] === characterDimensions8x16.width * 64 && cmd[4] === characterDimensions8x16.height * 32
			);
			expect(backgroundRectangle).toBeDefined();
			validateDrawingCommand(backgroundRectangle!, Command.RECTANGLE, [
				0,
				0,
				characterDimensions8x16.width * 64,
				characterDimensions8x16.height * 32,
			]);
		});

		it('should generate correct number of dot patterns', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			const fillColorCommands = findAllCommands(commands, Command.FILL_COLOR);

			// Should have dots colors
			const backgroundDotsCommands = fillColorCommands.filter(cmd => cmd[1] === testPalette.colors.canvasDetail1);
			const backgroundDots2Commands = fillColorCommands.filter(cmd => cmd[1] === testPalette.colors.canvasDetail2);

			// Should have many dot color commands (32 rows * 64 cols = 2048 dots)
			expect(backgroundDotsCommands.length + backgroundDots2Commands.length).toBe(32 * 64);
		});

		it('should generate correct dot pattern alternation', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			const fillColorCommands = findAllCommands(commands, Command.FILL_COLOR);

			// Find dot color commands (exclude background and other colors)
			const dotColorCommands = fillColorCommands.filter(
				cmd => cmd[1] === testPalette.colors.canvasDetail1 || cmd[1] === testPalette.colors.canvasDetail2
			);

			// Check pattern for first few dots in first row (even columns should use backgroundDots2)
			const firstRowDots = dotColorCommands.slice(0, 4);
			expect(firstRowDots[0][1]).toBe(testPalette.colors.canvasDetail2); // j=0, even
			expect(firstRowDots[1][1]).toBe(testPalette.colors.canvasDetail1); // j=1, odd
			expect(firstRowDots[2][1]).toBe(testPalette.colors.canvasDetail2); // j=2, even
			expect(firstRowDots[3][1]).toBe(testPalette.colors.canvasDetail1); // j=3, odd
		});

		it('should generate translate commands for positioning dots', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			const translateCommands = findAllCommands(commands, Command.TRANSLATE);

			// Should have initial positioning translate
			const initialTranslate = translateCommands[0];
			validateDrawingCommand(initialTranslate, Command.TRANSLATE, [layout8x16.background.x, layout8x16.background.y]);

			// Should have horizontal movement translates (character width, 0)
			const horizontalTranslates = translateCommands.filter(
				cmd => cmd[1] === characterDimensions8x16.width && cmd[2] === 0
			);
			expect(horizontalTranslates.length).toBeGreaterThan(0);

			// Should have row reset translates (-characterWidth * 64, characterHeight)
			const rowResetTranslates = translateCommands.filter(
				cmd => cmd[1] === -characterDimensions8x16.width * 64 && cmd[2] === characterDimensions8x16.height
			);
			expect(rowResetTranslates.length).toBe(32); // 32 rows
		});

		it('should generate pixel commands for dot rendering', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			// Should generate commands even if pixel commands depend on font data
			// The function should include drawCharacter calls for dots
			expect(commands.length).toBeGreaterThan(100); // Should have many commands
		});

		it('should handle different character dimensions correctly', () => {
			const commands8x16 = generateBackground(mockGlyphs, 8, 16, testPalette.colors);
			const commands6x10 = generateBackground(mockGlyphs, 6, 10, testPalette.colors);

			// Both should have same structure
			expect(commands8x16[0]).toEqual([Command.RESET_TRANSFORM]);
			expect(commands6x10[0]).toEqual([Command.RESET_TRANSFORM]);

			// Background rectangles should have different dimensions
			const bg8x16 = findAllCommands(commands8x16, Command.RECTANGLE)[0];
			const bg6x10 = findAllCommands(commands6x10, Command.RECTANGLE)[0];

			expect(bg8x16[3]).toBe(8 * 64); // width
			expect(bg8x16[4]).toBe(16 * 32); // height
			expect(bg6x10[3]).toBe(6 * 64); // width
			expect(bg6x10[4]).toBe(10 * 32); // height

			// Both should have same number of dot color commands
			const fillColors8x16 = findAllCommands(commands8x16, Command.FILL_COLOR);
			const fillColors6x10 = findAllCommands(commands6x10, Command.FILL_COLOR);

			const dotColors8x16 = fillColors8x16.filter(
				cmd => cmd[1] === testPalette.colors.canvasDetail1 || cmd[1] === testPalette.colors.canvasDetail2
			);
			const dotColors6x10 = fillColors6x10.filter(
				cmd => cmd[1] === testPalette.colors.canvasDetail1 || cmd[1] === testPalette.colors.canvasDetail2
			);

			expect(dotColors8x16.length).toBe(32 * 64);
			expect(dotColors6x10.length).toBe(32 * 64);
		});

		it('should use correct colors from color scheme', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			const fillColorCommands = findAllCommands(commands, Command.FILL_COLOR);
			const colorValues = fillColorCommands.map(cmd => cmd[1]);

			expect(colorValues).toContain(testPalette.colors.canvasBase);
			expect(colorValues).toContain(testPalette.colors.canvasDetail1);
			expect(colorValues).toContain(testPalette.colors.canvasDetail2);
		});

		it('should generate correct number of horizontal and vertical movements', () => {
			const commands = generateBackground(
				mockGlyphs,
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			const translateCommands = findAllCommands(commands, Command.TRANSLATE);

			// Horizontal movements: 64 per row * 32 rows = 2048
			const horizontalTranslates = translateCommands.filter(
				cmd => cmd[1] === characterDimensions8x16.width && cmd[2] === 0
			);
			expect(horizontalTranslates.length).toBe(64 * 32);

			// Row resets: 32 rows
			const rowResetTranslates = translateCommands.filter(
				cmd => cmd[1] === -characterDimensions8x16.width * 64 && cmd[2] === characterDimensions8x16.height
			);
			expect(rowResetTranslates.length).toBe(32);
		});
	});

	describe('generateLookup function', () => {
		it('should generate correct lookup for 8x16 characters', () => {
			const lookup = generateLookup(characterDimensions8x16.width, characterDimensions8x16.height, testPalette.colors);

			// Should have single entry with key 0
			expect(Object.keys(lookup)).toEqual(['0']);
			expect(lookup[0]).toBeDefined();
		});

		it('should generate correct lookup for 6x10 characters', () => {
			const lookup = generateLookup(characterDimensions6x10.width, characterDimensions6x10.height, testPalette.colors);

			// Should have single entry with key 0
			expect(Object.keys(lookup)).toEqual(['0']);
			expect(lookup[0]).toBeDefined();
		});

		it('should generate correct sprite coordinates for 8x16 characters', () => {
			const lookup = generateLookup(characterDimensions8x16.width, characterDimensions8x16.height, testPalette.colors);

			const backgroundCoordinate = lookup[0];

			validateSpriteCoordinates(
				backgroundCoordinate,
				layout8x16.background.x,
				layout8x16.background.y,
				characterDimensions8x16.width * 64, // spriteWidth
				characterDimensions8x16.height * 32 // spriteHeight
			);
		});

		it('should generate correct sprite coordinates for 6x10 characters', () => {
			const lookup = generateLookup(characterDimensions6x10.width, characterDimensions6x10.height, testPalette.colors);

			const backgroundCoordinate = lookup[0];

			validateSpriteCoordinates(
				backgroundCoordinate,
				layout6x10.background.x,
				layout6x10.background.y,
				characterDimensions6x10.width * 64, // spriteWidth
				characterDimensions6x10.height * 32 // spriteHeight
			);
		});

		it('should generate coordinates with fixed offset position', () => {
			const lookup8x16 = generateLookup(8, 16, testPalette.colors);
			const lookup6x10 = generateLookup(6, 10, testPalette.colors);

			// Both should have same offset position
			expect(lookup8x16[0].x).toBe(layout8x16.background.x);
			expect(lookup8x16[0].y).toBe(layout8x16.background.y);
			expect(lookup6x10[0].x).toBe(layout6x10.background.x);
			expect(lookup6x10[0].y).toBe(layout6x10.background.y);

			// But different dimensions
			expect(lookup8x16[0].spriteWidth).toBe(8 * 64);
			expect(lookup8x16[0].spriteHeight).toBe(16 * 32);
			expect(lookup6x10[0].spriteWidth).toBe(6 * 64);
			expect(lookup6x10[0].spriteHeight).toBe(10 * 32);
		});

		it('should generate lookup with consistent grid dimensions', () => {
			const lookup = generateLookup(characterDimensions8x16.width, characterDimensions8x16.height, testPalette.colors);

			const coordinate = lookup[0];

			// Should span 64x32 character grid
			expect(coordinate.spriteWidth).toBe(characterDimensions8x16.width * 64);
			expect(coordinate.spriteHeight).toBe(characterDimensions8x16.height * 32);
		});

		it('should have single background entry', () => {
			const lookup = generateLookup(characterDimensions8x16.width, characterDimensions8x16.height, testPalette.colors);

			// Should have exactly one entry
			expect(Object.keys(lookup)).toHaveLength(1);
			expect(lookup[0]).toBeDefined();

			// Verify the entry is accessible by key 0
			const keys = Object.keys(lookup);
			expect(keys[0]).toBe('0');
		});
	});
});
