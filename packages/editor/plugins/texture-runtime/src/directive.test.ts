import { expect, it } from 'vitest';
import { parseTextureDirective } from './directive';

it.each([
	['1bit', 10, 2, 4],
	['mono', 3, 2, 6],
	['rgb', 3, 2, 18],
	['rgba', 3, 2, 24],
] as const)('computes the row-aligned byte length for %s', (format, width, height, byteLength) => {
	expect(parseTextureDirective(['screen:pixels', format, String(width), String(height), '2'])).toEqual({
		framebuffer: 'screen:pixels',
		format,
		width,
		height,
		byteLength,
		magnification: 2,
	});
});

it.each([
	'pixels rgba 2 2',
	'pixels unknown 2 2 1',
	'pixels rgba 0 2 1',
	'pixels rgba 2 -1 1',
	'pixels rgba 2 2 1.5',
	'pixels rgba 2 2 0',
	'pixels rgba 2 2 1 extra',
	'&pixels rgba 2 2 1',
	'pixels rgba 9007199254740991 2 1',
])('rejects invalid directive arguments: %s', args => {
	expect(parseTextureDirective(args.split(' '))).toBeUndefined();
});
