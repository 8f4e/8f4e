import { describe, expect, it } from 'vitest';

import { updateDirectiveArgs, upsertDirective } from './index';

describe('directiveEditing with chained directives', () => {
	it('updateDirectiveArgs only rewrites the targeted directive on the line', () => {
		const code = ['module test', '; @custom audio @testDirective', 'moduleEnd'];

		expect(updateDirectiveArgs(code, 'custom', ([name]) => [name, 'mode'])).toEqual([
			'module test',
			'; @custom audio mode @testDirective',
			'moduleEnd',
		]);
	});

	it('upsertDirective removes prior chained instances before inserting the canonical line', () => {
		const code = ['module test', '; @testDirective @pos 1 2', 'moduleEnd'];

		expect(upsertDirective(code, 'pos', ['3', '4'])).toEqual([
			'module test',
			'; @pos 3 4',
			'; @testDirective',
			'moduleEnd',
		]);
	});
});

describe('upsertDirective without arguments', () => {
	it.each([
		{ code: [], expected: ['; @flag'] },
		{ code: ['module test'], expected: ['module test', '; @flag'] },
	])('supports short source arrays: $code', ({ code, expected }) => {
		expect(upsertDirective(code, 'flag')).toEqual(expected);
	});

	it('canonicalizes a flag while preserving neighboring directives and prose', () => {
		const code = [
			'module test',
			'; @group audio',
			'; a comment mentioning @flag',
			'; @flag',
			'; @watch',
			'output out 1',
			'; @flag',
			'moduleEnd',
		];
		const expected = [
			'module test',
			'; @flag',
			'; @group audio',
			'; a comment mentioning @flag',
			'; @watch',
			'output out 1',
			'moduleEnd',
		];
		expect(upsertDirective(code, 'flag')).toEqual(expected);
		expect(upsertDirective(expected, 'flag')).toEqual(expected);
	});
});
