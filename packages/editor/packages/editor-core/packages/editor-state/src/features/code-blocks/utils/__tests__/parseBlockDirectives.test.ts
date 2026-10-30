import { describe, expect, it } from 'vitest';

import { parseBlockDirectives } from '../parseBlockDirectives';

describe('parseBlockDirectives', () => {
	it('should return an empty array for code with no directives', () => {
		expect(parseBlockDirectives(['module test', 'push 1', 'moduleEnd'])).toEqual([]);
	});

	it('should parse an editor directive (@)', () => {
		expect(parseBlockDirectives(['; @pos 10 20'])).toEqual([
			{
				prefix: '@',
				name: 'pos',
				args: ['10', '20'],
				sourceLineIndex: 0,
				sourceLine: '; @pos 10 20',
				isTrailing: false,
			},
		]);
	});

	it('should parse unknown editor directive names', () => {
		expect(parseBlockDirectives(['; @custom'])).toEqual([
			{ prefix: '@', name: 'custom', args: [], sourceLineIndex: 0, sourceLine: '; @custom', isTrailing: false },
		]);
	});

	it('should parse directives with no arguments', () => {
		expect(parseBlockDirectives(['; @disabled'])).toEqual([
			{ prefix: '@', name: 'disabled', args: [], sourceLineIndex: 0, sourceLine: '; @disabled', isTrailing: false },
		]);
	});

	it('should record the correct sourceLineIndex for each directive', () => {
		const code = ['module test', '; @pos 5 10', 'push 1', '; @marker', 'moduleEnd'];
		expect(parseBlockDirectives(code)).toEqual([
			{ prefix: '@', name: 'pos', args: ['5', '10'], sourceLineIndex: 1, sourceLine: '; @pos 5 10', isTrailing: false },
			{ prefix: '@', name: 'marker', args: [], sourceLineIndex: 3, sourceLine: '; @marker', isTrailing: false },
		]);
	});

	it('should ignore plain comments', () => {
		expect(parseBlockDirectives(['; this is a plain comment'])).toEqual([]);
	});

	it('should ignore non-comment lines', () => {
		expect(parseBlockDirectives(['push 1', 'pop', 'add'])).toEqual([]);
	});

	it('should parse directives with leading whitespace', () => {
		expect(parseBlockDirectives(['   ; @group myGroup'])).toEqual([
			{
				prefix: '@',
				name: 'group',
				args: ['myGroup'],
				sourceLineIndex: 0,
				sourceLine: '   ; @group myGroup',
				isTrailing: false,
			},
		]);
	});

	it('should parse multiple directives from a block', () => {
		const code = ['; @pos 0 0', '; @disabled', '; @marker'];
		expect(parseBlockDirectives(code)).toEqual([
			{ prefix: '@', name: 'pos', args: ['0', '0'], sourceLineIndex: 0, sourceLine: '; @pos 0 0', isTrailing: false },
			{ prefix: '@', name: 'disabled', args: [], sourceLineIndex: 1, sourceLine: '; @disabled', isTrailing: false },
			{ prefix: '@', name: 'marker', args: [], sourceLineIndex: 2, sourceLine: '; @marker', isTrailing: false },
		]);
	});

	it('should parse trailing inline editor directives', () => {
		expect(parseBlockDirectives(['int foo 1 ; @watch'])).toEqual([
			{ prefix: '@', name: 'watch', args: [], sourceLineIndex: 0, sourceLine: 'int foo 1 ; @watch', isTrailing: true },
		]);
	});

	it('should parse multiple directives from a single comment line', () => {
		expect(parseBlockDirectives(['; @pos 1 2 @marker'])).toEqual([
			{
				prefix: '@',
				name: 'pos',
				args: ['1', '2'],
				sourceLineIndex: 0,
				sourceLine: '; @pos 1 2 @marker',
				isTrailing: false,
			},
			{
				prefix: '@',
				name: 'marker',
				args: [],
				sourceLineIndex: 0,
				sourceLine: '; @pos 1 2 @marker',
				isTrailing: false,
			},
		]);
	});

	it('should append dash continuation comment arguments to the previous directive', () => {
		expect(parseBlockDirectives(['; @config', '; - webUI.overlay.target', '; - frame:buffer'])).toEqual([
			{
				prefix: '@',
				name: 'config',
				args: ['webUI.overlay.target', 'frame:buffer'],
				sourceLineIndex: 0,
				sourceLine: '; @config',
				isTrailing: false,
			},
		]);
	});

	it('should ignore dash continuation comments without a previous directive', () => {
		expect(parseBlockDirectives(['; - orphan', '; @marker'])).toEqual([
			{
				prefix: '@',
				name: 'marker',
				args: [],
				sourceLineIndex: 1,
				sourceLine: '; @marker',
				isTrailing: false,
			},
		]);
	});

	it('should handle an empty code array', () => {
		expect(parseBlockDirectives([])).toEqual([]);
	});
});
