import { describe, expect, it } from 'vitest';
import { createAtlasLayout, FILL_COLOR_COLUMNS, FILL_COLOR_NAMES } from '../src/atlasLayout';
import { testPalette } from './utils/testFixtures';

describe('atlas layout', () => {
	it.each([
		[6, 10],
		[8, 16],
		[16, 32],
	])('packs fills beside the background without connector slots at %ix%i', (width, height) => {
		const layout = createAtlasLayout(width, height, testPalette.colors);

		expect(Object.keys(layout)).toEqual(['canvasWidth', 'canvasHeight', 'font', 'background', 'fillColors']);
		expect(layout.background.y).toBe(layout.font.bottom);
		expect(layout.fillColors.y).toBe(layout.font.bottom);
		expect(layout.fillColors.x).toBe(layout.background.right);
		expect(layout.fillColors.height).toBe(Math.ceil(FILL_COLOR_NAMES.length / FILL_COLOR_COLUMNS) * height);
		expect(layout.fillColors.right).toBeLessThanOrEqual(layout.canvasWidth);
		expect(layout.fillColors.bottom).toBeLessThanOrEqual(layout.canvasHeight);
	});
});
