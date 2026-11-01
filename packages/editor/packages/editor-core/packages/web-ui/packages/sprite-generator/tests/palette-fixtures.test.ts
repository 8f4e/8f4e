import { type PaletteConfig, resolvePalette } from '@8f4e/editor-palette';
import { describe, expect, it } from 'vitest';
import { aftertouch, aurora, translucent as lowerIntentions } from './fixtures/palettes';

function paletteFromSource(source: string) {
	return resolvePalette(
		Object.fromEntries(
			[...source.matchAll(/; @config color\.(\w+)\s+([^\n]+)/gi)].map(match => [match[1], match[2]])
		) as PaletteConfig
	);
}

describe('local palette fixtures', () => {
	it('retains Aurora’s independent accent hues and translucent strokes', () => {
		const palette = paletteFromSource(aurora);
		expect(palette.colors).toMatchObject({
			primaryBase: '#62e6c5',
			secondaryBase: '#f2c879',
			tertiaryBase: '#a99bcb',
			highlightBase: '#f2c879',
			detailBase: '#78bceb',
		});
		expect(palette.rgba.strokeBase).toEqual([98 / 255, 230 / 255, 197 / 255, 0.24]);
		expect(palette.rgba.strokeLight2[3]).toBe(0.24);
	});

	it.each([
		{ name: 'Aftertouch', source: aftertouch, ink: [1, 1, 1, 0.8] },
		{ name: 'Lower Intentions', source: lowerIntentions, ink: [249 / 255, 248 / 255, 1, 0.9] },
	])('retains the original translucent foreground and layered surfaces of $name', ({ source, ink }) => {
		const { rgba } = paletteFromSource(source);
		expect(rgba.inkBase).toEqual(ink);
		for (const token of [
			'canvasDetail1',
			'canvasDetail2',
			'surfaceOverlay',
			'floatingSurface',
			'darkSurface',
			'scrim',
		] as const) {
			expect(rgba[token][3]).toBeGreaterThan(0);
			expect(rgba[token][3]).toBeLessThan(1);
		}
	});
});
