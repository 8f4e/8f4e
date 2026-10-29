import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let directory: string;
let importer: string;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), '8f4e-bdf-'));
	mkdirSync(join(directory, 'tools'));
	importer = join(directory, 'tools/import-bdf.mjs');
	copyFileSync(new URL('../tools/import-bdf.mjs', import.meta.url), importer);
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('BDF importer', () => {
	it('imports ASCII characters with their offsets without a fallback glyph source', async () => {
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
`
		);
		execFileSync(process.execPath, [importer, bdf, 'fixture']);
		const output = join(directory, 'src/fonts/fixture');
		expect(readdirSync(output)).toEqual(['ascii.ts']);
		const source = readFileSync(join(output, 'ascii.ts'), 'utf8');
		const glyphs = JSON.parse(source.slice(source.indexOf('['), source.lastIndexOf(']') + 1)) as string[][];
		expect(glyphs).toHaveLength(128);
		expect(glyphs[65]).toEqual(['     ', ' ### ', ' # # ', ' ### ', '     ', '     ']);
		expect(glyphs[32]).toEqual(Array(6).fill('     '));
	});

	it('rejects the obsolete fallback option', () => {
		const result = spawnSync(process.execPath, [importer, 'font.bdf', 'fixture', '--glyphs-from', 'ibmvga8x16'], {
			encoding: 'utf8',
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Usage:');
		expect(readdirSync(directory)).toEqual(['tools']);
	});
});
