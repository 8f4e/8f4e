import { describe, expect, it } from 'vitest';
import {
	matchEditorDirectives,
	parseDirectiveLineRecords,
	parseDirectiveRecords,
	serializeDirectiveComments,
} from './utils';

describe('parseDirectiveLineRecords', () => {
	it('parses a full-line editor directive', () => {
		expect(parseDirectiveLineRecords('; @pos 10 20')).toEqual([
			{
				prefix: '@',
				name: 'pos',
				args: ['10', '20'],
				isTrailing: false,
			},
		]);
	});

	it('parses a full-line directive with no arguments', () => {
		expect(parseDirectiveLineRecords('; @disabled')).toEqual([
			{
				prefix: '@',
				name: 'disabled',
				args: [],
				isTrailing: false,
			},
		]);
	});

	it('parses a full-line directive with leading whitespace', () => {
		expect(parseDirectiveLineRecords('   ; @group myGroup')).toEqual([
			{
				prefix: '@',
				name: 'group',
				args: ['myGroup'],
				isTrailing: false,
			},
		]);
	});

	it('parses a trailing inline editor directive', () => {
		expect(parseDirectiveLineRecords('int foo 1 ; @watch')).toEqual([
			{
				prefix: '@',
				name: 'watch',
				args: [],
				isTrailing: true,
			},
		]);
	});

	it('parses a trailing inline directive with arguments', () => {
		expect(parseDirectiveLineRecords('int foo 1 ; @watch value')).toEqual([
			{
				prefix: '@',
				name: 'watch',
				args: ['value'],
				isTrailing: true,
			},
		]);
	});

	it('returns undefined for a plain comment', () => {
		expect(parseDirectiveLineRecords('; this is a plain comment')).toEqual([]);
	});

	it('returns undefined for a non-comment line', () => {
		expect(parseDirectiveLineRecords('push 1')).toEqual([]);
	});

	it('returns undefined for an empty line', () => {
		expect(parseDirectiveLineRecords('')).toEqual([]);
	});

	it('treats a pure directive comment as non-trailing', () => {
		expect(parseDirectiveLineRecords('; @watch')).toEqual([
			{
				prefix: '@',
				name: 'watch',
				args: [],
				isTrailing: false,
			},
		]);
	});

	it('parses multiple full-line directives from one comment line', () => {
		expect(parseDirectiveLineRecords('; @pos 1 2 @favorite')).toEqual([
			{ prefix: '@', name: 'pos', args: ['1', '2'], isTrailing: false },
			{ prefix: '@', name: 'favorite', args: [], isTrailing: false },
		]);
	});

	it('parses multiple trailing directives from one inline comment', () => {
		expect(parseDirectiveLineRecords('int foo 1 ; @watch value @favorite')).toEqual([
			{ prefix: '@', name: 'watch', args: ['value'], isTrailing: true },
			{ prefix: '@', name: 'favorite', args: [], isTrailing: true },
		]);
	});
});

describe('serializeDirectiveComments', () => {
	it('serializes full-line editor directives into canonical source', () => {
		expect(
			serializeDirectiveComments([
				{ name: 'group', args: ['audio', 'nonstick'] },
				{ name: 'favorite', args: [] },
			])
		).toBe('; @group audio nonstick @favorite');
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
