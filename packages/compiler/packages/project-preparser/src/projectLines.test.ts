import { describe, expect, it } from 'vitest';

import { getEntryName, isProjectGapLine, parseGroupHeader } from './projectLines';

describe('getEntryName', () => {
	it('reads the single required name from entry openers', () => {
		expect(getEntryName('entry main', 1)).toBe('main');
	});

	it('rejects missing or extra names', () => {
		expect(() => getEntryName('entry', 4)).toThrow('entry requires exactly one name');
		expect(() => getEntryName('entry main extra', 5)).toThrow('entry requires exactly one name');
	});
});

describe('parseGroupHeader', () => {
	it('reads plain and template-backed group names independently of whitespace and comments', () => {
		expect(parseGroupHeader('group audio', 1)).toEqual({ name: 'audio' });
		expect(parseGroupHeader('group use; comment', 2)).toEqual({ name: 'use' });
		expect(parseGroupHeader('group\toscillator use\tvoice; comment', 3)).toEqual({
			name: 'oscillator',
			template: 'voice',
		});
		expect(parseGroupHeader('group use use use', 4)).toEqual({ name: 'use', template: 'use' });
	});

	it.each(['group', 'group audio nested', 'group audio from voice', 'group audio use voice use other'])(
		'rejects malformed headers: %s',
		header => {
			expect(() => parseGroupHeader(header, 5)).toThrow('expected group NAME or group NAME use TEMPLATE');
		}
	);

	it('validates both names', () => {
		expect(() => parseGroupHeader('group bad/name use voice', 1)).toThrow('invalid group name');
		expect(() => parseGroupHeader('group audio use bad/name', 1)).toThrow('Expected one template name');
		expect(() => parseGroupHeader('group audio use; comment', 1)).toThrow('Expected one template name');
	});
});

describe('isProjectGapLine', () => {
	it('treats blank lines and project comments as gaps between project blocks', () => {
		expect(isProjectGapLine('')).toBe(true);
		expect(isProjectGapLine('# project comment')).toBe(true);
		expect(isProjectGapLine('; project comment')).toBe(true);
		expect(isProjectGapLine('// project comment')).toBe(true);
	});

	it('does not treat code as a project gap', () => {
		expect(isProjectGapLine('module counter')).toBe(false);
		expect(isProjectGapLine('push 1')).toBe(false);
	});
});
