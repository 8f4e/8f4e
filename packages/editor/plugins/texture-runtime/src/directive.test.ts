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
it('requires view dimensions and defaults the source origin to zero', () => {
	expect(parseTextureDirective(['pointer', '4', '8', '6'])).toEqual({
		address: 'pointer',
		magnification: { x: 4, y: 4 },
		crop: { x: 0, y: 0, width: 8, height: 6 },
	});
	expect(parseTextureDirective(['&screen:pixels', '2', '4', '5', '1', '3'])).toEqual({
		address: '&screen:pixels',
		magnification: { x: 2, y: 2 },
		crop: { x: 1, y: 3, width: 4, height: 5 },
	});
	expect(parseTextureUploadDirective(['pointer', 'mono', '2', '2'])?.address).toBe('pointer');
});
it.each([
	['2:4', 2, 4],
	['4:2', 4, 2],
	['2:2', 2, 2],
] as const)('parses independent magnification factors: %s', (magnification, x, y) => {
	expect(parseTextureDirective(['&screen:pixels', magnification, '4', '5'])).toEqual({
		address: '&screen:pixels',
		magnification: { x, y },
		crop: { x: 0, y: 0, width: 4, height: 5 },
	});
	expect(parseTextureDirective(['pointer', magnification, '4', '5', '1', '3'])).toEqual({
		address: 'pointer',
		magnification: { x, y },
		crop: { x: 1, y: 3, width: 4, height: 5 },
	});
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
	'&pixels 2',
	'&pixels 0 2 2',
	'&pixels 1.5 2 2',
	'&pixels 0:2 2 2',
	'&pixels 2:0 2 2',
	'&pixels -1:2 2 2',
	'&pixels 2:-1 2 2',
	'&pixels 1.5:2 2 2',
	'&pixels 2:1.5 2 2',
	'&pixels :2 2 2',
	'&pixels 2: 2 2',
	'&pixels 2:4:6 2 2',
	'&pixels 2:four 2 2',
	'&pixels 9007199254740992:1 1 1',
	'&pixels 1:9007199254740992 1 1',
	'&pixels 2:1 9007199254740991 1',
	'&pixels 1:2 1 9007199254740991',
	'&pixels 2 0 2',
	'&pixels 2 2 -1',
	'&pixels 2 2 2 -1 0',
	'&pixels 2 2 2 0 -1',
	'&pixels 2 2 2 0',
	'&pixels 2 2 2 0 0 extra',
	'&pixels 2 9007199254740991 2',
	'pixels[1] 2 2 2',
])('rejects invalid view: %s', args => {
	expect(parseTextureDirective(args.split(' '))).toBeUndefined();
});
