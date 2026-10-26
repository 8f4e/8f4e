import { describe, expect, it } from 'vitest';
import decodeFontBase64 from '../src/fonts/font-decoder.ts';
import { FONT_NAMES } from '../src/index.ts';

describe('font bitmap generation and decoding', () => {
	it.each(FONT_NAMES)('preserves all 128 ordinary characters for %s', async font => {
		const [{ default: glyphs }, { fontMetadata }] = await Promise.all([
			import(`../src/fonts/${font}/ascii.ts`),
			import(`../src/fonts/${font}/generated/ascii.ts`),
		]);
		const { characterWidth, characterHeight, glyphCount, bytesPerValue, base64Data } = fontMetadata;
		expect(glyphCount).toBe(128);
		expect(base64Data.length).toBeGreaterThan(0);
		expect(bytesPerValue).toBe(characterWidth > 8 ? 2 : 1);
		const decoded = decodeFontBase64(fontMetadata);
		const expected = (glyphs as string[][]).flatMap(glyph =>
			glyph.map(row =>
				Number.parseInt(
					row.slice(0, characterWidth).padEnd(characterWidth, ' ').replaceAll(' ', '0').replaceAll('#', '1'),
					2
				)
			)
		);
		expect(decoded).toHaveLength(128 * characterHeight);
		expect(decoded).toEqual(expected);
		expect(decoded.every(row => row >= 0 && row < 2 ** characterWidth)).toBe(true);
		expect(decoded.slice(32 * characterHeight, 33 * characterHeight)).toEqual(Array(characterHeight).fill(0));
	});
});
