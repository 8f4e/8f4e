import { describe, expect, it } from 'vitest';
import { createAtlasLayout, FILL_COLOR_COLUMNS } from '../src/atlasLayout';
import generateFillColors, { generateLookup } from '../src/fillColors';
import { Command } from '../src/types';
import { characterDimensions6x10, characterDimensions8x16, testPalette } from './utils/testFixtures';
import { findAllCommands, findCommand, validateDrawingCommand, validateSpriteCoordinates } from './utils/testHelpers';

describe('fillColors module', () => {
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

	describe('generateFillColors function', () => {
		it('should generate drawing commands for 8x16 characters', () => {
			const commands = generateFillColors(
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			// Should start with reset transform
			expect(commands[0]).toEqual([Command.RESET_TRANSFORM]);

			// Should have translate command to position offset
			const translateCommand = findCommand(commands, Command.TRANSLATE);
			expect(translateCommand).toBeDefined();
			validateDrawingCommand(translateCommand!, Command.TRANSLATE, [layout8x16.fillColors.x, layout8x16.fillColors.y]);
		});

		it('should generate drawing commands for 6x10 characters', () => {
			const commands = generateFillColors(
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

		it('should generate correct number of fill color commands', () => {
			const commands = generateFillColors(
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			const fillColorCommands = findAllCommands(commands, Command.FILL_COLOR);
			const rectangleCommands = findAllCommands(commands, Command.RECTANGLE);

			// Should have equal number of fill color and rectangle commands
			expect(fillColorCommands.length).toBe(rectangleCommands.length);
			expect(fillColorCommands.length).toBeGreaterThan(0);
		});

		it('should include all required color fill commands', () => {
			const commands = generateFillColors(
				characterDimensions8x16.width,
				characterDimensions8x16.height,
				testPalette.colors
			);

			const fillColorCommands = findAllCommands(commands, Command.FILL_COLOR);
			const colorValues = fillColorCommands.map(cmd => cmd[1]);

			// Check that specific colors from our color scheme are included
			expect(colorValues).toContain(testPalette.colors.canvasBase);
			expect(colorValues).toContain(testPalette.colors.surfaceRaised1);
			expect(colorValues).toContain(testPalette.colors.secondaryReadable);
			expect(colorValues).toContain(testPalette.colors.surfaceBase);
		});

		it('should generate rectangle commands with correct dimensions', () => {
			const width = characterDimensions8x16.width;
			const height = characterDimensions8x16.height;
			const commands = generateFillColors(width, height, testPalette.colors);

			const rectangleCommands = findAllCommands(commands, Command.RECTANGLE);

			// Each rectangle should have correct dimensions
			rectangleCommands.forEach(cmd => {
				validateDrawingCommand(cmd, Command.RECTANGLE);
				expect(cmd[3]).toBe(width); // width parameter
				expect(cmd[4]).toBe(height); // height parameter
			});
		});

		it('should generate translate commands for positioning', () => {
			const width = characterDimensions8x16.width;
			const height = characterDimensions8x16.height;
			const commands = generateFillColors(width, height, testPalette.colors);

			const translateCommands = findAllCommands(commands, Command.TRANSLATE);

			// Should have initial positioning translate and positioning translates between rectangles
			expect(translateCommands.length).toBeGreaterThan(1);

			// Some translate commands should move by character width
			const characterWidthTranslates = translateCommands.filter(cmd => cmd[1] === width && cmd[2] === 0);
			expect(characterWidthTranslates.length).toBeGreaterThan(0);
		});

		it('should handle different character dimensions correctly', () => {
			const commands8x16 = generateFillColors(8, 16, testPalette.colors);
			const commands6x10 = generateFillColors(6, 10, testPalette.colors);

			// Both should have same structure but different dimensions
			expect(commands8x16.length).toBe(commands6x10.length);

			const rectangles8x16 = findAllCommands(commands8x16, Command.RECTANGLE);
			const rectangles6x10 = findAllCommands(commands6x10, Command.RECTANGLE);

			expect(rectangles8x16.length).toBe(rectangles6x10.length);

			// Check dimensions are different
			expect(rectangles8x16[0][3]).toBe(8); // width
			expect(rectangles8x16[0][4]).toBe(16); // height
			expect(rectangles6x10[0][3]).toBe(6); // width
			expect(rectangles6x10[0][4]).toBe(10); // height
		});
	});

	describe('generateLookup function', () => {
		it('should generate correct lookup for 8x16 characters', () => {
			const lookup = generateLookup(characterDimensions8x16.width, characterDimensions8x16.height, testPalette.colors);

			// Should have entries for all fill colors
			expect(Object.keys(lookup)).toContain('canvasBase');
			expect(Object.keys(lookup)).toContain('surfaceRaised1');
			expect(Object.keys(lookup)).toContain('secondaryReadable');
			expect(Object.keys(lookup)).toContain('negativeBase');
		});

		it('should generate correct sprite coordinates for first color', () => {
			const lookup = generateLookup(characterDimensions8x16.width, characterDimensions8x16.height, testPalette.colors);

			// First color should be at offset position
			const firstColorKey = Object.keys(lookup)[0];
			const firstCoordinate = lookup[firstColorKey as keyof typeof lookup];

			validateSpriteCoordinates(
				firstCoordinate,
				layout8x16.fillColors.x,
				layout8x16.fillColors.y,
				characterDimensions8x16.width,
				characterDimensions8x16.height
			);
		});

		it('should generate correct sprite coordinates with proper spacing', () => {
			const width = characterDimensions8x16.width;
			const height = characterDimensions8x16.height;
			const lookup = generateLookup(width, height, testPalette.colors);

			const keys = Object.keys(lookup);
			if (keys.length >= 2) {
				const firstCoordinate = lookup[keys[0] as keyof typeof lookup];
				const secondCoordinate = lookup[keys[1] as keyof typeof lookup];

				// Second color should be offset by character width
				validateSpriteCoordinates(
					secondCoordinate,
					layout8x16.fillColors.x + width,
					layout8x16.fillColors.y,
					width,
					height
				);
				expect(secondCoordinate.x).toBe(firstCoordinate.x + width);
			}
		});

		it('should generate correct coordinates for 6x10 characters', () => {
			const lookup = generateLookup(characterDimensions6x10.width, characterDimensions6x10.height, testPalette.colors);

			const keys = Object.keys(lookup);
			if (keys.length > 0) {
				const firstCoordinate = lookup[keys[0] as keyof typeof lookup];

				validateSpriteCoordinates(
					firstCoordinate,
					layout6x10.fillColors.x,
					layout6x10.fillColors.y,
					characterDimensions6x10.width,
					characterDimensions6x10.height
				);
			}
		});

		it('should generate lookup with all expected fill color keys', () => {
			const lookup = generateLookup(8, 16, testPalette.colors);
			const keys = Object.keys(lookup);

			// Should include key fill colors from the fillColors array
			expect(keys).toContain('surfaceRaised1');
			expect(keys).toContain('primaryBase');
			expect(keys).toContain('canvasBase');
			expect(keys).toContain('secondaryReadable');
			expect(keys).toContain('negativeBase');
		});

		it('wraps the fill catalog into the existing sidebar and keeps every lookup inside the atlas', () => {
			const width = 8;
			const height = 16;
			const layout = createAtlasLayout(width, height, testPalette.colors);
			const lookup = generateLookup(width, height, testPalette.colors);
			expect(Object.keys(lookup).length).toBeGreaterThan(FILL_COLOR_COLUMNS);
			expect(layout.canvasWidth).toBe(128 * width);
			for (const [index, coordinates] of Object.values(lookup).entries()) {
				expect(coordinates.x).toBe(layout.fillColors.x + (index % FILL_COLOR_COLUMNS) * width);
				expect(coordinates.y).toBe(layout.fillColors.y + Math.floor(index / FILL_COLOR_COLUMNS) * height);
				expect(coordinates.x + width).toBeLessThanOrEqual(layout.canvasWidth);
				expect(coordinates.y + height).toBeLessThanOrEqual(layout.canvasHeight);
			}
		});
	});
});
