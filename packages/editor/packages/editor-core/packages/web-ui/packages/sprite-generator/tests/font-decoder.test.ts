import { describe, expect, it } from 'vitest';
import { FONT_NAMES, FONTS } from '../src/fonts/catalog.ts';
import decodeFontBase64 from '../src/fonts/font-decoder.ts';

describe('packed font row decoding', () => {
	it.each(FONT_NAMES)('preserves all 128 ordinary characters for %s', async font => {
		const [{ default: glyphs }, { default: base64 }] = await Promise.all([
			import(`../src/fonts/${font}/ascii.ts`),
			FONTS[font].load(),
		]);
		const { width, height } = FONTS[font];
		const decoded = decodeFontBase64(base64, width > 8 ? 2 : 1);
		expect(decoded).toBeInstanceOf(width > 8 ? Uint16Array : Uint8Array);
		const expected = (glyphs as string[][]).flatMap(glyph =>
			glyph.map(row =>
				Number.parseInt(row.slice(0, width).padEnd(width, ' ').replaceAll(' ', '0').replaceAll('#', '1'), 2)
			)
		);
		expect(decoded).toHaveLength(128 * height);
		expect(Array.from(decoded)).toEqual(expected);
	});
});
