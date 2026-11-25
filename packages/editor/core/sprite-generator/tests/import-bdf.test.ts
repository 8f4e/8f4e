import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let directory: string;
let importer: string;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), '8f4e-bdf-'));
	mkdirSync(join(directory, 'tools'));
	mkdirSync(join(directory, 'src'));
	copyFileSync(new URL('../src/characterSet.ts', import.meta.url), join(directory, 'src/characterSet.ts'));
	importer = join(directory, 'tools/import-bdf.mjs');
	copyFileSync(new URL('../tools/import-bdf.mjs', import.meta.url), importer);
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('BDF importer', () => {
	it.each(['', ' \t'])('imports ASCII offsets with trailing BDF whitespace %j', trailingWhitespace => {
		const bdf = join(directory, 'font.bdf');
		writeFileSync(
			bdf,
			`STARTFONT 2.1
FONTBOUNDINGBOX 5 6 0 -1
FONT_ASCENT 5
FONT_DESCENT 1
CHARS 1
STARTCHAR A
ENCODING 65
BBX 3 3 1 1
BITMAP
E0
A0
E0
ENDCHAR
ENDFONT
`.replaceAll('\n', trailingWhitespace + '\n')
		);
		execFileSync(process.execPath, [importer, bdf, 'fixture']);
		const output = join(directory, 'src/fonts/fixture');
		expect(readdirSync(output)).toEqual(['ascii.ts']);
		const source = readFileSync(join(output, 'ascii.ts'), 'utf8');
		const glyphs = JSON.parse(source.slice(source.indexOf('['), source.lastIndexOf(']') + 1)) as string[][];
		expect(glyphs).toHaveLength(256);
		expect(glyphs[65]).toEqual(['     ', ' ### ', ' # # ', ' ### ', '     ', '     ']);
		expect(glyphs[32]).toEqual(Array(6).fill('     '));
	});
	it.each([
		['ISO10646', '1', 233],
		['ibm', '437', 130],
	])('imports an extended character from %s-%s encoding', (registry, encoding, character) => {
		const bdf = join(directory, 'font.bdf');
		writeFileSync(
			bdf,
			`STARTFONT 2.1
FONTBOUNDINGBOX 3 2 0 0
FONT_ASCENT 2
FONT_DESCENT 0
CHARSET_REGISTRY "${registry}"
CHARSET_ENCODING "${encoding}"
CHARS 1
STARTCHAR eacute
ENCODING ${character}
BBX 3 2 0 0
BITMAP
A0
60
ENDCHAR
ENDFONT
`
		);
		execFileSync(process.execPath, [importer, bdf, 'fixture']);
		const source = readFileSync(join(directory, 'src/fonts/fixture/ascii.ts'), 'utf8');
		const glyphs = JSON.parse(source.slice(source.indexOf('['), source.lastIndexOf(']') + 1)) as string[][];
		expect(glyphs[130]).toEqual(['# #', ' ##']);
		expect(glyphs[0]).toEqual(['   ', '   ']);
		expect(glyphs[233]).toEqual(['   ', '   ']);
	});
});
