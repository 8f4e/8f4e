import { type PaletteConfig, resolvePalette } from '@8f4e/editor-palette';
import aurora from '@8f4e/examples/projects/audio/amigaMods/hymn_to_aurora.8f4e?raw';
import { describe, expect, it } from 'vitest';

describe('bundled example palettes', () => {
	it('retains Aurora’s independent accent hues and translucent strokes', () => {
		const config: PaletteConfig = Object.fromEntries(
			[...aurora.matchAll(/; @config color\.(\w+)\s+([^\n]+)/gi)].map(match => [match[1], match[2]])
		);
		const palette = resolvePalette(config);
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
});
