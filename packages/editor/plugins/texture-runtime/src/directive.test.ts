import { expect, it } from 'vitest';
import { parseTextureDirective, parseTextureUploadDirective } from './directive';

it.each([
	['1bit', 10, 2, 4],
	['mono', 3, 2, 6],
	['rgb', 3, 2, 18],
	['rgba', 3, 2, 24],
] as const)('computes the row-aligned upload byte length for %s', (format, width, height, byteLength) => {
	expect(parseTextureUploadDirective(['&screen:pixels', format, String(width), String(height)])).toEqual({
		address: '&screen:pixels',
		format,
		width,
		height,
		byteLength,
	});
});
it('accepts pointer sources and cropped views', () => {
	expect(parseTextureDirective(['pointer', '4'])).toEqual({ address: 'pointer', magnification: 4 });
	expect(parseTextureDirective(['&screen:pixels', '2', '1', '3', '4', '5'])).toEqual({
		address: '&screen:pixels',
		magnification: 2,
		crop: { x: 1, y: 3, width: 4, height: 5 },
	});
	expect(parseTextureUploadDirective(['pointer', 'mono', '2', '2'])?.address).toBe('pointer');
});
it.each([
	'&pixels rgba 2',
	'&pixels unknown 2 2',
	'&pixels rgba 0 2',
	'&pixels rgba 2 -1',
	'&pixels rgba 2 2 extra',
	'&pixels rgba 9007199254740991 2',
])('rejects invalid upload: %s', args => {
	expect(parseTextureUploadDirective(args.split(' '))).toBeUndefined();
});
it.each([
	'&pixels',
	'&pixels 0',
	'&pixels 1.5',
	'&pixels 2 1 2',
	'&pixels 2 -1 0 2 2',
	'&pixels 2 0 0 0 2',
	'&pixels 2 0 0 2 2 extra',
	'pixels[1] 2',
])('rejects invalid view: %s', args => {
	expect(parseTextureDirective(args.split(' '))).toBeUndefined();
});
