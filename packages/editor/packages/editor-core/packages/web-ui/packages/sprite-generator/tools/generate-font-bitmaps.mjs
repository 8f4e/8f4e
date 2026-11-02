#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { FONTS } from '../src/fonts/catalog.ts';

const output = new URL('../src/generated/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const [name, { width, height }] of Object.entries(FONTS)) {
	const { default: glyphs } = await import(`../src/fonts/${name}/ascii.ts`);
	const rows = glyphs.flatMap(glyph =>
		glyph.map(row => {
			let bits = 0;
			for (let column = 0; column < width; column++) {
				if (row[column] === '#') bits |= 1 << (width - 1 - column);
			}
			return bits;
		})
	);
	if (glyphs.length !== 128 || glyphs.some(glyph => glyph.length !== height)) {
		throw new Error(`${name} must contain 128 glyphs of height ${height}`);
	}
	const packed = width > 8 ? new Uint16Array(rows) : new Uint8Array(rows);
	const base64 = Buffer.from(packed.buffer).toString('base64');
	writeFileSync(
		new URL(`${name}.ts`, output),
		`// Generated from fonts/${name}/ascii.ts. Do not edit.\nexport default '${base64}';\n`
	);
	console.log(`${name}: ${rows.length} rows, ${base64.length} base64 characters`);
}
