import { describe, expect, it } from 'vitest';
import { parseDirectiveLineRecords } from './parseDirectiveLineRecords';

describe('parseDirectiveLineRecords', () => {
	it.each([
		{ line: '; @pos 10 20', name: 'pos', args: ['10', '20'], isTrailing: false },
		{ line: '; @disabled', name: 'disabled', args: [], isTrailing: false },
		{ line: '   ; @group myGroup', name: 'group', args: ['myGroup'], isTrailing: false },
		{ line: 'int foo 1 ; @watch', name: 'watch', args: [], isTrailing: true },
		{ line: 'int foo 1 ; @watch value', name: 'watch', args: ['value'], isTrailing: true },
		{ line: 'module sample ; @disabled', name: 'disabled', args: [], isTrailing: true },
	])('parses a directive: $line', ({ line, name, args, isTrailing }) => {
		expect(parseDirectiveLineRecords(line)).toEqual([{ prefix: '@', name, args, isTrailing }]);
	});

	it('parses multiple full-line directives from one comment line', () => {
		expect(parseDirectiveLineRecords('; @pos 1 2 @disabled')).toEqual([
			{ prefix: '@', name: 'pos', args: ['1', '2'], isTrailing: false },
			{ prefix: '@', name: 'disabled', args: [], isTrailing: false },
		]);
	});

	it('parses multiple trailing directives from one inline comment', () => {
		expect(parseDirectiveLineRecords('int foo 1 ; @watch value @disabled')).toEqual([
			{ prefix: '@', name: 'watch', args: ['value'], isTrailing: true },
			{ prefix: '@', name: 'disabled', args: [], isTrailing: true },
		]);
	});

	it.each([
		'',
		'push 1',
		'; this is a plain comment',
		'; mention @disabled in prose',
		'int foo 1 ; mention @disabled in prose',
		'; @disabled, is not a whole directive token',
		'; - @disabled',
		'; @doc Use @pos for placement.',
		'; @param value A value marked @watch.',
		'; @returns @disabled',
	])('does not mistake ordinary source or documentation for directives: %s', line => {
		expect(parseDirectiveLineRecords(line)).toEqual([]);
	});
});
