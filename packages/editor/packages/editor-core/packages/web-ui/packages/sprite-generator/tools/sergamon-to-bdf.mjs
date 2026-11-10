#!/usr/bin/env node
/** Convert Sergamon's trusted upstream .glyph grids to Unicode BDF without changing their pixels. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [sourceRoot, outputPath] = process.argv.slice(2);
const {
	width,
	height,
	baselineRow: ascent,
} = JSON.parse(readFileSync(join(sourceRoot, 'font-config.json'), 'utf8')).grid;
const descent = height - ascent;
const glyphRoot = join(sourceRoot, 'glyphs');
const glyphs = readdirSync(glyphRoot, { recursive: true })
	.filter(path => path.endsWith('.glyph'))
	.map(path => ({
		codepoint: Number.parseInt(basename(path).match(/^U\+([0-9A-F]+)_/i)[1], 16),
		rows: readFileSync(join(glyphRoot, path), 'utf8')
			.split(/\r?\n/)
			.filter(line => /^[.X]+$/.test(line)),
	}))
	.sort((left, right) => left.codepoint - right.codepoint);
const lines = [
	'STARTFONT 2.1',
	'FONT Sergamon',
	`SIZE ${height} 75 75`,
	`FONTBOUNDINGBOX ${width} ${height} 0 ${-descent}`,
	'STARTPROPERTIES 5',
	`FONT_ASCENT ${ascent}`,
	`FONT_DESCENT ${descent}`,
	'CHARSET_REGISTRY "ISO10646"',
	'CHARSET_ENCODING "1"',
	'COPYRIGHT "Copyright (c) 2024, Sergamon Contributors; SIL OFL 1.1"',
	'ENDPROPERTIES',
	`CHARS ${glyphs.length}`,
];
const paddedWidth = Math.ceil(width / 8) * 8;
for (const { codepoint, rows } of glyphs) {
	lines.push(
		`STARTCHAR uni${codepoint.toString(16).toUpperCase()}`,
		`ENCODING ${codepoint}`,
		'SWIDTH 500 0',
		`DWIDTH ${width} 0`,
		`BBX ${width} ${height} 0 ${-descent}`,
		'BITMAP',
		...rows.map(row =>
			Number.parseInt(row.replaceAll('.', '0').replaceAll('X', '1').padEnd(paddedWidth, '0'), 2)
				.toString(16)
				.padStart(paddedWidth / 4, '0')
				.toUpperCase()
		),
		'ENDCHAR'
	);
}
lines.push('ENDFONT');
writeFileSync(outputPath, lines.join('\n') + '\n');
