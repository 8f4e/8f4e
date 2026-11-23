import { describe, expect, it } from 'vitest';
import {
	isOrdinaryCommentLine,
	matchEditorDirectives,
	parseDirectiveRecords,
	serializeDirectiveComments,
} from './utils';

describe('parseDirectiveRecords', () => {
	it.each(['; @doc Use @pos for placement.', '; @param value A value marked @watch.', '; @returns @disabled'])(
		'keeps documentation prose out of editor directives: %s',
		line => {
			expect(parseDirectiveRecords([line])).toEqual([]);
			expect(isOrdinaryCommentLine(line)).toBe(false);
		}
	);

	it('does not attach documentation continuations to preceding editor directives', () => {
		expect(parseDirectiveRecords(['; @pos 1 2', '; @doc Description.', '; - Additional text.'])).toEqual([
			{ prefix: '@', name: 'pos', args: ['1', '2'], isTrailing: false, sourceLineIndex: 0, sourceLine: '; @pos 1 2' },
		]);
	});

	it.each([
		{ line: '; @disabled', isTrailing: false },
		{ line: '; @pos 1 2 @disabled', isTrailing: false },
		{ line: 'module sample ; @disabled', isTrailing: true },
		{ line: 'int value 1 ; @watch @disabled', isTrailing: true },
	])('retains source context for disabled directives: $line', ({ line, isTrailing }) => {
		expect(parseDirectiveRecords(['module sample', line]).filter(record => record.name === 'disabled')).toEqual([
			{
				prefix: '@',
				name: 'disabled',
				args: [],
				isTrailing,
				sourceLineIndex: 1,
				sourceLine: line,
			},
		]);
	});

	it.each(['; mention @disabled in prose', 'int value 1 ; mention @disabled in prose'])(
		'leaves prose containing a disabled tag untouched: %s',
		line => {
			expect(parseDirectiveRecords([line])).toEqual([]);
		}
	);
});

describe('serializeDirectiveComments', () => {
	it('serializes full-line editor directives into canonical source', () => {
		expect(
			serializeDirectiveComments([
				{ name: 'group', args: ['audio', 'nonstick'] },
				{ name: 'testDirective', args: [] },
			])
		).toBe('; @group audio nonstick @testDirective');
	});
});

describe('matchEditorDirectives', () => {
	const definitions = [{ name: 'watch', aliases: ['w'] }, { name: 'plot' }];

	it('normalizes aliases without changing cached records or losing source context', () => {
		const records = parseDirectiveRecords(['int value 1 ; @w']);
		expect(matchEditorDirectives(records, definitions)).toEqual([{ ...records[0], name: 'watch' }]);
		expect(records[0].name).toBe('w');
		expect(records[0].isTrailing).toBe(true);
	});

	it.each(['; @plot buffer 4', 'push 1 ; @plot buffer 4'])(
		'accepts standalone and trailing directives uniformly: %s',
		line => {
			const records = parseDirectiveRecords([line]);
			expect(matchEditorDirectives(records, definitions)).toEqual(records);
		}
	);

	it('preserves order, duplicates, chained directives, and continuation arguments', () => {
		const records = parseDirectiveRecords(['; @w first @plot buffer', '; - 4', 'int value 0 ; @w @w second']);
		expect(matchEditorDirectives(records, definitions)).toEqual([
			{ ...records[0], name: 'watch' },
			{ ...records[1], args: ['buffer', '4'] },
			{ ...records[2], name: 'watch' },
			{ ...records[3], name: 'watch' },
		]);
	});

	it('leaves unknown records available for features installed later', () => {
		const records = parseDirectiveRecords(['; @future setting @w value']);
		expect(matchEditorDirectives(records, definitions)).toEqual([{ ...records[1], name: 'watch' }]);
		expect(matchEditorDirectives(records, [{ name: 'future' }])).toEqual([records[0]]);
		expect(records).toHaveLength(2);
	});
});
