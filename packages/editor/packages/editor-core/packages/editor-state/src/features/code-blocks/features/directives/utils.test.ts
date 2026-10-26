import { describe, expect, it } from 'vitest';
import {
	createDirectiveDefinition,
	normalizeEditorDirectiveRecords,
	parseDirectiveComments,
	parseDirectiveLineRecords,
	parseEditorDirectives,
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

describe('parseDirectiveComments', () => {
	it('returns all full-line editor directives in source order', () => {
		expect(parseDirectiveComments('; @pos 1 2 @favorite')).toEqual([
			{ name: 'pos', args: ['1', '2'] },
			{ name: 'favorite', args: [] },
		]);
	});
});

describe('parseEditorDirectives', () => {
	it('appends dash continuation comment arguments to the previous directive', () => {
		const configDefinition = createDirectiveDefinition('config', () => undefined);

		expect(
			parseEditorDirectives(['; @config', '; - webUI.overlay.target', '; - frame:buffer'], [configDefinition])
		).toEqual([
			{
				name: 'config',
				rawRow: 0,
				args: ['webUI.overlay.target', 'frame:buffer'],
				sourceLine: '; @config',
			},
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

describe('normalizeEditorDirectiveRecords', () => {
	const watchDefinition = createDirectiveDefinition('watch', () => undefined, {
		aliases: ['w'],
		allowTrailingComment: true,
	});
	const plotDefinition = createDirectiveDefinition('plot', () => undefined);

	it('normalizes alias to canonical definition name', () => {
		const records = [{ prefix: '@' as const, name: 'w', args: ['value'], rawRow: 0, isTrailing: false }];
		expect(normalizeEditorDirectiveRecords(records, [watchDefinition])).toEqual([
			{ name: 'watch', rawRow: 0, args: ['value'], sourceLine: undefined },
		]);
	});

	it('filters out unknown directive names', () => {
		const records = [{ prefix: '@' as const, name: 'unknown', args: [], rawRow: 0, isTrailing: false }];
		expect(normalizeEditorDirectiveRecords(records, [watchDefinition])).toEqual([]);
	});

	it('allows trailing directives for definitions with allowTrailingComment', () => {
		const records = [{ prefix: '@' as const, name: 'watch', args: [], rawRow: 1, isTrailing: true }];
		expect(normalizeEditorDirectiveRecords(records, [watchDefinition])).toEqual([
			{ name: 'watch', rawRow: 1, args: [], sourceLine: undefined },
		]);
	});

	it('blocks trailing directives for definitions without allowTrailingComment', () => {
		const records = [{ prefix: '@' as const, name: 'plot', args: ['buf'], rawRow: 2, isTrailing: true }];
		expect(normalizeEditorDirectiveRecords(records, [plotDefinition])).toEqual([]);
	});

	it('allows non-trailing directives for definitions without allowTrailingComment', () => {
		const records = [{ prefix: '@' as const, name: 'plot', args: ['buf'], rawRow: 2, isTrailing: false }];
		expect(normalizeEditorDirectiveRecords(records, [plotDefinition])).toEqual([
			{ name: 'plot', rawRow: 2, args: ['buf'], sourceLine: undefined },
		]);
	});
});
