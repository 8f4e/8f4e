import { describe, expect, it } from 'vitest';
import { createAtlasLayout } from '../src/atlasLayout';
import generateFeedbackScale, { generateLookup, getFeedbackScaleColors } from '../src/feedbackScale';
import { Command } from '../src/types';
import { testPalette } from './utils/testFixtures';
import { createMockBitmap, findAllCommands } from './utils/testHelpers';

describe('feedback scale palette recipe', () => {
	it('uses four predefined accent shades followed by warning and negative', () => {
		const colors = testPalette.colors;
		expect(getFeedbackScaleColors(colors)).toEqual([
			colors.primaryDark3,
			colors.primaryDark2,
			colors.primaryDark1,
			colors.primaryBase,
			colors.warningBase,
			colors.negativeBase,
		]);
	});

	it.each([
		[8, 16],
		[6, 10],
		[16, 32],
	])('bakes all six states with matching atlas lookups at %ix%i', (width, height) => {
		const colors = testPalette.colors;
		const layout = createAtlasLayout(width, height, colors);
		const commands = generateFeedbackScale(createMockBitmap(256), width, height, colors);
		const rectangles = findAllCommands(commands, Command.RECTANGLE);
		expect(rectangles).toHaveLength(6);
		expect(rectangles.every(command => command[3] === width * 3 && command[4] === height)).toBe(true);
		expect(commands[1]).toEqual([Command.TRANSLATE, layout.feedbackScale.x, layout.feedbackScale.y]);
		const lookup = generateLookup(width, height, colors);
		for (let index = 0; index < 6; index++) {
			expect(lookup[index]).toEqual({
				x: layout.feedbackScale.x + index * width * 3,
				y: layout.feedbackScale.y,
				spriteWidth: width * 3,
				spriteHeight: height,
			});
		}
	});
});
